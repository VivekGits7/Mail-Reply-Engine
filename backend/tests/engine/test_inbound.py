import pytest

from app.ai.schemas import DraftReply
from app.common.enums import EmailCategory
from app.engine.inbound import process_email
from app.mail import Email
from app.worker import PermanentEventError
from tests.factories import create_joiner


async def test_same_message_is_processed_once(env):
    env.llm.classify_as(EmailCategory.QUERY)
    message_id = env.graph.add_message(
        from_email="rahul.sharma@gmail.com",
        subject="Joining date",
        body="Can I join a week later?",
    )
    await process_email({"graph_message_id": message_id})
    await process_email({"graph_message_id": message_id})
    assert await env.conn.fetchval("SELECT COUNT(*) FROM approvals") == 1


async def test_auto_replies_are_filtered_without_any_ai_call(env):
    message_id = env.graph.add_message(
        from_email="rahul.sharma@gmail.com",
        subject="Automatic reply: Away",
        body="I am out of office",
        headers={"Auto-Submitted": "auto-replied"},
    )
    await process_email({"graph_message_id": message_id})
    stored = await Email.find_by_graph_id(message_id)
    assert (
        stored.processing_status == "filtered"
        and stored.filter_reason == "auto_reply"
        and env.llm.requests == []
    )


async def test_low_confidence_email_is_logged_quietly_on_the_case_timeline(
    client, admin_headers, env
):
    joiner = await create_joiner(client, admin_headers)
    env.llm.classify_as(EmailCategory.QUERY, confidence=0.5)
    request_mail = env.graph.last_to("recruiter@tcgdigital.com")
    message_id = env.graph.add_message(
        from_email="recruiter@tcgdigital.com",
        subject="Re: docs",
        body="hmm",
        conversation_id=request_mail["conversationId"],
    )
    sent_before = len(env.graph.sent)
    await process_email({"graph_message_id": message_id})
    stored = await Email.find_by_graph_id(message_id)
    assert (
        stored.processing_status == "unmatched"
        and str(stored.case_id) == joiner["case_id"]
    )
    assert (
        len(env.graph.sent) == sent_before
        and await env.conn.fetchval("SELECT COUNT(*) FROM approvals") == 0
    )
    case = (
        await client.get(f"/api/cases/{joiner['case_id']}", headers=admin_headers)
    ).json()["data"]
    assert any(
        entry.get("email_id") == str(stored.email_id) for entry in case["timeline"]
    )


async def test_query_is_drafted_approved_and_sent_in_the_same_thread(
    client, admin_headers, env
):
    env.llm.classify_as(EmailCategory.QUERY)
    env.llm.on(
        DraftReply,
        lambda text: DraftReply(
            subject="Re: Joining date",
            body="Hi {{ recipient_name }},\n\nHR will confirm by Friday.\n\nHR Team",
            confidence=0.8,
        ),
    )
    message_id = env.graph.add_message(
        from_email="rahul.sharma@gmail.com",
        from_name="Rahul Sharma",
        subject="Joining date",
        body="Can I join on 23 Nov instead?",
    )
    await process_email({"graph_message_id": message_id})
    approval = (await client.get("/api/approvals", headers=admin_headers)).json()[
        "data"
    ][0]
    detail = (
        await client.get(
            f"/api/approvals/{approval['approval_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert (
        detail["draft"]["body"].startswith("Hi Rahul,")
        and detail["source_email"]["body"] == "Can I join on 23 Nov instead?"
    )
    assert env.graph.sent == []
    edited = await client.patch(
        f"/api/approvals/{approval['approval_id']}",
        json={"draft": {"body": "Hi Rahul,\n\nYes, 23 Nov works.\n\nHR Team"}},
        headers=admin_headers,
    )
    assert edited.status_code == 200
    approved = await client.post(
        f"/api/approvals/{approval['approval_id']}/approve",
        json={},
        headers=admin_headers,
    )
    assert approved.json()["data"]["email_id"]
    reply = env.graph.last_to("rahul.sharma@gmail.com")
    assert reply["reply_to"] == message_id and "23 Nov works" in reply["body"]
    final = (
        await client.get(
            f"/api/approvals/{approval['approval_id']}", headers=admin_headers
        )
    ).json()["data"]
    assert final["status"] == "sent"


async def test_rejected_draft_sends_nothing(client, admin_headers, env):
    env.llm.classify_as(EmailCategory.QUERY)
    message_id = env.graph.add_message(
        from_email="rahul.sharma@gmail.com", subject="Question", body="Which documents?"
    )
    await process_email({"graph_message_id": message_id})
    approval = (await client.get("/api/approvals", headers=admin_headers)).json()[
        "data"
    ][0]
    rejected = await client.post(
        f"/api/approvals/{approval['approval_id']}/reject",
        json={"reason": "Will call"},
        headers=admin_headers,
    )
    assert rejected.status_code == 200 and env.graph.sent == []
    assert (
        await client.post(
            f"/api/approvals/{approval['approval_id']}/reject",
            json={"reason": "again"},
            headers=admin_headers,
        )
    ).status_code == 409


async def test_pii_left_after_masking_blocks_the_ai_call(env, monkeypatch):
    from app.ai import service as ai_service
    from app.privacy.masking import MaskResult

    monkeypatch.setattr(
        ai_service, "mask_text", lambda text, names=None: MaskResult(text=text)
    )
    message_id = env.graph.add_message(
        from_email="x@gmail.com", subject="PAN ABCDE1234F", body="My PAN is ABCDE1234F"
    )
    with pytest.raises(PermanentEventError):
        await process_email({"graph_message_id": message_id})
    assert env.llm.requests == []
    assert (await Email.find_by_graph_id(message_id)).processing_status == "failed"


async def test_case_view_404_and_bad_id(client, admin_headers):
    assert (
        await client.get(
            "/api/cases/0b7c4f2e-0000-4000-8000-000000000000", headers=admin_headers
        )
    ).status_code == 404
    assert (
        await client.get("/api/cases/nope", headers=admin_headers)
    ).status_code == 400


async def test_webhook_to_reply_end_to_end(client, admin_headers, env):
    from app.config import settings

    env.llm.classify_as(EmailCategory.QUERY)
    message_id = env.graph.add_message(
        from_email="candidate@gmail.com", subject="Hi", body="Is there parking?"
    )
    body = {
        "value": [
            {
                "clientState": settings.GRAPH_CLIENT_STATE,
                "resourceData": {"id": message_id},
            }
        ]
    }
    assert (await client.post("/api/graph/notifications", json=body)).status_code == 202
    assert (await client.get("/api/approvals", headers=admin_headers)).json()[
        "total"
    ] == 1
