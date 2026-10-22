import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.cases import CaseFlag, checklist_data, task_data
from app.common.enums import HireCategory, SortOrder
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
from app.workflows.onboarding import service
from app.workflows.onboarding.enums import JoinerSortBy, OnboardingStage
from app.workflows.onboarding.schemas import (
    ChecklistOverrideData,
    ChecklistOverrideRequest,
    ChecklistOverrideResponse,
    CreateJoinerRequest,
    JoinerCreatedData,
    JoinerCreatedResponse,
    JoinerListItem,
    JoinerListResponse,
    JoinerUpdateData,
    JoinerUpdateResponse,
    SignOffData,
    SignOffRequest,
    SignOffResponse,
    UpdateJoinerRequest,
)

logger = get_logger(__name__)

joiners_router = APIRouter(prefix="/api/joiners", tags=["Joiners"])
signoff_router = APIRouter(prefix="/api/cases", tags=["Joiners"])


@joiners_router.post(
    "",
    response_model=JoinerCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a joiner",
    responses={
        **COMMON_ERROR_RESPONSES,
        201: {
            "model": JoinerCreatedResponse,
            "description": "Joiner created and document request queued",
        },
        400: {
            "model": BadRequestResponse,
            "description": "Joining date in the past or no checklist for this category and location",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can create joiners",
        },
        409: {
            "model": ConflictResponse,
            "description": "An open onboarding case already exists for this personal email",
        },
    },
)
@limiter.limit("30/minute")
async def create_joiner(
    request: Request,
    data: CreateJoinerRequest,
    current_user: User = Depends(require_admin),
) -> JoinerCreatedResponse:
    """
    Create a joiner, open the onboarding case, build the checklist and send the document request.

    - **full_name**: required
    - **personal_email**: required, the candidate is kept in CC
    - **recruiter_email**: required, gets the document request
    - **hire_category**: required, campus or lateral
    - **location**: required, picks the checklist, falls back to the any location checklist
    - **level**: required, like L4
    - **joining_date**: required, today or later
    - **date_of_birth**: required, used only by the local person check
    - **manager_name**, **manager_email**: required
    - the document request goes to the recruiter right away, within the sending window
    """
    try:
        person, case, items = await service.create_joiner(data, current_user)
        return JoinerCreatedResponse(
            success=True,
            message="Joiner created and document request queued",
            data=JoinerCreatedData(
                person=to_person_data(person),
                case_id=str(case.case_id),
                stage=case.stage,
                checklist=[checklist_data(i) for i in items],
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Create joiner error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@joiners_router.get(
    "",
    response_model=JoinerListResponse,
    summary="List joiners",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": JoinerListResponse, "description": "Joiners"},
    },
)
@limiter.limit("60/minute")
async def list_joiners(
    request: Request,
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Partial match on name, personal email or employee code",
    ),
    stage: Optional[OnboardingStage] = Query(
        default=None, description="Filter by stage"
    ),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        pattern="^(open|on_hold|closed|cancelled)$",
        description="Filter by case status",
    ),
    flag: Optional[CaseFlag] = Query(
        default=None, description="Filter by attention flag"
    ),
    hire_category: Optional[HireCategory] = Query(
        default=None, description="Filter by hire category"
    ),
    location: Optional[str] = Query(
        default=None, max_length=100, description="Filter by location"
    ),
    level: Optional[str] = Query(
        default=None, max_length=4, description="Filter by level like L4"
    ),
    joining_from: Optional[date] = Query(
        default=None, description="Joining on or after"
    ),
    joining_to: Optional[date] = Query(
        default=None, description="Joining on or before"
    ),
    sort_by: JoinerSortBy = Query(
        default=JoinerSortBy.CREATED_AT, description="Column to sort on"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="Sort direction"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> JoinerListResponse:
    """
    List joiners with their onboarding progress.

    - **search**: optional, partial match on name, personal email or employee code
    - **stage**: optional, docs_requested, docs_in_progress, ready_for_signoff, it_requested, closed or dropout
    - **status**: optional, open, on_hold, closed or cancelled
    - **flag**: optional, like name_mismatch or dropout_risk
    - **hire_category**, **location**, **level**: optional filters
    - **joining_from**, **joining_to**: optional date range
    - **sort_by**: joining_date, full_name, updated_at or created_at, defaults to created_at
    - **sort_order**: latest, oldest, a_to_z or z_to_a, defaults to latest
    """
    try:
        items, total = await service.list_joiners(
            search,
            stage.value if stage else None,
            status_filter,
            flag.value if flag else None,
            hire_category,
            location,
            level,
            joining_from,
            joining_to,
            sort_by,
            sort_order,
            limit,
            offset,
        )
        return JoinerListResponse(
            success=True,
            message=f"Found {total} joiners",
            data=[JoinerListItem(**item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List joiners error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@joiners_router.patch(
    "/{person_id}",
    response_model=JoinerUpdateResponse,
    summary="Fix joiner details",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": JoinerUpdateResponse, "description": "Joiner updated"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can edit joiners",
        },
        404: {
            "model": NotFoundResponse,
            "description": "Joiner or open case not found",
        },
        409: {"model": ConflictResponse, "description": "Already signed off"},
    },
)
@limiter.limit("30/minute")
async def update_joiner(
    request: Request,
    person_id: str,
    data: UpdateJoinerRequest,
    current_user: User = Depends(require_admin),
) -> JoinerUpdateResponse:
    """
    Fix joiner details before sign-off, changing the name or date of birth re-runs the person check on saved documents.

    - **person_id**: the joiner's UUID, passed in the path
    - any field from the create request is optional here
    """
    try:
        validate_uuid((person_id, "person_id"))
        person, rechecked = await service.update_joiner(
            uuid.UUID(person_id), data, current_user
        )
        return JoinerUpdateResponse(
            success=True,
            message="Joiner updated",
            data=JoinerUpdateData(
                person=to_person_data(person), rechecked_documents=rechecked
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update joiner error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@signoff_router.post(
    "/{case_id}/sign-off",
    response_model=SignOffResponse,
    summary="Sign off ready to onboard",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": SignOffResponse, "description": "Signed off, IT request queued"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can sign off"},
        404: {"model": NotFoundResponse, "description": "Onboarding case not found"},
        409: {
            "model": ConflictResponse,
            "description": "Documents not verified without a reason, or Employee ID already used",
        },
    },
)
@limiter.limit("30/minute")
async def sign_off(
    request: Request,
    case_id: str,
    data: SignOffRequest,
    current_user: User = Depends(require_admin),
) -> SignOffResponse:
    """
    HR's ready to onboard call, saves the Employee ID and the rest of the onboarding template, then sends the IT request.

    - **case_id**: the onboarding case UUID, passed in the path
    - **employee_code**, **designation**, **gender**, **bu_head**, **employment_type**, **contact_number**, **sector_region**, **skills**: required
    - **system_type**, **proj_ops**, **ess_d365**, **business_card**: required, true or false
    - **project_code**, **blood_group**, **date_of_marriage**: optional
    - **force_reason**: optional, signs off before every document is verified
    - the IT request goes out with the passport photo attached and is chased every follow-up gap
    """
    try:
        validate_uuid((case_id, "case_id"))
        case, person, it_task = await service.sign_off(
            uuid.UUID(case_id), data, current_user
        )
        return SignOffResponse(
            success=True,
            message="Signed off, IT request queued",
            data=SignOffData(
                case_id=str(case.case_id),
                stage=case.stage,
                person=to_person_data(person),
                it_task=task_data(it_task),
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Sign-off error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@signoff_router.patch(
    "/{case_id}/checklist/{checklist_item_id}",
    response_model=ChecklistOverrideResponse,
    summary="Verify or override a checklist item",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ChecklistOverrideResponse, "description": "Checklist updated"},
        400: {
            "model": BadRequestResponse,
            "description": "File does not belong to this case",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change the checklist",
        },
        404: {"model": NotFoundResponse, "description": "Case or item not found"},
    },
)
@limiter.limit("30/minute")
async def override_checklist(
    request: Request,
    case_id: str,
    checklist_item_id: str,
    data: ChecklistOverrideRequest,
    current_user: User = Depends(require_admin),
) -> ChecklistOverrideResponse:
    """
    HR verifies or overrides one checklist item, like a name mismatch or the passport photo.

    - **case_id**, **checklist_item_id**: UUIDs, passed in the path
    - **status**: required, verified, received, wrong_type, unreadable or pending
    - **note**: optional
    - **attachment_id**: optional, links a received file to this item
    - once every mandatory item is verified the case moves to ready_for_signoff
    """
    try:
        validate_uuid((case_id, "case_id"), (checklist_item_id, "checklist_item_id"))
        if data.attachment_id:
            validate_uuid((data.attachment_id, "attachment_id"))
        item, stage = await service.override_checklist(
            uuid.UUID(case_id), uuid.UUID(checklist_item_id), data, current_user
        )
        return ChecklistOverrideResponse(
            success=True,
            message="Checklist updated",
            data=ChecklistOverrideData(
                checklist_item=checklist_data(item), case_stage=stage
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Checklist override error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
