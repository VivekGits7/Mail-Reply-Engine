import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.database import execute_command_with_return, execute_query, execute_query_one

FIELDS = (
    "name",
    "data_source",
    "recipient_field",
    "required_columns",
    "template_key",
    "stages",
    "schedule_cron",
    "followup_gap_hours",
    "max_rounds",
    "escalate_to_email",
    "is_active",
)


class ReminderRule:
    def __init__(self, **kwargs: Any):
        self.reminder_rule_id: uuid.UUID = kwargs["reminder_rule_id"]
        self.name: str = kwargs["name"]
        self.rule_key: str = kwargs["rule_key"]
        self.data_source: str = kwargs.get("data_source") or "upload"
        self.recipient_field: str = kwargs["recipient_field"]
        self.required_columns: List[str] = list(kwargs.get("required_columns") or [])
        self.template_key: str = kwargs["template_key"]
        self.stages: List[Dict[str, Any]] = kwargs.get("stages") or []
        self.schedule_cron: str = kwargs["schedule_cron"]
        self.followup_gap_hours: int = kwargs.get("followup_gap_hours", 48)
        self.max_rounds: int = kwargs.get("max_rounds", 3)
        self.escalate_to_email: Optional[str] = kwargs.get("escalate_to_email")
        self.is_active: bool = kwargs.get("is_active", True)
        self.next_run_at: Optional[datetime] = kwargs.get("next_run_at")
        self.last_run_at: Optional[datetime] = kwargs.get("last_run_at")
        self.open_tasks: int = kwargs.get("open_tasks", 0)
        self.created_at: Optional[datetime] = kwargs.get("created_at")

    @classmethod
    async def create(
        cls,
        rule_key: str,
        values: Dict[str, Any],
        next_run_at: Optional[datetime],
        insert_only: bool = False,
    ) -> Optional["ReminderRule"]:
        conflict = "ON CONFLICT (rule_key) DO NOTHING" if insert_only else ""
        row = await execute_command_with_return(
            # SQL
            f"""
            INSERT INTO reminder_rules (
                reminder_rule_id, rule_key, name, data_source, recipient_field, required_columns, template_key, stages,
                schedule_cron, followup_gap_hours, max_rounds, escalate_to_email, is_active, next_run_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)
            {conflict}
            RETURNING *
            """,
            uuid.uuid4(),
            rule_key,
            *[
                values.get(field) if field != "is_active" else values.get(field, True)
                for field in FIELDS
            ],
            next_run_at,
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def find_by_id(cls, rule_id: uuid.UUID) -> Optional["ReminderRule"]:
        row = await execute_query_one(
            "SELECT * FROM reminder_rules WHERE reminder_rule_id = $1", rule_id
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def find_by_key(cls, rule_key: str) -> Optional["ReminderRule"]:
        row = await execute_query_one(
            "SELECT * FROM reminder_rules WHERE rule_key = $1", rule_key
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def search(
        cls,
        search: Optional[str],
        is_active: Optional[bool],
        data_source: Optional[str],
        order_sql: str,
    ) -> List["ReminderRule"]:
        pattern = f"%{search.strip()}%" if search and search.strip() else None
        rows = await execute_query(
            # SQL
            f"""
            SELECT r.*, (
                SELECT COUNT(*) FROM tasks t WHERE t.reminder_rule_id = r.reminder_rule_id AND t.status IN ('open', 'partial', 'paused', 'escalated')
            ) AS open_tasks
            FROM reminder_rules r
            WHERE ($1::text IS NULL OR r.name ILIKE $1 OR r.rule_key ILIKE $1)
              AND ($2::boolean IS NULL OR r.is_active = $2)
              AND ($3::text IS NULL OR r.data_source = $3)
            ORDER BY {order_sql}
            """,
            pattern,
            is_active,
            data_source,
        )
        return [cls(**dict(row)) for row in rows]

    @classmethod
    async def due(cls, now: datetime) -> List["ReminderRule"]:
        rows = await execute_query(
            "SELECT * FROM reminder_rules WHERE is_active AND (next_run_at IS NULL OR next_run_at <= $1)",
            now,
        )
        return [cls(**dict(row)) for row in rows]

    async def update(self, values: Dict[str, Any]) -> None:
        changes = {
            key: value
            for key, value in values.items()
            if key in FIELDS or key in ("next_run_at", "last_run_at")
        }
        if not changes:
            return
        columns = ", ".join(
            f"{key} = ${index + 2}{'::jsonb' if key == 'stages' else ''}"
            for index, key in enumerate(changes)
        )
        row = await execute_command_with_return(
            f"UPDATE reminder_rules SET {columns}, updated_at = NOW() WHERE reminder_rule_id = $1 RETURNING *",
            self.reminder_rule_id,
            *changes.values(),
        )
        self.__init__(**{**dict(row), "open_tasks": self.open_tasks})

    async def refresh_open_count(self) -> None:
        self.open_tasks = await _count_open(self.reminder_rule_id)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reminder_rule_id": str(self.reminder_rule_id),
            "name": self.name,
            "rule_key": self.rule_key,
            "data_source": self.data_source,
            "recipient_field": self.recipient_field,
            "required_columns": self.required_columns,
            "template_key": self.template_key,
            "stages": self.stages,
            "schedule_cron": self.schedule_cron,
            "followup_gap_hours": self.followup_gap_hours,
            "max_rounds": self.max_rounds,
            "escalate_to_email": self.escalate_to_email,
            "is_active": self.is_active,
            "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
            "open_tasks": self.open_tasks,
        }


async def _count_open(rule_id: uuid.UUID) -> int:
    row = await execute_query_one(
        "SELECT COUNT(*) AS total FROM tasks WHERE reminder_rule_id = $1 AND status IN ('open', 'partial', 'paused', 'escalated')",
        rule_id,
    )
    return row["total"] if row else 0
