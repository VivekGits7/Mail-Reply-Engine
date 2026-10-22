from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.cases.enums import ApprovalStatus, ApprovalType
from app.cases.schemas import (
    CASE_EXAMPLE,
    CHECKLIST_ITEM_EXAMPLE,
    TASK_EXAMPLE,
    CaseData,
    ChecklistItemData,
    TaskData,
)
from app.common.schemas import BaseResponse, PaginatedResponse
from app.mail.schemas import ATTACHMENT_EXAMPLE, AttachmentData
from app.people.schemas import PERSON_EXAMPLE, PersonData
from app.workflows.induction.schemas import SESSION_EXAMPLE, InductionSessionData


class ApprovalSummary(BaseModel):
    approval_id: str = Field(
        ...,
        description="Approval UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    approval_type: ApprovalType = Field(
        ..., description="reply or induction_schedule", examples=["reply"]
    )
    status: ApprovalStatus = Field(
        ..., description="pending, approved, rejected or sent", examples=["pending"]
    )
    created_at: Optional[str] = Field(
        default=None,
        description="When it was drafted",
        examples=["2026-10-22T12:00:00+05:30"],
    )


class TimelineEntry(BaseModel):
    at: str = Field(
        ..., description="ISO 8601 time", examples=["2026-10-22T11:02:00+05:30"]
    )
    kind: str = Field(..., description="email or action", examples=["email"])
    direction: Optional[str] = Field(
        default=None, description="inbound or outbound for emails", examples=["inbound"]
    )
    subject: Optional[str] = Field(
        default=None, description="Email subject", examples=["Documents for onboarding"]
    )
    summary: str = Field(
        ...,
        description="What happened",
        examples=["Sent PAN card and degree certificate"],
    )
    category: Optional[str] = Field(
        default=None, description="Email category", examples=["doc_submission"]
    )
    actor: str = Field(..., description="Who did it", examples=["candidate"])
    email_id: Optional[str] = Field(
        default=None,
        description="Email UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )


class RelatedCase(BaseModel):
    case_id: str = Field(
        ..., description="Case UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    case_type: str = Field(..., description="Case type", examples=["induction"])
    stage: str = Field(..., description="Stage", examples=["booking"])
    status: str = Field(..., description="Status", examples=["open"])


class CaseDetailData(BaseModel):
    case: CaseData = Field(..., description="The case")
    person: PersonData = Field(..., description="Who it is about")
    checklist: List[ChecklistItemData] = Field(
        ..., description="Document checklist, onboarding only"
    )
    attachments: List[AttachmentData] = Field(..., description="Stored files")
    tasks: List[TaskData] = Field(..., description="Tasks")
    sessions: List[InductionSessionData] = Field(
        ..., description="Induction sessions, induction only"
    )
    approvals: List[ApprovalSummary] = Field(
        ..., description="Drafts waiting or decided"
    )
    timeline: List[TimelineEntry] = Field(
        ..., description="Emails and actions in time order"
    )
    related_cases: List[RelatedCase] = Field(..., description="Parent or child cases")
    next_followup_at: Optional[str] = Field(
        default=None,
        description="Next scheduled email",
        examples=["2026-10-24T10:00:00+05:30"],
    )


CASE_DETAIL_EXAMPLE = {
    "case": CASE_EXAMPLE,
    "person": PERSON_EXAMPLE,
    "checklist": [CHECKLIST_ITEM_EXAMPLE],
    "attachments": [ATTACHMENT_EXAMPLE],
    "tasks": [TASK_EXAMPLE],
    "sessions": [SESSION_EXAMPLE],
    "approvals": [
        {
            "approval_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "approval_type": "reply",
            "status": "pending",
            "created_at": "2026-10-22T12:00:00+05:30",
        }
    ],
    "timeline": [
        {
            "at": "2026-10-22T11:02:00+05:30",
            "kind": "email",
            "direction": "inbound",
            "subject": "Documents for onboarding",
            "summary": "Sent PAN card and degree certificate",
            "category": "doc_submission",
            "actor": "candidate",
            "email_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        }
    ],
    "related_cases": [],
    "next_followup_at": "2026-10-24T10:00:00+05:30",
}


class CaseDetailResponse(BaseResponse):
    data: CaseDetailData = Field(..., description="Everything about one case")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Case retrieved",
                "data": CASE_DETAIL_EXAMPLE,
            }
        }
    )


class DraftSession(BaseModel):
    title: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Session title",
        examples=["HR policies"],
    )
    owner_email: str = Field(
        ...,
        min_length=3,
        max_length=320,
        description="Owner email or contact token",
        examples=["hr_owner"],
    )
    start: str = Field(
        ...,
        description="ISO 8601 start with offset",
        examples=["2026-11-16T10:00:00+05:30"],
    )
    end: str = Field(
        ...,
        description="ISO 8601 end with offset",
        examples=["2026-11-16T11:00:00+05:30"],
    )


class ApprovalDraft(BaseModel):
    subject: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Reply subject",
        examples=["Re: Joining date"],
    )
    body: Optional[str] = Field(
        default=None,
        max_length=20000,
        description="Reply body as plain text",
        examples=["Hi Rahul, HR will confirm the new date by Friday."],
    )
    to: Optional[List[str]] = Field(
        default=None,
        description="Reply recipients",
        examples=[["rahul.sharma@gmail.com"]],
    )
    track: Optional[str] = Field(
        default=None, description="Induction track", examples=["mid"]
    )
    sessions: Optional[List[DraftSession]] = Field(
        default=None, description="Induction sessions"
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="AI note for HR",
        examples=["Planned with the standard planner"],
    )
    ai_confidence: Optional[float] = Field(
        default=None, description="How sure the AI was", examples=[0.8]
    )


class SourceEmail(BaseModel):
    email_id: str = Field(
        ..., description="Email UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    from_email: Optional[str] = Field(
        default=None,
        alias="from",
        description="Sender",
        examples=["rahul.sharma@gmail.com"],
    )
    subject: Optional[str] = Field(
        default=None, description="Subject", examples=["Joining date"]
    )
    received_at: Optional[str] = Field(
        default=None,
        description="When it arrived",
        examples=["2026-10-22T11:50:00+05:30"],
    )
    body: Optional[str] = Field(
        default=None,
        description="New text of the email",
        examples=["Can I join on 23 Nov instead?"],
    )

    model_config = ConfigDict(populate_by_name=True)


class ApprovalListItem(BaseModel):
    approval_id: str = Field(
        ...,
        description="Approval UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    approval_type: ApprovalType = Field(
        ..., description="reply or induction_schedule", examples=["reply"]
    )
    case_id: Optional[str] = Field(
        default=None,
        description="Case UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    person_name: Optional[str] = Field(
        default=None, description="Who it is about", examples=["Rahul Sharma"]
    )
    summary: Optional[str] = Field(
        default=None,
        description="One line summary",
        examples=["Asks if the joining date can move"],
    )
    status: ApprovalStatus = Field(
        ..., description="pending, approved, rejected or sent", examples=["pending"]
    )
    created_at: Optional[str] = Field(
        default=None,
        description="When it was drafted",
        examples=["2026-10-22T12:00:00+05:30"],
    )


class ApprovalDetail(ApprovalListItem):
    source_email: Optional[SourceEmail] = Field(
        default=None, description="Email that triggered a reply draft"
    )
    draft: ApprovalDraft = Field(..., description="The draft")
    decided_at: Optional[str] = Field(
        default=None, description="When HR decided", examples=[None]
    )
    reject_reason: Optional[str] = Field(
        default=None, description="Why HR rejected it", examples=[None]
    )


APPROVAL_LIST_EXAMPLE = {
    "approval_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "approval_type": "reply",
    "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "person_name": "Rahul Sharma",
    "summary": "Asks if the joining date can move",
    "status": "pending",
    "created_at": "2026-10-22T12:00:00+05:30",
}

APPROVAL_DETAIL_EXAMPLE = {
    **APPROVAL_LIST_EXAMPLE,
    "source_email": {
        "email_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "from": "rahul.sharma@gmail.com",
        "subject": "Joining date",
        "received_at": "2026-10-22T11:50:00+05:30",
        "body": "Can I join on 23 Nov instead?",
    },
    "draft": {
        "subject": "Re: Joining date",
        "body": "Hi Rahul, HR will confirm the new date by Friday.",
        "to": ["rahul.sharma@gmail.com"],
        "track": None,
        "sessions": None,
        "notes": None,
        "ai_confidence": 0.8,
    },
    "decided_at": None,
    "reject_reason": None,
}


class ApprovalListResponse(PaginatedResponse):
    data: List[ApprovalListItem] = Field(..., description="Approval queue")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 approval",
                "data": [APPROVAL_LIST_EXAMPLE],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class ApprovalDetailResponse(BaseResponse):
    data: ApprovalDetail = Field(..., description="Approval with its draft")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Approval retrieved",
                "data": APPROVAL_DETAIL_EXAMPLE,
            }
        }
    )


class UpdateApprovalRequest(BaseModel):
    draft: ApprovalDraft = Field(
        ..., description="Edited draft, send only what changes"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "draft": {
                    "subject": "Re: Joining date",
                    "body": "Hi Rahul, HR will confirm the new date by Friday.",
                }
            }
        }
    )


class ApproveRequest(BaseModel):
    draft: Optional[ApprovalDraft] = Field(
        default=None, description="Optional final edit before approving"
    )

    model_config = ConfigDict(json_schema_extra={"example": {"draft": None}})


class ApproveData(BaseModel):
    approval_id: str = Field(
        ...,
        description="Approval UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    status: ApprovalStatus = Field(..., description="New status", examples=["approved"])
    email_id: Optional[str] = Field(
        default=None,
        description="Sent reply, once it goes out",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    sessions_created: int = Field(
        ..., description="Induction sessions created", examples=[0]
    )


class ApproveResponse(BaseResponse):
    data: ApproveData = Field(..., description="Approval result")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Approved",
                "data": {
                    "approval_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "status": "approved",
                    "email_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "sessions_created": 0,
                },
            }
        }
    )


class RejectRequest(BaseModel):
    reason: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="Why it was rejected",
        examples=["I will call the candidate instead"],
    )

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Give a short reason")
        return value

    model_config = ConfigDict(
        json_schema_extra={"example": {"reason": "I will call the candidate instead"}}
    )


class RejectData(BaseModel):
    approval_id: str = Field(
        ...,
        description="Approval UUID",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    status: ApprovalStatus = Field(..., description="New status", examples=["rejected"])


class RejectResponse(BaseResponse):
    data: RejectData = Field(..., description="Rejection result")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Rejected, nothing was sent",
                "data": {
                    "approval_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "status": "rejected",
                },
            }
        }
    )
