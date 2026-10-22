import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from app import runtime
from app.audit import log_action, log_user_action
from app.auth.model import User
from app.common.enums import SortOrder
from app.common.listing import contains, paginate, sort_in_app
from app.error import NotFoundException
from app.mail import Attachment, Email, Outbound
from app.people import Person
from app.storage import UploadPurpose, verify_upload
from app.worker import ScheduledJob, Skip, composer, start_email
from app.workflows.complaints.model import Complaint
from app.workflows.complaints.schemas import UploadTranscriptRequest

ALERT = "complaints.alert"


async def capture(email: Email) -> Complaint:
    people = (
        await Person.find_by_email(email.from_email or "") if email.from_email else []
    )
    complaint = await Complaint.create(
        "email",
        sender_email=email.from_email,
        person_id=people[0].person_id if people else None,
        subject=email.subject,
        content=email.body_text,
        email_id=email.email_id,
        received_at=email.received_at,
    )
    await email.restrict()
    await log_action(
        "complaint_captured", entity_type="complaint", entity_id=complaint.complaint_id
    )
    await start_email(
        ALERT,
        scope=f"complaint-{complaint.complaint_id}",
        extra={"complaint_id": str(complaint.complaint_id)},
    )
    return complaint


@composer(ALERT)
async def compose_alert(job: ScheduledJob):
    rs = await runtime.current()
    if not rs.contacts.complaints_owner:
        return Skip("no complaints owner configured")
    return Outbound(
        template_key="complaint_alert", values={}, to=[rs.contacts.complaints_owner]
    )


async def list_items(
    search: Optional[str],
    source: Optional[str],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    sort_order: SortOrder,
    limit: int,
    offset: int,
) -> Tuple[List[Tuple[Complaint, Optional[Person]]], int]:
    complaints = await Complaint.filtered(source, date_from, date_to)
    people = await Person.find_by_ids([c.person_id for c in complaints if c.person_id])
    matched = [
        (complaint, people.get(complaint.person_id))
        for complaint in complaints
        if not search
        or contains(complaint.sender_email, search)
        or contains(complaint.subject, search)
    ]
    ordered = sort_in_app(
        matched,
        lambda item: item[0].subject,
        lambda item: item[0].received_at,
        sort_order,
    )
    return paginate(ordered, limit, offset)


async def reveal(
    complaint_id: uuid.UUID, user: User
) -> Tuple[Complaint, Optional[Person], Optional[Attachment]]:
    complaint = await Complaint.find_by_id(complaint_id)
    if not complaint:
        raise NotFoundException("Item not found")
    person = (
        await Person.find_by_id(complaint.person_id) if complaint.person_id else None
    )
    attachment = (
        await Attachment.find_by_id(complaint.attachment_id)
        if complaint.attachment_id
        else None
    )
    await log_user_action(
        user.user_id,
        "complaint_viewed",
        entity_type="complaint",
        entity_id=complaint.complaint_id,
    )
    return complaint, person, attachment


async def upload(data: UploadTranscriptRequest, user: User) -> Complaint:
    person_id = None
    if data.person_id:
        person = await Person.find_by_id(uuid.UUID(data.person_id))
        if not person:
            raise NotFoundException("Person not found")
        person_id = person.person_id
    size = await verify_upload(data.file, UploadPurpose.TRANSCRIPT)
    attachment = await Attachment.create(
        file_name=data.file.file_name,
        mime_type=data.file.mime_type,
        size_bytes=size,
        storage_key=data.file.file_url,
        sha256=None,
        kind="transcript",
        check_status="skipped",
        uploaded_by=user.user_id,
    )
    complaint = await Complaint.create(
        data.source.value,
        person_id=person_id,
        attachment_id=attachment.attachment_id,
        uploaded_by=user.user_id,
    )
    await log_user_action(
        user.user_id,
        "transcript_uploaded",
        entity_type="complaint",
        entity_id=complaint.complaint_id,
    )
    return complaint
