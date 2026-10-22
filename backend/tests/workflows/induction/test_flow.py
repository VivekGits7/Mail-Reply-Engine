from datetime import datetime, timedelta

from app.ai.schemas import AvailabilityResult, TimeSlot
from app.common.enums import EmailCategory
from app.engine.inbound import process_email
from tests.conftest import advance_jobs
from tests.factories import create_joiner


async def planned(client, headers, env):
    joiner = await create_joiner(client, headers)
    response = await client.post(
        f"/api/cases/{joiner['case_id']}/induction", json={}, headers=headers
    )
    assert response.status_code == 202, response.text
    data = response.json()["data"]
    approvals = (
        await client.get(
            f"/api/approvals?case_id={data['induction_case_id']}", headers=headers
        )
    ).json()["data"]
    return joiner, data, approvals[0]["approval_id"]


async def test_plan_builds_a_valid_draft_without_ai(client, admin_headers, env):
    joiner, data, approval_id = await planned(client, admin_headers, env)
    assert data["track"] == "mid" and data["stage"] == "awaiting_approval"
    detail = (
        await client.get(f"/api/approvals/{approval_id}", headers=admin_headers)
    ).json()["data"]
    sessions = detail["draft"]["sessions"]
    assert [s["title"] for s in sessions][:3] == [
        "HR orientation",
        "IT orientation",
        "Meet your manager",
    ]
    for session in sessions:
        start = datetime.fromisoformat(session["start"])
        assert start.weekday() < 5 and 10 <= start.hour < 18
    again = await client.post(
        f"/api/cases/{joiner['case_id']}/induction", json={}, headers=admin_headers
    )
    assert again.status_code == 409


async def test_editing_a_session_onto_a_weekend_is_rejected(client, admin_headers, env):
    _, _, approval_id = await planned(client, admin_headers, env)
    detail = (
        await client.get(f"/api/approvals/{approval_id}", headers=admin_headers)
    ).json()["data"]
    sessions = detail["draft"]["sessions"]
    start = datetime.fromisoformat(sessions[0]["start"])
    saturday = start + timedelta(days=(5 - start.weekday()) % 7)
    sessions[0] = {
        **sessions[0],
        "start": saturday.isoformat(),
        "end": (saturday + timedelta(hours=1)).isoformat(),
    }
    response = await client.patch(
        f"/api/approvals/{approval_id}",
        json={"draft": {"sessions": sessions}},
        headers=admin_headers,
    )
    assert response.status_code == 400


async def test_approved_schedule_books_sessions_and_sends_the_welcome(
    client, admin_headers, env
):
    joiner, data, approval_id = await planned(client, admin_headers, env)
    approved = await client.post(
        f"/api/approvals/{approval_id}/approve",
        json={"draft": None},
        headers=admin_headers,
    )
    assert approved.json()["data"]["sessions_created"] == 4
    ask = env.graph.last_to("it@tcgdigital.com")
    assert ask["subject"] == "Induction session for Rahul Sharma: IT orientation"

    env.llm.classify_as(EmailCategory.AVAILABILITY_REPLY)
    env.llm.on(
        AvailabilityResult,
        lambda text: AvailabilityResult(
            accepts_proposed=True, alternatives=[], confidence=0.95
        ),
    )
    reply = env.graph.add_message(
        from_email="it@tcgdigital.com",
        subject=f"Re: {ask['subject']}",
        body="Works for me",
        conversation_id=ask["conversationId"],
    )
    await process_email({"graph_message_id": reply})
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    booked = [s for s in case["sessions"] if s["status"] == "booked"]
    assert (
        len(booked) == 1
        and env.graph.events[-1]["subject"] == "Induction: IT orientation"
    )
    attendees = {
        a["emailAddress"]["address"] for a in env.graph.events[-1]["attendees"]
    }
    assert attendees == {"it@tcgdigital.com", "rahul.sharma@gmail.com"}

    await advance_jobs(env.conn, timedelta(days=40))
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert "appointment_letter_missing" in case["case"]["flags"]
    assert not [
        m
        for m in env.graph.to("rahul.sharma@gmail.com")
        if m["subject"].startswith("Welcome")
    ]

    env.storage.preload(
        "uploads/appointment_letter/letter.pdf", b"%PDF letter", "application/pdf"
    )
    env.storage.preload(
        "uploads/statement_of_understanding/sou.pdf", b"%PDF sou", "application/pdf"
    )
    letter = await client.post(
        f"/api/cases/{joiner['case_id']}/appointment-letter",
        json={
            "file_name": "appointment.pdf",
            "file_url": "uploads/appointment_letter/letter.pdf",
            "mime_type": "application/pdf",
            "size": 11,
        },
        headers=admin_headers,
    )
    assert letter.status_code == 201
    sou = await client.post(
        "/api/admin/statement-of-understanding",
        json={
            "file_name": "sou.pdf",
            "file_url": "uploads/statement_of_understanding/sou.pdf",
            "mime_type": "application/pdf",
            "size": 8,
        },
        headers=admin_headers,
    )
    assert sou.status_code == 200
    await advance_jobs(env.conn, timedelta(days=40))
    welcome = [
        m
        for m in env.graph.to("rahul.sharma@gmail.com")
        if m["subject"].startswith("Welcome")
    ][-1]
    assert {a["name"] for a in welcome["attachments"]} == {"appointment.pdf", "sou.pdf"}
    assert "IT orientation" in welcome["body"] and "Amit Roy" in welcome["body"]
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert (
        case["case"]["stage"] == "welcome_sent" and case["case"]["status"] == "closed"
    )


async def test_busy_owner_is_flagged_and_hr_can_force_book(client, admin_headers, env):
    _, data, approval_id = await planned(client, admin_headers, env)
    await client.post(
        f"/api/approvals/{approval_id}/approve", json={}, headers=admin_headers
    )
    ask = env.graph.last_to("it@tcgdigital.com")
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    session = next(
        s for s in case["sessions"] if s["owner_email"] == "it@tcgdigital.com"
    )
    env.graph.busy["it@tcgdigital.com"] = [
        {
            "status": "busy",
            "start": {"dateTime": "2000-01-01T00:00:00"},
            "end": {"dateTime": "2100-01-01T00:00:00"},
        }
    ]
    alternative = datetime.fromisoformat(session["proposed_start"]) + timedelta(days=1)
    env.llm.classify_as(EmailCategory.AVAILABILITY_REPLY)
    env.llm.on(
        AvailabilityResult,
        lambda text: AvailabilityResult(
            accepts_proposed=False,
            alternatives=[
                TimeSlot(
                    start=alternative.isoformat(),
                    end=(alternative + timedelta(hours=1)).isoformat(),
                )
            ],
            confidence=0.9,
        ),
    )
    reply = env.graph.add_message(
        from_email="it@tcgdigital.com",
        subject="Re: induction",
        body="Can we do the next day?",
        conversation_id=ask["conversationId"],
    )
    await process_email({"graph_message_id": reply})
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert "calendar_conflict" in case["case"]["flags"]
    blocked = await client.post(
        f"/api/induction-sessions/{session['induction_session_id']}/book",
        json={
            "start": alternative.isoformat(),
            "end": (alternative + timedelta(hours=1)).isoformat(),
        },
        headers=admin_headers,
    )
    assert blocked.status_code == 409
    forced = await client.post(
        f"/api/induction-sessions/{session['induction_session_id']}/book",
        json={
            "start": alternative.isoformat(),
            "end": (alternative + timedelta(hours=1)).isoformat(),
            "force": True,
        },
        headers=admin_headers,
    )
    assert forced.status_code == 200 and forced.json()["data"]["status"] == "booked"


async def test_owner_who_never_replies_is_flagged_after_two_follow_ups(
    client, admin_headers, env
):
    _, data, approval_id = await planned(client, admin_headers, env)
    await client.post(
        f"/api/approvals/{approval_id}/approve", json={}, headers=admin_headers
    )
    for _ in range(3):
        await advance_jobs(env.conn, timedelta(days=4))
    followups = [m for m in env.graph.to("it@tcgdigital.com") if m["reply_to"]]
    assert len(followups) == 2
    alerts = [
        m
        for m in env.graph.to("hr@tcgdigital.com")
        if m["subject"].startswith("No reply")
    ]
    assert alerts
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert "induction_no_reply" in case["case"]["flags"]


async def test_rejecting_the_schedule_cancels_the_induction(client, admin_headers, env):
    joiner, data, approval_id = await planned(client, admin_headers, env)
    rejected = await client.post(
        f"/api/approvals/{approval_id}/reject",
        json={"reason": "Will plan by hand"},
        headers=admin_headers,
    )
    assert rejected.status_code == 200
    case = (
        await client.get(
            f"/api/cases/{data['induction_case_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert case["case"]["status"] == "cancelled"
    assert (
        await client.post(
            f"/api/approvals/{approval_id}/approve", json={}, headers=admin_headers
        )
    ).status_code == 409
    replanned = await client.post(
        f"/api/cases/{joiner['case_id']}/induction",
        json={"track": "senior"},
        headers=admin_headers,
    )
    assert (
        replanned.status_code == 202 and replanned.json()["data"]["track"] == "senior"
    )
