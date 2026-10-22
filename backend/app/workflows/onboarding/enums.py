from enum import Enum


class OnboardingStage(str, Enum):
    DOCS_REQUESTED = "docs_requested"
    DOCS_IN_PROGRESS = "docs_in_progress"
    READY_FOR_SIGNOFF = "ready_for_signoff"
    IT_REQUESTED = "it_requested"
    CLOSED = "closed"
    DROPOUT = "dropout"


DOC_STAGES = {
    OnboardingStage.DOCS_REQUESTED.value,
    OnboardingStage.DOCS_IN_PROGRESS.value,
    OnboardingStage.DROPOUT.value,
}


class JoinerSortBy(str, Enum):
    JOINING_DATE = "joining_date"
    FULL_NAME = "full_name"
    UPDATED_AT = "updated_at"
    CREATED_AT = "created_at"
