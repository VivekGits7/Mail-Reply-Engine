from app.common.enums import EmailCategory
from app.engine.inbound import process_email
from app.mail import Email


async def complaint(env, sender="employee@tcgdigital.com"):
    env.llm.classify_as(EmailCategory.COMPLAINT)
    message_id = env.graph.add_message(
        from_email=sender,
        subject="Concern about my team",
        body="My manager shouted at me in the meeting.",
    )
    await process_email({"graph_message_id": message_id})
    return message_id


async def test_complaint_is_stored_restricted_never_replied_and_hr_alerted_neutrally(
    client, restricted_headers, env
):
    message_id = await complaint(env)
    assert not env.graph.to("employee@tcgdigital.com")
    alert = env.graph.last_to("complaints@tcgdigital.com")
    assert (
        alert["subject"] == "New item in the restricted queue"
        and "shouted" not in alert["body"]
        and "Concern" not in alert["body"]
    )
    stored = await Email.find_by_graph_id(message_id)
    assert (
        stored.is_restricted
        and stored.body_text is None
        and stored.subject is None
        and stored.case_id is None
    )
    listed = (await client.get("/api/complaints", headers=restricted_headers)).json()[
        "data"
    ]
    assert listed[0]["subject"] == "Concern about my team"
    detail = (
        await client.get(
            f"/api/complaints/{listed[0]['complaint_id']}", headers=restricted_headers
        )
    ).json()["data"]
    assert "shouted" in detail["content"]
    views = await env.conn.fetchval(
        "SELECT COUNT(*) FROM action_log WHERE action = 'complaint_viewed'"
    )
    assert views == 1


async def test_restricted_area_needs_complaints_access(client, admin_headers, env):
    await complaint(env)
    assert (
        await client.get("/api/complaints", headers=admin_headers)
    ).status_code == 403


async def test_transcript_upload(client, restricted_headers, env):
    env.storage.preload(
        "uploads/transcript/notes.txt", b"HR connect notes", "text/plain"
    )
    file = {
        "file_name": "notes.txt",
        "file_url": "uploads/transcript/notes.txt",
        "mime_type": "text/plain",
        "size": 16,
    }
    stored = await client.post(
        "/api/complaints/uploads",
        json={"source": "hr_connect", "file": file},
        headers=restricted_headers,
    )
    assert stored.status_code == 201
    wrong = await client.post(
        "/api/complaints/uploads",
        json={
            "source": "hr_connect",
            "file": {**file, "file_url": "uploads/reminder_list/x.txt"},
        },
        headers=restricted_headers,
    )
    assert wrong.status_code == 400
    listed = (
        await client.get(
            "/api/complaints?source=hr_connect", headers=restricted_headers
        )
    ).json()
    assert listed["total"] == 1
