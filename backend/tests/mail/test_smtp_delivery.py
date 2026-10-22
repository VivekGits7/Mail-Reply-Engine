import smtplib
import uuid
from datetime import timedelta

import pytest

from app.engine.inbound import process_email
from app.error import MailSendException
from app.mail import Email, Outbound, deliver
from tests.conftest import advance_jobs, configure_runtime
from tests.workflows.exits.test_flow import create_exit


def alert() -> Outbound:
    return Outbound(
        template_key="complaint_alert", values={}, to=["person@tcgdigital.com"]
    )


async def test_smtp_mail_takes_its_graph_ids_from_the_sent_copy(env, smtp_server):
    result = await deliver(alert(), "s1")
    mail = smtp_server.last_to("person@tcgdigital.com")
    stored = await Email.find_by_id(result.email_id)
    assert result.status == "sent" and env.graph.sent == []
    assert stored.internet_message_id == mail["message_id"]
    assert stored.graph_message_id.startswith("sent-")
    assert stored.conversation_id == mail["conversationId"]


async def test_smtp_reply_threads_on_the_inbound_mail_in_dry_run(env, smtp_server):
    await configure_runtime(dry_run=True, test_inbox="hr-test@tcgdigital.com")
    message_id = env.graph.add_message(
        from_email="rahul@example.com",
        subject="Question",
        body="When is my joining date?",
    )
    await process_email({"graph_message_id": message_id})
    inbound = await Email.find_by_graph_id(message_id)
    answer = Outbound(
        subject="Re: Question",
        html_body="<p>Monday</p>",
        to=["rahul@example.com"],
        reply_to_email_id=inbound.email_id,
        is_automatic=False,
        bypass_window=True,
    )
    result = await deliver(answer, "r1")
    mail = smtp_server.last_to("hr-test@tcgdigital.com")
    assert mail["to"] == ["hr-test@tcgdigital.com"] and mail["cc"] == []
    assert mail["subject"] == "[DRY RUN to: rahul@example.com] RE: Question"
    assert mail["in_reply_to"] == inbound.internet_message_id
    assert "Monday" in mail["body"] and "When is my joining date?" in mail["body"]
    stored = await Email.find_by_id(result.email_id)
    assert stored.conversation_id == inbound.conversation_id and stored.is_dry_run


async def test_follow_ups_thread_and_replies_link_without_a_sent_copy(
    client, admin_headers, env, smtp_server
):
    smtp_server.keep_copy = False
    data = await create_exit(client, admin_headers)
    intimation = smtp_server.last_to("offboarding@tcgdigital.com")
    seed = await env.conn.fetchrow(
        "SELECT graph_message_id, conversation_id FROM emails WHERE internet_message_id = $1",
        intimation["message_id"],
    )
    assert seed["graph_message_id"] is None and seed["conversation_id"] is None

    await advance_jobs(env.conn, timedelta(days=1, hours=1))
    finance = smtp_server.last_to("finance@tcgdigital.com")
    assert finance["subject"].startswith("RE: Offboarding : Rahul Sharma")
    assert finance["in_reply_to"] == intimation["message_id"]

    message_id = env.graph.add_message(
        from_email="finance@tcgdigital.com",
        subject=finance["subject"],
        body="Finance is cleared",
        conversation_id="conv-finance-reply",
        headers={
            "In-Reply-To": finance["message_id"],
            "References": f"{intimation['message_id']} {finance['message_id']}",
        },
    )
    await process_email({"graph_message_id": message_id})
    adopted = await env.conn.fetchval(
        "SELECT conversation_id FROM emails WHERE internet_message_id = $1",
        intimation["message_id"],
    )
    reply = await Email.find_by_graph_id(message_id)
    assert adopted == "conv-finance-reply"
    assert reply.case_id == uuid.UUID(data["case_id"])


async def test_smtp_failure_marks_the_email_failed(env, smtp_server):
    smtp_server.login_error = smtplib.SMTPAuthenticationError(535, b"Bad login")
    with pytest.raises(MailSendException):
        await deliver(alert(), "f1")
    status = await env.conn.fetchval(
        "SELECT processing_status FROM emails WHERE dedupe_key = 'f1'"
    )
    assert status == "failed" and smtp_server.sent == []
