import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import log_user_action
from app.auth.model import User
from app.auth.service import require_admin
from app.cases.enums import CaseStatus, TaskStatus
from app.cases.model import Case, Task
from app.cases.schemas import (
    CaseUpdateResponse,
    TaskResponse,
    UpdateCaseRequest,
    UpdateTaskRequest,
    case_data,
    task_data,
)
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadRequestResponse,
    ConflictResponse,
    ForbiddenResponse,
    NotFoundResponse,
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
from app.worker import ScheduledJob, enqueue_event

logger = get_logger(__name__)

cases_router = APIRouter(prefix="/api/cases", tags=["Cases"])
tasks_router = APIRouter(prefix="/api/tasks", tags=["Cases"])

OPEN_TASK_STATUSES = {TaskStatus.OPEN, TaskStatus.PARTIAL}


@cases_router.patch(
    "/{case_id}",
    response_model=CaseUpdateResponse,
    summary="Pause, resume, close or cancel a case",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": CaseUpdateResponse, "description": "Case updated"},
        400: {"model": BadRequestResponse, "description": "Nothing to change"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change cases",
        },
        404: {"model": NotFoundResponse, "description": "Case not found"},
        409: {
            "model": ConflictResponse,
            "description": "Case is already closed or cancelled",
        },
    },
)
@limiter.limit("30/minute")
async def update_case(
    request: Request,
    case_id: str,
    data: UpdateCaseRequest,
    current_user: User = Depends(require_admin),
) -> CaseUpdateResponse:
    """
    Pause, resume, close or cancel a case, and clear flags.

    - **case_id**: the case UUID, passed in the path
    - **status**: optional, open, on_hold, closed or cancelled
    - **clear_flags**: optional, flags to remove, like dropout_risk
    - **note**: optional, why, the note text is not stored in the log
    - on_hold, closed and cancelled cancel pending follow-ups, going back to open restarts them
    """
    try:
        validate_uuid((case_id, "case_id"))
        case = await Case.find_by_id(uuid.UUID(case_id))
        if not case:
            raise NotFoundException("Case not found")
        if data.status is None and not data.clear_flags:
            raise BadRequestException("Send a status or flags to clear")
        if (
            case.status in (CaseStatus.CLOSED, CaseStatus.CANCELLED)
            and data.status != CaseStatus.OPEN
        ):
            raise ConflictException("This case is already closed")
        previous = case.status
        if data.clear_flags:
            await case.remove_flags(*[flag.value for flag in data.clear_flags])
        if data.status and data.status != previous:
            await case.set_status(data.status)
            if data.status != CaseStatus.OPEN:
                await ScheduledJob.cancel_pending(case_id=case.case_id)
        if data.status == CaseStatus.OPEN:
            await enqueue_event(
                "case.reopened",
                {"case_id": str(case.case_id)},
                source="hr_action",
                case_id=case.case_id,
            )
        await log_user_action(
            current_user.user_id,
            "case_updated",
            case_id=case.case_id,
            entity_type="case",
            entity_id=case.case_id,
            details={
                "status": data.status.value if data.status else None,
                "cleared": [f.value for f in data.clear_flags],
                "has_note": bool(data.note),
            },
        )
        return CaseUpdateResponse(
            success=True,
            message="Case updated",
            data=case_data(await Case.find_by_id(case.case_id)),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update case error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@tasks_router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Update a task by hand",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": TaskResponse, "description": "Task updated"},
        400: {"model": BadRequestResponse, "description": "Nothing to change"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change tasks",
        },
        404: {"model": NotFoundResponse, "description": "Task not found"},
        409: {"model": ConflictResponse, "description": "Task is already closed"},
    },
)
@limiter.limit("30/minute")
async def update_task(
    request: Request,
    task_id: str,
    data: UpdateTaskRequest,
    current_user: User = Depends(require_admin),
) -> TaskResponse:
    """
    Update a task by hand, like a clearance done over Teams or credentials sent.

    - **task_id**: the task UUID, passed in the path
    - **status**: optional, open, partial, done, blocked, not_applicable, escalated, paused or cancelled
    - **sub_items**: optional, item level updates merged into the current ones
    - **note**: optional, progress note
    - closing the task cancels its follow-ups and checks if the whole case is complete
    """
    try:
        validate_uuid((task_id, "task_id"))
        task = await Task.find_by_id(uuid.UUID(task_id))
        if not task:
            raise NotFoundException("Task not found")
        if data.status is None and not data.sub_items and not data.note:
            raise BadRequestException("Send a status, sub items or a note")
        if task.is_final and data.status not in OPEN_TASK_STATUSES:
            raise ConflictException("This task is already closed")
        merged = {**task.sub_items, **data.sub_items} if data.sub_items else None
        await task.update(
            status=data.status,
            sub_items=merged,
            progress_notes=data.note,
            clear_pause=data.status in OPEN_TASK_STATUSES,
        )
        if task.status not in OPEN_TASK_STATUSES:
            await ScheduledJob.cancel_pending(task_id=task.task_id)
        await enqueue_event(
            "task.updated",
            {"task_id": str(task.task_id), "by_user": str(current_user.user_id)},
            source="hr_action",
            case_id=task.case_id,
        )
        await log_user_action(
            current_user.user_id,
            "task_updated",
            case_id=task.case_id,
            entity_type="task",
            entity_id=task.task_id,
            details={
                "status": task.status.value,
                "sub_items": sorted(data.sub_items),
                "has_note": bool(data.note),
            },
        )
        fresh = await Task.find_by_id(task.task_id)
        next_at = await ScheduledJob.next_pending_at(task_id=task.task_id)
        return TaskResponse(
            success=True,
            message="Task updated",
            data=task_data(fresh, next_at.isoformat() if next_at else None),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update task error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
