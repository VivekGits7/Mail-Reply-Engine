from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.cases.schemas import TASK_EXAMPLE, TaskData
from app.common.schemas import BaseResponse, PaginatedResponse
from app.people.schemas import PERSON_EXAMPLE, PersonData


class CreateExitRequest(BaseModel):
    person_id: Optional[str] = Field(
        default=None,
        description="Existing person UUID, leave null to send details",
        examples=[None],
    )
    full_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Employee name",
        examples=["Rahul Sharma"],
    )
    employee_code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=32,
        description="Employee ID",
        examples=["32999"],
    )
    work_email: Optional[EmailStr] = Field(
        default=None, description="Work email", examples=["rahul.sharma@tcgdigital.com"]
    )
    manager_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Reporting manager",
        examples=["Amit Roy"],
    )
    manager_email: Optional[EmailStr] = Field(
        default=None,
        description="Reporting manager email",
        examples=["amit.roy@tcgdigital.com"],
    )
    last_working_day: date = Field(
        ..., description="Last working day", examples=["2026-11-30"]
    )

    @model_validator(mode="after")
    def person_or_details(self) -> "CreateExitRequest":
        if not self.person_id and not all(
            (self.full_name, self.employee_code, self.work_email, self.manager_email)
        ):
            raise ValueError(
                "Send person_id, or full_name, employee_code, work_email and manager_email"
            )
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "person_id": None,
                "full_name": "Rahul Sharma",
                "employee_code": "32999",
                "work_email": "rahul.sharma@tcgdigital.com",
                "manager_name": "Amit Roy",
                "manager_email": "amit.roy@tcgdigital.com",
                "last_working_day": "2026-11-30",
            }
        }
    )


class ExitCreatedData(BaseModel):
    case_id: str = Field(
        ...,
        description="Exit case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    person: PersonData = Field(..., description="Exiting employee")
    stage: str = Field(..., description="Case stage", examples=["clearance_requested"])
    tasks: List[TaskData] = Field(..., description="Clearance tasks per team")


class ExitCreatedResponse(BaseResponse):
    data: ExitCreatedData = Field(..., description="Created exit case")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Exit created and clearance mail queued",
                "data": {
                    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "person": PERSON_EXAMPLE,
                    "stage": "clearance_requested",
                    "tasks": [TASK_EXAMPLE],
                },
            }
        }
    )


class ExitListItem(BaseModel):
    case_id: str = Field(
        ...,
        description="Exit case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    person_id: str = Field(
        ...,
        description="Person UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    full_name: str = Field(..., description="Employee name", examples=["Rahul Sharma"])
    employee_code: Optional[str] = Field(
        default=None, description="Employee ID", examples=["32999"]
    )
    last_working_day: Optional[str] = Field(
        default=None, description="Last working day", examples=["2026-11-30"]
    )
    stage: str = Field(
        ..., description="Case stage", examples=["clearances_in_progress"]
    )
    status: str = Field(..., description="Case status", examples=["open"])
    flags: List[str] = Field(..., description="Attention flags", examples=[[]])
    clearances: Dict[str, str] = Field(
        ...,
        description="Task status per team",
        examples=[
            {"it": "partial", "finance": "open", "admin": "done", "manager": "done"}
        ],
    )
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last change",
        examples=["2026-11-26T10:00:00+05:30"],
    )


EXIT_LIST_EXAMPLE = {
    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "person_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "Rahul Sharma",
    "employee_code": "32999",
    "last_working_day": "2026-11-30",
    "stage": "clearances_in_progress",
    "status": "open",
    "flags": [],
    "clearances": {
        "it": "partial",
        "finance": "open",
        "admin": "done",
        "manager": "done",
    },
    "updated_at": "2026-11-26T10:00:00+05:30",
}


class ExitListResponse(PaginatedResponse):
    data: List[ExitListItem] = Field(..., description="Exits on this page")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 exit",
                "data": [EXIT_LIST_EXAMPLE],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class ReleaseConfirmRequest(BaseModel):
    note: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional note, only its presence is logged",
        examples=["Letter issued on 2026-12-01"],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"note": "Letter issued on 2026-12-01"}}
    )


class ReleaseConfirmData(BaseModel):
    case_id: str = Field(
        ...,
        description="Exit case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    stage: str = Field(..., description="New stage", examples=["closed"])
    closed_at: Optional[str] = Field(
        default=None,
        description="When the case closed",
        examples=["2026-12-01T15:00:00+05:30"],
    )


class ReleaseConfirmResponse(BaseResponse):
    data: ReleaseConfirmData = Field(..., description="Closed exit case")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Release confirmed and exit closed",
                "data": {
                    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "stage": "closed",
                    "closed_at": "2026-12-01T15:00:00+05:30",
                },
            }
        }
    )
