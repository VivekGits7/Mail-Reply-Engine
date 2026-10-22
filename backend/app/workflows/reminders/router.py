import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.cases import TaskStatus
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
from app.workflows.reminders import service
from app.workflows.reminders.schemas import (
    CreateRuleRequest,
    DataSource,
    RuleData,
    RuleListResponse,
    RuleResponse,
    RuleSortBy,
    RuleTaskItem,
    RuleTaskListResponse,
    RuleTaskSortBy,
    UpdateRuleRequest,
    UploadListData,
    UploadListRequest,
    UploadListResponse,
)

logger = get_logger(__name__)

reminders_router = APIRouter(prefix="/api/reminder-rules", tags=["Reminders"])


@reminders_router.get(
    "",
    response_model=RuleListResponse,
    summary="List reminder rules",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": RuleListResponse, "description": "Rules"},
    },
)
@limiter.limit("60/minute")
async def list_rules(
    request: Request,
    search: Optional[str] = Query(
        default=None, max_length=100, description="Partial match on name or key"
    ),
    is_active: Optional[bool] = Query(
        default=None, description="Filter by active state"
    ),
    data_source: Optional[DataSource] = Query(
        default=None, description="upload, d365 or test"
    ),
    sort_by: RuleSortBy = Query(
        default=RuleSortBy.NAME, description="name or created_at"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.A_TO_Z, description="Sort direction"
    ),
    current_user: User = Depends(get_current_user),
) -> RuleListResponse:
    """
    List reminder rules with their open task counts.

    - **search**: optional, partial match on name or key
    - **is_active**: optional, true or false
    - **data_source**: optional, upload, d365 or test
    - **sort_by**: name or created_at, defaults to name
    """
    try:
        rules = await service.list_rules(
            search,
            is_active,
            data_source.value if data_source else None,
            sort_by,
            sort_order,
        )
        return RuleListResponse(
            success=True,
            message=f"Found {len(rules)} rules",
            data=[RuleData(**rule.to_dict()) for rule in rules],
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List rules error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@reminders_router.post(
    "",
    response_model=RuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a reminder rule",
    responses={
        **COMMON_ERROR_RESPONSES,
        201: {"model": RuleResponse, "description": "Rule created"},
        400: {
            "model": BadRequestResponse,
            "description": "Unknown template or bad cron",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can add rules",
        },
        409: {"model": ConflictResponse, "description": "rule_key already used"},
    },
)
@limiter.limit("30/minute")
async def create_rule(
    request: Request,
    data: CreateRuleRequest,
    current_user: User = Depends(require_admin),
) -> RuleResponse:
    """
    Add a reminder rule, no reminder logic is hard coded.

    - **name**, **rule_key**: required, rule_key is unique snake case
    - **recipient_field**: required, the column holding the email to remind
    - **required_columns**: required, columns every upload must have
    - **template_key**: required, an existing template
    - **stages**: optional, for multi step rules, each with stage, recipient_field and template_key
    - **schedule_cron**: required, when new reminders go out, read in IST
    - **followup_gap_hours**, **max_rounds**: optional, default 48 and 3
    - **escalate_to_email**: optional, gets one escalation after the last follow-up
    """
    try:
        rule = await service.create_rule(data, current_user)
        return RuleResponse(
            success=True, message="Rule created", data=RuleData(**rule.to_dict())
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Create rule error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@reminders_router.patch(
    "/{reminder_rule_id}",
    response_model=RuleResponse,
    summary="Edit or pause a rule",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": RuleResponse, "description": "Rule updated"},
        400: {
            "model": BadRequestResponse,
            "description": "Unknown template or bad cron",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can edit rules",
        },
        404: {"model": NotFoundResponse, "description": "Rule not found"},
    },
)
@limiter.limit("30/minute")
async def update_rule(
    request: Request,
    reminder_rule_id: str,
    data: UpdateRuleRequest,
    current_user: User = Depends(require_admin),
) -> RuleResponse:
    """
    Edit or pause a rule.

    - **reminder_rule_id**: the rule UUID, passed in the path
    - every field from the create request except rule_key is optional
    """
    try:
        validate_uuid((reminder_rule_id, "reminder_rule_id"))
        rule = await service.update_rule(
            uuid.UUID(reminder_rule_id), data, current_user
        )
        return RuleResponse(
            success=True, message="Rule updated", data=RuleData(**rule.to_dict())
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update rule error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@reminders_router.post(
    "/{reminder_rule_id}/uploads",
    response_model=UploadListResponse,
    summary="Import a pending people list",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": UploadListResponse, "description": "List imported"},
        400: {
            "model": BadRequestResponse,
            "description": "Wrong file type or missing columns",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can import lists",
        },
        404: {"model": NotFoundResponse, "description": "Rule not found"},
    },
)
@limiter.limit("20/minute")
async def upload_list(
    request: Request,
    reminder_rule_id: str,
    data: UploadListRequest,
    current_user: User = Depends(require_admin),
) -> UploadListResponse:
    """
    Take HR's pending people list for one rule.

    - **reminder_rule_id**: the rule UUID, passed in the path
    - **file**: required, CSV or XLSX from POST /api/uploads/presign with purpose reminder_list
    - new rows become tasks, tasks whose rows are gone close, tasks marked done that are still listed reopen
    """
    try:
        validate_uuid((reminder_rule_id, "reminder_rule_id"))
        result = await service.import_list(
            uuid.UUID(reminder_rule_id), data.file, current_user
        )
        return UploadListResponse(
            success=True, message="List imported", data=UploadListData(**result)
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Upload list error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@reminders_router.get(
    "/{reminder_rule_id}/tasks",
    response_model=RuleTaskListResponse,
    summary="List tasks under a rule",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": RuleTaskListResponse, "description": "Tasks"},
        404: {"model": NotFoundResponse, "description": "Rule not found"},
    },
)
@limiter.limit("60/minute")
async def list_rule_tasks(
    request: Request,
    reminder_rule_id: str,
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Partial match on owner email or employee name",
    ),
    status_filter: Optional[TaskStatus] = Query(
        default=None, alias="status", description="Filter by task status"
    ),
    sort_by: RuleTaskSortBy = Query(
        default=RuleTaskSortBy.CREATED_AT, description="due_at or created_at"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="Sort direction"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> RuleTaskListResponse:
    """
    List the tasks under one rule.

    - **reminder_rule_id**: the rule UUID, passed in the path
    - **search**: optional, partial match on owner email or employee name
    - **status**: optional, open, partial, done, paused, escalated and so on
    - **sort_by**: due_at or created_at
    """
    try:
        validate_uuid((reminder_rule_id, "reminder_rule_id"))
        items, total = await service.list_tasks(
            uuid.UUID(reminder_rule_id),
            search,
            status_filter.value if status_filter else None,
            sort_by,
            sort_order,
            limit,
            offset,
        )
        return RuleTaskListResponse(
            success=True,
            message=f"Found {total} tasks",
            data=[RuleTaskItem(**i) for i in items],
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List rule tasks error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
