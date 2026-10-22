import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_query_one,
)

ANY_LOCATION = "*"


class ChecklistTemplate:
    @staticmethod
    async def grouped(
        hire_category: Optional[str], location: Optional[str]
    ) -> List[Dict[str, Any]]:
        rows = await execute_query(
            # SQL
            """
            SELECT * FROM checklist_templates
            WHERE ($1::text IS NULL OR hire_category = $1)
              AND ($2::text IS NULL OR LOWER(location) = LOWER($2))
            ORDER BY hire_category, location, sort_order, document_type
            """,
            hire_category,
            location,
        )
        groups: Dict[tuple, Dict[str, Any]] = {}
        for row in rows:
            key = (row["hire_category"], row["location"])
            group = groups.setdefault(
                key,
                {
                    "hire_category": key[0],
                    "location": key[1],
                    "items": [],
                    "updated_at": row["updated_at"],
                },
            )
            group["items"].append(
                {
                    "document_type": row["document_type"],
                    "is_mandatory": row["is_mandatory"],
                    "check_mode": row["check_mode"],
                    "sort_order": row["sort_order"],
                }
            )
            group["updated_at"] = max(group["updated_at"], row["updated_at"])
        return list(groups.values())

    @staticmethod
    async def items_for(
        hire_category: str, location: Optional[str]
    ) -> List[Dict[str, Any]]:
        rows = await execute_query(
            # SQL
            """
            SELECT * FROM checklist_templates
            WHERE hire_category = $1
              AND LOWER(location) = (
                  SELECT CASE WHEN EXISTS (
                      SELECT 1 FROM checklist_templates WHERE hire_category = $1 AND LOWER(location) = LOWER(COALESCE($2, ''))
                  ) THEN LOWER(COALESCE($2, '')) ELSE '*' END
              )
            ORDER BY sort_order, document_type
            """,
            hire_category,
            location,
        )
        return [dict(row) for row in rows]

    @staticmethod
    async def replace(
        hire_category: str, location: str, items: List[Dict[str, Any]]
    ) -> None:
        await execute_command(
            "DELETE FROM checklist_templates WHERE hire_category = $1 AND LOWER(location) = LOWER($2)",
            hire_category,
            location,
        )
        for order, item in enumerate(items):
            await execute_command(
                # SQL
                """
                INSERT INTO checklist_templates (checklist_template_id, hire_category, location, document_type, is_mandatory, check_mode, sort_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                uuid.uuid4(),
                hire_category,
                location,
                item["document_type"],
                item.get("is_mandatory", True),
                item.get("check_mode", "text"),
                order,
            )

    @staticmethod
    async def seed(defaults: Dict[str, List[Dict[str, Any]]]) -> None:
        for hire_category, items in defaults.items():
            for order, item in enumerate(items):
                await execute_command(
                    # SQL
                    """
                    INSERT INTO checklist_templates (checklist_template_id, hire_category, location, document_type, is_mandatory, check_mode, sort_order)
                    VALUES ($1, $2, '*', $3, $4, $5, $6)
                    ON CONFLICT (hire_category, location, document_type) DO NOTHING
                    """,
                    uuid.uuid4(),
                    hire_category,
                    item["document_type"],
                    item["is_mandatory"],
                    item["check_mode"],
                    order,
                )


class InductionTemplate:
    def __init__(self, **kwargs: Any):
        self.track: str = kwargs["track"]
        self.sessions: List[Dict[str, Any]] = kwargs.get("sessions") or []
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    async def find(cls, track: str) -> Optional["InductionTemplate"]:
        row = await execute_query_one(
            "SELECT * FROM induction_templates WHERE track = $1", track
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def upsert(
        cls,
        track: str,
        sessions: List[Dict[str, Any]],
        user_id: Optional[uuid.UUID],
        overwrite: bool = True,
    ) -> "InductionTemplate":
        conflict = (
            "DO UPDATE SET sessions = EXCLUDED.sessions, updated_by = EXCLUDED.updated_by, updated_at = NOW()"
            if overwrite
            else "DO NOTHING"
        )
        await execute_command(
            # SQL
            f"""
            INSERT INTO induction_templates (induction_template_id, track, sessions, updated_by)
            VALUES ($1, $2, $3::jsonb, $4)
            ON CONFLICT (track) {conflict}
            """,
            uuid.uuid4(),
            track,
            sessions,
            user_id,
        )
        return await cls.find(track)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track": self.track,
            "sessions": self.sessions,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


async def seed_admin_defaults() -> None:
    from app.admin.defaults import CHECKLIST_DEFAULTS, INDUCTION_DEFAULTS

    await ChecklistTemplate.seed(CHECKLIST_DEFAULTS)
    for track, sessions in INDUCTION_DEFAULTS.items():
        await InductionTemplate.upsert(track, sessions, None, overwrite=False)


async def existing_track(track: str) -> bool:
    row = await execute_command_with_return(
        "SELECT 1 FROM induction_templates WHERE track = $1", track
    )
    return row is not None
