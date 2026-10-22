from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.admin.enums import InductionTrack
from app.common.schemas import BaseResponse
from app.mail.schemas import ATTACHMENT_EXAMPLE, AttachmentData

SESSION_EXAMPLE = {
    "induction_session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "title": "IT orientation",
    "owner_email": "it@tcgdigital.com",
    "proposed_start": "2026-11-16T11:00:00+05:30",
    "proposed_end": "2026-11-16T12:00:00+05:30",
    "agreed_start": None,
    "agreed_end": None,
    "status": "asked",
    "graph_event_id": None,
}


class InductionSessionData(BaseModel):
    induction_session_id: str = Field(
        ...,
        description="Session UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    title: str = Field(..., description="Session title", examples=["IT orientation"])
    owner_email: Optional[str] = Field(
        default=None, description="Session owner", examples=["it@tcgdigital.com"]
    )
    proposed_start: str = Field(
        ..., description="Proposed start", examples=["2026-11-16T11:00:00+05:30"]
    )
    proposed_end: str = Field(
        ..., description="Proposed end", examples=["2026-11-16T12:00:00+05:30"]
    )
    agreed_start: Optional[str] = Field(
        default=None, description="Agreed start", examples=[None]
    )
    agreed_end: Optional[str] = Field(
        default=None, description="Agreed end", examples=[None]
    )
    status: str = Field(
        ...,
        description="proposed, asked, agreed, alternative, booked, no_reply or conflict",
        examples=["asked"],
    )
    graph_event_id: Optional[str] = Field(
        default=None, description="Calendar event id once booked", examples=[None]
    )


class PlanInductionRequest(BaseModel):
    track: Optional[InductionTrack] = Field(
        default=None, description="Override the auto-picked track", examples=[None]
    )

    model_config = ConfigDict(json_schema_extra={"example": {"track": None}})


class PlanInductionData(BaseModel):
    induction_case_id: str = Field(
        ...,
        description="Induction case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    stage: str = Field(..., description="Induction stage", examples=["drafting"])
    track: str = Field(..., description="campus, mid or senior", examples=["mid"])


class PlanInductionResponse(BaseResponse):
    data: PlanInductionData = Field(..., description="Planned induction")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Induction draft is being prepared",
                "data": {
                    "induction_case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "stage": "drafting",
                    "track": "mid",
                },
            }
        }
    )


class AppointmentLetterResponse(BaseResponse):
    data: AttachmentData = Field(..., description="Stored appointment letter")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Appointment letter attached",
                "data": {
                    **ATTACHMENT_EXAMPLE,
                    "kind": "appointment_letter",
                    "file_name": "appointment.pdf",
                },
            }
        }
    )


class BookSessionRequest(BaseModel):
    start: datetime = Field(
        ..., description="Start with timezone", examples=["2026-11-16T11:00:00+05:30"]
    )
    end: datetime = Field(
        ..., description="End with timezone", examples=["2026-11-16T12:00:00+05:30"]
    )
    force: bool = Field(
        default=False, description="Book even if the owner looks busy", examples=[False]
    )

    @model_validator(mode="after")
    def check_order(self) -> "BookSessionRequest":
        if self.start.tzinfo is None or self.end.tzinfo is None:
            raise ValueError("Send times with a timezone offset")
        if self.end <= self.start:
            raise ValueError("End must be after start")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "start": "2026-11-16T11:00:00+05:30",
                "end": "2026-11-16T12:00:00+05:30",
                "force": False,
            }
        }
    )


class SessionResponse(BaseResponse):
    data: InductionSessionData = Field(..., description="Session")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Session booked",
                "data": {
                    **SESSION_EXAMPLE,
                    "status": "booked",
                    "graph_event_id": "AAMk...",
                },
            }
        }
    )
