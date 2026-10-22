from enum import Enum


class InductionTrack(str, Enum):
    CAMPUS = "campus"
    MID = "mid"
    SENIOR = "senior"


class FailureKind(str, Enum):
    EVENT = "event"
    JOB = "job"


class ActorType(str, Enum):
    AGENT = "agent"
    USER = "user"
    SYSTEM = "system"
