from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.common.schemas import BaseResponse

TEMPLATE_EXAMPLE = {
    "template_key": "doc_request",
    "name": "Document request",
    "subject": "Documents needed for {{ candidate_name }}, joining {{ joining_date }}",
    "body_html": "<p>Hello,</p><p>Please share the documents below ...</p>",
    "placeholders": ["candidate_name", "joining_date", "document_list"],
    "is_active": True,
    "updated_at": "2026-10-20T10:00:00+05:30",
}


class TemplateSummary(BaseModel):
    template_key: str = Field(
        ..., description="Unique template key", examples=["doc_request"]
    )
    name: str = Field(..., description="Human name", examples=["Document request"])
    subject: str = Field(
        ...,
        description="Subject with placeholders",
        examples=["Documents needed for {{ candidate_name }}"],
    )
    placeholders: List[str] = Field(
        ...,
        description="Placeholders this template can use",
        examples=[["candidate_name", "joining_date"]],
    )
    is_active: bool = Field(
        ..., description="Inactive templates are never sent", examples=[True]
    )
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last edit",
        examples=["2026-10-20T10:00:00+05:30"],
    )


class TemplateData(TemplateSummary):
    body_html: str = Field(
        ..., description="HTML body with placeholders", examples=["<p>Hello,</p>"]
    )


class TemplateListResponse(BaseResponse):
    data: List[TemplateSummary] = Field(..., description="Email templates")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 template",
                "data": [
                    {k: v for k, v in TEMPLATE_EXAMPLE.items() if k != "body_html"}
                ],
            }
        }
    )


class TemplateResponse(BaseResponse):
    data: TemplateData = Field(..., description="Template with body")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Template retrieved",
                "data": TEMPLATE_EXAMPLE,
            }
        }
    )


class UpdateTemplateRequest(BaseModel):
    subject: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
        description="New subject",
        examples=["Documents needed for {{ candidate_name }}"],
    )
    body_html: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=50000,
        description="New HTML body",
        examples=["<p>Hello,</p>"],
    )
    is_active: Optional[bool] = Field(
        default=None, description="Turn the template on or off", examples=[True]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "subject": "Documents needed for {{ candidate_name }}",
                "body_html": "<p>Hello,</p>",
                "is_active": True,
            }
        }
    )


class PreviewTemplateRequest(BaseModel):
    values: Dict[str, Any] = Field(
        default_factory=dict,
        description="Placeholder values, sample values fill the rest",
        examples=[{"candidate_name": "Rahul Sharma"}],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "values": {
                    "candidate_name": "Rahul Sharma",
                    "joining_date": "16 Nov 2026",
                }
            }
        }
    )


class PreviewData(BaseModel):
    subject: str = Field(
        ...,
        description="Rendered subject",
        examples=["Documents needed for Rahul Sharma"],
    )
    body_html: str = Field(
        ..., description="Rendered HTML body", examples=["<p>Hello,</p>"]
    )


class PreviewResponse(BaseResponse):
    data: PreviewData = Field(..., description="Rendered template")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Preview ready",
                "data": {
                    "subject": "Documents needed for Rahul Sharma",
                    "body_html": "<p>Hello,</p>",
                },
            }
        }
    )


ATTACHMENT_EXAMPLE = {
    "attachment_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "kind": "email_document",
    "file_name": "pan.jpg",
    "mime_type": "image/jpeg",
    "size": 245000,
    "document_type_guess": "pan_card",
    "ai_confidence": 0.93,
    "ocr_quality": 81,
    "name_match_score": 96,
    "person_check": "match",
    "check_status": "processed",
    "issues": [],
    "is_latest": True,
    "received_at": "2026-10-22T11:02:00+05:30",
}


class AttachmentData(BaseModel):
    attachment_id: str = Field(
        ...,
        description="Attachment UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    kind: str = Field(
        ...,
        description="email_document, appointment_letter, statement_of_understanding and so on",
        examples=["email_document"],
    )
    file_name: str = Field(..., description="File name", examples=["pan.jpg"])
    mime_type: str = Field(..., description="MIME type", examples=["image/jpeg"])
    size: int = Field(..., description="Size in bytes", examples=[245000])
    document_type_guess: Optional[str] = Field(
        default=None, description="Document type the AI picked", examples=["pan_card"]
    )
    ai_confidence: Optional[float] = Field(
        default=None, description="AI confidence from 0 to 1", examples=[0.93]
    )
    ocr_quality: Optional[float] = Field(
        default=None, description="OCR confidence out of 100", examples=[81]
    )
    name_match_score: Optional[float] = Field(
        default=None, description="Name match out of 100", examples=[96]
    )
    person_check: Optional[str] = Field(
        default=None, description="match, mismatch or not_found", examples=["match"]
    )
    check_status: str = Field(
        ...,
        description="pending, processed, unreadable, wrong_type, restricted, duplicate or skipped",
        examples=["processed"],
    )
    issues: List[str] = Field(..., description="Problems found", examples=[[]])
    is_latest: bool = Field(
        ..., description="Whether this is the newest copy", examples=[True]
    )
    received_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time it arrived",
        examples=["2026-10-22T11:02:00+05:30"],
    )


class AttachmentResponse(BaseResponse):
    data: AttachmentData = Field(..., description="Stored file")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "File saved",
                "data": ATTACHMENT_EXAMPLE,
            }
        }
    )
