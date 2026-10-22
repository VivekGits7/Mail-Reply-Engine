from enum import Enum
from typing import Dict

from pydantic import BaseModel, ConfigDict, Field

from app.common.schemas import BaseResponse


class UploadPurpose(str, Enum):
    APPOINTMENT_LETTER = "appointment_letter"
    REMINDER_LIST = "reminder_list"
    SURVEY_EXPORT = "survey_export"
    TRANSCRIPT = "transcript"
    STATEMENT_OF_UNDERSTANDING = "statement_of_understanding"


PDF = "application/pdf"
CSV = "text/csv"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TXT = "text/plain"

ALLOWED_TYPES: Dict[UploadPurpose, set[str]] = {
    UploadPurpose.APPOINTMENT_LETTER: {PDF},
    UploadPurpose.STATEMENT_OF_UNDERSTANDING: {PDF},
    UploadPurpose.REMINDER_LIST: {CSV, XLSX},
    UploadPurpose.SURVEY_EXPORT: {XLSX},
    UploadPurpose.TRANSCRIPT: {PDF, DOCX, TXT},
}


def upload_prefix(purpose: UploadPurpose) -> str:
    return f"uploads/{purpose.value}"


class PresignRequest(BaseModel):
    file_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Original file name",
        examples=["pending.xlsx"],
    )
    mime_type: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="MIME type of the file",
        examples=[XLSX],
    )
    size: int = Field(..., ge=1, description="File size in bytes", examples=[20480])
    purpose: UploadPurpose = Field(
        ..., description="What the file is for", examples=["reminder_list"]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "file_name": "pending.xlsx",
                "mime_type": XLSX,
                "size": 20480,
                "purpose": "reminder_list",
            }
        }
    )


class PresignData(BaseModel):
    upload_url: str = Field(
        ...,
        description="URL the browser posts the form to",
        examples=["https://files.your-domain/mail-reply-engine"],
    )
    fields: Dict[str, str] = Field(
        ...,
        description="Form fields to send with the file",
        examples=[{"key": "uploads/reminder_list/0b7c.xlsx"}],
    )
    file_url: str = Field(
        ...,
        description="Storage key to send back in a FileAttachment",
        examples=["uploads/reminder_list/0b7c.xlsx"],
    )
    expires_in: int = Field(
        ..., description="Seconds the upload link stays valid", examples=[300]
    )


class PresignResponse(BaseResponse):
    data: PresignData = Field(..., description="Presigned upload details")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Upload link ready",
                "data": {
                    "upload_url": "https://files.your-domain/mail-reply-engine",
                    "fields": {
                        "key": "uploads/reminder_list/0b7c.xlsx",
                        "Content-Type": XLSX,
                        "policy": "...",
                        "x-amz-signature": "...",
                    },
                    "file_url": "uploads/reminder_list/0b7c.xlsx",
                    "expires_in": 300,
                },
            }
        }
    )


class DownloadUrlData(BaseModel):
    url: str = Field(
        ...,
        description="Short lived link to view the file",
        examples=["https://files.your-domain/mail-reply-engine/..."],
    )
    expires_in: int = Field(
        ..., description="Seconds the link stays valid", examples=[300]
    )


class DownloadUrlResponse(BaseResponse):
    data: DownloadUrlData = Field(..., description="Download link")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Download link ready",
                "data": {
                    "url": "https://files.your-domain/mail-reply-engine/...",
                    "expires_in": 300,
                },
            }
        }
    )
