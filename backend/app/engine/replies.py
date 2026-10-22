import uuid
from typing import List, Optional

from markupsafe import Markup, escape

from app.ai import helpers as ai
from app.audit import log_action
from app.cases import Approval, ApprovalType, Case
from app.mail import Email, Outbound
from app.worker import ScheduledJob, Skip, composer, sent_hook, start_email

APPROVED_REPLY = "engine.approved_reply"
APPROVAL_SENT = "engine.approval_sent"
NAME_PLACEHOLDER = "{{ recipient_name }}"


def _greeting_name(email: Email) -> str:
    if email.from_name and email.from_name.strip():
        return email.from_name.strip().split(" ")[0]
    return "there"


def text_to_html(text: str) -> str:
    paragraphs = [part.strip() for part in (text or "").split("\n\n") if part.strip()]
    return str(
        Markup("").join(
            Markup("<p>")
            + Markup("<br>").join(escape(line) for line in part.split("\n"))
            + Markup("</p>")
            for part in paragraphs
        )
    )


async def draft_for(
    email: Email, case: Optional[Case], known_names: List[str]
) -> Approval:
    context = (
        {"case_type": case.case_type.value, "stage": case.stage}
        if case
        else {"case_type": None, "stage": None}
    )
    result = await ai.draft_reply(
        email.subject or "", email.body_text or "", context, known_names
    )
    body = result.body.replace(NAME_PLACEHOLDER, _greeting_name(email)).replace(
        "{{recipient_name}}", _greeting_name(email)
    )
    approval = await Approval.create(
        ApprovalType.REPLY,
        {
            "subject": result.subject,
            "body": body,
            "to": [email.from_email],
            "reply_to_email_id": str(email.email_id),
            "ai_confidence": result.confidence,
        },
        case_id=case.case_id if case else None,
        summary=email.ai_summary or (email.subject or "Reply needed"),
        source_email_id=email.email_id,
    )
    await log_action(
        "reply_drafted",
        case_id=case.case_id if case else None,
        entity_type="approval",
        entity_id=approval.approval_id,
    )
    return approval


async def queue_approved_reply(approval: Approval) -> None:
    await start_email(
        APPROVED_REPLY,
        case_id=approval.case_id,
        scope=f"approval-{approval.approval_id}",
        extra={"approval_id": str(approval.approval_id)},
        on_sent=APPROVAL_SENT,
    )


@composer(APPROVED_REPLY)
async def compose_approved_reply(job: ScheduledJob):
    approval = await Approval.find_by_id(uuid.UUID(job.payload["approval_id"]))
    if not approval or approval.status.value != "approved":
        return Skip("approval not in approved state")
    draft = approval.draft
    reply_to = (
        uuid.UUID(draft["reply_to_email_id"])
        if draft.get("reply_to_email_id")
        else None
    )
    return Outbound(
        subject=draft["subject"],
        html_body=text_to_html(draft["body"]),
        to=draft.get("to") or [],
        reply_to_email_id=reply_to,
        case_id=approval.case_id,
        approval_id=approval.approval_id,
        is_automatic=False,
        bypass_window=True,
    )


@sent_hook(APPROVAL_SENT)
async def on_approval_sent(job: ScheduledJob) -> None:
    approval = await Approval.find_by_id(uuid.UUID(job.payload["approval_id"]))
    if approval:
        await approval.mark_sent()
