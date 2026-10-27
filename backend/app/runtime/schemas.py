import re
from typing import Any, Dict, List

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.common.schemas import BaseResponse

CLOCK_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
SWITCH_KEYS = {"kill_switch", "dry_run", "test_inbox"}


class ContactSettings(BaseModel):
    it_team: str = Field(
        default="", description="IT team mailbox for email ID and D365 requests"
    )
    onboarding_group: str = Field(
        default="", description="Onboarding group that gets the joining intimation"
    )
    offboarding_group: str = Field(
        default="", description="Offboarding group that gets exit intimations"
    )
    hr_onboarding_team: str = Field(
        default="", description="HR onboarding team kept in CC on document mails"
    )
    hr_onboarding_owner: str = Field(
        default="", description="HR person IT follow-ups escalate to"
    )
    recruitment_team: str = Field(
        default="", description="Recruitment team told about likely dropouts"
    )
    finance_team: str = Field(
        default="", description="Finance mailbox chased for exit clearance"
    )
    admin_team: str = Field(
        default="", description="Admin mailbox chased for exit clearance"
    )
    hr_owner: str = Field(default="", description="HR owner for alerts and escalations")
    complaints_owner: str = Field(
        default="", description="Person told about new restricted items"
    )
    performance_team: str = Field(
        default="", description="Performance team kept informed on appraisals"
    )
    training_team: str = Field(
        default="", description="Training team that owns training reminders"
    )

    @field_validator("*")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if value and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("must be an email address")
        return value


class RuntimeSettings(BaseModel):
    ai_confidence_threshold: float = Field(
        default=0.8, ge=0, le=1, description="AI confidence needed to act on an email"
    )
    followup_gap_hours: int = Field(
        default=48, ge=1, le=720, description="Hours between follow-ups"
    )
    finance_followup_gap_hours: int = Field(
        default=24, ge=1, le=720, description="Hours between Finance exit follow-ups"
    )
    max_followups: int = Field(
        default=3, ge=0, le=10, description="Follow-ups before one escalation and stop"
    )
    induction_followup_after_days: int = Field(
        default=3, ge=1, le=30, description="Days before an availability follow-up"
    )
    induction_max_followups: int = Field(
        default=2,
        ge=0,
        le=10,
        description="Availability follow-ups before HR is flagged",
    )
    survey_reminder_after_days: int = Field(
        default=3, ge=1, le=30, description="Days before a survey reminder"
    )
    survey_max_reminders: int = Field(
        default=2, ge=0, le=10, description="Survey reminders per milestone"
    )
    max_auto_emails_per_person_per_day: int = Field(
        default=3,
        ge=1,
        le=50,
        description="Automatic emails one person can get in a day",
    )
    sending_days: List[int] = Field(
        default=[0, 1, 2, 3, 4], description="Weekdays mail can go out, Monday is 0"
    )
    working_days: List[int] = Field(
        default=[0, 1, 2, 3, 4],
        description="Weekdays induction sessions can be planned on, Monday is 0",
    )
    sending_start: str = Field(
        default="09:00", description="Start of the daily sending window"
    )
    sending_end: str = Field(
        default="19:00", description="End of the daily sending window"
    )
    welcome_email_time: str = Field(
        default="09:30", description="Welcome email time on the joining day"
    )
    appointment_letter_check_time: str = Field(
        default="09:00", description="Time of the day-before appointment letter check"
    )
    induction_day_start: str = Field(
        default="10:00", description="Earliest induction session start"
    )
    induction_day_end: str = Field(
        default="18:00", description="Latest induction session end"
    )
    name_match_threshold: int = Field(
        default=85,
        ge=50,
        le=100,
        description="Name match score needed to accept a document",
    )
    survey_levels: List[str] = Field(
        default=["L1", "L2", "L3", "L4", "L5", "L6"],
        description="Levels that get 30-60-90 surveys",
    )
    survey_low_score_threshold: float = Field(
        default=3.0, ge=0, description="Survey score below which HR is alerted"
    )
    survey_form_links: Dict[str, str] = Field(
        default={"campus": "", "lateral": ""},
        description="Forms link per hire category",
    )
    survey_response_workbooks: Dict[str, Dict[str, str]] = Field(
        default_factory=dict,
        description="Forms response workbook per hire category, drive_id item_id and sheet",
    )
    feedback_report_day_of_month: int = Field(
        default=1,
        ge=1,
        le=28,
        description="Day of the month the feedback report goes out",
    )
    senior_track_designations: List[str] = Field(
        default=["director", "vice president", "president", "chief", "head"],
        description="Designation words that pick the senior induction track",
    )
    ocr_min_chars: int = Field(
        default=50, ge=0, description="Fewest characters for a readable document"
    )
    ocr_min_confidence: int = Field(
        default=60,
        ge=0,
        le=100,
        description="Lowest OCR confidence for a readable document",
    )
    upload_max_mb: int = Field(
        default=20, ge=1, le=100, description="Largest dashboard upload in MB"
    )
    kill_switch: bool = Field(default=False, description="Stops every outgoing email")
    dry_run: bool = Field(
        default=True, description="Sends every email to the test inbox only"
    )
    test_inbox: str = Field(
        default="", description="Inbox that gets every email in dry-run"
    )
    document_reading_enabled: bool = Field(
        default=False, description="Reads document content, off until security approves"
    )
    d365_enabled: bool = Field(
        default=False, description="Polls D365 for status changes"
    )
    work_email_domain: str = Field(
        default="tcgdigital.com", description="Domain of work email IDs IT creates"
    )
    contacts: ContactSettings = Field(
        default_factory=ContactSettings, description="Team and owner mailboxes"
    )

    @field_validator(
        "sending_start",
        "sending_end",
        "welcome_email_time",
        "appointment_letter_check_time",
        "induction_day_start",
        "induction_day_end",
    )
    @classmethod
    def validate_clock(cls, value: str) -> str:
        if not CLOCK_PATTERN.match(value):
            raise ValueError("must be a 24 hour time like 09:30")
        return value

    @field_validator("sending_days", "working_days")
    @classmethod
    def validate_days(cls, value: List[int]) -> List[int]:
        if not value or any(day < 0 or day > 6 for day in value):
            raise ValueError("must hold weekday numbers from 0 to 6")
        return sorted(set(value))

    @field_validator("test_inbox")
    @classmethod
    def validate_test_inbox(cls, value: str) -> str:
        value = value.strip().lower()
        if value and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("must be an email address")
        return value


class SettingItem(BaseModel):
    key: str = Field(..., description="Setting key", examples=["followup_gap_hours"])
    value: Any = Field(..., description="Current value", examples=[48])
    description: str = Field(
        ...,
        description="What the setting controls",
        examples=["Hours between follow-ups"],
    )
    updated_by: str | None = Field(
        default=None,
        description="Name of the admin who last changed it",
        examples=["TCG Admin"],
    )
    updated_at: str | None = Field(
        default=None,
        description="ISO 8601 time of the last change",
        examples=["2026-10-20T10:00:00+05:30"],
    )


SETTINGS_LIST_EXAMPLE = [
    {
        "key": "followup_gap_hours",
        "value": 48,
        "description": "Hours between follow-ups",
        "updated_by": "TCG Admin",
        "updated_at": "2026-10-20T10:00:00+05:30",
    }
]


class SettingsListResponse(BaseResponse):
    data: List[SettingItem] = Field(
        ..., description="Every HR tunable with its current value"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Settings retrieved",
                "data": SETTINGS_LIST_EXAMPLE,
            }
        }
    )


class KillSwitchRequest(BaseModel):
    enabled: bool = Field(..., description="True stops all sending", examples=[True])
    reason: str | None = Field(
        default=None,
        max_length=300,
        description="Why the switch was flipped",
        examples=["Wrong template went out"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"enabled": True, "reason": "Wrong template went out"}
        }
    )


class DryRunRequest(BaseModel):
    enabled: bool = Field(
        ..., description="True sends every email to the test inbox", examples=[True]
    )
    test_inbox: EmailStr | None = Field(
        default=None,
        description="Test inbox, required when enabling without one set",
        examples=["hr-test@tcgdigital.com"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"enabled": True, "test_inbox": "hr-test@tcgdigital.com"}
        }
    )
