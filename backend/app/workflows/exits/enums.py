from enum import Enum


class ExitStage(str, Enum):
    CLEARANCE_REQUESTED = "clearance_requested"
    CLEARANCES_IN_PROGRESS = "clearances_in_progress"
    ALL_CLEARED = "all_cleared"
    CLOSED = "closed"


class ClearanceTeam(str, Enum):
    IT = "it"
    FINANCE = "finance"
    ADMIN = "admin"
    MANAGER = "manager"


class ExitSortBy(str, Enum):
    LAST_WORKING_DAY = "last_working_day"
    FULL_NAME = "full_name"
    CREATED_AT = "created_at"


TEAM_TASK_TYPES = {
    ClearanceTeam.IT: "clearance_it",
    ClearanceTeam.FINANCE: "clearance_finance",
    ClearanceTeam.ADMIN: "clearance_admin",
    ClearanceTeam.MANAGER: "clearance_manager",
}
TASK_TEAMS = {task_type: team for team, task_type in TEAM_TASK_TYPES.items()}
TEAM_LABELS = {
    ClearanceTeam.IT: "IT",
    ClearanceTeam.FINANCE: "Finance",
    ClearanceTeam.ADMIN: "Admin",
    ClearanceTeam.MANAGER: "Manager",
}
DEFAULT_CLEARANCE_ITEMS = {
    ClearanceTeam.IT: ["credentials", "laptop"],
    ClearanceTeam.FINANCE: ["dues"],
    ClearanceTeam.ADMIN: ["id_card", "access_card"],
    ClearanceTeam.MANAGER: ["handover"],
}
