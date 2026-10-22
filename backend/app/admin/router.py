import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)

from app import runtime
from app.admin.enums import ActorType, FailureKind, InductionTrack
from app.admin.model import ChecklistTemplate, InductionTemplate
from app.admin.schemas import (
    ActionLogItem,
    ActionLogListResponse,
    ChecklistGroup,
    ChecklistGroupResponse,
    ChecklistListResponse,
    CreateHolidayRequest,
    DryRunData,
    DryRunResponse,
    FailureItem,
    FailureListResponse,
    HolidayData,
    HolidayListResponse,
    HolidayResponse,
    InductionTemplateData,
    InductionTemplateResponse,
    KillSwitchData,
    KillSwitchResponse,
    MailboxStatus,
    PutChecklistRequest,
    PutInductionTemplateRequest,
    QueueStatus,
    RetryData,
    RetryRequest,
    RetryResponse,
    StatusData,
    StatusResponse,
)
from app.audit import ActionLog, log_user_action
from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.common.enums import HireCategory, SortOrder
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadRequestResponse,
    ConflictResponse,
    ForbiddenResponse,
    NotFoundResponse,
)
from app.config import settings
from app.error import (
    AppException,
    BadRequestException,
    ConflictException,
    NotFoundException,
    validate_uuid,
)
from app.graph.model import MailboxState
from app.graph.service import subscription_status
from app.limiter import limiter
from app.logger import get_logger
from app.runtime.clock import utcnow
from app.runtime.model import Holiday
from app.runtime.schemas import (
    SWITCH_KEYS,
    DryRunRequest,
    KillSwitchRequest,
    SettingsListResponse,
)
from app.worker.model import Event, ScheduledJob, list_failures

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["Admin"])


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


@router.get(
    "/admin/status",
    response_model=StatusResponse,
    summary="Live switches and health",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": StatusResponse, "description": "Status"},
    },
)
@limiter.limit("60/minute")
async def admin_status(
    request: Request, current_user: User = Depends(get_current_user)
) -> StatusResponse:
    """
    Show the kill switch, dry-run, mailbox and queue health for the Admin screen.
    """
    try:
        rs = await runtime.current()
        mailbox = await MailboxState.get(settings.mailbox or "unconfigured")
        counts = await Event.counts()
        return StatusResponse(
            success=True,
            message="Status retrieved",
            data=StatusData(
                kill_switch=rs.kill_switch,
                dry_run=rs.dry_run,
                test_inbox=rs.test_inbox,
                document_reading_enabled=rs.document_reading_enabled,
                d365_enabled=rs.d365_enabled,
                mailbox=MailboxStatus(
                    subscription=await subscription_status(),
                    subscription_expires_at=_iso(mailbox.subscription_expires_at),
                    last_poll_at=_iso(mailbox.last_poll_at),
                    last_email_at=_iso(mailbox.last_email_at),
                ),
                queue=QueueStatus(
                    queued=counts.get("queued", 0),
                    processing=counts.get("processing", 0),
                    failed=counts.get("failed", 0),
                    pending_jobs=await ScheduledJob.pending_count(),
                ),
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Status error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/admin/kill-switch",
    response_model=KillSwitchResponse,
    summary="Stop or allow all sending",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": KillSwitchResponse, "description": "Kill switch changed"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can flip the switch",
        },
    },
)
@limiter.limit("30/minute")
async def kill_switch(
    request: Request,
    data: KillSwitchRequest,
    current_user: User = Depends(require_admin),
) -> KillSwitchResponse:
    """
    Stop or allow all sending, it takes effect within one minute.

    - **enabled**: required, true stops every outgoing email
    - **reason**: optional, why it was flipped, kept in the action log
    """
    try:
        await runtime.update({"kill_switch": data.enabled}, current_user.user_id)
        await log_user_action(
            current_user.user_id,
            "kill_switch_changed",
            details={"enabled": data.enabled, "reason": data.reason or ""},
        )
        return KillSwitchResponse(
            success=True,
            message="Sending stopped" if data.enabled else "Sending allowed",
            data=KillSwitchData(
                kill_switch=data.enabled,
                changed_by=current_user.name,
                changed_at=utcnow().isoformat(),
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Kill switch error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/admin/dry-run",
    response_model=DryRunResponse,
    summary="Turn test inbox mode on or off",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": DryRunResponse, "description": "Dry-run changed"},
        400: {
            "model": BadRequestResponse,
            "description": "Test inbox missing when enabling",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change dry-run",
        },
    },
)
@limiter.limit("30/minute")
async def dry_run(
    request: Request, data: DryRunRequest, current_user: User = Depends(require_admin)
) -> DryRunResponse:
    """
    Turn test inbox mode on or off.

    - **enabled**: required, true sends every email to the test inbox only
    - **test_inbox**: optional, required when enabling and no test inbox is set yet
    """
    try:
        current = await runtime.current()
        inbox = str(data.test_inbox).lower() if data.test_inbox else current.test_inbox
        if data.enabled and not inbox:
            raise BadRequestException("Set a test inbox to turn on dry-run")
        updated = await runtime.update(
            {"dry_run": data.enabled, "test_inbox": inbox}, current_user.user_id
        )
        await log_user_action(
            current_user.user_id, "dry_run_changed", details={"enabled": data.enabled}
        )
        return DryRunResponse(
            success=True,
            message="Dry-run turned on" if data.enabled else "Dry-run turned off",
            data=DryRunData(
                dry_run=updated.dry_run,
                test_inbox=updated.test_inbox,
                changed_by=current_user.name,
                changed_at=utcnow().isoformat(),
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Dry-run error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/settings",
    response_model=SettingsListResponse,
    summary="List HR settings",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": SettingsListResponse, "description": "Every tunable"},
    },
)
@limiter.limit("60/minute")
async def list_settings(
    request: Request, current_user: User = Depends(get_current_user)
) -> SettingsListResponse:
    """
    List every HR tunable with its current value, not paginated since the list is small.
    """
    try:
        return SettingsListResponse(
            success=True, message="Settings retrieved", data=await runtime.listing()
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List settings error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch(
    "/settings",
    response_model=SettingsListResponse,
    summary="Update HR settings",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": SettingsListResponse, "description": "Settings updated"},
        400: {
            "model": BadRequestResponse,
            "description": "Unknown key or invalid value",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change settings",
        },
    },
)
@limiter.limit("30/minute")
async def update_settings(
    request: Request,
    data: Dict[str, Any] = Body(
        ..., examples=[{"followup_gap_hours": 72, "max_followups": 2}]
    ),
    current_user: User = Depends(require_admin),
) -> SettingsListResponse:
    """
    Update one or more HR settings, each one is validated by its own type.

    - send key and value pairs, keys come from GET /api/settings
    - nested values like contacts are merged, so send only the keys that change
    - kill_switch, dry_run and test_inbox use their own endpoints
    """
    try:
        if not data:
            raise BadRequestException("Send at least one setting")
        blocked = sorted(SWITCH_KEYS & set(data))
        if blocked:
            raise BadRequestException(
                f"Use the dedicated endpoint for: {', '.join(blocked)}"
            )
        await runtime.update(data, current_user.user_id)
        await log_user_action(
            current_user.user_id, "settings_updated", details={"keys": sorted(data)}
        )
        return SettingsListResponse(
            success=True, message="Settings updated", data=await runtime.listing()
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update settings error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/checklist-templates",
    response_model=ChecklistListResponse,
    summary="List document checklists",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ChecklistListResponse, "description": "Checklists"},
    },
)
@limiter.limit("60/minute")
async def list_checklists(
    request: Request,
    hire_category: Optional[HireCategory] = Query(
        default=None, description="Filter by hire category"
    ),
    location: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Filter by location, * is the default checklist",
    ),
    current_user: User = Depends(get_current_user),
) -> ChecklistListResponse:
    """
    List document checklists per hire category and location.

    - **hire_category**: optional, campus or lateral
    - **location**: optional, exact location, * is the any location checklist
    """
    try:
        groups = await ChecklistTemplate.grouped(
            hire_category.value if hire_category else None, location
        )
        data = [
            ChecklistGroup(**{**group, "updated_at": _iso(group["updated_at"])})
            for group in groups
        ]
        return ChecklistListResponse(
            success=True, message=f"Found {len(data)} checklists", data=data
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List checklists error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put(
    "/checklist-templates",
    response_model=ChecklistGroupResponse,
    summary="Replace a document checklist",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ChecklistGroupResponse, "description": "Checklist saved"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change checklists",
        },
    },
)
@limiter.limit("30/minute")
async def put_checklist(
    request: Request,
    data: PutChecklistRequest,
    current_user: User = Depends(require_admin),
) -> ChecklistGroupResponse:
    """
    Replace the checklist for one hire category and location, only new joiners get the change.

    - **hire_category**: required, campus or lateral
    - **location**: optional, defaults to * which means any location
    - **items**: required, documents in order, each with document_type, is_mandatory and check_mode text or photo
    """
    try:
        location = data.location.strip() or "*"
        await ChecklistTemplate.replace(
            data.hire_category.value,
            location,
            [item.model_dump(mode="json") for item in data.items],
        )
        await log_user_action(
            current_user.user_id,
            "checklist_template_saved",
            details={
                "hire_category": data.hire_category.value,
                "location": location,
                "items": len(data.items),
            },
        )
        group = (await ChecklistTemplate.grouped(data.hire_category.value, location))[0]
        return ChecklistGroupResponse(
            success=True,
            message="Checklist saved",
            data=ChecklistGroup(**{**group, "updated_at": _iso(group["updated_at"])}),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Save checklist error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/induction-templates/{track}",
    response_model=InductionTemplateResponse,
    summary="Get an induction template",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": InductionTemplateResponse, "description": "Induction template"},
        404: {
            "model": NotFoundResponse,
            "description": "No template for this track yet",
        },
    },
)
@limiter.limit("60/minute")
async def get_induction_template(
    request: Request,
    track: InductionTrack,
    current_user: User = Depends(get_current_user),
) -> InductionTemplateResponse:
    """
    Return the session template for one induction track.

    - **track**: campus, mid or senior, passed in the path
    """
    try:
        template = await InductionTemplate.find(track.value)
        if not template:
            raise NotFoundException("No induction template for this track yet")
        return InductionTemplateResponse(
            success=True,
            message="Template retrieved",
            data=InductionTemplateData(**template.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Get induction template error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put(
    "/induction-templates/{track}",
    response_model=InductionTemplateResponse,
    summary="Replace an induction template",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": InductionTemplateResponse, "description": "Template saved"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change induction templates",
        },
    },
)
@limiter.limit("30/minute")
async def put_induction_template(
    request: Request,
    track: InductionTrack,
    data: PutInductionTemplateRequest,
    current_user: User = Depends(require_admin),
) -> InductionTemplateResponse:
    """
    Replace a track's sessions.

    - **track**: campus, mid or senior, passed in the path
    - **sessions**: required, each with title, owner_email, duration_mins and day_number
    - owner_email takes an email or a token such as manager, it_team or hr_owner
    """
    try:
        template = await InductionTemplate.upsert(
            track.value, [s.model_dump() for s in data.sessions], current_user.user_id
        )
        await log_user_action(
            current_user.user_id,
            "induction_template_saved",
            details={"track": track.value, "sessions": len(data.sessions)},
        )
        return InductionTemplateResponse(
            success=True,
            message="Template saved",
            data=InductionTemplateData(**template.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Save induction template error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/holidays",
    response_model=HolidayListResponse,
    summary="List holidays",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": HolidayListResponse, "description": "Holidays"},
    },
)
@limiter.limit("60/minute")
async def list_holidays(
    request: Request,
    year: Optional[int] = Query(
        default=None, ge=2000, le=2100, description="Filter by year"
    ),
    location: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Filter by location, company wide holidays always show",
    ),
    current_user: User = Depends(get_current_user),
) -> HolidayListResponse:
    """
    List holidays, they are skipped for sending and induction days.

    - **year**: optional, like 2026
    - **location**: optional, company wide holidays always show
    """
    try:
        holidays = await Holiday.find_all(year, location)
        return HolidayListResponse(
            success=True,
            message=f"Found {len(holidays)} holidays",
            data=[HolidayData(**h.to_dict()) for h in holidays],
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List holidays error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/holidays",
    response_model=HolidayResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a holiday",
    responses={
        **COMMON_ERROR_RESPONSES,
        201: {"model": HolidayResponse, "description": "Holiday added"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can add holidays",
        },
        409: {
            "model": ConflictResponse,
            "description": "Same date and location already exists",
        },
    },
)
@limiter.limit("30/minute")
async def create_holiday(
    request: Request,
    data: CreateHolidayRequest,
    current_user: User = Depends(require_admin),
) -> HolidayResponse:
    """
    Add a holiday.

    - **holiday_date**: required, YYYY-MM-DD
    - **name**: required
    - **location**: optional, null means every location
    """
    try:
        location = (
            data.location.strip() if data.location and data.location.strip() else None
        )
        if await Holiday.exists(data.holiday_date, location):
            raise ConflictException("This holiday already exists")
        holiday = await Holiday.create(data.holiday_date, data.name.strip(), location)
        runtime.invalidate()
        await log_user_action(
            current_user.user_id,
            "holiday_added",
            entity_type="holiday",
            entity_id=holiday.holiday_id,
        )
        return HolidayResponse(
            success=True, message="Holiday added", data=HolidayData(**holiday.to_dict())
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Create holiday error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete(
    "/holidays/{holiday_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a holiday",
    responses={
        **COMMON_ERROR_RESPONSES,
        204: {"description": "Holiday removed, no body"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can remove holidays",
        },
        404: {"model": NotFoundResponse, "description": "Holiday not found"},
    },
)
@limiter.limit("30/minute")
async def delete_holiday(
    request: Request, holiday_id: str, current_user: User = Depends(require_admin)
) -> Response:
    """
    Remove a holiday.

    - **holiday_id**: the holiday UUID, passed in the path
    """
    try:
        validate_uuid((holiday_id, "holiday_id"))
        if not await Holiday.delete(uuid.UUID(holiday_id)):
            raise NotFoundException("Holiday not found")
        runtime.invalidate()
        await log_user_action(
            current_user.user_id,
            "holiday_removed",
            entity_type="holiday",
            entity_id=uuid.UUID(holiday_id),
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Delete holiday error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/action-log",
    response_model=ActionLogListResponse,
    summary="Search the action log",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ActionLogListResponse, "description": "Action log entries"},
    },
)
@limiter.limit("60/minute")
async def action_log(
    request: Request,
    case_id: Optional[str] = Query(default=None, description="Filter by case UUID"),
    actor_type: Optional[ActorType] = Query(
        default=None, description="Filter by actor type"
    ),
    action: Optional[str] = Query(
        default=None, max_length=64, description="Filter by action name"
    ),
    date_from: Optional[datetime] = Query(default=None, description="From this time"),
    date_to: Optional[datetime] = Query(default=None, description="Up to this time"),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="latest or oldest"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> ActionLogListResponse:
    """
    Search the log of every action by the agent, the system and HR users.

    - **case_id**: optional, a case UUID
    - **actor_type**: optional, agent, user or system
    - **action**: optional, exact action name like email_sent
    - **date_from**, **date_to**: optional ISO 8601 times
    - **sort_order**: latest or oldest, defaults to latest
    """
    try:
        if case_id:
            validate_uuid((case_id, "case_id"))
        rows, total = await ActionLog.search(
            uuid.UUID(case_id) if case_id else None,
            actor_type.value if actor_type else None,
            action,
            date_from,
            date_to,
            sort_order != SortOrder.OLDEST,
            limit,
            offset,
        )
        data = [
            ActionLogItem(
                action_log_id=str(row["action_log_id"]),
                occurred_at=row["occurred_at"].isoformat(),
                actor_type=row["actor_type"],
                actor_name=row["actor_name"] or row["actor_type"],
                action=row["action"],
                case_id=str(row["case_id"]) if row["case_id"] else None,
                entity_type=row["entity_type"],
                entity_id=str(row["entity_id"]) if row["entity_id"] else None,
                details=row["details"] or {},
            )
            for row in rows
        ]
        return ActionLogListResponse(
            success=True,
            message=f"Found {total} entries",
            data=data,
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Action log error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/admin/failures",
    response_model=FailureListResponse,
    summary="List failed events and jobs",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": FailureListResponse, "description": "Failures"},
    },
)
@limiter.limit("60/minute")
async def failures(
    request: Request,
    kind: Optional[FailureKind] = Query(default=None, description="event or job"),
    event_type: Optional[str] = Query(
        default=None, max_length=64, description="Filter by event or job type"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> FailureListResponse:
    """
    List events and jobs that ran out of retries.

    - **kind**: optional, event or job
    - **event_type**: optional, like email.received or send_email
    """
    try:
        rows, total = await list_failures(
            kind.value if kind else None, event_type, limit, offset
        )
        data = [
            FailureItem(
                failure_id=str(row["failure_id"]),
                kind=row["kind"],
                event_type=row["event_type"],
                case_id=str(row["case_id"]) if row["case_id"] else None,
                attempts=row["attempts"],
                last_error=row["last_error"],
                updated_at=row["updated_at"].isoformat(),
            )
            for row in rows
        ]
        return FailureListResponse(
            success=True,
            message=f"Found {total} failures",
            data=data,
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Failures error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/admin/failures/{failure_id}/retry",
    response_model=RetryResponse,
    summary="Retry a failed event or job",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": RetryResponse, "description": "Queued again"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can retry"},
        404: {"model": NotFoundResponse, "description": "No failed item with this id"},
    },
)
@limiter.limit("30/minute")
async def retry_failure(
    request: Request,
    failure_id: str,
    data: RetryRequest,
    current_user: User = Depends(require_admin),
) -> RetryResponse:
    """
    Queue one failed event or job again.

    - **failure_id**: the event or job UUID, passed in the path
    - **kind**: required, event or job
    """
    try:
        validate_uuid((failure_id, "failure_id"))
        target = uuid.UUID(failure_id)
        if data.kind == FailureKind.EVENT:
            requeued = await Event.requeue(target)
            if requeued:
                from app.worker.events import dispatch

                await dispatch(target)
        else:
            requeued = await ScheduledJob.requeue(target)
        if not requeued:
            raise NotFoundException("No failed item with this id")
        await log_user_action(
            current_user.user_id,
            "failure_retried",
            entity_type=data.kind.value,
            entity_id=target,
        )
        return RetryResponse(
            success=True,
            message="Queued again",
            data=RetryData(failure_id=failure_id, kind=data.kind, status="queued"),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Retry error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
