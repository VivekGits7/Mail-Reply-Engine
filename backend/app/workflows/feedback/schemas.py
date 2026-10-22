from datetime import date
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.attachment import FileAttachment
from app.common.enums import HireCategory
from app.common.schemas import BaseResponse, PaginatedResponse


class SurveyStatus(str, Enum):
    SENT = "sent"
    RESPONDED = "responded"
    NO_RESPONSE = "no_response"


class ReportStatus(str, Enum):
    QUEUED = "queued"
    READY = "ready"
    SENT = "sent"
    FAILED = "failed"


class SurveySortBy(str, Enum):
    SENT_AT = "sent_at"
    SCORE = "score"
    FULL_NAME = "full_name"


class SurveyItem(BaseModel):
    survey_response_id: str = Field(
        ...,
        description="Survey UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    person_id: str = Field(
        ...,
        description="Person UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    full_name: str = Field(..., description="Employee name", examples=["Rahul Sharma"])
    milestone: int = Field(..., description="30, 60 or 90", examples=[30])
    form_variant: HireCategory = Field(
        ..., description="campus or lateral form", examples=["lateral"]
    )
    status: SurveyStatus = Field(
        ..., description="sent, responded or no_response", examples=["sent"]
    )
    sent_at: Optional[str] = Field(
        default=None,
        description="When the invite went out",
        examples=["2026-12-16T09:00:00+05:30"],
    )
    reminders_sent: int = Field(..., description="Reminders sent", examples=[1])
    responded_at: Optional[str] = Field(
        default=None, description="When they responded", examples=[None]
    )
    score: Optional[float] = Field(
        default=None, description="Overall score", examples=[None]
    )
    flagged: bool = Field(
        ..., description="Score below the HR threshold", examples=[False]
    )


SURVEY_EXAMPLE = {
    "survey_response_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "person_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "Rahul Sharma",
    "milestone": 30,
    "form_variant": "lateral",
    "status": "sent",
    "sent_at": "2026-12-16T09:00:00+05:30",
    "reminders_sent": 1,
    "responded_at": None,
    "score": None,
    "flagged": False,
}


class SurveyListResponse(PaginatedResponse):
    data: List[SurveyItem] = Field(..., description="Surveys on this page")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 survey",
                "data": [SURVEY_EXAMPLE],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class UploadResponsesRequest(BaseModel):
    form_variant: HireCategory = Field(
        ..., description="campus or lateral form", examples=["lateral"]
    )
    file: FileAttachment = Field(..., description="Forms export as XLSX")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "form_variant": "lateral",
                "file": {
                    "file_name": "responses.xlsx",
                    "file_url": "uploads/survey_export/0b7c.xlsx",
                    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "size": 30000,
                },
            }
        }
    )


class UploadResponsesData(BaseModel):
    rows_total: int = Field(..., description="Rows read", examples=[13])
    rows_matched: int = Field(
        ..., description="Rows matched to a sent survey", examples=[12]
    )
    rows_unmatched: int = Field(
        ..., description="Rows with no matching survey", examples=[1]
    )
    low_score_alerts: int = Field(
        ..., description="Alerts queued for low scores", examples=[1]
    )


class UploadResponsesResponse(BaseResponse):
    data: UploadResponsesData = Field(..., description="Import result")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Responses imported",
                "data": {
                    "rows_total": 13,
                    "rows_matched": 12,
                    "rows_unmatched": 1,
                    "low_score_alerts": 1,
                },
            }
        }
    )


class ReportItem(BaseModel):
    feedback_report_id: str = Field(
        ...,
        description="Report UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    period_start: str = Field(..., description="Period start", examples=["2026-10-01"])
    period_end: str = Field(..., description="Period end", examples=["2026-10-31"])
    response_count: int = Field(..., description="Responses covered", examples=[18])
    status: ReportStatus = Field(
        ..., description="queued, ready, sent or failed", examples=["sent"]
    )
    sent_at: Optional[str] = Field(
        default=None,
        description="When it was emailed",
        examples=["2026-11-01T09:05:00+05:30"],
    )


REPORT_EXAMPLE = {
    "feedback_report_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "period_start": "2026-10-01",
    "period_end": "2026-10-31",
    "response_count": 18,
    "status": "sent",
    "sent_at": "2026-11-01T09:05:00+05:30",
}


class ReportListResponse(BaseResponse):
    data: List[ReportItem] = Field(..., description="Generated reports")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 report",
                "data": [REPORT_EXAMPLE],
            }
        }
    )


class CreateReportRequest(BaseModel):
    period_start: date = Field(..., description="Period start", examples=["2026-10-01"])
    period_end: date = Field(..., description="Period end", examples=["2026-10-31"])

    @model_validator(mode="after")
    def check_period(self) -> "CreateReportRequest":
        if self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"period_start": "2026-10-01", "period_end": "2026-10-31"}
        }
    )


class CreateReportData(BaseModel):
    feedback_report_id: str = Field(
        ...,
        description="Report UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    status: ReportStatus = Field(..., description="Report state", examples=["queued"])


class CreateReportResponse(BaseResponse):
    data: CreateReportData = Field(..., description="Queued report")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Report queued",
                "data": {
                    "feedback_report_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "status": "queued",
                },
            }
        }
    )
