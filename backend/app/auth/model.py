import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from app.auth.enums import UserRole, UserSortBy
from app.common.enums import SortOrder
from app.common.listing import sql_order
from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_query_one,
    execute_scalar,
)


class User:
    def __init__(self, **kwargs):
        self.user_id: uuid.UUID = kwargs["user_id"]
        self.name: str = kwargs["name"]
        self.email: str = kwargs["email"]
        self.password_hash: str = kwargs["password_hash"]
        self.role = UserRole(kwargs.get("role", UserRole.HR_VIEWER.value))
        self.complaints_access: bool = kwargs.get("complaints_access", False)
        self.is_active: bool = kwargs.get("is_active", True)
        self.photo_key: Optional[str] = kwargs.get("photo_key")
        self.last_login_at: Optional[datetime] = kwargs.get("last_login_at")
        self.created_at: Optional[datetime] = kwargs.get("created_at")
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.HR_ADMIN

    @classmethod
    async def find_by_id(cls, user_id: str | uuid.UUID) -> Optional["User"]:
        row = await execute_query_one(
            "SELECT * FROM users WHERE user_id = $1", uuid.UUID(str(user_id))
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def find_by_email(cls, email: str) -> Optional["User"]:
        row = await execute_query_one(
            "SELECT * FROM users WHERE LOWER(email) = LOWER($1)", email
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def create(
        cls,
        name: str,
        email: str,
        password_hash: str,
        role: UserRole = UserRole.HR_VIEWER,
        complaints_access: bool = False,
        photo_key: Optional[str] = None,
    ) -> "User":
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO users (user_id, name, email, password_hash, role, complaints_access, photo_key)
            VALUES ($1, $2, LOWER($3), $4, $5, $6, $7)
            RETURNING *
            """,
            uuid.uuid4(),
            name,
            email,
            password_hash,
            role.value,
            complaints_access,
            photo_key,
        )
        return cls(**dict(row))

    @classmethod
    async def search(
        cls,
        search: Optional[str],
        role: Optional[UserRole],
        is_active: Optional[bool],
        sort_by: UserSortBy,
        sort_order: SortOrder,
        limit: int,
        offset: int,
    ) -> Tuple[List["User"], int]:
        # SQL
        where = """
            WHERE ($1::text IS NULL OR name ILIKE $1 OR email ILIKE $1)
              AND ($2::text IS NULL OR role = $2)
              AND ($3::boolean IS NULL OR is_active = $3)
        """
        pattern = f"%{search.strip()}%" if search and search.strip() else None
        order = sql_order(sort_by.value, sort_order, "created_at", "user_id")
        rows = await execute_query(
            f"SELECT * FROM users {where} ORDER BY {order} LIMIT $4 OFFSET $5",
            pattern,
            role.value if role else None,
            is_active,
            limit,
            offset,
        )
        total = await execute_scalar(
            f"SELECT COUNT(*) FROM users {where}",
            pattern,
            role.value if role else None,
            is_active,
        )
        return [cls(**dict(row)) for row in rows], total

    @staticmethod
    async def active_admin_count() -> int:
        return await execute_scalar(
            "SELECT COUNT(*) FROM users WHERE role = 'hr_admin' AND is_active"
        )

    async def update(
        self,
        role: Optional[UserRole] = None,
        complaints_access: Optional[bool] = None,
        is_active: Optional[bool] = None,
        password_hash: Optional[str] = None,
    ) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE users
            SET role = COALESCE($2, role),
                complaints_access = COALESCE($3, complaints_access),
                is_active = COALESCE($4, is_active),
                password_hash = COALESCE($5, password_hash),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            """,
            self.user_id,
            role.value if role else None,
            complaints_access,
            is_active,
            password_hash,
        )
        self.__init__(**dict(row))

    async def set_photo(self, photo_key: Optional[str]) -> None:
        row = await execute_command_with_return(
            "UPDATE users SET photo_key = $2, updated_at = NOW() WHERE user_id = $1 RETURNING *",
            self.user_id,
            photo_key,
        )
        self.__init__(**dict(row))

    async def mark_logged_in(self) -> None:
        await execute_command(
            "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1",
            self.user_id,
        )

    async def delete(self) -> None:
        await execute_command("DELETE FROM users WHERE user_id = $1", self.user_id)

    def to_dict(self) -> dict:
        return {
            "user_id": str(self.user_id),
            "name": self.name,
            "email": self.email,
            "role": self.role.value,
            "complaints_access": self.complaints_access,
            "is_active": self.is_active,
            "last_login_at": self.last_login_at.isoformat()
            if self.last_login_at
            else None,
        }

    def to_public_dict(self) -> dict:
        return {"user_id": str(self.user_id), "name": self.name}


class RevokedToken:
    @staticmethod
    async def revoke(jti: str, expires_at: datetime) -> None:
        await execute_command(
            # SQL
            """
            INSERT INTO revoked_tokens (revoked_token_id, jti, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (jti) DO NOTHING
            """,
            uuid.uuid4(),
            jti,
            expires_at,
        )

    @staticmethod
    async def is_revoked(jti: str) -> bool:
        row = await execute_query_one(
            "SELECT 1 FROM revoked_tokens WHERE jti = $1", jti
        )
        return row is not None

    @staticmethod
    async def purge_expired() -> None:
        await execute_command("DELETE FROM revoked_tokens WHERE expires_at < NOW()")
