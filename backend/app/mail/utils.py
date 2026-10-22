import re
from html import unescape
from typing import List, Optional

from app.graph.schemas import GraphMessage
from app.privacy.redaction import redact_credentials

HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
HTML_BREAK_PATTERN = re.compile(r"<\s*(br|/p|/div|/li|/tr|/h\d)\s*/?>", re.IGNORECASE)
HTML_DROP_PATTERN = re.compile(
    r"<(style|script|head)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)
QUOTE_MARKERS = (
    re.compile(r"^On .+wrote:\s*$", re.IGNORECASE),
    re.compile(r"^-{2,}\s*Original Message\s*-{2,}", re.IGNORECASE),
    re.compile(r"^-{2,}\s*Forwarded message\s*-{2,}", re.IGNORECASE),
    re.compile(r"^From:\s.+", re.IGNORECASE),
    re.compile(r"^_{10,}\s*$"),
)
AUTOMATED_SENDER_PREFIXES = (
    "mailer-daemon",
    "postmaster",
    "no-reply",
    "noreply",
    "do-not-reply",
    "donotreply",
)
BOUNCE_SENDER_PREFIXES = ("mailer-daemon", "postmaster")
BULK_PRECEDENCE = {"bulk", "junk", "list", "auto_reply"}
AUTO_REPLY_SUBJECTS = (
    "automatic reply",
    "auto reply",
    "autoreply",
    "out of office",
    "auto:",
)
BOUNCE_SUBJECTS = (
    "undeliverable",
    "delivery status notification",
    "mail delivery failed",
    "returned mail",
    "delivery has failed",
)


def html_to_text(html: str) -> str:
    text = HTML_DROP_PATTERN.sub("", html or "")
    text = HTML_BREAK_PATTERN.sub("\n", text)
    text = unescape(HTML_TAG_PATTERN.sub("", text))
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def strip_quoted_reply(text: str) -> str:
    kept: List[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        if stripped.startswith(">") or any(
            marker.match(stripped) for marker in QUOTE_MARKERS
        ):
            break
        kept.append(line)
    visible = "\n".join(kept).strip()
    return visible or (text or "").strip()


def visible_text(message: GraphMessage) -> str:
    text = message.unique_body_text.strip() or strip_quoted_reply(message.body_text)
    return redact_credentials(text)


def full_text(message: GraphMessage) -> str:
    return redact_credentials(message.body_text or "")


def junk_reason(message: GraphMessage, mailbox: str) -> Optional[str]:
    sender = message.from_email.lower()
    local_part = sender.split("@", 1)[0]
    headers = message.headers
    subject = message.subject.strip().lower()
    if mailbox and sender == mailbox.lower():
        return "own_mailbox"
    if message.is_receipt:
        return "receipt"
    if (
        local_part.startswith(BOUNCE_SENDER_PREFIXES)
        or subject.startswith(BOUNCE_SUBJECTS)
        or "multipart/report" in headers.get("content-type", "")
    ):
        return "bounce"
    if (
        headers.get("auto-submitted", "no").strip().lower() != "no"
        or "x-autoreply" in headers
        or "x-autorespond" in headers
    ):
        return "auto_reply"
    if headers.get("x-auto-response-suppress", "").lower() in {
        "all",
        "oof",
    } and subject.startswith(AUTO_REPLY_SUBJECTS):
        return "auto_reply"
    if subject.startswith(AUTO_REPLY_SUBJECTS):
        return "auto_reply"
    if (
        headers.get("precedence", "").strip().lower() in BULK_PRECEDENCE
        or "list-id" in headers
        or "list-unsubscribe" in headers
    ):
        return "bulk"
    if local_part.startswith(AUTOMATED_SENDER_PREFIXES):
        return "no_reply_sender"
    return None


def thread_message_ids(message: GraphMessage) -> List[str]:
    ids: List[str] = []
    for header in ("in-reply-to", "references"):
        ids.extend(re.findall(r"<[^<>\s]+>", message.headers.get(header, "")))
    return ids


def clean_addresses(addresses: List[Optional[str]]) -> List[str]:
    seen: List[str] = []
    for address in addresses:
        value = (address or "").strip().lower()
        if value and value not in seen:
            seen.append(value)
    return seen
