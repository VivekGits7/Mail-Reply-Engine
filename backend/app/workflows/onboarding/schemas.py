import re
from datetime import date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.cases.enums import ChecklistStatus
from app.cases.schemas import (
    CHECKLIST_ITEM_EXAMPLE,
    TASK_EXAMPLE,
    ChecklistItemData,
    TaskData,
)
from app.common.attachment import FileAttachment
from app.common.enums import HireCategory
from app.common.schemas import BaseResponse, PaginatedResponse
from app.people.schemas import PERSON_EXAMPLE, PersonData

LEVEL_PATTERN = re.compile(r"^L\d{1,2}$")
PHOTO_EXAMPLE = {
    "file_name": "rahul.jpg",
    "file_url": "uploads/joiner_photo/9f2c4e1a.jpg",
    "mime_type": "image/jpeg",
    "size": 240000,
}
PHOTO_URL_EXAMPLE = "https://files.your-domain/mail-reply-engine/uploads/joiner_photo/9f2c4e1a.jpg?X-Amz-Signature=..."


def _strip(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("cannot be empty")
    return value


class CreateJoinerRequest(BaseModel):
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Joiner full name",
        examples=["Rahul Sharma"],
    )
    personal_email: EmailStr = Field(
        ..., description="Joiner personal email", examples=["rahul.sharma@gmail.com"]
    )
    recruiter_email: EmailStr = Field(
        ...,
        description="Recruiter who gets the document request",
        examples=["recruiter@tcgdigital.com"],
    )
    hire_category: HireCategory = Field(
        ..., description="campus or lateral", examples=["lateral"]
    )
    location: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Base location, picks the checklist",
        examples=["Kolkata"],
    )
    level: str = Field(..., description="Level like L4", examples=["L4"])
    joining_date: date = Field(..., description="Joining date", examples=["2026-11-16"])
    date_of_birth: date = Field(
        ...,
        description="Date of birth, used only by the local person check",
        examples=["1990-02-20"],
    )
    manager_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Reporting manager name",
        examples=["Amit Roy"],
    )
    manager_email: EmailStr = Field(
        ..., description="Reporting manager email", examples=["amit.roy@tcgdigital.com"]
    )
    photo: Optional[FileAttachment] = Field(
        default=None,
        description="Profile photo uploaded with the joiner_photo purpose",
        examples=[PHOTO_EXAMPLE],
    )

    @field_validator("full_name", "location", "manager_name")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return _strip(value)

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        value = value.strip().upper()
        if not LEVEL_PATTERN.match(value):
            raise ValueError("Level must look like L4")
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "full_name": "Rahul Sharma",
                "personal_email": "rahul.sharma@gmail.com",
                "recruiter_email": "recruiter@tcgdigital.com",
                "hire_category": "lateral",
                "location": "Kolkata",
                "level": "L4",
                "joining_date": "2026-11-16",
                "date_of_birth": "1990-02-20",
                "manager_name": "Amit Roy",
                "manager_email": "amit.roy@tcgdigital.com",
                "photo": PHOTO_EXAMPLE,
            }
        }
    )


class UpdateJoinerRequest(BaseModel):
    full_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Joiner full name",
        examples=["Rahul Kumar Sharma"],
    )
    personal_email: Optional[EmailStr] = Field(
        default=None,
        description="Joiner personal email",
        examples=["rahul.sharma@gmail.com"],
    )
    recruiter_email: Optional[EmailStr] = Field(
        default=None,
        description="Recruiter email",
        examples=["recruiter@tcgdigital.com"],
    )
    location: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
        description="Base location",
        examples=["Kolkata"],
    )
    level: Optional[str] = Field(
        default=None, description="Level like L4", examples=["L4"]
    )
    joining_date: Optional[date] = Field(
        default=None, description="Joining date", examples=["2026-11-16"]
    )
    date_of_birth: Optional[date] = Field(
        default=None, description="Date of birth", examples=["1990-02-21"]
    )
    manager_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Reporting manager name",
        examples=["Amit Roy"],
    )
    manager_email: Optional[EmailStr] = Field(
        default=None,
        description="Reporting manager email",
        examples=["amit.roy@tcgdigital.com"],
    )
    photo: Optional[FileAttachment] = Field(
        default=None,
        description="New profile photo, send null to remove it",
        examples=[PHOTO_EXAMPLE],
    )

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip().upper()
        if not LEVEL_PATTERN.match(value):
            raise ValueError("Level must look like L4")
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "full_name": "Rahul Kumar Sharma",
                "date_of_birth": "1990-02-21",
                "photo": PHOTO_EXAMPLE,
            }
        }
    )


class SignOffRequest(BaseModel):
    employee_code: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="Employee ID from D365",
        examples=["32700"],
    )
    designation: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Designation",
        examples=["Senior Manager"],
    )
    project_code: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Project code",
        examples=["Delivery 2.0"],
    )
    gender: str = Field(
        ..., min_length=1, max_length=30, description="Gender", examples=["Male"]
    )
    blood_group: Optional[str] = Field(
        default=None, max_length=10, description="Blood group", examples=["B+"]
    )
    date_of_marriage: Optional[date] = Field(
        default=None, description="Date of marriage", examples=[None]
    )
    bu_head: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="BU head",
        examples=["Neha Gupta"],
    )
    employment_type: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Employment type",
        examples=["Permanent"],
    )
    contact_number: str = Field(
        ...,
        min_length=7,
        max_length=20,
        description="Contact number",
        examples=["9000000000"],
    )
    sector_region: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Sector or region",
        examples=["India"],
    )
    system_type: bool = Field(..., description="Needs a system", examples=[True])
    proj_ops: bool = Field(
        ..., description="Needs Swift ALM or Proj Ops", examples=[False]
    )
    ess_d365: bool = Field(..., description="Needs ESS D365", examples=[True])
    skills: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Skill set",
        examples=["Kafka, Elastic Search"],
    )
    business_card: bool = Field(
        ..., description="Needs a business card", examples=[True]
    )
    force_reason: Optional[str] = Field(
        default=None,
        min_length=5,
        max_length=500,
        description="Why HR signs off before every document is verified",
        examples=[None],
    )

    @field_validator("employee_code", "designation")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return _strip(value)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "employee_code": "32700",
                "designation": "Senior Manager",
                "project_code": "Delivery 2.0",
                "gender": "Male",
                "blood_group": "B+",
                "date_of_marriage": None,
                "bu_head": "Neha Gupta",
                "employment_type": "Permanent",
                "contact_number": "9000000000",
                "sector_region": "India",
                "system_type": True,
                "proj_ops": False,
                "ess_d365": True,
                "skills": "Kafka, Elastic Search",
                "business_card": True,
                "force_reason": None,
            }
        }
    )


class ChecklistOverrideRequest(BaseModel):
    status: ChecklistStatus = Field(
        ...,
        description="verified, received, wrong_type, unreadable or pending",
        examples=["verified"],
    )
    note: Optional[str] = Field(
        default=None,
        max_length=500,
        description="HR note",
        examples=["Name differs only by an initial"],
    )
    attachment_id: Optional[str] = Field(
        default=None, description="File to link to this item", examples=[None]
    )

    @field_validator("status")
    @classmethod
    def allowed_status(cls, value: ChecklistStatus) -> ChecklistStatus:
        if value == ChecklistStatus.NAME_MISMATCH:
            raise ValueError("name_mismatch is set by the person check only")
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "verified",
                "note": "Name differs only by an initial",
                "attachment_id": None,
            }
        }
    )


class JoinerCreatedData(BaseModel):
    person: PersonData = Field(..., description="The joiner")
    case_id: str = Field(
        ...,
        description="Onboarding case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    stage: str = Field(..., description="Case stage", examples=["docs_requested"])
    checklist: List[ChecklistItemData] = Field(..., description="Documents to collect")


class JoinerCreatedResponse(BaseResponse):
    data: JoinerCreatedData = Field(..., description="Created joiner and case")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Joiner created and document request queued",
                "data": {
                    "person": PERSON_EXAMPLE,
                    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "stage": "docs_requested",
                    "checklist": [CHECKLIST_ITEM_EXAMPLE],
                },
            }
        }
    )


class JoinerListItem(BaseModel):
    person_id: str = Field(
        ...,
        description="Person UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    case_id: str = Field(
        ...,
        description="Onboarding case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    full_name: str = Field(..., description="Joiner name", examples=["Rahul Sharma"])
    joining_date: Optional[str] = Field(
        default=None, description="Joining date", examples=["2026-11-16"]
    )
    hire_category: Optional[str] = Field(
        default=None, description="campus or lateral", examples=["lateral"]
    )
    level: Optional[str] = Field(default=None, description="Level", examples=["L4"])
    location: Optional[str] = Field(
        default=None, description="Base location", examples=["Kolkata"]
    )
    stage: str = Field(..., description="Case stage", examples=["docs_in_progress"])
    status: str = Field(..., description="Case status", examples=["open"])
    flags: List[str] = Field(
        ..., description="Attention flags", examples=[["name_mismatch"]]
    )
    docs_verified: int = Field(
        ..., description="Mandatory documents verified", examples=[5]
    )
    docs_total: int = Field(
        ..., description="Mandatory documents in the checklist", examples=[8]
    )
    next_followup_at: Optional[str] = Field(
        default=None,
        description="When the next reminder goes out",
        examples=["2026-10-24T10:00:00+05:30"],
    )
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last change",
        examples=["2026-10-22T11:05:00+05:30"],
    )
    photo_url: Optional[str] = Field(
        default=None,
        description="Short lived link to the profile photo, null when there is none",
        examples=[PHOTO_URL_EXAMPLE],
    )


JOINER_LIST_EXAMPLE = {
    "person_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "Rahul Sharma",
    "joining_date": "2026-11-16",
    "hire_category": "lateral",
    "level": "L4",
    "location": "Kolkata",
    "stage": "docs_in_progress",
    "status": "open",
    "flags": ["name_mismatch"],
    "docs_verified": 5,
    "docs_total": 8,
    "next_followup_at": "2026-10-24T10:00:00+05:30",
    "updated_at": "2026-10-22T11:05:00+05:30",
    "photo_url": PHOTO_URL_EXAMPLE,
}


class JoinerListResponse(PaginatedResponse):
    data: List[JoinerListItem] = Field(..., description="Joiners on this page")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 joiner",
                "data": [JOINER_LIST_EXAMPLE],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class JoinerUpdateData(BaseModel):
    person: PersonData = Field(..., description="Updated joiner")
    rechecked_documents: int = Field(
        ..., description="Documents queued for a fresh person check", examples=[3]
    )


class JoinerUpdateResponse(BaseResponse):
    data: JoinerUpdateData = Field(..., description="Updated joiner")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Joiner updated",
                "data": {"person": PERSON_EXAMPLE, "rechecked_documents": 3},
            }
        }
    )


class SignOffData(BaseModel):
    case_id: str = Field(
        ...,
        description="Onboarding case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    stage: str = Field(..., description="New stage", examples=["it_requested"])
    person: PersonData = Field(..., description="Joiner with Employee ID")
    it_task: TaskData = Field(..., description="IT setup task")


class SignOffResponse(BaseResponse):
    data: SignOffData = Field(..., description="Sign-off result")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Signed off, IT request queued",
                "data": {
                    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "stage": "it_requested",
                    "person": PERSON_EXAMPLE,
                    "it_task": TASK_EXAMPLE,
                },
            }
        }
    )


class ChecklistOverrideData(BaseModel):
    checklist_item: ChecklistItemData = Field(..., description="Updated checklist item")
    case_stage: str = Field(
        ..., description="Case stage after the change", examples=["ready_for_signoff"]
    )


class ChecklistOverrideResponse(BaseResponse):
    data: ChecklistOverrideData = Field(..., description="Checklist change")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Checklist updated",
                "data": {
                    "checklist_item": CHECKLIST_ITEM_EXAMPLE,
                    "case_stage": "ready_for_signoff",
                },
            }
        }
    )
