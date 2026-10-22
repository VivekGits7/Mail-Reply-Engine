from enum import Enum


class PersonRole(str, Enum):
    CANDIDATE = "candidate"
    EMPLOYEE = "employee"
    STAKEHOLDER = "stakeholder"
    MANAGER = "manager"


class PersonStatus(str, Enum):
    ACTIVE = "active"
    EXITING = "exiting"
    EXITED = "exited"
    DROPPED = "dropped"
