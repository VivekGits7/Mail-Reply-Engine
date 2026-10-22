from datetime import date, timedelta

from app.ai.schemas import ReminderIntent, ReminderReplyResult
from app.common.enums import EmailCategory
from app.engine.daily import run_reminder_tick
from app.engine.inbound import process_email
from tests.conftest import advance_jobs

CSV = "text/csv"


async def rule_id(client, headers, key):
    rules = (await client.get("/api/reminder-rules", headers=headers)).json()["data"]
    return next(rule["reminder_rule_id"] for rule in rules if rule["rule_key"] == key)


async def upload(
    client,
    headers,
    env,
    rule,
    csv_text: str,
    key: str = "uploads/reminder_list/list.csv",
):
    env.storage.preload(key, csv_text.encode(), CSV)
    file = {
        "file_name": "list.csv",
        "file_url": key,
        "mime_type": CSV,
        "size": len(csv_text),
    }
    return await client.post(
        f"/api/reminder-rules/{rule}/uploads", json={"file": file}, headers=headers
    )


async def tick(env):
    await env.conn.execute(
        "UPDATE reminder_rules SET next_run_at = NOW() - INTERVAL '1 minute'"
    )
    return await run_reminder_tick()


TIMESHEETS = "employee_name,employee_email,item\nRahul Sharma,rahul.sharma@tcgdigital.com,Week 42\nPriya Das,priya.das@tcgdigital.com,Week 42\nBroken Row,,Week 42\n"


async def test_seeded_rules_and_rule_validation(client, admin_headers, viewer_headers):
    rules = (await client.get("/api/reminder-rules", headers=viewer_headers)).json()[
        "data"
    ]
    assert {rule["rule_key"] for rule in rules} == {
        "appraisal",
        "leave_approval",
        "timesheet",
        "training",
    }
    base = {
        "name": "Expense",
        "rule_key": "expense",
        "recipient_field": "employee_email",
        "required_columns": ["employee_email"],
        "template_key": "reminder_generic",
        "schedule_cron": "0 10 * * MON",
    }
    assert (
        await client.post(
            "/api/reminder-rules",
            json={**base, "schedule_cron": "not a cron"},
            headers=admin_headers,
        )
    ).status_code == 400
    assert (
        await client.post(
            "/api/reminder-rules",
            json={**base, "template_key": "nope"},
            headers=admin_headers,
        )
    ).status_code == 400
    assert (
        await client.post("/api/reminder-rules", json=base, headers=admin_headers)
    ).status_code == 201
    assert (
        await client.post("/api/reminder-rules", json=base, headers=admin_headers)
    ).status_code == 409
    paused = await client.patch(
        f"/api/reminder-rules/{await rule_id(client, admin_headers, 'expense')}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert paused.json()["data"]["is_active"] is False


async def test_upload_tick_reply_and_reupload(client, admin_headers, env):
    rule = await rule_id(client, admin_headers, "timesheet")
    result = (await upload(client, admin_headers, env, rule, TIMESHEETS)).json()["data"]
    assert result["tasks_created"] == 2 and result["rows_invalid"] == [
        {"row": 4, "reason": "employee_email is missing"}
    ]
    assert await tick(env) == 2
    reminder = env.graph.last_to("rahul.sharma@tcgdigital.com")
    assert (
        reminder["subject"] == "Reminder: please fill your timesheet"
        and "Hi Rahul Sharma" in reminder["body"]
    )

    env.llm.classify_as(EmailCategory.REMINDER_RESPONSE)
    env.llm.on(
        ReminderReplyResult,
        lambda text: ReminderReplyResult(
            intent=ReminderIntent.DONE, return_date=None, confidence=0.95
        ),
    )
    reply = env.graph.add_message(
        from_email="rahul.sharma@tcgdigital.com",
        subject="Re: timesheet",
        body="Done!",
        conversation_id=reminder["conversationId"],
    )
    await process_email({"graph_message_id": reply})
    tasks = (
        await client.get(
            f"/api/reminder-rules/{rule}/tasks?status=done", headers=admin_headers
        )
    ).json()["data"]
    assert [t["owner_email"] for t in tasks] == ["rahul.sharma@tcgdigital.com"]

    again = (
        await upload(
            client,
            admin_headers,
            env,
            rule,
            "employee_name,employee_email,item\nRahul Sharma,rahul.sharma@tcgdigital.com,Week 42\n",
            "uploads/reminder_list/second.csv",
        )
    ).json()["data"]
    assert (
        again["tasks_reopened"] == 1
        and again["tasks_closed"] == 1
        and again["tasks_created"] == 0
    )


async def test_on_leave_pauses_until_the_return_date(client, admin_headers, env):
    rule = await rule_id(client, admin_headers, "timesheet")
    await upload(client, admin_headers, env, rule, TIMESHEETS)
    await tick(env)
    back = (date.today() + timedelta(days=7)).isoformat()
    env.llm.classify_as(EmailCategory.REMINDER_RESPONSE)
    env.llm.on(
        ReminderReplyResult,
        lambda text: ReminderReplyResult(
            intent=ReminderIntent.ON_LEAVE, return_date=back, confidence=0.9
        ),
    )
    reply = env.graph.add_message(
        from_email="priya.das@tcgdigital.com",
        subject="Re: timesheet",
        body="On leave till next week",
    )
    await process_email({"graph_message_id": reply})
    tasks = (
        await client.get(
            f"/api/reminder-rules/{rule}/tasks?status=paused", headers=admin_headers
        )
    ).json()["data"]
    assert tasks[0]["paused_until"].startswith(back) and tasks[0][
        "next_followup_at"
    ].startswith(back)


async def test_question_reply_goes_to_the_approval_queue(client, admin_headers, env):
    rule = await rule_id(client, admin_headers, "timesheet")
    await upload(client, admin_headers, env, rule, TIMESHEETS)
    await tick(env)
    env.llm.classify_as(EmailCategory.REMINDER_RESPONSE)
    env.llm.on(
        ReminderReplyResult,
        lambda text: ReminderReplyResult(
            intent=ReminderIntent.QUESTION, return_date=None, confidence=0.9
        ),
    )
    reply = env.graph.add_message(
        from_email="priya.das@tcgdigital.com",
        from_name="Priya Das",
        subject="Re: timesheet",
        body="Which project code do I use?",
    )
    await process_email({"graph_message_id": reply})
    approvals = (await client.get("/api/approvals", headers=admin_headers)).json()[
        "data"
    ]
    assert approvals and approvals[0]["approval_type"] == "reply"


async def test_unanswered_reminders_escalate_once(client, admin_headers, env):
    rule = await rule_id(client, admin_headers, "timesheet")
    await client.patch(
        f"/api/reminder-rules/{rule}",
        json={"max_rounds": 1, "escalate_to_email": "hr@tcgdigital.com"},
        headers=admin_headers,
    )
    await upload(
        client,
        admin_headers,
        env,
        rule,
        "employee_name,employee_email,item\nRahul Sharma,rahul.sharma@tcgdigital.com,Week 42\n",
    )
    await tick(env)
    await advance_jobs(env.conn, timedelta(days=3))
    await advance_jobs(env.conn, timedelta(days=3))
    escalation = env.graph.last_to("hr@tcgdigital.com")
    assert escalation["subject"] == "Still pending: Timesheet for Rahul Sharma"
    sent_before = len(env.graph.sent)
    await advance_jobs(env.conn, timedelta(days=10))
    assert len(env.graph.sent) == sent_before


async def test_appraisal_stage_reminds_the_right_person_and_informs_performance(
    client, admin_headers, env
):
    rule = await rule_id(client, admin_headers, "appraisal")
    csv_text = "employee_name,employee_email,manager_email,manager_name,reviewer_email,stage,due_date\nRahul Sharma,rahul.sharma@tcgdigital.com,amit.roy@tcgdigital.com,Amit Roy,neha@tcgdigital.com,manager_review,2026-11-30\n"
    result = (await upload(client, admin_headers, env, rule, csv_text)).json()["data"]
    assert result["tasks_created"] == 1
    assert (
        env.graph.last_to("performance@tcgdigital.com")["subject"]
        == "Appraisal update: Rahul Sharma at manager review"
    )
    await tick(env)
    manager = env.graph.last_to("amit.roy@tcgdigital.com")
    assert (
        manager["subject"] == "Appraisal feedback due for Rahul Sharma"
        and "Hi Amit Roy" in manager["body"]
    )
    bad = await upload(
        client,
        admin_headers,
        env,
        rule,
        "employee_name\nX\n",
        "uploads/reminder_list/bad.csv",
    )
    assert bad.status_code == 400
