import uuid
from datetime import date
from typing import Any, List, Optional

import asyncpg

from app.database import execute_command, execute_command_with_return, execute_query


class SettingRow:
    @staticmethod
    async def all() -> List[asyncpg.Record]:
        return await execute_query(
            # SQL
            """
            SELECT s.key, s.value, s.updated_at, u.name AS updated_by
            FROM settings s
            LEFT JOIN users u ON u.user_id = s.updated_by
            """
        )

    @staticmethod
    async def upsert(key: str, value: Any, user_id: Optional[uuid.UUID]) -> None:
        await execute_command(
            # SQL
            """
            INSERT INTO settings (setting_id, key, value, updated_by)
            VALUES ($1, $2, $3::jsonb, $4)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
            """,
            uuid.uuid4(),
            key,
            value,
            user_id,
        )


class Holiday:
    def __init__(self, **kwargs):
        self.holiday_id = kwargs["holiday_id"]
        self.holiday_date: date = kwargs["holiday_date"]
        self.name: str = kwargs["name"]
        self.location: Optional[str] = kwargs.get("location")

    @classmethod
    async def find_all(
        cls, year: Optional[int] = None, location: Optional[str] = None
    ) -> List["Holiday"]:
        rows = await execute_query(
            # SQL
            """
            SELECT * FROM holidays
            WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM holiday_date)::int = $1)
              AND ($2::text IS NULL OR location IS NULL OR LOWER(location) = LOWER($2))
            ORDER BY holiday_date, holiday_id
            """,
            year,
            location,
        )
        return [cls(**dict(row)) for row in rows]

    @classmethod
    async def create(
        cls, holiday_date: date, name: str, location: Optional[str]
    ) -> "Holiday":
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO holidays (holiday_id, holiday_date, name, location)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            uuid.uuid4(),
            holiday_date,
            name,
            location,
        )
        return cls(**dict(row))

    @staticmethod
    async def exists(holiday_date: date, location: Optional[str]) -> bool:
        row = await execute_command_with_return(
            "SELECT 1 FROM holidays WHERE holiday_date = $1 AND COALESCE(LOWER(location), '') = COALESCE(LOWER($2), '')",
            holiday_date,
            location,
        )
        return row is not None

    @staticmethod
    async def delete(holiday_id: uuid.UUID) -> bool:
        result = await execute_command(
            "DELETE FROM holidays WHERE holiday_id = $1", holiday_id
        )
        return result.endswith(" 1")

    @staticmethod
    async def dates(location: Optional[str] = None) -> set[date]:
        rows = await execute_query(
            "SELECT holiday_date FROM holidays WHERE location IS NULL OR LOWER(location) = LOWER(COALESCE($1, ''))",
            location,
        )
        return {row["holiday_date"] for row in rows}

    def to_dict(self) -> dict:
        return {
            "holiday_id": str(self.holiday_id),
            "holiday_date": self.holiday_date.isoformat(),
            "name": self.name,
            "location": self.location,
        }
