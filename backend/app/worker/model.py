import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import asyncpg

from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_scalar,
)

ERROR_MAX_CHARS = 480
CLOCK_TOLERANCE = timedelta(seconds=5)


def _short(error: str) -> str:
    return error[:ERROR_MAX_CHARS]


class Event:
    def __init__(self, **kwargs):
        self.event_id: uuid.UUID = kwargs["event_id"]
        self.event_type: str = kwargs["event_type"]
        self.source: str = kwargs["source"]
        self.payload: Dict[str, Any] = kwargs.get("payload") or {}
        self.dedupe_key: Optional[str] = kwargs.get("dedupe_key")
        self.status: str = kwargs["status"]
        self.attempts: int = kwargs.get("attempts", 0)
        self.last_error: Optional[str] = kwargs.get("last_error")
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    async def create(
        cls,
        event_type: str,
        source: str,
        payload: Dict[str, Any],
        dedupe_key: Optional[str],
        case_id: Optional[uuid.UUID],
    ) -> Optional["Event"]:
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO events (event_id, event_type, source, payload, dedupe_key, case_id)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            ON CONFLICT (dedupe_key) DO NOTHING
            RETURNING *
            """,
            uuid.uuid4(),
            event_type,
            source,
            payload,
            dedupe_key,
            case_id,
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def claim(cls, event_id: uuid.UUID) -> Optional["Event"]:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE events
            SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
            WHERE event_id = $1 AND status = 'queued' AND available_at <= NOW()
            RETURNING *
            """,
            event_id,
        )
        return cls(**dict(row)) if row else None

    async def mark_done(self) -> None:
        await execute_command(
            "UPDATE events SET status = 'done', last_error = NULL, updated_at = NOW() WHERE event_id = $1",
            self.event_id,
        )

    async def mark_retry(self, error: str, delay_seconds: int) -> None:
        await execute_command(
            # SQL
            """
            UPDATE events
            SET status = 'queued', last_error = $2, available_at = NOW() + make_interval(secs => $3), updated_at = NOW()
            WHERE event_id = $1
            """,
            self.event_id,
            _short(error),
            delay_seconds,
        )

    async def mark_failed(self, error: str) -> None:
        await execute_command(
            "UPDATE events SET status = 'failed', last_error = $2, updated_at = NOW() WHERE event_id = $1",
            self.event_id,
            _short(error),
        )

    @staticmethod
    async def requeue(event_id: uuid.UUID) -> bool:
        result = await execute_command(
            # SQL
            """
            UPDATE events
            SET status = 'queued', attempts = 0, available_at = NOW(), updated_at = NOW()
            WHERE event_id = $1 AND status = 'failed'
            """,
            event_id,
        )
        return result.endswith(" 1")

    @staticmethod
    async def due_ids(stuck_after: timedelta, limit: int = 100) -> List[uuid.UUID]:
        rows = await execute_query(
            # SQL
            """
            SELECT event_id FROM events
            WHERE (status = 'queued' AND available_at <= NOW())
               OR (status = 'processing' AND updated_at < NOW() - $1::interval)
            ORDER BY available_at
            LIMIT $2
            """,
            stuck_after,
            limit,
        )
        return [row["event_id"] for row in rows]

    @staticmethod
    async def release_stuck(stuck_after: timedelta) -> None:
        await execute_command(
            "UPDATE events SET status = 'queued', updated_at = NOW() WHERE status = 'processing' AND updated_at < NOW() - $1::interval",
            stuck_after,
        )

    @staticmethod
    async def counts() -> Dict[str, int]:
        rows = await execute_query(
            "SELECT status, COUNT(*) AS total FROM events WHERE status <> 'done' GROUP BY status"
        )
        return {row["status"]: row["total"] for row in rows}


class ScheduledJob:
    def __init__(self, **kwargs):
        self.scheduled_job_id: uuid.UUID = kwargs["scheduled_job_id"]
        self.job_type: str = kwargs["job_type"]
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.task_id: Optional[uuid.UUID] = kwargs.get("task_id")
        self.template_key: Optional[str] = kwargs.get("template_key")
        self.run_at: datetime = kwargs["run_at"]
        self.attempt: int = kwargs.get("attempt", 0)
        self.max_attempts: int = kwargs.get("max_attempts", 0)
        self.status: str = kwargs["status"]
        self.dedupe_key: str = kwargs["dedupe_key"]
        self.payload: Dict[str, Any] = kwargs.get("payload") or {}
        self.tries: int = kwargs.get("tries", 0)
        self.last_error: Optional[str] = kwargs.get("last_error")
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    async def create(
        cls,
        job_type: str,
        run_at: datetime,
        dedupe_key: str,
        *,
        case_id: Optional[uuid.UUID] = None,
        task_id: Optional[uuid.UUID] = None,
        template_key: Optional[str] = None,
        attempt: int = 0,
        max_attempts: int = 0,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Optional["ScheduledJob"]:
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO scheduled_jobs
                (scheduled_job_id, job_type, case_id, task_id, template_key, run_at, attempt, max_attempts, dedupe_key, payload)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
            ON CONFLICT (dedupe_key) DO NOTHING
            RETURNING *
            """,
            uuid.uuid4(),
            job_type,
            case_id,
            task_id,
            template_key,
            run_at,
            attempt,
            max_attempts,
            dedupe_key,
            payload or {},
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def find_by_id(cls, job_id: uuid.UUID) -> Optional["ScheduledJob"]:
        row = await execute_command_with_return(
            "SELECT * FROM scheduled_jobs WHERE scheduled_job_id = $1", job_id
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def find_by_dedupe(cls, dedupe_key: str) -> Optional["ScheduledJob"]:
        row = await execute_command_with_return(
            "SELECT * FROM scheduled_jobs WHERE dedupe_key = $1", dedupe_key
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def claim(cls, job_id: uuid.UUID) -> Optional["ScheduledJob"]:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE scheduled_jobs
            SET status = 'running', tries = tries + 1, updated_at = NOW()
            WHERE scheduled_job_id = $1 AND status = 'pending' AND run_at <= $2
            RETURNING *
            """,
            job_id,
            datetime.now(timezone.utc) + CLOCK_TOLERANCE,
        )
        return cls(**dict(row)) if row else None

    @staticmethod
    async def due_ids(limit: int = 100) -> List[uuid.UUID]:
        rows = await execute_query(
            "SELECT scheduled_job_id FROM scheduled_jobs WHERE status = 'pending' AND run_at <= $1 ORDER BY run_at LIMIT $2",
            datetime.now(timezone.utc) + CLOCK_TOLERANCE,
            limit,
        )
        return [row["scheduled_job_id"] for row in rows]

    async def finish(self, status: str, error: Optional[str] = None) -> None:
        await execute_command(
            "UPDATE scheduled_jobs SET status = $2, last_error = $3, updated_at = NOW() WHERE scheduled_job_id = $1",
            self.scheduled_job_id,
            status,
            _short(error) if error else None,
        )

    async def reschedule(self, run_at: datetime, error: Optional[str] = None) -> None:
        await execute_command(
            # SQL
            """
            UPDATE scheduled_jobs
            SET status = 'pending', run_at = $2, last_error = $3, updated_at = NOW()
            WHERE scheduled_job_id = $1
            """,
            self.scheduled_job_id,
            run_at,
            _short(error) if error else None,
        )

    @staticmethod
    async def requeue(job_id: uuid.UUID) -> bool:
        result = await execute_command(
            "UPDATE scheduled_jobs SET status = 'pending', run_at = NOW(), tries = 0, updated_at = NOW() WHERE scheduled_job_id = $1 AND status = 'failed'",
            job_id,
        )
        return result.endswith(" 1")

    @staticmethod
    async def cancel_pending(
        *,
        task_id: Optional[uuid.UUID] = None,
        case_id: Optional[uuid.UUID] = None,
        job_types: Optional[List[str]] = None,
    ) -> int:
        if task_id is None and case_id is None:
            return 0
        result = await execute_command(
            # SQL
            """
            UPDATE scheduled_jobs
            SET status = 'cancelled', updated_at = NOW()
            WHERE status = 'pending'
              AND ($1::uuid IS NULL OR task_id = $1)
              AND ($2::uuid IS NULL OR case_id = $2)
              AND ($3::text[] IS NULL OR job_type = ANY($3))
            """,
            task_id,
            case_id,
            job_types,
        )
        return int(result.split()[-1])

    @staticmethod
    async def next_pending_at(
        *, case_id: Optional[uuid.UUID] = None, task_id: Optional[uuid.UUID] = None
    ) -> Optional[datetime]:
        return await execute_scalar(
            # SQL
            """
            SELECT MIN(run_at) FROM scheduled_jobs
            WHERE status = 'pending' AND ($1::uuid IS NULL OR case_id = $1) AND ($2::uuid IS NULL OR task_id = $2)
            """,
            case_id,
            task_id,
        )

    @staticmethod
    async def pending_count() -> int:
        return await execute_scalar(
            "SELECT COUNT(*) FROM scheduled_jobs WHERE status = 'pending'"
        )


async def list_failures(
    kind: Optional[str], event_type: Optional[str], limit: int, offset: int
) -> Tuple[List[asyncpg.Record], int]:
    # SQL
    union = """
        SELECT event_id AS failure_id, 'event' AS kind, event_type, case_id, attempts, last_error, updated_at
        FROM events WHERE status = 'failed'
        UNION ALL
        SELECT scheduled_job_id, 'job', job_type, case_id, tries, last_error, updated_at
        FROM scheduled_jobs WHERE status = 'failed'
    """
    # SQL
    where = "WHERE ($1::text IS NULL OR kind = $1) AND ($2::text IS NULL OR event_type = $2)"
    rows = await execute_query(
        f"SELECT * FROM ({union}) f {where} ORDER BY updated_at DESC, failure_id LIMIT $3 OFFSET $4",
        kind,
        event_type,
        limit,
        offset,
    )
    total = await execute_scalar(
        f"SELECT COUNT(*) FROM ({union}) f {where}", kind, event_type
    )
    return rows, total
