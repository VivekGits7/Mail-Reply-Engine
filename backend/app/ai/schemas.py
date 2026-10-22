from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from app.common.enums import EmailCategory


class ClassifyResult(BaseModel):
    category: EmailCategory = Field(..., description="Email category")
    confidence: float = Field(..., ge=0, le=1, description="Confidence from 0 to 1")
    case_id: Optional[str] = Field(
        ..., description="Case id from the list given, or null"
    )
    summary: str = Field(..., description="One line summary without personal data")
    documents_mentioned: List[str] = Field(..., description="Document types mentioned")
    clearance_team: Optional[str] = Field(
        ..., description="it, finance, admin or manager when it is a clearance update"
    )


class IdentifyResult(BaseModel):
    document_type: str = Field(..., description="One of the checklist types, or other")
    confidence: float = Field(..., ge=0, le=1, description="Confidence from 0 to 1")
    issues: List[str] = Field(
        ..., description="Obvious problems such as expired or cropped"
    )


class ItSetupResult(BaseModel):
    email_created: bool = Field(..., description="IT says the email ID is created")
    d365_created: bool = Field(..., description="IT says D365 access is created")
    credentials_sent_to_joiner: bool = Field(
        ..., description="IT says credentials went straight to the joiner"
    )
    confidence: float = Field(..., ge=0, le=1, description="Confidence from 0 to 1")


class TimeSlot(BaseModel):
    start: str = Field(..., description="ISO 8601 start with offset")
    end: str = Field(..., description="ISO 8601 end with offset")


class AvailabilityResult(BaseModel):
    accepts_proposed: bool = Field(..., description="Owner agreed to the proposed time")
    alternatives: List[TimeSlot] = Field(
        ..., description="Times the owner suggested instead"
    )
    confidence: float = Field(..., ge=0, le=1, description="Confidence from 0 to 1")


class ClearanceState(str, Enum):
    DONE = "done"
    PARTIAL = "partial"
    PENDING = "pending"
    BLOCKED = "blocked"
    NOT_APPLICABLE = "not_applicable"


class ClearanceItem(BaseModel):
    item: str = Field(..., description="Checklist item name from the list given")
    status: ClearanceState = Field(..., description="Item status")


class ClearanceResult(BaseModel):
    team: Optional[str] = Field(..., description="it, finance, admin or manager")
    status: ClearanceState = Field(..., description="Overall status for that team")
    items: List[ClearanceItem] = Field(
        ..., description="Per item status when the reply names items"
    )
    blocker: Optional[str] = Field(
        ..., description="Why it is blocked, without personal data"
    )
    confidence: float = Field(..., ge=0, le=1, description="Confidence from 0 to 1")


class ReminderIntent(str, Enum):
    DONE = "done"
    ON_LEAVE = "on_leave"
    QUESTION = "question"
    OTHER = "other"


class ReminderReplyResult(BaseModel):
    intent: ReminderIntent = Field(..., description="What the reply says")
    return_date: Optional[str] = Field(
        ..., description="YYYY-MM-DD return date when on leave"
    )
    confidence: float = Field(..., ge=0, le=1, description="Confidence from 0 to 1")


class DraftReply(BaseModel):
    subject: str = Field(..., description="Reply subject")
    body: str = Field(
        ...,
        description="Plain text reply body using {{ recipient_name }} for the greeting",
    )
    confidence: float = Field(
        ..., ge=0, le=1, description="How sure the answer is right"
    )


class PlannedSession(BaseModel):
    index: int = Field(..., description="Index of the template session")
    start: str = Field(..., description="ISO 8601 start with offset")
    end: str = Field(..., description="ISO 8601 end with offset")


class InductionPlan(BaseModel):
    sessions: List[PlannedSession] = Field(
        ..., description="One entry per template session"
    )
    notes: str = Field(..., description="Short note for HR")


class FeedbackAnalysis(BaseModel):
    summary: str = Field(..., description="Leadership summary paragraph")
    themes: List[str] = Field(..., description="Main themes")
    working_well: List[str] = Field(..., description="What is working")
    not_working: List[str] = Field(..., description="What is not working")
    suggested_actions: List[str] = Field(..., description="Suggested actions")
