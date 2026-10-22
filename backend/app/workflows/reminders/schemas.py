import re
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.cases.schemas import TASK_EXAMPLE
from app.common.attachment import FileAttachment
from app.common.schemas import BaseResponse, PaginatedResponse

KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


class DataSource(str, Enum):
    UPLOAD = "upload"
    D365 = "d365"
    TEST = "test"


class RuleSortBy(str, Enum):
    NAME = "name"
    CREATED_AT = "created_at"


class RuleTaskSortBy(str, Enum):
    DUE_AT = "due_at"
    CREATED_AT = "created_at"


class RuleStage(BaseModel):
    stage: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Stage value used in the upload",
        examples=["manager_review"],
    )
    recipient_field: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Column with the email to remind",
        examples=["manager_email"],
    )
    template_key: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Template used at this stage",
        examples=["appraisal_manager"],
    )


class RuleFields(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Rule name",
        examples=["Timesheet"],
    )
    data_source: DataSource = Field(
        default=DataSource.UPLOAD,
        description="upload, d365 or test",
        examples=["upload"],
    )
    recipient_field: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Column with the email to remind",
        examples=["employee_email"],
    )
    required_columns: List[str] = Field(
        ...,
        min_length=1,
        max_length=30,
        description="Columns every upload must have",
        examples=[["employee_name", "employee_email", "item"]],
    )
    template_key: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Template used for reminders",
        examples=["reminder_timesheet"],
    )
    stages: List[RuleStage] = Field(
        default_factory=list,
        description="Stages for multi step rules such as appraisals",
    )
    schedule_cron: str = Field(
        ...,
        min_length=9,
        max_length=64,
        description="When new reminders go out, cron in IST",
        examples=["0 10 * * MON"],
    )
    followup_gap_hours: int = Field(
        default=48, ge=1, le=720, description="Hours between follow-ups", examples=[48]
    )
    max_rounds: int = Field(
        default=3, ge=0, le=10, description="Follow-ups before escalation", examples=[3]
    )
    escalate_to_email: Optional[EmailStr] = Field(
        default=None,
        description="Who hears about people who never respond",
        examples=["hr@tcgdigital.com"],
    )
    is_active: bool = Field(
        default=True, description="Inactive rules send nothing", examples=[True]
    )

    @field_validator("required_columns")
    @classmethod
    def clean_columns(cls, value: List[str]) -> List[str]:
        return [column.strip().lower() for column in value if column.strip()]


class CreateRuleRequest(RuleFields):
    rule_key: str = Field(
        ..., description="Unique snake case key", examples=["timesheet"]
    )

    @field_validator("rule_key")
    @classmethod
    def validate_key(cls, value: str) -> str:
        value = value.strip().lower()
        if not KEY_PATTERN.match(value):
            raise ValueError("Use lowercase letters, numbers and underscores")
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Timesheet",
                "rule_key": "timesheet",
                "data_source": "upload",
                "recipient_field": "employee_email",
                "required_columns": ["employee_name", "employee_email", "item"],
                "template_key": "reminder_timesheet",
                "stages": [],
                "schedule_cron": "0 10 * * MON",
                "followup_gap_hours": 48,
                "max_rounds": 3,
                "escalate_to_email": "hr@tcgdigital.com",
                "is_active": True,
            }
        }
    )


class UpdateRuleRequest(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Rule name",
        examples=["Timesheet"],
    )
    recipient_field: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=64,
        description="Column with the email to remind",
        examples=["employee_email"],
    )
    required_columns: Optional[List[str]] = Field(
        default=None,
        min_length=1,
        description="Columns every upload must have",
        examples=[["employee_name", "employee_email"]],
    )
    template_key: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=64,
        description="Template used for reminders",
        examples=["reminder_timesheet"],
    )
    stages: Optional[List[RuleStage]] = Field(
        default=None, description="Stages for multi step rules"
    )
    schedule_cron: Optional[str] = Field(
        default=None,
        min_length=9,
        max_length=64,
        description="When new reminders go out",
        examples=["0 10 * * MON"],
    )
    followup_gap_hours: Optional[int] = Field(
        default=None,
        ge=1,
        le=720,
        description="Hours between follow-ups",
        examples=[72],
    )
    max_rounds: Optional[int] = Field(
        default=None,
        ge=0,
        le=10,
        description="Follow-ups before escalation",
        examples=[2],
    )
    escalate_to_email: Optional[EmailStr] = Field(
        default=None, description="Escalation contact", examples=["hr@tcgdigital.com"]
    )
    is_active: Optional[bool] = Field(
        default=None, description="Turn the rule on or off", examples=[False]
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"is_active": False, "followup_gap_hours": 72}}
    )


class RuleData(BaseModel):
    reminder_rule_id: str = Field(
        ..., description="Rule UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    name: str = Field(..., description="Rule name", examples=["Timesheet"])
    rule_key: str = Field(..., description="Unique key", examples=["timesheet"])
    data_source: DataSource = Field(
        ..., description="upload, d365 or test", examples=["upload"]
    )
    recipient_field: str = Field(
        ..., description="Column with the email to remind", examples=["employee_email"]
    )
    required_columns: List[str] = Field(
        ...,
        description="Columns every upload must have",
        examples=[["employee_name", "employee_email", "item"]],
    )
    template_key: str = Field(
        ..., description="Template used for reminders", examples=["reminder_timesheet"]
    )
    stages: List[RuleStage] = Field(..., description="Stages for multi step rules")
    schedule_cron: str = Field(
        ..., description="When new reminders go out", examples=["0 10 * * MON"]
    )
    followup_gap_hours: int = Field(
        ..., description="Hours between follow-ups", examples=[48]
    )
    max_rounds: int = Field(
        ..., description="Follow-ups before escalation", examples=[3]
    )
    escalate_to_email: Optional[str] = Field(
        default=None, description="Escalation contact", examples=["hr@tcgdigital.com"]
    )
    is_active: bool = Field(..., description="Whether the rule sends", examples=[True])
    next_run_at: Optional[str] = Field(
        default=None,
        description="Next scheduled run",
        examples=["2026-10-26T10:00:00+05:30"],
    )
    open_tasks: int = Field(
        ..., description="Open tasks under this rule", examples=[12]
    )


RULE_EXAMPLE = {
    "reminder_rule_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Timesheet",
    "rule_key": "timesheet",
    "data_source": "upload",
    "recipient_field": "employee_email",
    "required_columns": ["employee_name", "employee_email", "item"],
    "template_key": "reminder_timesheet",
    "stages": [],
    "schedule_cron": "0 10 * * MON",
    "followup_gap_hours": 48,
    "max_rounds": 3,
    "escalate_to_email": "hr@tcgdigital.com",
    "is_active": True,
    "next_run_at": "2026-10-26T10:00:00+05:30",
    "open_tasks": 12,
}


class RuleListResponse(BaseResponse):
    data: List[RuleData] = Field(..., description="Reminder rules")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 rule",
                "data": [RULE_EXAMPLE],
            }
        }
    )


class RuleResponse(BaseResponse):
    data: RuleData = Field(..., description="Reminder rule")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"success": True, "message": "Rule saved", "data": RULE_EXAMPLE}
        }
    )


class UploadListRequest(BaseModel):
    file: FileAttachment = Field(
        ...,
        description="CSV or XLSX from POST /api/uploads/presign with purpose reminder_list",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "file": {
                    "file_name": "pending.xlsx",
                    "file_url": "uploads/reminder_list/0b7c.xlsx",
                    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "size": 20480,
                }
            }
        }
    )


class InvalidRow(BaseModel):
    row: int = Field(..., description="Row number in the file", examples=[7])
    reason: str = Field(
        ..., description="Why it was skipped", examples=["employee_email is missing"]
    )


class UploadListData(BaseModel):
    rows_total: int = Field(..., description="Rows read", examples=[40])
    rows_valid: int = Field(..., description="Rows used", examples=[38])
    rows_invalid: List[InvalidRow] = Field(..., description="Rows skipped with reasons")
    tasks_created: int = Field(..., description="New tasks", examples=[30])
    tasks_closed: int = Field(
        ..., description="Tasks closed because their row is gone", examples=[5]
    )
    tasks_reopened: int = Field(
        ..., description="Tasks reopened because their row is still there", examples=[1]
    )


class UploadListResponse(BaseResponse):
    data: UploadListData = Field(..., description="Import result")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "List imported",
                "data": {
                    "rows_total": 40,
                    "rows_valid": 38,
                    "rows_invalid": [{"row": 7, "reason": "employee_email is missing"}],
                    "tasks_created": 30,
                    "tasks_closed": 5,
                    "tasks_reopened": 1,
                },
            }
        }
    )


class RuleTaskItem(BaseModel):
    task_id: str = Field(
        ..., description="Task UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    owner_email: Optional[str] = Field(
        default=None,
        description="Who is reminded",
        examples=["rahul.sharma@tcgdigital.com"],
    )
    status: str = Field(..., description="Task status", examples=["open"])
    followups_sent: int = Field(..., description="Follow-ups sent", examples=[1])
    next_followup_at: Optional[str] = Field(
        default=None,
        description="Next follow-up",
        examples=["2026-10-27T10:00:00+05:30"],
    )
    details: Dict[str, Any] = Field(
        ...,
        description="The uploaded row",
        examples=[{"employee_name": "Rahul Sharma", "item": "Week 42"}],
    )
    paused_until: Optional[str] = Field(
        default=None, description="Paused until, when on leave", examples=[None]
    )
    completed_at: Optional[str] = Field(
        default=None, description="When it was closed", examples=[None]
    )


class RuleTaskListResponse(PaginatedResponse):
    data: List[RuleTaskItem] = Field(..., description="Tasks under this rule")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 task",
                "data": [
                    {
                        "task_id": TASK_EXAMPLE["task_id"],
                        "owner_email": "rahul.sharma@tcgdigital.com",
                        "status": "open",
                        "followups_sent": 1,
                        "next_followup_at": "2026-10-27T10:00:00+05:30",
                        "details": {"employee_name": "Rahul Sharma", "item": "Week 42"},
                        "paused_until": None,
                        "completed_at": None,
                    }
                ],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )
