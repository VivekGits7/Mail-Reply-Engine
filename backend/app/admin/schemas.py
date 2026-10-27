import re
from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.admin.enums import FailureKind, InductionTrack
from app.common.enums import CheckMode, HireCategory
from app.common.schemas import BaseResponse, PaginatedResponse

OWNER_TOKENS = {
    "manager",
    "hr_owner",
    "it_team",
    "hr_onboarding_owner",
    "hr_onboarding_team",
    "admin_team",
    "finance_team",
    "training_team",
    "performance_team",
}
DOCUMENT_TYPE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


class MailboxStatus(BaseModel):
    subscription: str = Field(
        ...,
        description="active, expired, polling_only or not_configured",
        examples=["active"],
    )
    subscription_expires_at: Optional[str] = Field(
        default=None,
        description="When the Graph subscription expires",
        examples=["2026-10-24T09:00:00+05:30"],
    )
    last_poll_at: Optional[str] = Field(
        default=None,
        description="Last backup poll of the inbox",
        examples=["2026-10-22T12:02:00+05:30"],
    )
    last_email_at: Optional[str] = Field(
        default=None,
        description="Last inbound email seen",
        examples=["2026-10-22T11:50:00+05:30"],
    )


class QueueStatus(BaseModel):
    queued: int = Field(..., description="Events waiting to run", examples=[2])
    processing: int = Field(..., description="Events running now", examples=[1])
    failed: int = Field(..., description="Events that ran out of retries", examples=[0])
    pending_jobs: int = Field(
        ..., description="Scheduled emails and checks waiting", examples=[14]
    )


class StatusData(BaseModel):
    kill_switch: bool = Field(
        ..., description="Whether all sending is stopped", examples=[False]
    )
    dry_run: bool = Field(
        ..., description="Whether every email goes to the test inbox", examples=[True]
    )
    test_inbox: str = Field(
        ...,
        description="Test inbox used in dry-run",
        examples=["hr-test@tcgdigital.com"],
    )
    document_reading_enabled: bool = Field(
        ..., description="Whether document content is read", examples=[False]
    )
    d365_enabled: bool = Field(
        ..., description="Whether D365 is polled", examples=[False]
    )
    mailbox: MailboxStatus = Field(..., description="Mailbox health")
    queue: QueueStatus = Field(..., description="Queue health")


STATUS_EXAMPLE = {
    "kill_switch": False,
    "dry_run": True,
    "test_inbox": "hr-test@tcgdigital.com",
    "document_reading_enabled": False,
    "d365_enabled": False,
    "mailbox": {
        "subscription": "active",
        "subscription_expires_at": "2026-10-24T09:00:00+05:30",
        "last_poll_at": "2026-10-22T12:02:00+05:30",
        "last_email_at": "2026-10-22T11:50:00+05:30",
    },
    "queue": {"queued": 2, "processing": 1, "failed": 0, "pending_jobs": 14},
}


class StatusResponse(BaseResponse):
    data: StatusData = Field(..., description="Live switches and health")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Status retrieved",
                "data": STATUS_EXAMPLE,
            }
        }
    )


class KillSwitchData(BaseModel):
    kill_switch: bool = Field(
        ..., description="Whether all sending is stopped", examples=[True]
    )
    changed_by: str = Field(
        ..., description="Admin who changed it", examples=["TCG Admin"]
    )
    changed_at: str = Field(
        ...,
        description="ISO 8601 time of the change",
        examples=["2026-10-22T12:05:00+05:30"],
    )


class KillSwitchResponse(BaseResponse):
    data: KillSwitchData = Field(..., description="New kill switch state")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Sending stopped",
                "data": {
                    "kill_switch": True,
                    "changed_by": "TCG Admin",
                    "changed_at": "2026-10-22T12:05:00+05:30",
                },
            }
        }
    )


class DryRunData(BaseModel):
    dry_run: bool = Field(
        ..., description="Whether every email goes to the test inbox", examples=[False]
    )
    test_inbox: str = Field(
        ..., description="Test inbox", examples=["hr-test@tcgdigital.com"]
    )
    changed_by: str = Field(
        ..., description="Admin who changed it", examples=["TCG Admin"]
    )
    changed_at: str = Field(
        ...,
        description="ISO 8601 time of the change",
        examples=["2026-10-22T12:06:00+05:30"],
    )


class DryRunResponse(BaseResponse):
    data: DryRunData = Field(..., description="New dry-run state")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Dry-run turned off",
                "data": {
                    "dry_run": False,
                    "test_inbox": "hr-test@tcgdigital.com",
                    "changed_by": "TCG Admin",
                    "changed_at": "2026-10-22T12:06:00+05:30",
                },
            }
        }
    )


class ChecklistItemIn(BaseModel):
    document_type: str = Field(
        ..., description="Snake case document type", examples=["relieving_letter"]
    )
    is_mandatory: bool = Field(
        default=True, description="Whether sign-off needs it verified", examples=[True]
    )
    check_mode: CheckMode = Field(
        default=CheckMode.TEXT,
        description="text is read and checked, photo is verified by HR",
        examples=["text"],
    )

    @field_validator("document_type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        value = value.strip().lower()
        if not DOCUMENT_TYPE_PATTERN.match(value):
            raise ValueError(
                "Use lowercase letters, numbers and underscores, like relieving_letter"
            )
        return value


class ChecklistItemOut(ChecklistItemIn):
    sort_order: int = Field(..., description="Position in the checklist", examples=[1])


class ChecklistGroup(BaseModel):
    hire_category: HireCategory = Field(
        ..., description="Hire category", examples=["lateral"]
    )
    location: str = Field(
        ..., description="Location, * means any location", examples=["*"]
    )
    items: List[ChecklistItemOut] = Field(..., description="Documents in order")
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last change",
        examples=["2026-10-20T10:00:00+05:30"],
    )


CHECKLIST_EXAMPLE = {
    "hire_category": "lateral",
    "location": "*",
    "items": [
        {
            "document_type": "relieving_letter",
            "is_mandatory": True,
            "check_mode": "text",
            "sort_order": 0,
        }
    ],
    "updated_at": "2026-10-20T10:00:00+05:30",
}


class ChecklistListResponse(BaseResponse):
    data: List[ChecklistGroup] = Field(
        ..., description="Checklists per hire category and location"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 checklist",
                "data": [CHECKLIST_EXAMPLE],
            }
        }
    )


class ChecklistGroupResponse(BaseResponse):
    data: ChecklistGroup = Field(..., description="Saved checklist")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Checklist saved",
                "data": CHECKLIST_EXAMPLE,
            }
        }
    )


class PutChecklistRequest(BaseModel):
    hire_category: HireCategory = Field(
        ..., description="Hire category", examples=["lateral"]
    )
    location: str = Field(
        default="*",
        min_length=1,
        max_length=100,
        description="Location, * means any location",
        examples=["Kolkata"],
    )
    items: List[ChecklistItemIn] = Field(
        ..., min_length=1, max_length=40, description="Documents in order"
    )

    @field_validator("items")
    @classmethod
    def unique_types(cls, items: List[ChecklistItemIn]) -> List[ChecklistItemIn]:
        types = [item.document_type for item in items]
        if len(types) != len(set(types)):
            raise ValueError("Each document type can appear once")
        return items

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "hire_category": "lateral",
                "location": "Kolkata",
                "items": [
                    {
                        "document_type": "relieving_letter",
                        "is_mandatory": True,
                        "check_mode": "text",
                    },
                    {
                        "document_type": "passport_photo",
                        "is_mandatory": True,
                        "check_mode": "photo",
                    },
                ],
            }
        }
    )


class InductionSessionTemplate(BaseModel):
    title: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Session title",
        examples=["IT orientation"],
    )
    owner_email: str = Field(
        ...,
        min_length=3,
        max_length=320,
        description="Owner email, or a contact token like manager or it_team",
        examples=["it_team"],
    )
    duration_mins: int = Field(
        ..., ge=15, le=480, description="Length in minutes", examples=[60]
    )
    day_number: int = Field(
        ...,
        ge=1,
        le=10,
        description="Working day of the induction, day 1 is the joining day",
        examples=[1],
    )

    @field_validator("owner_email")
    @classmethod
    def validate_owner(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in OWNER_TOKENS and not re.match(
            r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value
        ):
            raise ValueError(
                f"Use an email or one of {', '.join(sorted(OWNER_TOKENS))}"
            )
        return value


class InductionTemplateData(BaseModel):
    track: InductionTrack = Field(..., description="Induction track", examples=["mid"])
    sessions: List[InductionSessionTemplate] = Field(
        ..., description="Sessions in this track"
    )
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last change",
        examples=["2026-10-20T10:00:00+05:30"],
    )


INDUCTION_TEMPLATE_EXAMPLE = {
    "track": "mid",
    "sessions": [
        {
            "title": "IT orientation",
            "owner_email": "it_team",
            "duration_mins": 60,
            "day_number": 1,
        }
    ],
    "updated_at": "2026-10-20T10:00:00+05:30",
}


class InductionTemplateResponse(BaseResponse):
    data: InductionTemplateData = Field(..., description="Induction template")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Template retrieved",
                "data": INDUCTION_TEMPLATE_EXAMPLE,
            }
        }
    )


class PutInductionTemplateRequest(BaseModel):
    sessions: List[InductionSessionTemplate] = Field(
        ..., min_length=1, max_length=30, description="Sessions in this track"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sessions": [
                    {
                        "title": "IT orientation",
                        "owner_email": "it_team",
                        "duration_mins": 60,
                        "day_number": 1,
                    }
                ]
            }
        }
    )


class HolidayData(BaseModel):
    holiday_id: str = Field(
        ...,
        description="Holiday UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    holiday_date: str = Field(
        ..., description="Date of the holiday", examples=["2026-12-25"]
    )
    name: str = Field(..., description="Holiday name", examples=["Christmas"])
    location: Optional[str] = Field(
        default=None, description="Location, null means every location", examples=[None]
    )


HOLIDAY_EXAMPLE = {
    "holiday_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "holiday_date": "2026-12-25",
    "name": "Christmas",
    "location": None,
}


class HolidayListResponse(BaseResponse):
    data: List[HolidayData] = Field(..., description="Holidays")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 holiday",
                "data": [HOLIDAY_EXAMPLE],
            }
        }
    )


class HolidayResponse(BaseResponse):
    data: HolidayData = Field(..., description="Holiday")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Holiday added",
                "data": HOLIDAY_EXAMPLE,
            }
        }
    )


class CreateHolidayRequest(BaseModel):
    holiday_date: date = Field(
        ..., description="Date of the holiday", examples=["2026-12-25"]
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Holiday name",
        examples=["Christmas"],
    )
    location: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Location, null means every location",
        examples=[None],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "holiday_date": "2026-12-25",
                "name": "Christmas",
                "location": None,
            }
        }
    )


class ActionLogItem(BaseModel):
    action_log_id: str = Field(
        ...,
        description="Log entry UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    occurred_at: str = Field(
        ..., description="ISO 8601 time", examples=["2026-10-22T11:03:00+05:30"]
    )
    actor_type: str = Field(
        ..., description="agent, user or system", examples=["agent"]
    )
    actor_name: str = Field(..., description="Admin name, or agent", examples=["agent"])
    action: str = Field(
        ..., description="What happened", examples=["checklist_item_verified"]
    )
    case_id: Optional[str] = Field(
        default=None,
        description="Case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    entity_type: Optional[str] = Field(
        default=None, description="Kind of record touched", examples=["checklist_item"]
    )
    entity_id: Optional[str] = Field(
        default=None,
        description="Record UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    details: Dict[str, Any] = Field(
        ...,
        description="Extra facts, never personal data",
        examples=[{"document_type": "pan_card"}],
    )


class ActionLogListResponse(PaginatedResponse):
    data: List[ActionLogItem] = Field(..., description="Action log entries")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 entry",
                "data": [
                    {
                        "action_log_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                        "occurred_at": "2026-10-22T11:03:00+05:30",
                        "actor_type": "agent",
                        "actor_name": "agent",
                        "action": "checklist_item_verified",
                        "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                        "entity_type": "checklist_item",
                        "entity_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                        "details": {"document_type": "pan_card"},
                    }
                ],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class FailureItem(BaseModel):
    failure_id: str = Field(
        ...,
        description="Event or job UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    kind: FailureKind = Field(..., description="event or job", examples=["event"])
    event_type: str = Field(
        ..., description="Event type or job type", examples=["email.received"]
    )
    case_id: Optional[str] = Field(
        default=None,
        description="Case UUID when known",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    attempts: int = Field(..., description="Attempts made", examples=[5])
    last_error: Optional[str] = Field(
        default=None,
        description="Short reason with no personal data",
        examples=["GraphException: Graph returned 503"],
    )
    updated_at: str = Field(
        ...,
        description="ISO 8601 time of the last attempt",
        examples=["2026-10-22T12:00:00+05:30"],
    )


class FailureListResponse(PaginatedResponse):
    data: List[FailureItem] = Field(..., description="Failed events and jobs")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 failure",
                "data": [
                    {
                        "failure_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                        "kind": "event",
                        "event_type": "email.received",
                        "case_id": None,
                        "attempts": 5,
                        "last_error": "GraphException: Graph returned 503",
                        "updated_at": "2026-10-22T12:00:00+05:30",
                    }
                ],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class RetryRequest(BaseModel):
    kind: FailureKind = Field(..., description="event or job", examples=["event"])

    model_config = ConfigDict(json_schema_extra={"example": {"kind": "event"}})


class RetryData(BaseModel):
    failure_id: str = Field(
        ...,
        description="Event or job UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    kind: FailureKind = Field(..., description="event or job", examples=["event"])
    status: str = Field(..., description="New state", examples=["queued"])


class RetryResponse(BaseResponse):
    data: RetryData = Field(..., description="Retry result")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Queued again",
                "data": {
                    "failure_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "kind": "event",
                    "status": "queued",
                },
            }
        }
    )
