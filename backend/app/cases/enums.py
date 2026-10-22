from enum import Enum


class CaseType(str, Enum):
    ONBOARDING = "onboarding"
    EXIT = "exit"
    INDUCTION = "induction"
    FEEDBACK = "feedback"


class CaseStatus(str, Enum):
    OPEN = "open"
    ON_HOLD = "on_hold"
    CLOSED = "closed"
    CANCELLED = "cancelled"


ACTIVE_STATUSES = (CaseStatus.OPEN.value, CaseStatus.ON_HOLD.value)


class CaseFlag(str, Enum):
    DROPOUT_RISK = "dropout_risk"
    NAME_MISMATCH = "name_mismatch"
    SENDER_NOT_RECOGNISED = "sender_not_recognised"
    SALARY_DOCUMENT = "salary_document"
    FAILED_ACTION = "failed_action"
    APPOINTMENT_LETTER_MISSING = "appointment_letter_missing"
    INDUCTION_NO_REPLY = "induction_no_reply"
    CALENDAR_CONFLICT = "calendar_conflict"
    NEEDS_HR = "needs_hr"


class TaskType(str, Enum):
    DOC_COLLECTION = "doc_collection"
    IT_SETUP = "it_setup"
    SEND_CREDENTIALS = "send_credentials"
    CLEARANCE_IT = "clearance_it"
    CLEARANCE_FINANCE = "clearance_finance"
    CLEARANCE_ADMIN = "clearance_admin"
    CLEARANCE_MANAGER = "clearance_manager"
    INDUCTION_AVAILABILITY = "induction_availability"
    SURVEY_RESPONSE = "survey_response"
    REMINDER = "reminder"


class TaskStatus(str, Enum):
    OPEN = "open"
    PARTIAL = "partial"
    DONE = "done"
    BLOCKED = "blocked"
    NOT_APPLICABLE = "not_applicable"
    ESCALATED = "escalated"
    PAUSED = "paused"
    CANCELLED = "cancelled"


CLOSED_TASK_STATUSES = {
    TaskStatus.DONE,
    TaskStatus.NOT_APPLICABLE,
    TaskStatus.CANCELLED,
    TaskStatus.BLOCKED,
}


class ChecklistStatus(str, Enum):
    PENDING = "pending"
    RECEIVED = "received"
    VERIFIED = "verified"
    UNREADABLE = "unreadable"
    WRONG_TYPE = "wrong_type"
    NAME_MISMATCH = "name_mismatch"


class ApprovalType(str, Enum):
    REPLY = "reply"
    INDUCTION_SCHEDULE = "induction_schedule"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SENT = "sent"
