from enum import Enum


class SortOrder(str, Enum):
    LATEST = "latest"
    OLDEST = "oldest"
    A_TO_Z = "a_to_z"
    Z_TO_A = "z_to_a"


class PersonCheck(str, Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    NOT_FOUND = "not_found"


class EmailCategory(str, Enum):
    DOC_SUBMISSION = "doc_submission"
    IT_SETUP_REPLY = "it_setup_reply"
    AVAILABILITY_REPLY = "availability_reply"
    CLEARANCE_UPDATE = "clearance_update"
    REMINDER_RESPONSE = "reminder_response"
    QUERY = "query"
    COMPLAINT = "complaint"
    UNRELATED = "unrelated"


class HireCategory(str, Enum):
    CAMPUS = "campus"
    LATERAL = "lateral"


class CheckMode(str, Enum):
    TEXT = "text"
    PHOTO = "photo"
