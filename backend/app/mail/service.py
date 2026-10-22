import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app import runtime
from app.audit import log_action
from app.config import settings
from app.graph import mail as graph_mail
from app.logger import get_logger
from app.mail.model import Attachment, Email
from app.mail.templating import TemplateRenderError, render, render_source
from app.mail.utils import clean_addresses, html_to_text
from app.runtime.clock import at_local, local_today, parse_clock, to_local, utcnow
from app.runtime.schemas import RuntimeSettings
from app.storage import service as storage

logger = get_logger(__name__)

KILL_SWITCH_RECHECK = timedelta(minutes=5)


class Outbound(BaseModel):
    template_key: Optional[str] = Field(
        default=None, description="Template to render, empty for pre-rendered content"
    )
    values: Dict[str, Any] = Field(
        default_factory=dict, description="Placeholder values"
    )
    subject: Optional[str] = Field(default=None, description="Pre-rendered subject")
    html_body: Optional[str] = Field(default=None, description="Pre-rendered HTML body")
    to: List[str] = Field(default_factory=list, description="To addresses")
    cc: List[str] = Field(default_factory=list, description="CC addresses")
    reply_to_email_id: Optional[uuid.UUID] = Field(
        default=None, description="Stored email to reply to in its thread"
    )
    attachment_ids: List[uuid.UUID] = Field(
        default_factory=list, description="Stored files to attach"
    )
    extra_files: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Generated files as name, content_type, storage_key",
    )
    case_id: Optional[uuid.UUID] = Field(
        default=None, description="Case the email belongs to"
    )
    task_id: Optional[uuid.UUID] = Field(
        default=None, description="Task the email belongs to"
    )
    approval_id: Optional[uuid.UUID] = Field(
        default=None, description="Approval behind an AI-written email"
    )
    is_automatic: bool = Field(
        default=True, description="Automatic emails count toward the daily cap"
    )
    bypass_window: bool = Field(
        default=False, description="HR-approved sends skip the sending window"
    )

    model_config = {"arbitrary_types_allowed": True}


class DeliveryResult(BaseModel):
    status: Literal["sent", "deferred", "held", "duplicate", "dropped"] = Field(
        ..., description="What happened"
    )
    run_at: Optional[datetime] = Field(
        default=None, description="When to try again for deferred or held sends"
    )
    email_id: Optional[uuid.UUID] = Field(
        default=None, description="Stored outbound email"
    )
    reason: Optional[str] = Field(default=None, description="Why it was not sent")


def team_addresses(rs: RuntimeSettings) -> set[str]:
    return {value for value in rs.contacts.model_dump().values() if value}


def _start_of_today(now: datetime) -> datetime:
    return at_local(local_today(now), parse_clock("00:00"))


async def _over_daily_cap(
    recipients: List[str], rs: RuntimeSettings, now: datetime
) -> Optional[str]:
    teams = team_addresses(rs)
    since = _start_of_today(now)
    for address in recipients:
        if address in teams:
            continue
        if (
            await Email.automatic_count_since(address, since)
            >= rs.max_auto_emails_per_person_per_day
        ):
            return address
    return None


async def _files(outbound: Outbound) -> List[tuple[str, str, bytes]]:
    files: List[tuple[str, str, bytes]] = []
    for attachment_id in outbound.attachment_ids:
        attachment = await Attachment.find_by_id(attachment_id)
        if attachment and attachment.storage_key:
            files.append(
                (
                    attachment.file_name,
                    attachment.mime_type,
                    await storage.get_bytes(attachment.storage_key),
                )
            )
    for extra in outbound.extra_files:
        files.append(
            (
                extra["name"],
                extra["content_type"],
                await storage.get_bytes(extra["storage_key"]),
            )
        )
    return files


async def deliver(
    outbound: Outbound, dedupe_key: str, now: Optional[datetime] = None
) -> DeliveryResult:
    now = now or utcnow()
    rs = await runtime.current()
    to = clean_addresses(outbound.to)
    cc = [address for address in clean_addresses(outbound.cc) if address not in to]
    if not to:
        logger.warning(
            f"Dropped {outbound.template_key or 'email'} for {dedupe_key}, no recipient is configured"
        )
        await log_action(
            "email_dropped",
            case_id=outbound.case_id,
            details={"template_key": outbound.template_key, "reason": "no_recipient"},
        )
        return DeliveryResult(status="dropped", reason="no_recipient")
    if rs.kill_switch:
        return DeliveryResult(
            status="held", run_at=now + KILL_SWITCH_RECHECK, reason="kill_switch"
        )
    if not outbound.bypass_window:
        next_slot = runtime.next_send_time(now, rs, await runtime.holidays())
        if next_slot > to_local(now):
            return DeliveryResult(
                status="deferred", run_at=next_slot, reason="outside_sending_window"
            )
    if outbound.is_automatic:
        capped = await _over_daily_cap(to + cc, rs, now)
        if capped:
            tomorrow = _start_of_today(now) + timedelta(days=1)
            return DeliveryResult(
                status="deferred",
                run_at=runtime.next_send_time(tomorrow, rs, await runtime.holidays()),
                reason="daily_cap",
            )
    if outbound.template_key and outbound.html_body is None:
        subject, html_body = await render(outbound.template_key, outbound.values)
    elif outbound.subject is not None and outbound.html_body is not None:
        subject, html_body = (
            render_source(outbound.subject, outbound.html_body, outbound.values)
            if outbound.values
            else (outbound.subject, outbound.html_body)
        )
    else:
        raise TemplateRenderError("Outbound email has neither a template nor content")
    send_to, send_cc, subject_prefix = to, cc, None
    if rs.dry_run:
        if not rs.test_inbox:
            return DeliveryResult(
                status="held",
                run_at=now + KILL_SWITCH_RECHECK,
                reason="dry_run_without_test_inbox",
            )
        label = f"to: {', '.join(to)}" + (f" cc: {', '.join(cc)}" if cc else "")
        send_to, send_cc, subject_prefix = [rs.test_inbox], [], f"[DRY RUN {label}]"
    email = await Email.claim_outbound(
        dedupe_key=dedupe_key,
        to=to,
        cc=cc,
        subject=subject,
        body_text=html_to_text(html_body),
        case_id=outbound.case_id,
        task_id=outbound.task_id,
        template_key=outbound.template_key,
        approval_id=outbound.approval_id,
        is_automatic=outbound.is_automatic,
        is_dry_run=rs.dry_run,
        sender=settings.mailbox,
    )
    if email is None:
        return DeliveryResult(status="duplicate", reason="already_sent")
    reply_target = (
        await Email.find_by_id(outbound.reply_to_email_id)
        if outbound.reply_to_email_id
        else None
    )
    try:
        sent = await graph_mail.send_mail(
            subject=subject,
            html_body=html_body,
            to=send_to,
            cc=send_cc,
            reply_to_message_id=reply_target.graph_message_id if reply_target else None,
            attachments=await _files(outbound),
            subject_prefix=subject_prefix,
        )
    except Exception:
        await email.mark_failed()
        raise
    await email.mark_sent(
        sent.graph_message_id, sent.internet_message_id, sent.conversation_id
    )
    await log_action(
        "email_sent",
        case_id=outbound.case_id,
        entity_type="email",
        entity_id=email.email_id,
        details={
            "template_key": outbound.template_key,
            "dry_run": rs.dry_run,
            "automatic": outbound.is_automatic,
        },
    )
    return DeliveryResult(status="sent", email_id=email.email_id)
