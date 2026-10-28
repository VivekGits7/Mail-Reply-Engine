import uuid
from datetime import date, timedelta

from app.ai import schemas as ai_schemas
from app.common.enums import EmailCategory
from app.engine.inbound import process_email
from app.llm.guard import find_pii
from app.mail import Email
from tests.conftest import advance_jobs, configure_runtime, make_pdf, make_png
from tests.factories import (
    aadhaar_text,
    certificate_text,
    create_joiner,
    joiner_payload,
    pan_text,
    sign_off_payload,
    smart_identify,
)

RECRUITER = "recruiter@tcgdigital.com"
CANDIDATE = "rahul.sharma@gmail.com"


def full_document_set(name: str = "Rahul Sharma"):
    return [
        {
            "name": "pan.pdf",
            "content_type": "application/pdf",
            "data": make_pdf(pan_text(name=name)),
        },
        {
            "name": "aadhaar.pdf",
            "content_type": "application/pdf",
            "data": make_pdf(aadhaar_text(name=name)),
        },
        {
            "name": "class10.pdf",
            "content_type": "application/pdf",
            "data": make_pdf(certificate_text("class_10_certificate", name)),
        },
        {
            "name": "class12.pdf",
            "content_type": "application/pdf",
            "data": make_pdf(certificate_text("class_12_certificate", name)),
        },
        {
            "name": "degree.pdf",
            "content_type": "application/pdf",
            "data": make_pdf(certificate_text("degree_certificate", name)),
        },
        {
            "name": "relieving.pdf",
            "content_type": "application/pdf",
            "data": make_pdf(certificate_text("relieving_letter", name)),
        },
        {"name": "photo.png", "content_type": "image/png", "data": make_png()},
        {
            "name": "logo.png",
            "content_type": "image/png",
            "data": make_png(),
            "inline": True,
        },
    ]


async def send_documents(env, files, sender=RECRUITER, candidate="Rahul Sharma"):
    request_mail = next(
        mail
        for mail in reversed(env.graph.to(RECRUITER))
        if candidate in mail["subject"]
    )
    env.llm.classify_as(EmailCategory.DOC_SUBMISSION)
    env.llm.on(ai_schemas.IdentifyResult, smart_identify)
    message_id = env.graph.add_message(
        from_email=sender,
        subject=f"RE: {request_mail['subject']}",
        body="Please find the documents attached.",
        conversation_id=request_mail["conversationId"],
        attachments=files,
    )
    await process_email({"graph_message_id": message_id})
    return message_id


async def checklist(client, headers, case_id):
    case = (await client.get(f"/api/cases/{case_id}", headers=headers)).json()["data"]
    return case, {item["document_type"]: item for item in case["checklist"]}


def assert_ai_never_saw_pii(env):
    assert env.llm.requests, "expected AI calls"
    for request in env.llm.requests:
        assert find_pii(request["content"]) == [], request["helper"]
        assert "Rahul" not in request["content"]


async def test_create_joiner_sends_the_document_request(client, admin_headers, env):
    data = await create_joiner(client, admin_headers)
    assert data["stage"] == "docs_requested" and len(data["checklist"]) == 9
    mail = env.graph.last_to(RECRUITER)
    assert "Rahul Sharma" in mail["subject"]
    assert set(mail["cc"]) == {CANDIDATE, "hr-onboarding@tcgdigital.com"}
    assert "Relieving letter" in mail["body"] and "Resume (optional)" in mail["body"]
    row = await env.conn.fetchrow("SELECT * FROM people")
    assert b"Rahul" not in bytes(row["full_name_enc"]) and b"gmail" not in bytes(
        row["personal_email_enc"]
    )


async def test_create_joiner_validation_and_conflicts(
    client, admin_headers, viewer_headers
):
    assert (
        await client.post(
            "/api/joiners", json=joiner_payload(level="Senior"), headers=admin_headers
        )
    ).status_code == 422
    past = joiner_payload(joining_date=(date.today() - timedelta(days=1)).isoformat())
    assert (
        await client.post("/api/joiners", json=past, headers=admin_headers)
    ).status_code == 400
    assert (
        await client.post("/api/joiners", json=joiner_payload(), headers=viewer_headers)
    ).status_code == 403
    await create_joiner(client, admin_headers)
    assert (
        await client.post("/api/joiners", json=joiner_payload(), headers=admin_headers)
    ).status_code == 409


async def test_full_onboarding_from_documents_to_induction(client, admin_headers, env):
    data = await create_joiner(client, admin_headers)
    case_id = data["case_id"]
    await send_documents(env, full_document_set())
    case, items = await checklist(client, admin_headers, case_id)
    assert {k: v["status"] for k, v in items.items() if v["is_mandatory"]} == {
        "pan_card": "verified",
        "aadhaar_card": "verified",
        "passport_photo": "received",
        "class_10_certificate": "verified",
        "class_12_certificate": "verified",
        "degree_certificate": "verified",
        "relieving_letter": "verified",
    }
    assert case["case"]["stage"] == "docs_in_progress"
    assert all(a["file_name"] != "logo.png" for a in case["attachments"])

    photo = items["passport_photo"]["checklist_item_id"]
    override = await client.patch(
        f"/api/cases/{case_id}/checklist/{photo}",
        json={"status": "verified", "note": "Looks fine"},
        headers=admin_headers,
    )
    assert override.json()["data"]["case_stage"] == "ready_for_signoff"

    signed = await client.post(
        f"/api/cases/{case_id}/sign-off", json=sign_off_payload(), headers=admin_headers
    )
    assert (
        signed.status_code == 200 and signed.json()["data"]["stage"] == "it_requested"
    )
    it_mail = env.graph.last_to("it@tcgdigital.com")
    assert (
        it_mail["subject"] == "Email ID Creation"
        and "32700" in it_mail["body"]
        and "Senior Manager" in it_mail["body"]
    )
    assert it_mail["attachments"][0]["name"] == "photo.png"

    env.llm.classify_as(EmailCategory.IT_SETUP_REPLY)
    env.llm.on(
        ai_schemas.ItSetupResult,
        lambda text: ai_schemas.ItSetupResult(
            email_created=True,
            d365_created=True,
            credentials_sent_to_joiner=False,
            confidence=0.95,
        ),
    )
    reply_id = env.graph.add_message(
        from_email="himanshu.pal@tcgdigital.com",
        subject="Re: Email ID Creation",
        body="Hi Raina,\nPls find the email credentials below.\nEmail ID: Rahul.Sharma@tcgdigital.com\nPassword: Password#51\nThanks",
        conversation_id=it_mail["conversationId"],
    )
    await process_email({"graph_message_id": reply_id})

    stored = await Email.find_by_graph_id(reply_id)
    assert "Password#51" not in stored.body_text and "[redacted]" in stored.body_text
    final, _ = await checklist(client, admin_headers, case_id)
    assert final["person"]["work_email"] == "rahul.sharma@tcgdigital.com"
    assert final["case"]["status"] == "closed"
    tasks = {t["task_type"]: t for t in final["tasks"]}
    assert (
        tasks["it_setup"]["status"] == "done"
        and tasks["send_credentials"]["status"] == "open"
    )
    group = env.graph.last_to("onboarding@tcgdigital.com")
    assert (
        group["subject"].startswith("Onboarding: ")
        and "rahul.sharma@tcgdigital.com" in group["body"]
    )
    induction = [c for c in final["related_cases"] if c["case_type"] == "induction"]
    assert induction and induction[0]["stage"] == "awaiting_approval"
    assert_ai_never_saw_pii(env)


async def test_credentials_task_is_skipped_when_it_sent_them_directly(
    client, admin_headers, env
):
    data = await create_joiner(client, admin_headers)
    await client.post(
        f"/api/cases/{data['case_id']}/sign-off",
        json=sign_off_payload(force_reason="Documents verified offline"),
        headers=admin_headers,
    )
    it_mail = env.graph.last_to("it@tcgdigital.com")
    env.llm.classify_as(EmailCategory.IT_SETUP_REPLY)
    env.llm.on(
        ai_schemas.ItSetupResult,
        lambda text: ai_schemas.ItSetupResult(
            email_created=True,
            d365_created=False,
            credentials_sent_to_joiner=True,
            confidence=0.95,
        ),
    )
    reply_id = env.graph.add_message(
        from_email="it@tcgdigital.com",
        subject="Re: Email ID Creation",
        body="User ID created: Rahul.Sharma@tcgdigital.com. Credentials intimated separately.",
        conversation_id=it_mail["conversationId"],
    )
    await process_email({"graph_message_id": reply_id})
    case = (
        await client.get(f"/api/cases/{data['case_id']}", headers=admin_headers)
    ).json()["data"]
    tasks = {t["task_type"]: t for t in case["tasks"]}
    assert "send_credentials" not in tasks
    assert tasks["it_setup"]["status"] == "partial" and tasks["it_setup"][
        "sub_items"
    ] == {"email_id": "done", "d365": "pending"}
    assert case["case"]["status"] == "open"
    await advance_jobs(env.conn, timedelta(days=3))
    followup = env.graph.last_to("it@tcgdigital.com")
    assert followup["subject"] == "RE: Email ID Creation" and followup["reply_to"]
    assert "D365 access" in followup["body"] and "Email ID<" not in followup["body"]


async def test_name_mismatch_is_flagged_not_rejected(client, admin_headers, env):
    data = await create_joiner(client, admin_headers)
    await send_documents(
        env,
        [
            {
                "name": "pan.pdf",
                "content_type": "application/pdf",
                "data": make_pdf(pan_text(name="Amit Verma")),
            }
        ],
    )
    case, items = await checklist(client, admin_headers, data["case_id"])
    assert (
        items["pan_card"]["status"] == "name_mismatch"
        and "name_mismatch" in case["case"]["flags"]
    )


async def test_salary_document_is_deleted_and_flagged(client, admin_headers, env):
    data = await create_joiner(client, admin_headers)
    await send_documents(
        env,
        [
            {
                "name": "payslip.pdf",
                "content_type": "application/pdf",
                "data": make_pdf(
                    "Payslip September\nNet Pay 85,000\nBasic Salary 40,000"
                ),
            }
        ],
    )
    case, _ = await checklist(client, admin_headers, data["case_id"])
    attachment = case["attachments"][0]
    assert (
        attachment["check_status"] == "restricted"
        and "salary_document" in case["case"]["flags"]
    )
    assert not any(
        key.startswith(f"cases/{data['case_id']}") for key in env.storage.files
    )
    link = await client.get(
        f"/api/attachments/{attachment['attachment_id']}/download-url",
        headers=admin_headers,
    )
    assert link.status_code == 410


async def test_reminders_escalate_to_dropout_and_stop(
    client, admin_headers, env, blank_ocr
):
    data = await create_joiner(client, admin_headers)
    await send_documents(
        env,
        [
            {
                "name": "blurry.pdf",
                "content_type": "application/pdf",
                "data": make_pdf("x"),
            }
        ],
    )
    await advance_jobs(env.conn, timedelta(days=3))
    first = env.graph.last_to(RECRUITER)
    assert first["subject"].startswith("RE: Documents needed") and first["reply_to"]
    assert (
        CANDIDATE not in first["to"] and "blurry.pdf could not be read" in first["body"]
    )
    await advance_jobs(env.conn, timedelta(days=3))
    second = env.graph.last_to(RECRUITER)
    assert (
        second["subject"].startswith("RE: Documents needed")
        and CANDIDATE in second["to"]
        and second["reply_to"]
    )
    await advance_jobs(env.conn, timedelta(days=3))
    await advance_jobs(env.conn, timedelta(days=3))
    dropout = env.graph.last_to("recruitment@tcgdigital.com")
    assert dropout["subject"].startswith("Likely dropout")
    case, _ = await checklist(client, admin_headers, data["case_id"])
    assert (
        case["case"]["stage"] == "dropout"
        and "dropout_risk" in case["case"]["flags"]
        and case["next_followup_at"] is None
    )
    sent_before = len(env.graph.sent)
    assert (
        await advance_jobs(env.conn, timedelta(days=30)) == 0
        and len(env.graph.sent) == sent_before
    )
    reopened = await client.patch(
        f"/api/cases/{data['case_id']}",
        json={"status": "open", "clear_flags": ["dropout_risk"]},
        headers=admin_headers,
    )
    assert reopened.status_code == 200
    restarted, _ = await checklist(client, admin_headers, data["case_id"])
    assert restarted["case"]["stage"] == "docs_in_progress"


async def test_reminder_is_skipped_once_everything_is_verified(
    client, admin_headers, env
):
    data = await create_joiner(client, admin_headers)
    await send_documents(env, full_document_set())
    _, items = await checklist(client, admin_headers, data["case_id"])
    await client.patch(
        f"/api/cases/{data['case_id']}/checklist/{items['passport_photo']['checklist_item_id']}",
        json={"status": "verified"},
        headers=admin_headers,
    )
    sent_before = len(env.graph.sent)
    await advance_jobs(env.conn, timedelta(days=30))
    assert len(env.graph.sent) == sent_before


async def test_sign_off_rules(client, admin_headers, env):
    data = await create_joiner(client, admin_headers)
    early = await client.post(
        f"/api/cases/{data['case_id']}/sign-off",
        json=sign_off_payload(),
        headers=admin_headers,
    )
    assert early.status_code == 409
    other = await create_joiner(
        client,
        admin_headers,
        personal_email="second@gmail.com",
        full_name="Second Joiner",
    )
    await client.post(
        f"/api/cases/{other['case_id']}/sign-off",
        json=sign_off_payload(force_reason="Verified offline"),
        headers=admin_headers,
    )
    taken = await client.post(
        f"/api/cases/{data['case_id']}/sign-off",
        json=sign_off_payload(force_reason="Verified offline"),
        headers=admin_headers,
    )
    assert taken.status_code == 409
    missing = await client.post(
        f"/api/cases/{uuid.uuid4()}/sign-off",
        json=sign_off_payload(),
        headers=admin_headers,
    )
    assert missing.status_code == 404


async def test_documents_from_an_unknown_sender_are_matched_by_name(
    client, admin_headers, env
):
    data = await create_joiner(client, admin_headers)
    env.llm.classify_as(EmailCategory.DOC_SUBMISSION)
    env.llm.on(ai_schemas.IdentifyResult, smart_identify)
    message_id = env.graph.add_message(
        from_email="someone@agency.com",
        subject="Documents of Rahul Sharma",
        body="Attaching for Rahul Sharma",
        attachments=[
            {
                "name": "pan.pdf",
                "content_type": "application/pdf",
                "data": make_pdf(pan_text()),
            }
        ],
    )
    await process_email({"graph_message_id": message_id})
    case, items = await checklist(client, admin_headers, data["case_id"])
    assert (
        "sender_not_recognised" in case["case"]["flags"]
        and items["pan_card"]["status"] == "verified"
    )


async def test_document_reading_off_stores_files_for_hr(client, admin_headers, env):
    await configure_runtime(document_reading_enabled=False)
    data = await create_joiner(client, admin_headers)
    await send_documents(env, full_document_set())
    case, items = await checklist(client, admin_headers, data["case_id"])
    assert (
        items["pan_card"]["status"] == "pending"
        and items["passport_photo"]["status"] == "received"
    )
    assert {a["check_status"] for a in case["attachments"]} == {"skipped", "processed"}
    assert not any(r["helper"] == "IdentifyResult" for r in env.llm.requests)


async def test_list_and_update_joiners(client, admin_headers, viewer_headers, env):
    first = await create_joiner(client, admin_headers)
    await create_joiner(
        client,
        admin_headers,
        full_name="Priya Das",
        personal_email="priya.das@gmail.com",
        hire_category="campus",
    )
    listed = await client.get(
        "/api/joiners?search=priya&sort_by=full_name&sort_order=a_to_z",
        headers=viewer_headers,
    )
    assert (
        listed.json()["total"] == 1
        and listed.json()["data"][0]["full_name"] == "Priya Das"
    )
    campus = await client.get(
        "/api/joiners?hire_category=campus", headers=viewer_headers
    )
    assert campus.json()["total"] == 1
    await send_documents(
        env,
        [
            {
                "name": "pan.pdf",
                "content_type": "application/pdf",
                "data": make_pdf(pan_text()),
            }
        ],
    )
    updated = await client.patch(
        f"/api/joiners/{first['person']['person_id']}",
        json={"date_of_birth": "1990-02-21"},
        headers=admin_headers,
    )
    assert (
        updated.status_code == 200
        and updated.json()["data"]["rechecked_documents"] == 1
    )
    _, items = await checklist(client, admin_headers, first["case_id"])
    assert items["pan_card"]["status"] == "name_mismatch"


def joiner_photo(key: str) -> dict:
    return {
        "file_name": "rahul.jpg",
        "file_url": key,
        "mime_type": "image/jpeg",
        "size": 3,
    }


async def test_joiner_photo_on_create_list_and_after_sign_off(
    client, admin_headers, viewer_headers, env
):
    first = env.storage.preload("uploads/joiner_photo/first.jpg", b"one", "image/jpeg")
    data = await create_joiner(client, admin_headers, photo=joiner_photo(first))
    person = data["person"]
    assert first in person["photo_url"]
    listed = await client.get("/api/joiners", headers=viewer_headers)
    assert first in listed.json()["data"][0]["photo_url"]
    await env.conn.execute(
        "UPDATE cases SET stage = 'it_requested' WHERE case_id = $1",
        uuid.UUID(data["case_id"]),
    )
    locked = await client.patch(
        f"/api/joiners/{person['person_id']}",
        json={"full_name": "Rahul Kumar Sharma"},
        headers=admin_headers,
    )
    assert locked.status_code == 409
    second = env.storage.preload(
        "uploads/joiner_photo/second.jpg", b"two", "image/jpeg"
    )
    swapped = await client.patch(
        f"/api/joiners/{person['person_id']}",
        json={"photo": joiner_photo(second)},
        headers=admin_headers,
    )
    assert swapped.status_code == 200
    assert second in swapped.json()["data"]["person"]["photo_url"]
    assert first not in env.storage.files
    case, _ = await checklist(client, admin_headers, data["case_id"])
    assert second in case["person"]["photo_url"]
    removed = await client.patch(
        f"/api/joiners/{person['person_id']}",
        json={"photo": None},
        headers=admin_headers,
    )
    assert removed.json()["data"]["person"]["photo_url"] is None
    user_key = env.storage.preload("uploads/user_photo/hr.jpg", b"x", "image/jpeg")
    wrong_purpose = await client.patch(
        f"/api/joiners/{person['person_id']}",
        json={"photo": joiner_photo(user_key)},
        headers=admin_headers,
    )
    assert wrong_purpose.status_code == 400


async def test_passport_photo_is_the_avatar_until_hr_uploads_one(
    client, admin_headers, env
):
    await configure_runtime(document_reading_enabled=False)
    data = await create_joiner(client, admin_headers)
    await send_documents(env, full_document_set())
    case, items = await checklist(client, admin_headers, data["case_id"])
    passport_key = case["person"]["photo_url"].split("?")[0].split("test-bucket/")[1]
    assert passport_key.startswith(f"cases/{data['case_id']}/")
    hr_key = env.storage.preload("uploads/joiner_photo/hr.jpg", b"hr", "image/jpeg")
    await client.patch(
        f"/api/joiners/{data['person']['person_id']}",
        json={"photo": joiner_photo(hr_key)},
        headers=admin_headers,
    )
    assert passport_key in env.storage.files
    await client.patch(
        f"/api/cases/{data['case_id']}/checklist/{items['passport_photo']['checklist_item_id']}",
        json={"status": "verified"},
        headers=admin_headers,
    )
    case, _ = await checklist(client, admin_headers, data["case_id"])
    assert hr_key in case["person"]["photo_url"]


async def test_rejected_passport_photo_stops_being_the_avatar(
    client, admin_headers, env
):
    await configure_runtime(document_reading_enabled=False)
    data = await create_joiner(client, admin_headers)
    await send_documents(env, full_document_set())
    case, items = await checklist(client, admin_headers, data["case_id"])
    assert case["person"]["photo_url"]
    await client.patch(
        f"/api/cases/{data['case_id']}/checklist/{items['passport_photo']['checklist_item_id']}",
        json={"status": "wrong_type", "note": "Not a passport photo"},
        headers=admin_headers,
    )
    case, _ = await checklist(client, admin_headers, data["case_id"])
    assert case["person"]["photo_url"] is None
