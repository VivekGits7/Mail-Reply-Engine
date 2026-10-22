import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import asyncpg

from app.database import execute_command, execute_query, execute_scalar


class ActionLog:
    @staticmethod
    async def create(
        actor_type: str,
        actor_id: Optional[uuid.UUID],
        action: str,
        case_id: Optional[uuid.UUID],
        entity_type: Optional[str],
        entity_id: Optional[uuid.UUID],
        details: Dict[str, Any],
    ) -> None:
        await execute_command(
            # SQL
            """
            INSERT INTO action_log (action_log_id, actor_type, actor_id, action, case_id, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            """,
            uuid.uuid4(),
            actor_type,
            actor_id,
            action,
            case_id,
            entity_type,
            entity_id,
            details,
        )

    @staticmethod
    async def search(
        case_id: Optional[uuid.UUID],
        actor_type: Optional[str],
        action: Optional[str],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        newest_first: bool,
        limit: int,
        offset: int,
    ) -> Tuple[List[asyncpg.Record], int]:
        # SQL
        where = """
            WHERE ($1::uuid IS NULL OR a.case_id = $1)
              AND ($2::text IS NULL OR a.actor_type = $2)
              AND ($3::text IS NULL OR a.action = $3)
              AND ($4::timestamptz IS NULL OR a.occurred_at >= $4)
              AND ($5::timestamptz IS NULL OR a.occurred_at <= $5)
        """
        direction = "DESC" if newest_first else "ASC"
        rows = await execute_query(
            # SQL
            f"""
            SELECT a.*, u.name AS actor_name
            FROM action_log a
            LEFT JOIN users u ON u.user_id = a.actor_id
            {where}
            ORDER BY a.occurred_at {direction}, a.action_log_id
            LIMIT $6 OFFSET $7
            """,
            case_id,
            actor_type,
            action,
            date_from,
            date_to,
            limit,
            offset,
        )
        total = await execute_scalar(
            f"SELECT COUNT(*) FROM action_log a {where}",
            case_id,
            actor_type,
            action,
            date_from,
            date_to,
        )
        return rows, total

    @staticmethod
    async def for_case(case_id: uuid.UUID) -> List[asyncpg.Record]:
        return await execute_query(
            # SQL
            """
            SELECT a.*, u.name AS actor_name
            FROM action_log a
            LEFT JOIN users u ON u.user_id = a.actor_id
            WHERE a.case_id = $1
            ORDER BY a.occurred_at, a.action_log_id
            """,
            case_id,
        )
