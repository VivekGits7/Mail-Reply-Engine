import uuid

from app.common.enums import EmailCategory
from app.engine.inbound import process_email
from tests.factories import create_joiner


async def reply_to_request(env, request_mail, body: str, category: EmailCategory):
    env.llm.classify_as(category, confidence=0.5)
    message_id = env.graph.add_message(
        from_email="recruiter@tcgdigital.com",
        subject=f"Re: {request_mail['subject']}",
        body=body,
        conversation_id=request_mail["conversationId"],
    )
    await process_email({"graph_message_id": message_id})


async def test_person_threads_show_sent_and_received_mail_but_never_complaints(
    client, admin_headers, viewer_headers, env
):
    joiner = await create_joiner(client, admin_headers)
    request_mail = env.graph.last_to("recruiter@tcgdigital.com")
    await reply_to_request(
        env,
        request_mail,
        "The degree certificate will come tomorrow.",
        EmailCategory.QUERY,
    )
    env.llm.classify_as(EmailCategory.COMPLAINT)
    complaint = env.graph.add_message(
        from_email="recruiter@tcgdigital.com",
        subject=f"Re: {request_mail['subject']}",
        body="I want to raise a complaint about my manager.",
        conversation_id=request_mail["conversationId"],
    )
    await process_email({"graph_message_id": complaint})

    response = await client.get(
        f"/api/cases/{joiner['case_id']}/emails", headers=viewer_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    thread = body["data"][0]
    messages = thread["messages"]
    assert sorted(m["direction"] for m in messages) == ["inbound", "outbound"]
    assert [m["at"] for m in messages] == sorted(m["at"] for m in messages)
    assert thread["message_count"] == 2 and thread["last_at"] == messages[-1]["at"]
    sent = next(m for m in messages if m["direction"] == "outbound")
    received = next(m for m in messages if m["direction"] == "inbound")
    assert sent["to"] == ["recruiter@tcgdigital.com"]
    assert sent["is_automatic"] and sent["case_type"] == "onboarding"
    assert received["body"] == "The degree certificate will come tomorrow."
    assert not any("complaint" in (m["body"] or "") for m in messages)

    inbound = await client.get(
        f"/api/cases/{joiner['case_id']}/emails?direction=inbound&search=degree",
        headers=viewer_headers,
    )
    assert [m["direction"] for m in inbound.json()["data"][0]["messages"]] == [
        "inbound"
    ]
    nothing = await client.get(
        f"/api/cases/{joiner['case_id']}/emails?search=salary", headers=viewer_headers
    )
    assert nothing.json()["total"] == 0


async def test_thread_errors(client, admin_headers):
    assert (
        await client.get("/api/cases/not-a-uuid/emails", headers=admin_headers)
    ).status_code == 400
    assert (
        await client.get(f"/api/cases/{uuid.uuid4()}/emails", headers=admin_headers)
    ).status_code == 404
    assert (await client.get(f"/api/cases/{uuid.uuid4()}/emails")).status_code == 401
