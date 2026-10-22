from enum import Enum


class InductionStage(str, Enum):
    DRAFTING = "drafting"
    AWAITING_APPROVAL = "awaiting_approval"
    BOOKING = "booking"
    BOOKED = "booked"
    WELCOME_SENT = "welcome_sent"
    CLOSED = "closed"


class SessionStatus(str, Enum):
    PROPOSED = "proposed"
    ASKED = "asked"
    AGREED = "agreed"
    ALTERNATIVE = "alternative"
    BOOKED = "booked"
    NO_REPLY = "no_reply"
    CONFLICT = "conflict"


SETTLED_SESSION_STATUSES = {
    SessionStatus.BOOKED.value,
    SessionStatus.NO_REPLY.value,
    SessionStatus.CONFLICT.value,
}
