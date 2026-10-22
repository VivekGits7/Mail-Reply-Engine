import re
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html import escape
from typing import List, Optional, Tuple

from app.config import settings
from app.graph.schemas import SentMail
from app.runtime.clock import to_local
from app.smtp import client
from app.smtp.schemas import ReplyContext

REPLY_PREFIX = re.compile(r"^\s*re\s*:", re.IGNORECASE)
QUOTE_STYLE = "margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex"


def reply_subject(subject: str) -> str:
    return subject if REPLY_PREFIX.match(subject) else f"RE: {subject}"


def _one_line(value: str) -> str:
    return " ".join(value.split())


def _quote(reply_to: ReplyContext) -> Tuple[str, str]:
    intro = f"{reply_to.sender} wrote:"
    if reply_to.sent_at:
        when = to_local(reply_to.sent_at).strftime("%a, %d %b %Y at %H:%M")
        intro = f"On {when}, {intro}"
    lines = reply_to.quoted_text.splitlines()
    quoted_html = "<br>".join(escape(line) for line in lines)
    html = f'<br><hr><p>{escape(intro)}</p><blockquote style="{QUOTE_STYLE}">{quoted_html}</blockquote>'
    text = "\n\n" + intro + "\n" + "\n".join(f"> {line}" for line in lines)
    return html, text


def build_message(
    *,
    subject: str,
    html_body: str,
    text_body: str,
    to: List[str],
    cc: List[str],
    reply_to: Optional[ReplyContext] = None,
    attachments: Optional[List[Tuple[str, str, bytes]]] = None,
    subject_prefix: Optional[str] = None,
) -> EmailMessage:
    sender = settings.sender_email
    message = EmailMessage()
    message["From"] = formataddr((settings.SMTP_FROM_NAME, sender))
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    # Replies must land in the inbox the agent reads, even when SMTP sends from another address.
    if settings.mailbox and sender != settings.mailbox:
        message["Reply-To"] = settings.mailbox
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1])
    if reply_to:
        subject = reply_subject(reply_to.subject or subject)
        if reply_to.message_id:
            message["In-Reply-To"] = reply_to.message_id
            chain = dict.fromkeys([*reply_to.references, reply_to.message_id])
            message["References"] = " ".join(chain)
        quote_html, quote_text = _quote(reply_to)
        html_body, text_body = html_body + quote_html, text_body + quote_text
    message["Subject"] = _one_line(
        f"{subject_prefix} {subject}" if subject_prefix else subject
    )
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    for name, content_type, data in attachments or []:
        maintype, _, subtype = content_type.partition("/")
        message.add_attachment(
            data,
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=name,
        )
    return message


async def send_mail(
    *,
    subject: str,
    html_body: str,
    text_body: str,
    to: List[str],
    cc: List[str],
    reply_to: Optional[ReplyContext] = None,
    attachments: Optional[List[Tuple[str, str, bytes]]] = None,
    subject_prefix: Optional[str] = None,
) -> SentMail:
    message = build_message(
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        to=to,
        cc=cc,
        reply_to=reply_to,
        attachments=attachments,
        subject_prefix=subject_prefix,
    )
    await client.send(message, [*to, *cc])
    return SentMail(internet_message_id=message["Message-ID"])
