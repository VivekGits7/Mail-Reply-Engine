import pytest

from app.error import BadRequestException
from app.graph.mail import parse_message
from app.mail.templating import (
    TemplateRenderError,
    html_list,
    render_source,
    validate_source,
)
from app.mail.utils import (
    html_to_text,
    junk_reason,
    strip_quoted_reply,
    thread_message_ids,
    visible_text,
)

MAILBOX = "hr-agent@tcgdigital.com"


def message(**overrides):
    raw = {
        "id": "m1",
        "subject": overrides.pop("subject", "Documents"),
        "from": {
            "emailAddress": {"address": overrides.pop("sender", "candidate@gmail.com")}
        },
        "internetMessageHeaders": [
            {"name": k, "value": v} for k, v in overrides.pop("headers", {}).items()
        ],
        "body": {"content": overrides.pop("body", "Hello")},
        "uniqueBody": {"content": overrides.pop("unique", "")},
        **overrides,
    }
    return parse_message(raw)


@pytest.mark.parametrize(
    "overrides,reason",
    [
        ({"sender": MAILBOX}, "own_mailbox"),
        ({"isReadReceipt": True}, "receipt"),
        ({"sender": "mailer-daemon@outlook.com"}, "bounce"),
        ({"subject": "Undeliverable: Documents"}, "bounce"),
        ({"headers": {"Auto-Submitted": "auto-replied"}}, "auto_reply"),
        ({"subject": "Automatic reply: Out of office"}, "auto_reply"),
        ({"headers": {"List-Unsubscribe": "<mailto:x>"}}, "bulk"),
        ({"headers": {"Precedence": "bulk"}}, "bulk"),
        ({"sender": "noreply@vendor.com"}, "no_reply_sender"),
        ({}, None),
    ],
)
def test_junk_filter(overrides, reason):
    assert junk_reason(message(**overrides), MAILBOX) == reason


def test_visible_text_prefers_unique_body_and_redacts_passwords():
    parsed = message(
        body="old thread", unique="Email ID: a.b@tcgdigital.com\nPassword: Secret#1"
    )
    text = visible_text(parsed)
    assert "Secret#1" not in text and "a.b@tcgdigital.com" in text


def test_strip_quoted_reply_keeps_only_the_new_part():
    assert (
        strip_quoted_reply("Tuesday works.\n\nOn Mon, Amit wrote:\n> old")
        == "Tuesday works."
    )
    assert strip_quoted_reply("> only quote") == "> only quote"


def test_thread_ids_come_from_reply_headers():
    parsed = message(headers={"In-Reply-To": "<a@x>", "References": "<b@x> <a@x>"})
    assert thread_message_ids(parsed) == ["<a@x>", "<b@x>", "<a@x>"]


def test_html_to_text_drops_tags_and_styles():
    assert html_to_text("<style>p{}</style><p>Hi<br>there</p>") == "Hi\nthere"


def test_templates_escape_values_and_fail_loudly_on_missing_values():
    subject, body = render_source(
        "Hi {{ name }}",
        "<p>{{ name }}</p>{{ items }}",
        {"name": "<b>R</b>", "items": html_list(["PAN card"])},
    )
    assert (
        subject == "Hi <b>R</b>"
        and "&lt;b&gt;R&lt;/b&gt;" in body
        and "<li>PAN card</li>" in body
    )
    with pytest.raises(TemplateRenderError):
        render_source("Hi {{ missing }}", "<p></p>", {})


def test_template_validation_rejects_unknown_placeholders_and_bad_syntax():
    validate_source(
        "doc_request", "Docs for {{ candidate_name }}", "<p>{{ document_list }}</p>"
    )
    with pytest.raises(BadRequestException):
        validate_source("doc_request", "Docs for {{ salary }}", None)
    with pytest.raises(BadRequestException):
        validate_source("doc_request", None, "<p>{{ candidate_name </p>")
