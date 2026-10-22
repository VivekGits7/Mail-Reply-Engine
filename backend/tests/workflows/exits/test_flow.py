from datetime import date, timedelta

from app.ai.schemas import ClearanceItem, ClearanceResult, ClearanceState
from app.common.enums import EmailCategory
from app.engine.inbound import process_email
from tests.conftest import advance_jobs

EXIT = {
    "full_name": "Rahul Sharma",
    "employee_code": "32999",
    "work_email": "rahul.sharma@tcgdigital.com",
    "manager_name": "Amit Roy",
    "manager_email": "amit.roy@tcgdigital.com",
    "last_working_day": (date.today() + timedelta(days=10)).isoformat(),
}


async def create_exit(client, headers):
    response = await client.post("/api/exits", json=EXIT, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def clearance_reply(
    env, sender: str, team: str, status: ClearanceState, items=None, blocker=None
):
    intimation = env.graph.last_to("offboarding@tcgdigital.com")
    env.llm.classify_as(EmailCategory.CLEARANCE_UPDATE, team=team)
    env.llm.on(
        ClearanceResult,
        lambda text: ClearanceResult(
            team=team,
            status=status,
            items=items or [],
            blocker=blocker,
            confidence=0.95,
        ),
    )
    message_id = env.graph.add_message(
        from_email=sender,
        subject=f"Re: {intimation['subject']}",
        body="Update on clearance",
        conversation_id=intimation["conversationId"],
    )
    await process_email({"graph_message_id": message_id})


async def clearances(client, headers, case_id):
    case = (await client.get(f"/api/cases/{case_id}", headers=headers)).json()["data"]
    return case, {t["owner_role"]: t for t in case["tasks"]}


async def test_exit_runs_from_intimation_to_release(client, admin_headers, env):
    data = await create_exit(client, admin_headers)
    intimation = env.graph.last_to("offboarding@tcgdigital.com")
    assert (
        intimation["subject"].startswith("Offboarding : Rahul Sharma")
        and "amit.roy@tcgdigital.com" in intimation["to"]
    )
    assert "32999" in intimation["body"] and len(data["tasks"]) == 4

    await clearance_reply(
        env,
        "it@tcgdigital.com",
        "it",
        ClearanceState.PARTIAL,
        items=[
            ClearanceItem(item="credentials", status=ClearanceState.DONE),
            ClearanceItem(item="laptop", status=ClearanceState.PENDING),
        ],
    )
    case, tasks = await clearances(client, admin_headers, data["case_id"])
    assert tasks["it"]["status"] == "partial" and tasks["it"]["sub_items"] == {
        "credentials": "done",
        "laptop": "pending",
    }
    assert case["case"]["stage"] == "clearances_in_progress"

    await advance_jobs(env.conn, timedelta(days=1, hours=1))
    finance = env.graph.last_to("finance@tcgdigital.com")
    assert (
        finance["subject"].startswith("RE: Offboarding : Rahul Sharma")
        and finance["reply_to"]
    )
    assert not any(mail["reply_to"] for mail in env.graph.to("admin@tcgdigital.com"))

    await clearance_reply(env, "finance@tcgdigital.com", "finance", ClearanceState.DONE)
    for role in ("admin", "manager"):
        response = await client.patch(
            f"/api/tasks/{tasks[role]['task_id']}",
            json={"status": "done", "note": "Cleared over Teams"},
            headers=admin_headers,
        )
        assert response.status_code == 200
    early = await client.post(
        f"/api/cases/{data['case_id']}/release-confirm", json={}, headers=admin_headers
    )
    assert early.status_code == 409
    await clearance_reply(env, "it@tcgdigital.com", "it", ClearanceState.DONE)

    cleared = env.graph.last_to("hr@tcgdigital.com")
    assert (
        cleared["subject"] == "All clearances complete: Rahul Sharma"
        and "can now be issued" in cleared["body"]
    )
    released = await client.post(
        f"/api/cases/{data['case_id']}/release-confirm",
        json={"note": "Issued"},
        headers=admin_headers,
    )
    assert released.json()["data"]["stage"] == "closed"
    case, _ = await clearances(client, admin_headers, data["case_id"])
    assert case["person"]["status"] == "exited"


async def test_blocked_clearance_alerts_hr_and_stops_chasing(
    client, admin_headers, env
):
    data = await create_exit(client, admin_headers)
    await clearance_reply(
        env,
        "it@tcgdigital.com",
        "it",
        ClearanceState.BLOCKED,
        blocker="Laptop returned damaged",
    )
    alert = env.graph.last_to("hr@tcgdigital.com")
    assert "blocked" in alert["subject"] and "Laptop returned damaged" in alert["body"]
    _, tasks = await clearances(client, admin_headers, data["case_id"])
    assert (
        tasks["it"]["status"] == "blocked" and tasks["it"]["next_followup_at"] is None
    )


async def test_unanswered_team_is_escalated_once(client, admin_headers, env):
    await create_exit(client, admin_headers)
    for _ in range(4):
        await advance_jobs(env.conn, timedelta(days=3))
    escalations = [
        m for m in env.graph.to("hr@tcgdigital.com") if "still pending" in m["subject"]
    ]
    assert {m["subject"].split(" clearance")[0] for m in escalations} == {
        "IT",
        "Finance",
        "Admin",
        "Manager",
    }
    sent_before = len(env.graph.sent)
    await advance_jobs(env.conn, timedelta(days=10))
    assert len(env.graph.sent) == sent_before


async def test_exit_conflicts_and_listing(client, admin_headers, viewer_headers, env):
    data = await create_exit(client, admin_headers)
    assert (
        await client.post(
            "/api/exits",
            json={**EXIT, "person_id": data["person"]["person_id"]},
            headers=admin_headers,
        )
    ).status_code == 409
    assert (
        await client.post(
            "/api/exits", json={"last_working_day": "2026-12-01"}, headers=admin_headers
        )
    ).status_code == 422
    listed = await client.get(
        "/api/exits?pending_team=finance&search=32999", headers=viewer_headers
    )
    assert (
        listed.json()["total"] == 1
        and listed.json()["data"][0]["clearances"]["finance"] == "open"
    )


async def test_low_confidence_clearance_reply_flags_hr(client, admin_headers, env):
    data = await create_exit(client, admin_headers)
    intimation = env.graph.last_to("offboarding@tcgdigital.com")
    env.llm.classify_as(EmailCategory.CLEARANCE_UPDATE)
    env.llm.on(
        ClearanceResult,
        lambda text: ClearanceResult(
            team=None,
            status=ClearanceState.PENDING,
            items=[],
            blocker=None,
            confidence=0.3,
        ),
    )
    message_id = env.graph.add_message(
        from_email="random@tcgdigital.com",
        subject="Re: exit",
        body="Not sure",
        conversation_id=intimation["conversationId"],
    )
    await process_email({"graph_message_id": message_id})
    case, _ = await clearances(client, admin_headers, data["case_id"])
    assert "needs_hr" in case["case"]["flags"]
