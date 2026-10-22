import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.cases import task_data
from app.common.enums import SortOrder
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadRequestResponse,
    ConflictResponse,
    ForbiddenResponse,
    NotFoundResponse,
)
from app.error import AppException, validate_uuid
from app.limiter import limiter
from app.logger import get_logger
from app.people import to_person_data
from app.workflows.exits import service
from app.workflows.exits.enums import ClearanceTeam, ExitSortBy, ExitStage
from app.workflows.exits.schemas import (
    CreateExitRequest,
    ExitCreatedData,
    ExitCreatedResponse,
    ExitListItem,
    ExitListResponse,
    ReleaseConfirmData,
    ReleaseConfirmRequest,
    ReleaseConfirmResponse,
)

logger = get_logger(__name__)

exits_router = APIRouter(prefix="/api/exits", tags=["Exits"])
release_router = APIRouter(prefix="/api/cases", tags=["Exits"])


@exits_router.post(
    "",
    response_model=ExitCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an exit",
    responses={
        **COMMON_ERROR_RESPONSES,
        201: {
            "model": ExitCreatedResponse,
            "description": "Exit created and clearance mail queued",
        },
        400: {
            "model": BadRequestResponse,
            "description": "Neither person_id nor full employee details",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can create exits",
        },
        404: {"model": NotFoundResponse, "description": "person_id not found"},
        409: {
            "model": ConflictResponse,
            "description": "An open exit case already exists",
        },
    },
)
@limiter.limit("30/minute")
async def create_exit(
    request: Request,
    data: CreateExitRequest,
    current_user: User = Depends(require_admin),
) -> ExitCreatedResponse:
    """
    Create an exit case with IT, Finance, Admin and Manager clearance tasks, and send the group mail.

    - **person_id**: optional, someone already in the system
    - **full_name**, **employee_code**, **work_email**, **manager_email**: required when person_id is empty
    - **manager_name**: optional
    - **last_working_day**: required
    - the intimation goes to the offboarding group and the manager, then each pending team is chased in the same thread
    - Finance is chased every finance_followup_gap_hours, other teams every followup_gap_hours
    """
    try:
        if data.person_id:
            validate_uuid((data.person_id, "person_id"))
        case, person, tasks = await service.create_exit(data, current_user)
        return ExitCreatedResponse(
            success=True,
            message="Exit created and clearance mail queued",
            data=ExitCreatedData(
                case_id=str(case.case_id),
                person=to_person_data(person),
                stage=case.stage,
                tasks=[task_data(task) for task in tasks],
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Create exit error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@exits_router.get(
    "",
    response_model=ExitListResponse,
    summary="List exits",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ExitListResponse, "description": "Exits"},
    },
)
@limiter.limit("60/minute")
async def list_exits(
    request: Request,
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Partial match on name, employee code or work email",
    ),
    stage: Optional[ExitStage] = Query(default=None, description="Filter by stage"),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        pattern="^(open|on_hold|closed|cancelled)$",
        description="Filter by case status",
    ),
    pending_team: Optional[ClearanceTeam] = Query(
        default=None, description="Only exits where this team is not cleared"
    ),
    lwd_from: Optional[date] = Query(
        default=None, description="Last working day on or after"
    ),
    lwd_to: Optional[date] = Query(
        default=None, description="Last working day on or before"
    ),
    sort_by: ExitSortBy = Query(
        default=ExitSortBy.CREATED_AT, description="Column to sort on"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="Sort direction"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> ExitListResponse:
    """
    List exits with the clearance status of each team.

    - **search**: optional, partial match on name, employee code or work email
    - **stage**: optional, clearance_requested, clearances_in_progress, all_cleared or closed
    - **status**: optional, open, on_hold, closed or cancelled
    - **pending_team**: optional, it, finance, admin or manager
    - **lwd_from**, **lwd_to**: optional last working day range
    - **sort_by**: last_working_day, full_name or created_at, defaults to created_at
    - **sort_order**: latest, oldest, a_to_z or z_to_a, defaults to latest
    """
    try:
        items, total = await service.list_exits(
            search,
            stage.value if stage else None,
            status_filter,
            pending_team,
            lwd_from,
            lwd_to,
            sort_by,
            sort_order,
            limit,
            offset,
        )
        return ExitListResponse(
            success=True,
            message=f"Found {total} exits",
            data=[ExitListItem(**item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List exits error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@release_router.post(
    "/{case_id}/release-confirm",
    response_model=ReleaseConfirmResponse,
    summary="Confirm the release letter",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ReleaseConfirmResponse, "description": "Exit closed"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can confirm"},
        404: {"model": NotFoundResponse, "description": "Exit case not found"},
        409: {"model": ConflictResponse, "description": "Clearances are not complete"},
    },
)
@limiter.limit("30/minute")
async def release_confirm(
    request: Request,
    case_id: str,
    data: ReleaseConfirmRequest,
    current_user: User = Depends(require_admin),
) -> ReleaseConfirmResponse:
    """
    HR's final call that the relieving letter can be issued, closes the exit case.

    - **case_id**: the exit case UUID, passed in the path
    - **note**: optional
    - only works once every clearance is done or not applicable
    """
    try:
        validate_uuid((case_id, "case_id"))
        case = await service.release_confirm(
            uuid.UUID(case_id), bool(data.note), current_user
        )
        return ReleaseConfirmResponse(
            success=True,
            message="Release confirmed and exit closed",
            data=ReleaseConfirmData(
                case_id=str(case.case_id),
                stage=case.stage,
                closed_at=case.closed_at.isoformat() if case.closed_at else None,
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Release confirm error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
