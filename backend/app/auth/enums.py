from enum import Enum


class UserRole(str, Enum):
    HR_ADMIN = "hr_admin"
    HR_VIEWER = "hr_viewer"


class UserSortBy(str, Enum):
    CREATED_AT = "created_at"
    NAME = "name"
    LAST_LOGIN_AT = "last_login_at"
