from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.cases.enums import CaseFlag, CaseStatus, TaskStatus
from app.common.schemas import BaseResponse

CHECKLIST_ITEM_EXAMPLE = {
    "checklist_item_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "document_type": "pan_card",
    "is_mandatory": True,
    "check_mode": "text",
    "status": "verified",
    "person_check": "match",
    "attachment_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "notes": None,
    "updated_at": "2026-10-22T11:05:00+05:30",
}

TASK_EXAMPLE = {
    "task_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "task_type": "clearance_it",
    "owner_role": "it",
    "owner_email": "it@tcgdigital.com",
    "status": "partial",
    "sub_items": {"credentials": "done", "laptop": "pending"},
    "progress_notes": "Laptop return pending from the user",
    "followups_sent": 1,
    "next_followup_at": "2026-11-27T10:00:00+05:30",
    "due_at": None,
    "completed_at": None,
}

CASE_EXAMPLE = {
    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "case_type": "onboarding",
    "stage": "docs_in_progress",
    "status": "open",
    "flags": [],
    "track": None,
    "parent_case_id": None,
    "opened_at": "2026-10-20T10:00:00+05:30",
    "closed_at": None,
}


class ChecklistItemData(BaseModel):
    checklist_item_id: str = Field(
        ...,
        description="Checklist item UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    document_type: str = Field(..., description="Document type", examples=["pan_card"])
    is_mandatory: bool = Field(..., description="Needed for sign-off", examples=[True])
    check_mode: str = Field(..., description="text or photo", examples=["text"])
    status: str = Field(
        ...,
        description="pending, received, verified, unreadable, wrong_type or name_mismatch",
        examples=["verified"],
    )
    person_check: Optional[str] = Field(
        default=None, description="match, mismatch or not_found", examples=["match"]
    )
    attachment_id: Optional[str] = Field(
        default=None,
        description="Latest file for this item",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    notes: Optional[str] = Field(default=None, description="HR note", examples=[None])
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last change",
        examples=["2026-10-22T11:05:00+05:30"],
    )


class TaskData(BaseModel):
    task_id: str = Field(
        ..., description="Task UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    case_id: Optional[str] = Field(
        default=None,
        description="Case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    task_type: str = Field(..., description="Task type", examples=["clearance_it"])
    owner_role: str = Field(..., description="Who owns it", examples=["it"])
    owner_email: Optional[str] = Field(
        default=None, description="Owner email", examples=["it@tcgdigital.com"]
    )
    status: str = Field(
        ...,
        description="open, partial, done, blocked, not_applicable, escalated, paused or cancelled",
        examples=["partial"],
    )
    sub_items: Dict[str, str] = Field(
        ...,
        description="Item level status",
        examples=[{"credentials": "done", "laptop": "pending"}],
    )
    progress_notes: Optional[str] = Field(
        default=None,
        description="Latest progress note",
        examples=["Laptop return pending from the user"],
    )
    followups_sent: int = Field(..., description="Follow-ups sent so far", examples=[1])
    next_followup_at: Optional[str] = Field(
        default=None,
        description="When the next follow-up goes out",
        examples=["2026-11-27T10:00:00+05:30"],
    )
    due_at: Optional[str] = Field(
        default=None, description="Due date when known", examples=[None]
    )
    completed_at: Optional[str] = Field(
        default=None, description="When it was closed", examples=[None]
    )


class CaseData(BaseModel):
    case_id: str = Field(
        ..., description="Case UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    case_type: str = Field(
        ...,
        description="onboarding, exit, induction or feedback",
        examples=["onboarding"],
    )
    stage: str = Field(..., description="Current stage", examples=["docs_in_progress"])
    status: str = Field(
        ..., description="open, on_hold, closed or cancelled", examples=["open"]
    )
    flags: List[str] = Field(
        ..., description="Attention flags", examples=[["name_mismatch"]]
    )
    track: Optional[str] = Field(
        default=None, description="Induction track", examples=[None]
    )
    parent_case_id: Optional[str] = Field(
        default=None,
        description="Onboarding case behind an induction case",
        examples=[None],
    )
    opened_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time the case opened",
        examples=["2026-10-20T10:00:00+05:30"],
    )
    closed_at: Optional[str] = Field(
        default=None, description="ISO 8601 time the case closed", examples=[None]
    )


class UpdateCaseRequest(BaseModel):
    status: Optional[CaseStatus] = Field(
        default=None,
        description="open, on_hold, closed or cancelled",
        examples=["open"],
    )
    clear_flags: List[CaseFlag] = Field(
        default_factory=list, description="Flags to clear", examples=[["dropout_risk"]]
    )
    note: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Why, kept as a flag that a note exists",
        examples=["Candidate confirmed joining"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "open",
                "clear_flags": ["dropout_risk"],
                "note": "Candidate confirmed joining",
            }
        }
    )


class CaseUpdateResponse(BaseResponse):
    data: CaseData = Field(..., description="Updated case")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Case updated",
                "data": CASE_EXAMPLE,
            }
        }
    )


class UpdateTaskRequest(BaseModel):
    status: Optional[TaskStatus] = Field(
        default=None, description="New status", examples=["done"]
    )
    sub_items: Dict[str, str] = Field(
        default_factory=dict,
        description="Item level updates, merged into the current items",
        examples=[{"laptop": "done"}],
    )
    note: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Progress note",
        examples=["Laptop received at reception"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "done",
                "sub_items": {"laptop": "done"},
                "note": "Laptop received at reception",
            }
        }
    )


class TaskResponse(BaseResponse):
    data: TaskData = Field(..., description="Updated task")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Task updated",
                "data": TASK_EXAMPLE,
            }
        }
    )


def task_data(task: Any, next_followup_at: Optional[str] = None) -> TaskData:
    return TaskData(**task.to_dict(), next_followup_at=next_followup_at)


def case_data(case: Any) -> CaseData:
    return CaseData(**case.to_dict())


def checklist_data(item: Any) -> ChecklistItemData:
    return ChecklistItemData(**item.to_dict())
