import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.audit import ActionLog, log_user_action
from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.cases import (
    Approval,
    ApprovalStatus,
    ApprovalType,
    Case,
    CaseType,
    ChecklistItem,
    Task,
    case_data,
    checklist_data,
    task_data,
)
from app.common.enums import SortOrder
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadRequestResponse,
    ConflictResponse,
    ForbiddenResponse,
    NotFoundResponse,
)
from app.engine.schemas import (
    ApprovalDetail,
    ApprovalDetailResponse,
    ApprovalDraft,
    ApprovalListItem,
    ApprovalListResponse,
    ApprovalSummary,
    ApproveData,
    ApproveRequest,
    ApproveResponse,
    CaseDetailData,
    CaseDetailResponse,
    RejectData,
    RejectRequest,
    RejectResponse,
    RelatedCase,
    SourceEmail,
    TimelineEntry,
    UpdateApprovalRequest,
)
from app.error import (
    AppException,
    BadRequestException,
    ConflictException,
    NotFoundException,
    validate_uuid,
)
from app.limiter import limiter
from app.logger import get_logger
from app.mail import Attachment, Email
from app.mail.schemas import AttachmentData
from app.people import Person, to_person_data
from app.worker import ScheduledJob, enqueue_event
from app.workflows.induction import service as induction
from app.workflows.induction.model import InductionSession
from app.workflows.induction.schemas import InductionSessionData

logger = get_logger(__name__)

case_view_router = APIRouter(prefix="/api/cases", tags=["Cases"])
approvals_router = APIRouter(prefix="/api/approvals", tags=["Approvals"])

HIDDEN_KINDS = {"transcript", "report"}


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if value else None


def _email_actor(email: Email, person: Person) -> str:
    if email.direction == "outbound":
        return "agent"
    sender = (email.from_email or "").lower()
    if sender in person.emails():
        return "candidate" if person.role.value == "candidate" else "employee"
    if sender == person.recruiter_email:
        return "recruiter"
    if sender == person.manager_email:
        return "manager"
    return email.from_name or "external"


async def _timeline(case: Case, person: Person) -> List[TimelineEntry]:
    entries: List[TimelineEntry] = []
    for email in await Email.for_case(case.case_id):
        moment = email.received_at or email.created_at
        entries.append(
            TimelineEntry(
                at=moment.isoformat(),
                kind="email",
                direction=email.direction,
                subject=email.subject,
                summary=email.ai_summary
                or (
                    "Sent " + (email.template_key or "email").replace("_", " ")
                    if email.direction == "outbound"
                    else email.subject or "Email received"
                ),
                category=email.category,
                actor=_email_actor(email, person),
                email_id=str(email.email_id),
            )
        )
    for row in await ActionLog.for_case(case.case_id):
        if row["action"] == "email_sent":
            continue
        entries.append(
            TimelineEntry(
                at=row["occurred_at"].isoformat(),
                kind="action",
                summary=row["action"].replace("_", " ").capitalize(),
                actor=row["actor_name"] or row["actor_type"],
            )
        )
    return sorted(entries, key=lambda entry: entry.at)


@case_view_router.get(
    "/{case_id}",
    response_model=CaseDetailResponse,
    summary="Get one case",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": CaseDetailResponse, "description": "Everything about the case"},
        404: {"model": NotFoundResponse, "description": "Case not found"},
    },
)
@limiter.limit("60/minute")
async def get_case(
    request: Request, case_id: str, current_user: User = Depends(get_current_user)
) -> CaseDetailResponse:
    """
    Everything about one case for the Case details screen, for every case type.

    - **case_id**: the case UUID, passed in the path
    - checklist is filled for onboarding cases, sessions for induction cases
    - complaints never show up here
    """
    try:
        validate_uuid((case_id, "case_id"))
        case = await Case.find_by_id(uuid.UUID(case_id))
        if not case:
            raise NotFoundException("Case not found")
        person = await Person.find_by_id(case.person_id)
        checklist = (
            await ChecklistItem.for_case(case.case_id)
            if case.case_type == CaseType.ONBOARDING
            else []
        )
        attachments = [
            a
            for a in await Attachment.for_case(case.case_id)
            if a.kind not in HIDDEN_KINDS
        ]
        tasks = []
        for task in await Task.for_case(case.case_id):
            next_at = await ScheduledJob.next_pending_at(task_id=task.task_id)
            tasks.append(task_data(task, _iso(next_at)))
        sessions = (
            await InductionSession.for_case(case.case_id)
            if case.case_type == CaseType.INDUCTION
            else []
        )
        related = (
            [await Case.find_by_id(case.parent_case_id)] if case.parent_case_id else []
        )
        related += await Case.children(case.case_id)
        next_at = await ScheduledJob.next_pending_at(case_id=case.case_id)
        data = CaseDetailData(
            case=case_data(case),
            person=to_person_data(person),
            checklist=[checklist_data(item) for item in checklist],
            attachments=[AttachmentData(**a.to_dict()) for a in attachments],
            tasks=tasks,
            sessions=[InductionSessionData(**s.to_dict()) for s in sessions],
            approvals=[
                ApprovalSummary(
                    approval_id=str(a.approval_id),
                    approval_type=a.approval_type,
                    status=a.status,
                    created_at=_iso(a.created_at),
                )
                for a in await Approval.for_case(case.case_id)
            ],
            timeline=await _timeline(case, person),
            related_cases=[
                RelatedCase(
                    case_id=str(c.case_id),
                    case_type=c.case_type.value,
                    stage=c.stage,
                    status=c.status.value,
                )
                for c in related
                if c
            ],
            next_followup_at=_iso(next_at),
        )
        return CaseDetailResponse(success=True, message="Case retrieved", data=data)
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Get case error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def _person_names(approvals: List[Approval]) -> Dict[uuid.UUID, str]:
    case_ids = {a.case_id for a in approvals if a.case_id}
    cases = [await Case.find_by_id(case_id) for case_id in case_ids]
    people = await Person.find_by_ids([c.person_id for c in cases if c])
    return {
        c.case_id: people[c.person_id].full_name
        for c in cases
        if c and c.person_id in people
    }


def _list_item(approval: Approval, names: Dict[uuid.UUID, str]) -> Dict[str, Any]:
    return {
        "approval_id": str(approval.approval_id),
        "approval_type": approval.approval_type,
        "case_id": str(approval.case_id) if approval.case_id else None,
        "person_name": names.get(approval.case_id) if approval.case_id else None,
        "summary": approval.summary,
        "status": approval.status,
        "created_at": _iso(approval.created_at),
    }


async def _detail(approval: Approval) -> ApprovalDetail:
    names = await _person_names([approval])
    source = None
    if approval.source_email_id:
        email = await Email.find_by_id(approval.source_email_id)
        if email:
            source = SourceEmail(
                email_id=str(email.email_id),
                from_email=email.from_email,
                subject=email.subject,
                received_at=_iso(email.received_at),
                body=email.body_text,
            )
    allowed = set(ApprovalDraft.model_fields)
    return ApprovalDetail(
        **_list_item(approval, names),
        source_email=source,
        draft=ApprovalDraft(
            **{key: value for key, value in approval.draft.items() if key in allowed}
        ),
        decided_at=_iso(approval.decided_at),
        reject_reason=approval.reject_reason,
    )


async def _pending(approval_id: str) -> Approval:
    validate_uuid((approval_id, "approval_id"))
    approval = await Approval.find_by_id(uuid.UUID(approval_id))
    if not approval:
        raise NotFoundException("Approval not found")
    if approval.status != ApprovalStatus.PENDING:
        raise ConflictException("This draft is no longer pending")
    return approval


async def _merged_draft(approval: Approval, edit: ApprovalDraft) -> Dict[str, Any]:
    changes = edit.model_dump(exclude_unset=True, exclude_none=True)
    draft = {**approval.draft, **changes}
    if approval.approval_type == ApprovalType.REPLY:
        if (
            not str(draft.get("subject", "")).strip()
            or not str(draft.get("body", "")).strip()
        ):
            raise BadRequestException("A reply needs a subject and a body")
        if not draft.get("to"):
            raise BadRequestException("A reply needs at least one recipient")
    else:
        sessions = draft.get("sessions") or []
        if not sessions:
            raise BadRequestException(
                "An induction schedule needs at least one session"
            )
        case = await Case.find_by_id(approval.case_id)
        person = await Person.find_by_id(case.person_id) if case else None
        await induction.validate_sessions(sessions, person.location if person else None)
    return draft


@approvals_router.get(
    "",
    response_model=ApprovalListResponse,
    summary="List the approval queue",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ApprovalListResponse, "description": "Approval queue"},
    },
)
@limiter.limit("60/minute")
async def list_approvals(
    request: Request,
    status: Optional[ApprovalStatus] = Query(
        default=ApprovalStatus.PENDING, description="Filter by status"
    ),
    approval_type: Optional[ApprovalType] = Query(
        default=None, description="reply or induction_schedule"
    ),
    case_id: Optional[str] = Query(default=None, description="Filter by case UUID"),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="latest or oldest"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> ApprovalListResponse:
    """
    List AI drafted replies and induction schedules waiting for HR.

    - **status**: optional, pending, approved, rejected or sent, defaults to pending
    - **approval_type**: optional, reply or induction_schedule
    - **case_id**: optional, a case UUID
    - **sort_order**: latest or oldest
    """
    try:
        if case_id:
            validate_uuid((case_id, "case_id"))
        approvals, total = await Approval.search(
            status.value if status else None,
            approval_type.value if approval_type else None,
            uuid.UUID(case_id) if case_id else None,
            sort_order != SortOrder.OLDEST,
            limit,
            offset,
        )
        names = await _person_names(approvals)
        return ApprovalListResponse(
            success=True,
            message=f"Found {total} approvals",
            data=[ApprovalListItem(**_list_item(a, names)) for a in approvals],
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List approvals error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@approvals_router.get(
    "/{approval_id}",
    response_model=ApprovalDetailResponse,
    summary="Get one draft",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {
            "model": ApprovalDetailResponse,
            "description": "Draft with its source email",
        },
        404: {"model": NotFoundResponse, "description": "Approval not found"},
    },
)
@limiter.limit("60/minute")
async def get_approval(
    request: Request, approval_id: str, current_user: User = Depends(get_current_user)
) -> ApprovalDetailResponse:
    """
    Show one draft plus the email that triggered it.

    - **approval_id**: the approval UUID, passed in the path
    """
    try:
        validate_uuid((approval_id, "approval_id"))
        approval = await Approval.find_by_id(uuid.UUID(approval_id))
        if not approval:
            raise NotFoundException("Approval not found")
        return ApprovalDetailResponse(
            success=True, message="Approval retrieved", data=await _detail(approval)
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Get approval error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@approvals_router.patch(
    "/{approval_id}",
    response_model=ApprovalDetailResponse,
    summary="Save edits to a draft",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ApprovalDetailResponse, "description": "Draft saved"},
        400: {
            "model": BadRequestResponse,
            "description": "Draft is incomplete, or a session is on a weekend, holiday or outside hours",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can edit drafts",
        },
        404: {"model": NotFoundResponse, "description": "Approval not found"},
        409: {"model": ConflictResponse, "description": "No longer pending"},
    },
)
@limiter.limit("30/minute")
async def update_approval(
    request: Request,
    approval_id: str,
    data: UpdateApprovalRequest,
    current_user: User = Depends(require_admin),
) -> ApprovalDetailResponse:
    """
    Save HR's edits to a draft without approving it.

    - **approval_id**: the approval UUID, passed in the path
    - **draft**: reply drafts take subject, body and to, schedules take sessions with title, owner_email, start and end
    """
    try:
        approval = await _pending(approval_id)
        await approval.save_draft(await _merged_draft(approval, data.draft))
        await log_user_action(
            current_user.user_id,
            "draft_edited",
            case_id=approval.case_id,
            entity_type="approval",
            entity_id=approval.approval_id,
        )
        return ApprovalDetailResponse(
            success=True, message="Draft saved", data=await _detail(approval)
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update approval error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@approvals_router.post(
    "/{approval_id}/approve",
    response_model=ApproveResponse,
    summary="Approve a draft",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ApproveResponse, "description": "Approved"},
        400: {"model": BadRequestResponse, "description": "Draft is incomplete"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can approve"},
        404: {"model": NotFoundResponse, "description": "Approval not found"},
        409: {"model": ConflictResponse, "description": "No longer pending"},
    },
)
@limiter.limit("30/minute")
async def approve(
    request: Request,
    approval_id: str,
    data: ApproveRequest,
    current_user: User = Depends(require_admin),
) -> ApproveResponse:
    """
    Approve a draft, a reply goes out in its thread, a schedule is saved and the availability mails start.

    - **approval_id**: the approval UUID, passed in the path
    - **draft**: optional, a final edit, or null to approve as is
    - the kill switch and dry-run still apply, approved replies skip the sending window and the daily cap
    """
    try:
        approval = await _pending(approval_id)
        draft = await _merged_draft(approval, data.draft or ApprovalDraft())
        if draft != approval.draft:
            await approval.save_draft(draft)
        if not await approval.decide(ApprovalStatus.APPROVED, current_user.user_id):
            raise ConflictException("This draft is no longer pending")
        await log_user_action(
            current_user.user_id,
            "draft_approved",
            case_id=approval.case_id,
            entity_type="approval",
            entity_id=approval.approval_id,
        )
        await enqueue_event(
            "approval.approved",
            {"approval_id": str(approval.approval_id)},
            source="hr_action",
            dedupe_key=f"approved:{approval.approval_id}",
            case_id=approval.case_id,
        )
        fresh = await Approval.find_by_id(approval.approval_id)
        sent = await Email.find_by_approval(approval.approval_id)
        sessions = (
            await InductionSession.for_case(approval.case_id)
            if approval.approval_type == ApprovalType.INDUCTION_SCHEDULE
            and approval.case_id
            else []
        )
        return ApproveResponse(
            success=True,
            message="Approved",
            data=ApproveData(
                approval_id=str(fresh.approval_id),
                status=fresh.status,
                email_id=str(sent.email_id) if sent else None,
                sessions_created=len(sessions),
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Approve error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@approvals_router.post(
    "/{approval_id}/reject",
    response_model=RejectResponse,
    summary="Reject a draft",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": RejectResponse, "description": "Rejected, nothing sent"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can reject"},
        404: {"model": NotFoundResponse, "description": "Approval not found"},
        409: {"model": ConflictResponse, "description": "No longer pending"},
    },
)
@limiter.limit("30/minute")
async def reject(
    request: Request,
    approval_id: str,
    data: RejectRequest,
    current_user: User = Depends(require_admin),
) -> RejectResponse:
    """
    Reject a draft, nothing is sent.

    - **approval_id**: the approval UUID, passed in the path
    - **reason**: required, a short note
    - rejecting an induction schedule cancels that induction, plan it again from the onboarding case
    """
    try:
        approval = await _pending(approval_id)
        if not await approval.decide(
            ApprovalStatus.REJECTED, current_user.user_id, data.reason
        ):
            raise ConflictException("This draft is no longer pending")
        await log_user_action(
            current_user.user_id,
            "draft_rejected",
            case_id=approval.case_id,
            entity_type="approval",
            entity_id=approval.approval_id,
        )
        await enqueue_event(
            "approval.rejected",
            {"approval_id": str(approval.approval_id)},
            source="hr_action",
            dedupe_key=f"rejected:{approval.approval_id}",
            case_id=approval.case_id,
        )
        return RejectResponse(
            success=True,
            message="Rejected, nothing was sent",
            data=RejectData(
                approval_id=str(approval.approval_id), status=ApprovalStatus.REJECTED
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Reject error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
