import hashlib
import uuid
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from markupsafe import Markup

from app import runtime
from app.admin.model import ChecklistTemplate
from app.ai import helpers as ai
from app.audit import log_action, log_user_action
from app.auth.model import User
from app.cases import (
    Case,
    CaseFlag,
    CaseType,
    ChecklistItem,
    ChecklistStatus,
    CheckMode,
    Task,
    TaskStatus,
    TaskType,
)
from app.common.enums import PersonCheck, SortOrder
from app.common.listing import contains, paginate, sort_in_app
from app.config import settings
from app.documents import (
    extract_text,
    has_salary_content,
    is_readable,
    is_zip,
    looks_like_photo,
    person_check,
    resolve_mime,
    sanitize_file_name,
    unzip,
)
from app.error import BadRequestException, ConflictException, NotFoundException
from app.graph.schemas import GraphAttachment
from app.logger import get_logger
from app.mail import Attachment, Email, Outbound, html_list, html_table
from app.people import HireCategory, Person, PersonRole
from app.privacy.encryption import blind_index
from app.runtime.clock import utcnow
from app.storage import service as storage
from app.worker import (
    ScheduledJob,
    Skip,
    chain_key,
    composer,
    enqueue_event,
    followup,
    sent_hook,
    start_email,
)
from app.workflows.onboarding.enums import DOC_STAGES, JoinerSortBy, OnboardingStage
from app.workflows.onboarding.schemas import (
    ChecklistOverrideRequest,
    CreateJoinerRequest,
    SignOffRequest,
    UpdateJoinerRequest,
)
from app.workflows.onboarding.utils import (
    PROFILE_FIELDS,
    doc_label,
    onboarding_rows,
    pick_work_email,
    show_date,
)

logger = get_logger(__name__)

DOC_REQUEST = "onboarding.doc_request"
DOC_REMINDER = "onboarding.doc_reminder"
DROPOUT = "onboarding.dropout"
IT_REQUEST = "onboarding.it_request"
IT_FOLLOWUP = "onboarding.it_followup"
IT_ESCALATION = "onboarding.it_escalation"
GROUP_INTIMATION = "onboarding.group_intimation"
GROUP_SENT = "onboarding.group_sent"
UNCLEAR_STATUSES = {ChecklistStatus.UNREADABLE, ChecklistStatus.WRONG_TYPE}


def _doc_chase():
    return followup(
        DOC_REMINDER, "followup_gap_hours", "max_followups", escalation=DROPOUT
    )


def _it_chase():
    return followup(
        IT_FOLLOWUP, "followup_gap_hours", "max_followups", escalation=IT_ESCALATION
    )


async def _onboarding_case(case_id: uuid.UUID) -> Case:
    case = await Case.find_by_id(case_id)
    if not case or case.case_type != CaseType.ONBOARDING:
        raise NotFoundException("Onboarding case not found")
    return case


async def _person(person_id: uuid.UUID) -> Person:
    person = await Person.find_by_id(person_id)
    if not person:
        raise NotFoundException("Joiner not found")
    return person


async def create_joiner(
    data: CreateJoinerRequest, user: User
) -> Tuple[Person, Case, List[ChecklistItem]]:
    if data.joining_date < runtime.local_today():
        raise BadRequestException("Joining date can't be in the past")
    for existing in await Person.find_by_email(
        str(data.personal_email), ("personal_email",)
    ):
        if await Case.find_active(existing.person_id, CaseType.ONBOARDING):
            raise ConflictException("This joiner already has an open onboarding case")
    template = await ChecklistTemplate.items_for(
        data.hire_category.value, data.location
    )
    if not template:
        raise BadRequestException(
            "No document checklist is set up for this hire category and location"
        )
    person = await Person(
        full_name=data.full_name,
        personal_email=str(data.personal_email),
        recruiter_email=str(data.recruiter_email),
        manager_name=data.manager_name,
        manager_email=str(data.manager_email),
        date_of_birth=data.date_of_birth,
        role=PersonRole.CANDIDATE.value,
        hire_category=data.hire_category.value,
        level=data.level,
        location=data.location,
        joining_date=data.joining_date,
    ).insert(created_by=user.user_id)
    case = await Case.create(
        CaseType.ONBOARDING,
        person.person_id,
        OnboardingStage.DOCS_REQUESTED.value,
        created_by=user.user_id,
    )
    items = await ChecklistItem.create_many(case.case_id, template)
    task = await Task.create(
        TaskType.DOC_COLLECTION.value,
        "recruiter",
        person.recruiter_email,
        case_id=case.case_id,
    )
    await log_user_action(
        user.user_id,
        "joiner_created",
        case_id=case.case_id,
        entity_type="person",
        entity_id=person.person_id,
        details={"documents": len(items)},
    )
    await start_email(
        DOC_REQUEST, case_id=case.case_id, task_id=task.task_id, chase=_doc_chase()
    )
    return person, await Case.find_by_id(case.case_id), items


async def list_joiners(
    search: Optional[str],
    stage: Optional[str],
    status: Optional[str],
    flag: Optional[str],
    hire_category: Optional[HireCategory],
    location: Optional[str],
    level: Optional[str],
    joining_from: Optional[date],
    joining_to: Optional[date],
    sort_by: JoinerSortBy,
    sort_order: SortOrder,
    limit: int,
    offset: int,
) -> Tuple[List[Dict[str, Any]], int]:
    rows = await Case.search(CaseType.ONBOARDING, stage, status, flag)
    people = await Person.find_by_ids([row["person_id"] for row in rows])
    items = []
    for row in rows:
        person = people.get(row["person_id"])
        if not person:
            continue
        if hire_category and row["hire_category"] != hire_category.value:
            continue
        if location and (row["location"] or "").lower() != location.lower():
            continue
        if level and (row["level"] or "").upper() != level.upper():
            continue
        if joining_from and (
            not row["joining_date"] or row["joining_date"] < joining_from
        ):
            continue
        if joining_to and (not row["joining_date"] or row["joining_date"] > joining_to):
            continue
        if search and not any(
            contains(value, search)
            for value in (person.full_name, person.personal_email, person.employee_code)
        ):
            continue
        items.append({"row": row, "person": person})
    sort_keys = {
        JoinerSortBy.JOINING_DATE: lambda item: item["row"]["joining_date"],
        JoinerSortBy.FULL_NAME: lambda item: item["person"].full_name,
        JoinerSortBy.UPDATED_AT: lambda item: item["row"]["updated_at"],
        JoinerSortBy.CREATED_AT: lambda item: item["row"]["opened_at"],
    }
    created_key = (
        sort_keys[sort_by]
        if sort_by in (JoinerSortBy.UPDATED_AT, JoinerSortBy.JOINING_DATE)
        else sort_keys[JoinerSortBy.CREATED_AT]
    )
    ordered = sort_in_app(items, sort_keys[sort_by], created_key, sort_order)
    page, total = paginate(ordered, limit, offset)
    counts = await ChecklistItem.counts_for([item["row"]["case_id"] for item in page])
    result = []
    for item in page:
        row, person = item["row"], item["person"]
        verified, total_docs = counts.get(row["case_id"], (0, 0))
        next_at = await ScheduledJob.next_pending_at(case_id=row["case_id"])
        result.append(
            {
                "person_id": str(person.person_id),
                "case_id": str(row["case_id"]),
                "full_name": person.full_name,
                "joining_date": row["joining_date"].isoformat()
                if row["joining_date"]
                else None,
                "hire_category": row["hire_category"],
                "level": row["level"],
                "location": row["location"],
                "stage": row["stage"],
                "status": row["status"],
                "flags": list(row["flags"] or []),
                "docs_verified": verified,
                "docs_total": total_docs,
                "next_followup_at": next_at.isoformat() if next_at else None,
                "updated_at": row["updated_at"].isoformat()
                if row["updated_at"]
                else None,
            }
        )
    return result, total


async def update_joiner(
    person_id: uuid.UUID, data: UpdateJoinerRequest, user: User
) -> Tuple[Person, int]:
    person = await _person(person_id)
    case = await Case.find_active(person.person_id, CaseType.ONBOARDING)
    if not case:
        raise NotFoundException("This joiner has no open onboarding case")
    if (
        case.stage not in DOC_STAGES
        and case.stage != OnboardingStage.READY_FOR_SIGNOFF.value
    ):
        raise ConflictException("This joiner is already signed off")
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(
            person,
            field,
            str(value).lower() if field.endswith("email") and value else value,
        )
    await person.save()
    rechecked = 0
    if {"full_name", "date_of_birth"} & set(changes):
        for attachment in await Attachment.for_case(case.case_id, ["email_document"]):
            if (
                attachment.storage_key
                and attachment.is_latest
                and attachment.check_status in ("processed", "unreadable")
            ):
                await enqueue_event(
                    "documents.check",
                    {"attachment_id": str(attachment.attachment_id)},
                    source="hr_action",
                    dedupe_key=f"recheck:{attachment.attachment_id}:{utcnow().timestamp()}",
                    case_id=case.case_id,
                )
                rechecked += 1
    await log_user_action(
        user.user_id,
        "joiner_updated",
        case_id=case.case_id,
        entity_type="person",
        entity_id=person.person_id,
        details={"fields": sorted(changes)},
    )
    return person, rechecked


async def refresh_stage(case: Case) -> None:
    if not case.is_active:
        return
    items = await ChecklistItem.for_case(case.case_id)
    complete = all(
        item.status == ChecklistStatus.VERIFIED for item in items if item.is_mandatory
    )
    if complete and case.stage in DOC_STAGES:
        await case.set_stage(OnboardingStage.READY_FOR_SIGNOFF.value)
        await case.remove_flags(CaseFlag.DROPOUT_RISK.value)
        task = await Task.for_case_type(case.case_id, TaskType.DOC_COLLECTION.value)
        if task:
            await task.update(status=TaskStatus.DONE)
            await ScheduledJob.cancel_pending(task_id=task.task_id)
        await log_action(
            "ready_for_signoff",
            case_id=case.case_id,
            entity_type="case",
            entity_id=case.case_id,
        )
    elif not complete and case.stage == OnboardingStage.READY_FOR_SIGNOFF.value:
        await case.set_stage(OnboardingStage.DOCS_IN_PROGRESS.value)


async def override_checklist(
    case_id: uuid.UUID, item_id: uuid.UUID, data: ChecklistOverrideRequest, user: User
) -> Tuple[ChecklistItem, str]:
    case = await _onboarding_case(case_id)
    item = await ChecklistItem.find(case.case_id, item_id)
    if not item:
        raise NotFoundException("Checklist item not found")
    attachment_id = None
    if data.attachment_id:
        attachment = await Attachment.find_by_id(uuid.UUID(data.attachment_id))
        if not attachment or attachment.case_id != case.case_id:
            raise BadRequestException("That file does not belong to this case")
        attachment_id = attachment.attachment_id
    await item.update(
        data.status,
        attachment_id=attachment_id,
        notes=data.note,
        verified_by=user.user_id,
    )
    if data.status == ChecklistStatus.VERIFIED and not [
        i
        for i in await ChecklistItem.for_case(case.case_id)
        if i.status == ChecklistStatus.NAME_MISMATCH
    ]:
        await case.remove_flags(CaseFlag.NAME_MISMATCH.value)
    await refresh_stage(case)
    await log_user_action(
        user.user_id,
        "checklist_item_set",
        case_id=case.case_id,
        entity_type="checklist_item",
        entity_id=item.checklist_item_id,
        details={
            "document_type": item.document_type,
            "status": data.status.value,
            "has_note": bool(data.note),
        },
    )
    fresh = await Case.find_by_id(case.case_id)
    return item, fresh.stage


async def _store(
    case: Case,
    email_id: Optional[uuid.UUID],
    name: str,
    mime: str,
    data: bytes,
    parent_id: Optional[uuid.UUID],
) -> Optional[Attachment]:
    sha = hashlib.sha256(data).hexdigest()
    if await Attachment.sha_seen(case.case_id, sha):
        await Attachment.create(
            file_name=name,
            mime_type=mime,
            size_bytes=len(data),
            storage_key=None,
            sha256=sha,
            email_id=email_id,
            case_id=case.case_id,
            parent_attachment_id=parent_id,
            check_status="duplicate",
        )
        return None
    key = storage.new_key(f"cases/{case.case_id}", name)
    await storage.put_bytes(key, data, mime)
    return await Attachment.create(
        file_name=name,
        mime_type=mime,
        size_bytes=len(data),
        storage_key=key,
        sha256=sha,
        email_id=email_id,
        case_id=case.case_id,
        parent_attachment_id=parent_id,
    )


async def handle_documents(
    email: Email, attachments: List[GraphAttachment], case: Case
) -> int:
    stored: List[Attachment] = []
    for incoming in attachments:
        if incoming.is_inline or not incoming.content:
            continue
        name = sanitize_file_name(incoming.name, "document")
        mime = resolve_mime(name, incoming.content_type)
        if len(incoming.content) > settings.MAX_ATTACHMENT_BYTES:
            await Attachment.create(
                file_name=name,
                mime_type=mime,
                size_bytes=len(incoming.content),
                storage_key=None,
                sha256=None,
                email_id=email.email_id,
                case_id=case.case_id,
                check_status="skipped",
            )
            continue
        if is_zip(name, mime):
            parent = await Attachment.create(
                file_name=name,
                mime_type=mime,
                size_bytes=len(incoming.content),
                storage_key=None,
                sha256=hashlib.sha256(incoming.content).hexdigest(),
                email_id=email.email_id,
                case_id=case.case_id,
                check_status="skipped",
            )
            try:
                children = unzip(
                    incoming.content,
                    settings.ZIP_MAX_FILES,
                    settings.ZIP_MAX_TOTAL_BYTES,
                )
            except Exception:
                await parent.record_check(
                    check_status="unreadable", issues=["zip_could_not_be_opened"]
                )
                continue
            for child_name, child_data in children:
                child = await _store(
                    case,
                    email.email_id,
                    child_name,
                    resolve_mime(child_name, None),
                    child_data,
                    parent.attachment_id,
                )
                if child:
                    stored.append(child)
            continue
        attachment = await _store(
            case, email.email_id, name, mime, incoming.content, None
        )
        if attachment:
            stored.append(attachment)
    if case.stage == OnboardingStage.DOCS_REQUESTED.value:
        await case.set_stage(OnboardingStage.DOCS_IN_PROGRESS.value)
    await log_action(
        "documents_received",
        case_id=case.case_id,
        entity_type="email",
        entity_id=email.email_id,
        details={"files": len(stored)},
    )
    for attachment in stored:
        await enqueue_event(
            "documents.check",
            {"attachment_id": str(attachment.attachment_id)},
            source="email",
            dedupe_key=f"check:{attachment.attachment_id}",
            case_id=case.case_id,
        )
    return len(stored)


async def _link(
    item: ChecklistItem,
    attachment: Attachment,
    status: ChecklistStatus,
    person_result: Optional[str] = None,
) -> None:
    await Attachment.supersede(
        "email_document",
        attachment.case_id,
        attachment.attachment_id,
        item.document_type,
    )
    await item.update(
        status, attachment_id=attachment.attachment_id, person_check=person_result
    )


async def check_attachment(attachment_id: uuid.UUID) -> None:
    attachment = await Attachment.find_by_id(attachment_id)
    if not attachment or not attachment.case_id or not attachment.storage_key:
        return
    case = await Case.find_by_id(attachment.case_id)
    if not case or not case.is_active or case.case_type != CaseType.ONBOARDING:
        return
    person = await _person(case.person_id)
    rs = await runtime.current()
    items = await ChecklistItem.for_case(case.case_id)
    photo_item = next(
        (
            item
            for item in items
            if item.check_mode == CheckMode.PHOTO
            and item.status != ChecklistStatus.VERIFIED
        ),
        None,
    )
    if not rs.document_reading_enabled:
        if photo_item and looks_like_photo(
            attachment.file_name, attachment.mime_type, 0
        ):
            await _link(photo_item, attachment, ChecklistStatus.RECEIVED)
            await attachment.record_check(
                check_status="processed", document_type_guess=photo_item.document_type
            )
        else:
            await attachment.record_check(
                check_status="skipped", issues=["reading_disabled"]
            )
        await log_action(
            "document_stored_for_hr",
            case_id=case.case_id,
            entity_type="attachment",
            entity_id=attachment.attachment_id,
        )
        return
    document = await extract_text(
        await storage.get_bytes(attachment.storage_key), attachment.mime_type
    )
    if photo_item and looks_like_photo(
        attachment.file_name, attachment.mime_type, document.chars
    ):
        await _link(photo_item, attachment, ChecklistStatus.RECEIVED)
        await attachment.record_check(
            check_status="processed",
            document_type_guess=photo_item.document_type,
            text_chars=document.chars,
        )
        await refresh_stage(case)
        return
    if document.method == "ocr_unavailable":
        await attachment.record_check(
            check_status="skipped",
            issues=["ocr_unavailable"],
            text_chars=document.chars,
        )
        return
    if has_salary_content(document.text):
        await storage.delete(attachment.storage_key)
        await attachment.drop_file("salary_content")
        await case.add_flags(CaseFlag.SALARY_DOCUMENT.value)
        await log_action(
            "salary_document_removed",
            case_id=case.case_id,
            entity_type="attachment",
            entity_id=attachment.attachment_id,
        )
        return
    if not is_readable(document, rs.ocr_min_chars, rs.ocr_min_confidence):
        await attachment.record_check(
            check_status="unreadable",
            ocr_quality=document.ocr_confidence,
            text_chars=document.chars,
            issues=["unreadable"],
        )
        await log_action(
            "document_unreadable",
            case_id=case.case_id,
            entity_type="attachment",
            entity_id=attachment.attachment_id,
        )
        return
    from app.privacy.masking import detect_people

    check = person_check(
        document.text,
        person.full_name,
        person.date_of_birth,
        person.pan_hash,
        rs.name_match_threshold,
        detect_people(document.text),
    )
    types = [item.document_type for item in items]
    known = [name for name in (person.full_name, person.manager_name) if name]
    identified = await ai.identify_document(document.text, types, known_names=known)
    common = {
        "ocr_quality": document.ocr_confidence,
        "text_chars": document.chars,
        "name_match_score": check.name_score,
        "person_check": check.result.value,
        "ai_confidence": identified.confidence,
        "issues": identified.issues,
    }
    item = next(
        (entry for entry in items if entry.document_type == identified.document_type),
        None,
    )
    if item is None:
        await attachment.record_check(
            check_status="wrong_type",
            document_type_guess=identified.document_type,
            **common,
        )
        await log_action(
            "document_wrong_type",
            case_id=case.case_id,
            entity_type="attachment",
            entity_id=attachment.attachment_id,
        )
        return
    await attachment.record_check(
        check_status="processed", document_type_guess=identified.document_type, **common
    )
    if identified.confidence < rs.ai_confidence_threshold:
        status = ChecklistStatus.RECEIVED
    elif check.result == PersonCheck.MATCH:
        status = ChecklistStatus.VERIFIED
    elif check.result == PersonCheck.MISMATCH:
        status = ChecklistStatus.NAME_MISMATCH
        await case.add_flags(CaseFlag.NAME_MISMATCH.value)
    else:
        status = ChecklistStatus.RECEIVED
    await _link(item, attachment, status, check.result.value)
    if (
        item.document_type == "pan_card"
        and status == ChecklistStatus.VERIFIED
        and len(check.pans) == 1
        and person.pan_hash is None
    ):
        person.pan_hash = blind_index(check.pans[0])
        await person.save()
    await log_action(
        "document_checked",
        case_id=case.case_id,
        entity_type="attachment",
        entity_id=attachment.attachment_id,
        details={
            "document_type": item.document_type,
            "status": status.value,
            "person_check": check.result.value,
        },
    )
    await refresh_stage(case)


async def sign_off(
    case_id: uuid.UUID, data: SignOffRequest, user: User
) -> Tuple[Case, Person, Task]:
    case = await _onboarding_case(case_id)
    if not case.is_active:
        raise ConflictException("This case is closed")
    if case.stage != OnboardingStage.READY_FOR_SIGNOFF.value and not (
        data.force_reason and case.stage in DOC_STAGES
    ):
        raise ConflictException(
            "Every mandatory document must be verified first, or give a reason to sign off anyway"
        )
    person = await _person(case.person_id)
    other = await Person.find_by_employee_code(data.employee_code)
    if other and other.person_id != person.person_id:
        raise ConflictException("This Employee ID is already used")
    profile = {
        **person.profile,
        **data.model_dump(mode="json", include=set(PROFILE_FIELDS)),
    }
    person.employee_code = data.employee_code
    person.designation = data.designation
    person.profile = profile
    await person.save()
    doc_task = await Task.for_case_type(case.case_id, TaskType.DOC_COLLECTION.value)
    if doc_task:
        await doc_task.update(status=TaskStatus.DONE)
        await ScheduledJob.cancel_pending(task_id=doc_task.task_id)
    await case.remove_flags(CaseFlag.DROPOUT_RISK.value)
    await case.set_stage(OnboardingStage.IT_REQUESTED.value)
    rs = await runtime.current()
    it_task = await Task.create(
        TaskType.IT_SETUP.value,
        "it",
        rs.contacts.it_team or None,
        case_id=case.case_id,
        sub_items={"email_id": "pending", "d365": "pending"},
    )
    await log_user_action(
        user.user_id,
        "signed_off",
        case_id=case.case_id,
        entity_type="case",
        entity_id=case.case_id,
        details={"forced": bool(data.force_reason)},
    )
    await start_email(
        IT_REQUEST, case_id=case.case_id, task_id=it_task.task_id, chase=_it_chase()
    )
    return await Case.find_by_id(case.case_id), person, it_task


async def _photo_attachment(case_id: uuid.UUID) -> Optional[uuid.UUID]:
    for item in await ChecklistItem.for_case(case_id):
        if item.check_mode == CheckMode.PHOTO and item.attachment_id:
            return item.attachment_id
    return None


async def _table(case: Case, person: Person) -> Markup:
    return html_table(
        onboarding_rows(person, await _photo_attachment(case.case_id) is not None)
    )


def _missing(items: List[ChecklistItem]) -> List[str]:
    return [
        doc_label(item.document_type)
        for item in items
        if item.is_mandatory and item.status == ChecklistStatus.PENDING
    ]


async def _unclear(case_id: uuid.UUID, items: List[ChecklistItem]) -> List[str]:
    unclear = [
        f"{doc_label(item.document_type)}, please send a clearer or correct copy"
        for item in items
        if item.status in UNCLEAR_STATUSES
    ]
    for attachment in await Attachment.for_case(case_id, ["email_document"]):
        if attachment.is_latest and attachment.check_status in (
            "unreadable",
            "wrong_type",
        ):
            reason = (
                "could not be read, please send a clearer copy"
                if attachment.check_status == "unreadable"
                else "is not one of the requested documents"
            )
            unclear.append(f"{attachment.file_name} {reason}")
    return unclear


@composer(DOC_REQUEST)
async def compose_doc_request(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id)
    if not case or not case.is_active:
        return Skip("case not active")
    person = await _person(case.person_id)
    rs = await runtime.current()
    items = await ChecklistItem.for_case(case.case_id)
    documents = [
        doc_label(item.document_type) + ("" if item.is_mandatory else " (optional)")
        for item in items
    ]
    return Outbound(
        template_key="doc_request",
        values={
            "candidate_name": person.full_name,
            "joining_date": show_date(person.joining_date),
            "document_list": html_list(documents),
        },
        to=[person.recruiter_email],
        cc=[person.personal_email, rs.contacts.hr_onboarding_team],
        case_id=case.case_id,
        task_id=job.task_id,
    )


@composer(DOC_REMINDER)
async def compose_doc_reminder(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id)
    if (
        not case
        or not case.is_active
        or case.stage
        not in (
            OnboardingStage.DOCS_REQUESTED.value,
            OnboardingStage.DOCS_IN_PROGRESS.value,
        )
    ):
        return Skip("documents no longer being chased")
    person = await _person(case.person_id)
    items = await ChecklistItem.for_case(case.case_id)
    missing, unclear = _missing(items), await _unclear(case.case_id, items)
    if not missing and not unclear:
        return Skip("nothing missing")
    rs = await runtime.current()
    unclear_html = (
        Markup("<p>These need attention:</p>") + html_list(unclear)
        if unclear
        else Markup("")
    )
    first = job.attempt <= 1
    previous = await Email.latest_in_thread(
        case.case_id,
        ["doc_request", "doc_reminder_recruiter", "doc_reminder_candidate"],
    )
    return Outbound(
        template_key="doc_reminder_recruiter" if first else "doc_reminder_candidate",
        values={
            "candidate_name": person.full_name,
            "joining_date": show_date(person.joining_date),
            "missing_docs": html_list(missing),
            "unclear_docs": unclear_html,
            "attempt": job.attempt,
        },
        to=[person.recruiter_email]
        if first
        else [person.recruiter_email, person.personal_email],
        cc=[rs.contacts.hr_onboarding_team],
        reply_to_email_id=previous.email_id if previous else None,
        case_id=case.case_id,
        task_id=job.task_id,
    )


@composer(DROPOUT)
async def compose_dropout(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id)
    if (
        not case
        or not case.is_active
        or case.stage
        not in (
            OnboardingStage.DOCS_REQUESTED.value,
            OnboardingStage.DOCS_IN_PROGRESS.value,
            OnboardingStage.DROPOUT.value,
        )
    ):
        return Skip("documents no longer being chased")
    items = await ChecklistItem.for_case(case.case_id)
    missing = _missing(items)
    if not missing:
        return Skip("nothing missing")
    person = await _person(case.person_id)
    rs = await runtime.current()
    await case.add_flags(CaseFlag.DROPOUT_RISK.value)
    await case.set_stage(OnboardingStage.DROPOUT.value)
    if job.task_id:
        task = await Task.find_by_id(job.task_id)
        if task and not task.is_closed:
            await task.update(status=TaskStatus.ESCALATED)
    await log_action(
        "dropout_flagged",
        case_id=case.case_id,
        entity_type="case",
        entity_id=case.case_id,
        details={"missing": len(missing)},
    )
    return Outbound(
        template_key="doc_dropout_alert",
        values={
            "candidate_name": person.full_name,
            "joining_date": show_date(person.joining_date),
            "missing_docs": html_list(missing),
        },
        to=[rs.contacts.recruitment_team, person.recruiter_email],
        cc=[rs.contacts.hr_onboarding_team],
        case_id=case.case_id,
        task_id=job.task_id,
    )


@composer(IT_REQUEST)
async def compose_it_request(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id)
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    if not case or not task or task.is_closed:
        return Skip("IT task closed")
    person = await _person(case.person_id)
    rs = await runtime.current()
    photo = await _photo_attachment(case.case_id)
    return Outbound(
        template_key="it_request",
        values={
            "candidate_name": person.full_name,
            "joining_date": show_date(person.joining_date),
            "onboarding_table": await _table(case, person),
        },
        to=[rs.contacts.it_team],
        cc=[rs.contacts.hr_onboarding_team, person.recruiter_email],
        attachment_ids=[photo] if photo else [],
        case_id=case.case_id,
        task_id=task.task_id,
    )


def _pending_it(task: Task) -> List[str]:
    labels = {"email_id": "Email ID", "d365": "D365 access"}
    return [
        labels.get(key, key) for key, value in task.sub_items.items() if value != "done"
    ]


@composer(IT_FOLLOWUP)
async def compose_it_followup(job: ScheduledJob):
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    if not task or task.status not in (TaskStatus.OPEN, TaskStatus.PARTIAL):
        return Skip("IT task closed")
    case = await Case.find_by_id(job.case_id)
    person = await _person(case.person_id)
    rs = await runtime.current()
    previous = await Email.latest_in_thread(case.case_id, ["it_request", "it_followup"])
    return Outbound(
        template_key="it_followup",
        values={
            "candidate_name": person.full_name,
            "pending_items": html_list(_pending_it(task)),
            "attempt": job.attempt,
        },
        to=[rs.contacts.it_team],
        cc=[rs.contacts.hr_onboarding_team],
        reply_to_email_id=previous.email_id if previous else None,
        case_id=case.case_id,
        task_id=task.task_id,
    )


@composer(IT_ESCALATION)
async def compose_it_escalation(job: ScheduledJob):
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    if not task or task.status not in (
        TaskStatus.OPEN,
        TaskStatus.PARTIAL,
        TaskStatus.ESCALATED,
    ):
        return Skip("IT task closed")
    case = await Case.find_by_id(job.case_id)
    person = await _person(case.person_id)
    rs = await runtime.current()
    await task.update(status=TaskStatus.ESCALATED)
    await log_action(
        "it_escalated", case_id=case.case_id, entity_type="task", entity_id=task.task_id
    )
    return Outbound(
        template_key="it_escalation",
        values={
            "candidate_name": person.full_name,
            "pending_items": html_list(_pending_it(task)),
        },
        to=[rs.contacts.hr_onboarding_owner],
        case_id=case.case_id,
        task_id=task.task_id,
    )


@composer(GROUP_INTIMATION)
async def compose_group_intimation(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id)
    if not case:
        return Skip("case missing")
    person = await _person(case.person_id)
    rs = await runtime.current()
    photo = await _photo_attachment(case.case_id)
    return Outbound(
        template_key="onboarding_group_intimation",
        values={
            "candidate_name": person.full_name,
            "joining_date": show_date(person.joining_date),
            "onboarding_table": await _table(case, person),
        },
        to=[rs.contacts.onboarding_group],
        attachment_ids=[photo] if photo else [],
        case_id=case.case_id,
    )


def _group_key(case_id: uuid.UUID) -> str:
    return f"{chain_key(case_id, None, 'group')}:{GROUP_INTIMATION}:0"


async def maybe_close(case: Case) -> None:
    if not case.is_active or case.stage != OnboardingStage.IT_REQUESTED.value:
        return
    task = await Task.for_case_type(case.case_id, TaskType.IT_SETUP.value)
    group_job = await ScheduledJob.find_by_dedupe(_group_key(case.case_id))
    if (
        task
        and task.status == TaskStatus.DONE
        and group_job
        and group_job.status == "done"
    ):
        await case.close(OnboardingStage.CLOSED.value)
        await log_action(
            "onboarding_closed",
            case_id=case.case_id,
            entity_type="case",
            entity_id=case.case_id,
        )
        await enqueue_event(
            "it.completed",
            {"case_id": str(case.case_id)},
            source="system",
            dedupe_key=f"it-completed:{case.case_id}",
            case_id=case.case_id,
        )


@sent_hook(GROUP_SENT)
async def on_group_sent(job: ScheduledJob) -> None:
    case = await Case.find_by_id(job.case_id)
    if case:
        await maybe_close(case)


async def _send_group_mail(case: Case) -> None:
    await start_email(
        GROUP_INTIMATION, case_id=case.case_id, scope="group", on_sent=GROUP_SENT
    )


async def handle_it_reply(email: Email, text: str, case: Case) -> None:
    task = await Task.for_case_type(case.case_id, TaskType.IT_SETUP.value)
    if not task or task.is_final:
        await log_action(
            "it_reply_without_open_task",
            case_id=case.case_id,
            entity_type="email",
            entity_id=email.email_id,
        )
        return
    person = await _person(case.person_id)
    rs = await runtime.current()
    excluded = {value for value in rs.contacts.model_dump().values() if value} | {
        settings.mailbox,
        email.from_email or "",
    }
    excluded |= {
        value for value in (person.recruiter_email, person.manager_email) if value
    }
    work_email = pick_work_email(text, rs.work_email_domain, person.full_name, excluded)
    result = await ai.read_it_setup(text, known_names=[person.full_name])
    if result.confidence < rs.ai_confidence_threshold:
        await case.add_flags(CaseFlag.NEEDS_HR.value)
        await log_action(
            "it_reply_unclear",
            case_id=case.case_id,
            entity_type="email",
            entity_id=email.email_id,
        )
        return
    sub_items = dict(task.sub_items)
    if result.email_created and (work_email or person.work_email):
        if work_email and work_email != person.work_email:
            person.work_email = work_email
            await person.save()
        sub_items["email_id"] = "done"
    if result.d365_created:
        sub_items["d365"] = "done"
    done = all(value == "done" for value in sub_items.values())
    status = (
        TaskStatus.DONE
        if done
        else TaskStatus.PARTIAL
        if any(value == "done" for value in sub_items.values())
        else task.status
    )
    await task.update(
        status=status, sub_items=sub_items, progress_notes="Updated from the IT reply"
    )
    if done:
        await ScheduledJob.cancel_pending(task_id=task.task_id)
    await log_action(
        "it_reply_read",
        case_id=case.case_id,
        entity_type="task",
        entity_id=task.task_id,
        details={"sub_items": sub_items},
    )
    if sub_items.get("email_id") == "done" and not result.credentials_sent_to_joiner:
        if not await Task.for_case_type(case.case_id, TaskType.SEND_CREDENTIALS.value):
            await Task.create(
                TaskType.SEND_CREDENTIALS.value,
                "hr",
                rs.contacts.hr_onboarding_owner or None,
                case_id=case.case_id,
            )
    if person.work_email:
        await _send_group_mail(case)
    await maybe_close(await Case.find_by_id(case.case_id))


async def on_task_updated(task: Task) -> None:
    if not task.case_id:
        return
    case = await Case.find_by_id(task.case_id)
    if not case or case.case_type != CaseType.ONBOARDING:
        return
    if task.task_type == TaskType.IT_SETUP.value and task.status == TaskStatus.DONE:
        await _send_group_mail(case)
        await maybe_close(await Case.find_by_id(case.case_id))


async def on_case_reopened(case: Case) -> None:
    if case.case_type != CaseType.ONBOARDING or case.stage not in DOC_STAGES:
        return
    if case.stage == OnboardingStage.DROPOUT.value:
        await case.set_stage(OnboardingStage.DOCS_IN_PROGRESS.value)
    await case.remove_flags(CaseFlag.DROPOUT_RISK.value)
    task = await Task.for_case_type(case.case_id, TaskType.DOC_COLLECTION.value)
    if task and not await ScheduledJob.next_pending_at(task_id=task.task_id):
        await task.update(status=TaskStatus.OPEN)
        await start_email(
            DOC_REMINDER,
            case_id=case.case_id,
            task_id=task.task_id,
            chase=_doc_chase(),
            attempt=1,
            scope=f"reopen-{int(utcnow().timestamp())}",
        )


async def onboarding_people_for_name_match() -> List[Tuple[Case, Person]]:
    cases = await Case.active_of_type(CaseType.ONBOARDING)
    people = await Person.find_by_ids([case.person_id for case in cases])
    return [
        (case, people[case.person_id]) for case in cases if case.person_id in people
    ]
