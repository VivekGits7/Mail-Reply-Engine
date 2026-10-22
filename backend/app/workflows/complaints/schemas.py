from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.common.attachment import FileAttachment
from app.common.schemas import BaseResponse, PaginatedResponse
from app.mail.schemas import AttachmentData


class ComplaintSource(str, Enum):
    EMAIL = "email"
    EXIT_INTERVIEW = "exit_interview"
    HR_CONNECT = "hr_connect"


class UploadSource(str, Enum):
    EXIT_INTERVIEW = "exit_interview"
    HR_CONNECT = "hr_connect"


class ComplaintListItem(BaseModel):
    complaint_id: str = Field(
        ...,
        description="Complaint UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    received_at: str = Field(
        ...,
        description="ISO 8601 time it arrived",
        examples=["2026-10-22T16:40:00+05:30"],
    )
    source: ComplaintSource = Field(
        ..., description="email, exit_interview or hr_connect", examples=["email"]
    )
    sender_email: Optional[str] = Field(
        default=None, description="Sender email", examples=["employee@tcgdigital.com"]
    )
    person_name: Optional[str] = Field(
        default=None, description="Linked employee", examples=["Rahul Sharma"]
    )
    subject: Optional[str] = Field(
        default=None, description="Subject line", examples=["Concern about my team"]
    )


class ComplaintPerson(BaseModel):
    person_id: str = Field(
        ...,
        description="Person UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    full_name: str = Field(..., description="Employee name", examples=["Rahul Sharma"])
    employee_code: Optional[str] = Field(
        default=None, description="Employee ID", examples=["32700"]
    )


class ComplaintDetail(BaseModel):
    complaint_id: str = Field(
        ...,
        description="Complaint UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    received_at: str = Field(
        ...,
        description="ISO 8601 time it arrived",
        examples=["2026-10-22T16:40:00+05:30"],
    )
    source: ComplaintSource = Field(
        ..., description="email, exit_interview or hr_connect", examples=["email"]
    )
    sender_email: Optional[str] = Field(
        default=None, description="Sender email", examples=["employee@tcgdigital.com"]
    )
    person: Optional[ComplaintPerson] = Field(
        default=None, description="Linked employee"
    )
    subject: Optional[str] = Field(
        default=None, description="Subject line", examples=["Concern about my team"]
    )
    content: Optional[str] = Field(
        default=None, description="Full text", examples=["..."]
    )
    attachment: Optional[AttachmentData] = Field(
        default=None, description="Uploaded transcript file"
    )


LIST_EXAMPLE = {
    "complaint_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "received_at": "2026-10-22T16:40:00+05:30",
    "source": "email",
    "sender_email": "employee@tcgdigital.com",
    "person_name": "Rahul Sharma",
    "subject": "Concern about my team",
}


class ComplaintListResponse(PaginatedResponse):
    data: List[ComplaintListItem] = Field(..., description="Restricted items")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 item",
                "data": [LIST_EXAMPLE],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class ComplaintDetailResponse(BaseResponse):
    data: ComplaintDetail = Field(..., description="Full item")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Item retrieved",
                "data": {
                    **LIST_EXAMPLE,
                    "person": {
                        "person_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                        "full_name": "Rahul Sharma",
                        "employee_code": "32700",
                    },
                    "content": "...",
                    "attachment": None,
                },
            }
        }
    )


class UploadTranscriptRequest(BaseModel):
    source: UploadSource = Field(
        ..., description="exit_interview or hr_connect", examples=["hr_connect"]
    )
    person_id: Optional[str] = Field(
        default=None,
        description="Employee the transcript is about",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    file: FileAttachment = Field(..., description="Uploaded transcript")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "source": "hr_connect",
                "person_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "file": {
                    "file_name": "notes.docx",
                    "file_url": "uploads/transcript/0b7c.docx",
                    "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "size": 15000,
                },
            }
        }
    )


class UploadTranscriptData(BaseModel):
    complaint_id: str = Field(
        ...,
        description="Restricted item UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    source: UploadSource = Field(
        ..., description="exit_interview or hr_connect", examples=["hr_connect"]
    )
    received_at: str = Field(
        ...,
        description="ISO 8601 time it was stored",
        examples=["2026-10-23T10:00:00+05:30"],
    )


class UploadTranscriptResponse(BaseResponse):
    data: UploadTranscriptData = Field(..., description="Stored transcript")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Transcript stored",
                "data": {
                    "complaint_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "source": "hr_connect",
                    "received_at": "2026-10-23T10:00:00+05:30",
                },
            }
        }
    )
