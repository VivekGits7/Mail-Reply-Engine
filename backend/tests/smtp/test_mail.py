import smtplib
from datetime import datetime, timezone

import pytest

from app.config import settings
from app.error import MailSendException
from app.smtp import (
    ReplyContext,
    build_message,
    check_sign_in,
    reply_subject,
    send_mail,
)


def new_mail(**overrides):
    return build_message(
        subject=overrides.pop("subject", "Welcome"),
        html_body="<p>Hi <b>Rahul</b></p>",
        text_body="Hi Rahul",
        to=["rahul@example.com"],
        cc=["hr@tcgdigital.com"],
        **overrides,
    )


def test_new_mail_carries_both_bodies_files_and_a_message_id():
    message = new_mail(
        subject="Welcome\nto TCG",
        attachments=[("offer.pdf", "application/pdf", b"%PDF-1.4")],
    )
    assert message["Subject"] == "Welcome to TCG"
    assert message["To"] == "rahul@example.com" and message["Cc"] == "hr@tcgdigital.com"
    assert message["Message-ID"].endswith("@tcgdigital.com>")
    assert message["In-Reply-To"] is None and message["Reply-To"] is None
    assert message.get_body(("plain",)).get_content().strip() == "Hi Rahul"
    assert "<b>Rahul</b>" in message.get_body(("html",)).get_content()
    [file] = list(message.iter_attachments())
    assert (
        file.get_filename() == "offer.pdf"
        and file.get_content_type() == "application/pdf"
    )


def test_reply_threads_on_the_original_and_quotes_it_safely():
    original = ReplyContext(
        message_id="<b@sender.test>",
        references=["<a@sender.test>", "<b@sender.test>"],
        subject="Documents",
        sender="rahul@example.com",
        sent_at=datetime(2026, 10, 20, 5, 30, tzinfo=timezone.utc),
        quoted_text="PAN attached\n<script>x</script>",
    )
    message = new_mail(
        reply_to=original, subject_prefix="[DRY RUN to: rahul@example.com]"
    )
    assert message["Subject"] == "[DRY RUN to: rahul@example.com] RE: Documents"
    assert message["In-Reply-To"] == "<b@sender.test>"
    assert message["References"] == "<a@sender.test> <b@sender.test>"
    html = message.get_body(("html",)).get_content()
    assert "On Tue, 20 Oct 2026 at 11:00, rahul@example.com wrote:" in html
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert "> PAN attached" in message.get_body(("plain",)).get_content()


def test_reply_subject_is_not_prefixed_twice():
    assert reply_subject("Documents") == "RE: Documents"
    assert reply_subject("Re: Documents") == "Re: Documents"


def test_replies_go_to_the_agent_mailbox_when_smtp_sends_from_another_address(
    monkeypatch,
):
    monkeypatch.setattr(settings, "MAIL_SEND_PROVIDER", "smtp")
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "HR-NoReply@tcgdigital.com")
    monkeypatch.setattr(settings, "SMTP_FROM_NAME", "HR Operations")
    message = new_mail()
    assert message["From"] == "HR Operations <hr-noreply@tcgdigital.com>"
    assert message["Reply-To"] == settings.mailbox


async def test_send_uses_starttls_login_and_every_recipient(smtp_server):
    sent = await send_mail(
        subject="Hello",
        html_body="<p>Hi</p>",
        text_body="Hi",
        to=["rahul@example.com"],
        cc=["hr@tcgdigital.com"],
    )
    assert smtp_server.connections == [("smtp.test", 587)] and smtp_server.starttls == 1
    assert smtp_server.logins == ["hr-agent@tcgdigital.com"]
    assert smtp_server.envelopes == [
        (settings.mailbox, ["rahul@example.com", "hr@tcgdigital.com"])
    ]
    assert sent.graph_message_id is None
    assert sent.internet_message_id == smtp_server.sent[0]["message_id"]


async def test_ssl_mode_signs_in_without_starttls(smtp_server, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_SECURITY", "ssl")
    await check_sign_in()
    assert smtp_server.starttls == 0 and smtp_server.logins == [
        "hr-agent@tcgdigital.com"
    ]


async def test_wrong_password_is_a_clear_send_error(smtp_server):
    smtp_server.login_error = smtplib.SMTPAuthenticationError(
        535, b"5.7.3 Authentication unsuccessful"
    )
    with pytest.raises(MailSendException, match="sign in"):
        await check_sign_in()


async def test_unreachable_or_missing_server_is_a_send_error(smtp_server, monkeypatch):
    smtp_server.connect_error = ConnectionRefusedError()
    with pytest.raises(MailSendException, match="did not accept"):
        await check_sign_in()
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    with pytest.raises(MailSendException, match="not configured"):
        await check_sign_in()
