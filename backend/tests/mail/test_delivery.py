from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.config import settings
from app.error import GraphException
from app.graph import mail as graph_mail
from app.mail import Attachment, Email, Outbound, deliver
from app.runtime.clock import local_tz
from tests.conftest import configure_runtime


def alert(**overrides) -> Outbound:
    return Outbound(
        template_key="complaint_alert",
        values={},
        to=overrides.pop("to", ["person@tcgdigital.com"]),
        **overrides,
    )


async def test_template_email_is_sent_once_per_dedupe_key(env):
    first = await deliver(alert(), "case:task:alert:0")
    second = await deliver(alert(), "case:task:alert:0")
    assert first.status == "sent" and second.status == "duplicate"
    assert len(env.graph.sent) == 1
    stored = await Email.find_by_id(first.email_id)
    assert stored.processing_status == "sent" and stored.to == ["person@tcgdigital.com"]
    assert stored.from_email == settings.mailbox
    assert stored.graph_message_id == env.graph.sent[0]["id"]
    assert stored.internet_message_id == env.graph.sent[0]["internetMessageId"]
    assert stored.conversation_id == env.graph.sent[0]["conversationId"]


async def test_kill_switch_holds_every_send(env):
    await configure_runtime(kill_switch=True)
    result = await deliver(alert(), "k1")
    assert (
        result.status == "held"
        and result.reason == "kill_switch"
        and env.graph.sent == []
    )


async def test_outside_sending_hours_is_deferred_to_the_next_window(env):
    await configure_runtime(
        sending_days=[0, 1, 2, 3, 4], sending_start="09:00", sending_end="19:00"
    )
    saturday = datetime(2026, 10, 24, 10, 0, tzinfo=local_tz())
    result = await deliver(alert(), "w1", now=saturday)
    assert result.status == "deferred" and result.run_at == datetime(
        2026, 10, 26, 9, 0, tzinfo=local_tz()
    )


async def test_daily_cap_applies_to_people_but_not_team_mailboxes(env):
    await configure_runtime(max_auto_emails_per_person_per_day=1)
    assert (await deliver(alert(), "c1")).status == "sent"
    capped = await deliver(alert(), "c2")
    assert capped.status == "deferred" and capped.reason == "daily_cap"
    assert (await deliver(alert(to=["it@tcgdigital.com"]), "c3")).status == "sent"
    assert (await deliver(alert(to=["it@tcgdigital.com"]), "c4")).status == "sent"


async def test_hr_approved_mail_skips_the_cap(env):
    await configure_runtime(max_auto_emails_per_person_per_day=1)
    await deliver(alert(), "a1")
    approved = Outbound(
        subject="Re: Q",
        html_body="<p>Answer</p>",
        to=["person@tcgdigital.com"],
        is_automatic=False,
        bypass_window=True,
    )
    assert (await deliver(approved, "a2")).status == "sent"


async def test_dry_run_sends_only_to_the_test_inbox(env):
    await configure_runtime(dry_run=True, test_inbox="hr-test@tcgdigital.com")
    result = await deliver(alert(cc=["cc@tcgdigital.com"]), "d1")
    sent = env.graph.sent[-1]
    assert sent["to"] == ["hr-test@tcgdigital.com"] and sent["cc"] == []
    stored = await Email.find_by_id(result.email_id)
    assert (
        stored.is_dry_run
        and stored.to == ["person@tcgdigital.com"]
        and stored.cc == ["cc@tcgdigital.com"]
    )


async def test_dry_run_without_a_test_inbox_holds(env):
    await configure_runtime(dry_run=True, test_inbox="")
    assert (await deliver(alert(), "d2")).status == "held"


async def test_reply_goes_into_the_same_thread(env):
    first = await deliver(alert(), "t1")
    original = await Email.find_by_id(first.email_id)
    reply = await deliver(alert(reply_to_email_id=first.email_id), "t2")
    sent = env.graph.sent[-1]
    assert sent["reply_to"] == original.graph_message_id
    assert (
        await Email.find_by_id(reply.email_id)
    ).conversation_id == original.conversation_id


async def test_missing_recipient_is_dropped_not_sent(env):
    assert (await deliver(alert(to=[""]), "r1")).status == "dropped"
    assert (await deliver(alert(to=[None], cc=[None]), "r2")).status == "dropped"
    assert env.graph.sent == []


async def test_graph_failure_marks_the_email_failed(env, monkeypatch):
    monkeypatch.setattr(
        graph_mail, "send_mail", AsyncMock(side_effect=GraphException())
    )
    with pytest.raises(GraphException):
        await deliver(alert(), "graph-failure")
    status = await env.conn.fetchval(
        "SELECT processing_status FROM emails WHERE dedupe_key = $1", "graph-failure"
    )
    assert status == "failed" and env.graph.sent == []


async def test_dry_run_reply_keeps_the_graph_thread(env):
    first = await deliver(alert(), "dry-thread-seed")
    original = await Email.find_by_id(first.email_id)
    await configure_runtime(dry_run=True, test_inbox="hr-test@tcgdigital.com")
    reply = await deliver(
        alert(reply_to_email_id=first.email_id, cc=["cc@tcgdigital.com"]),
        "dry-thread-reply",
    )
    sent = env.graph.sent[-1]
    assert sent["to"] == ["hr-test@tcgdigital.com"] and sent["cc"] == []
    assert sent["reply_to"] == original.graph_message_id
    assert sent["subject"].startswith("[DRY RUN to: person@tcgdigital.com cc: cc@tcgdigital.com]")
    stored = await Email.find_by_id(reply.email_id)
    assert stored.conversation_id == original.conversation_id and stored.is_dry_run


async def test_stored_files_are_attached(env):
    env.storage.preload("files/letter.pdf", b"%PDF letter", "application/pdf")
    attachment = await Attachment.create(
        file_name="letter.pdf",
        mime_type="application/pdf",
        size_bytes=11,
        storage_key="files/letter.pdf",
        sha256=None,
        kind="appointment_letter",
    )
    await deliver(alert(attachment_ids=[attachment.attachment_id]), "f1")
    assert env.graph.sent[-1]["attachments"][0]["name"] == "letter.pdf"
