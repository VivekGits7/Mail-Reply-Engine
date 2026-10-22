import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import asyncpg

from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_query_one,
)
from app.privacy.encryption import FieldCipher

TABLE = "survey_responses"


class SurveyResponse:
    def __init__(self, **kwargs: Any):
        self.survey_response_id: uuid.UUID = kwargs["survey_response_id"]
        self.person_id: uuid.UUID = kwargs["person_id"]
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.task_id: Optional[uuid.UUID] = kwargs.get("task_id")
        self.milestone: int = kwargs["milestone"]
        self.form_variant: str = kwargs["form_variant"]
        self.sent_at: Optional[datetime] = kwargs.get("sent_at")
        self.responded_at: Optional[datetime] = kwargs.get("responded_at")
        self.response_ref: Optional[str] = kwargs.get("response_ref")
        self.score: Optional[float] = kwargs.get("score")
        self.answers: Dict[str, Any] = kwargs.get("answers") or {}
        self.flagged: bool = kwargs.get("flagged", False)
        self.created_at: Optional[datetime] = kwargs.get("created_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "SurveyResponse":
        data = {key: row[key] for key in row.keys() if not key.endswith("_enc")}
        return cls(
            **data,
            answers=FieldCipher(TABLE, row["survey_response_id"]).dec_json(
                "answers", row["answers_enc"], default={}
            ),
        )

    @classmethod
    async def create(
        cls, person_id: uuid.UUID, case_id: uuid.UUID, milestone: int, form_variant: str
    ) -> Optional["SurveyResponse"]:
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO survey_responses (survey_response_id, person_id, case_id, milestone, form_variant)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (person_id, milestone) DO NOTHING
            RETURNING *
            """,
            uuid.uuid4(),
            person_id,
            case_id,
            milestone,
            form_variant,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def find_by_id(
        cls, survey_response_id: uuid.UUID
    ) -> Optional["SurveyResponse"]:
        row = await execute_query_one(
            "SELECT * FROM survey_responses WHERE survey_response_id = $1",
            survey_response_id,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def open_for_person(cls, person_id: uuid.UUID) -> Optional["SurveyResponse"]:
        row = await execute_query_one(
            "SELECT * FROM survey_responses WHERE person_id = $1 AND responded_at IS NULL ORDER BY milestone DESC LIMIT 1",
            person_id,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def filtered(
        cls,
        milestone: Optional[int],
        flagged: Optional[bool],
        form_variant: Optional[str],
    ) -> List[asyncpg.Record]:
        return await execute_query(
            # SQL
            """
            SELECT s.*, t.followups_sent
            FROM survey_responses s
            LEFT JOIN tasks t ON t.task_id = s.task_id
            WHERE ($1::int IS NULL OR s.milestone = $1)
              AND ($2::boolean IS NULL OR s.flagged = $2)
              AND ($3::text IS NULL OR s.form_variant = $3)
            """,
            milestone,
            flagged,
            form_variant,
        )

    @classmethod
    async def responded_between(cls, start: date, end: date) -> List["SurveyResponse"]:
        rows = await execute_query(
            "SELECT * FROM survey_responses WHERE responded_at::date BETWEEN $1 AND $2 ORDER BY responded_at",
            start,
            end,
        )
        return [cls.from_row(row) for row in rows]

    async def attach_task(self, task_id: uuid.UUID) -> None:
        await execute_command(
            "UPDATE survey_responses SET task_id = $2, updated_at = NOW() WHERE survey_response_id = $1",
            self.survey_response_id,
            task_id,
        )
        self.task_id = task_id

    async def mark_sent(self) -> None:
        await execute_command(
            "UPDATE survey_responses SET sent_at = COALESCE(sent_at, NOW()), updated_at = NOW() WHERE survey_response_id = $1",
            self.survey_response_id,
        )

    async def record_answer(
        self,
        score: Optional[float],
        answers: Dict[str, Any],
        response_ref: Optional[str],
        flagged: bool,
    ) -> None:
        await execute_command(
            # SQL
            """
            UPDATE survey_responses
            SET responded_at = NOW(), score = $2, answers_enc = $3, response_ref = $4, flagged = $5, updated_at = NOW()
            WHERE survey_response_id = $1
            """,
            self.survey_response_id,
            score,
            FieldCipher(TABLE, self.survey_response_id).enc_json("answers", answers),
            response_ref,
            flagged,
        )
        self.score, self.answers, self.response_ref, self.flagged = (
            score,
            answers,
            response_ref,
            flagged,
        )


class FeedbackReport:
    def __init__(self, **kwargs: Any):
        self.feedback_report_id: uuid.UUID = kwargs["feedback_report_id"]
        self.period_start: date = kwargs["period_start"]
        self.period_end: date = kwargs["period_end"]
        self.response_count: int = kwargs.get("response_count", 0)
        self.status: str = kwargs.get("status") or "queued"
        self.storage_key: Optional[str] = kwargs.get("storage_key")
        self.sent_at: Optional[datetime] = kwargs.get("sent_at")
        self.created_at: Optional[datetime] = kwargs.get("created_at")

    @classmethod
    async def create(
        cls, period_start: date, period_end: date, requested_by: Optional[uuid.UUID]
    ) -> "FeedbackReport":
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO feedback_reports (feedback_report_id, period_start, period_end, requested_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            uuid.uuid4(),
            period_start,
            period_end,
            requested_by,
        )
        return cls(**dict(row))

    @classmethod
    async def find_by_id(cls, report_id: uuid.UUID) -> Optional["FeedbackReport"]:
        row = await execute_query_one(
            "SELECT * FROM feedback_reports WHERE feedback_report_id = $1", report_id
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def in_flight(
        cls, period_start: date, period_end: date
    ) -> Optional["FeedbackReport"]:
        row = await execute_query_one(
            "SELECT * FROM feedback_reports WHERE period_start = $1 AND period_end = $2 AND status IN ('queued', 'ready', 'sent') LIMIT 1",
            period_start,
            period_end,
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def all(
        cls, status: Optional[str], newest_first: bool
    ) -> List["FeedbackReport"]:
        direction = "DESC" if newest_first else "ASC"
        rows = await execute_query(
            f"SELECT * FROM feedback_reports WHERE ($1::text IS NULL OR status = $1) ORDER BY period_start {direction}, feedback_report_id",
            status,
        )
        return [cls(**dict(row)) for row in rows]

    async def finish(
        self,
        status: str,
        storage_key: Optional[str] = None,
        response_count: Optional[int] = None,
        error: Optional[str] = None,
    ) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE feedback_reports
            SET status = $2::text, storage_key = COALESCE($3, storage_key), response_count = COALESCE($4, response_count),
                error = $5, sent_at = CASE WHEN $2::text = 'sent' THEN NOW() ELSE sent_at END, updated_at = NOW()
            WHERE feedback_report_id = $1
            RETURNING *
            """,
            self.feedback_report_id,
            status,
            storage_key,
            response_count,
            error,
        )
        self.__init__(**dict(row))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feedback_report_id": str(self.feedback_report_id),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "response_count": self.response_count,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
        }
