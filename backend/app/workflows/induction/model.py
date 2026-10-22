import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import asyncpg

from app.database import execute_command_with_return, execute_query, execute_query_one
from app.privacy.encryption import FieldCipher, blind_index

TABLE = "induction_sessions"


class InductionSession:
    def __init__(self, **kwargs: Any):
        self.induction_session_id: uuid.UUID = kwargs["induction_session_id"]
        self.case_id: uuid.UUID = kwargs["case_id"]
        self.title: str = kwargs["title"]
        self.owner_email: Optional[str] = kwargs.get("owner_email")
        self.proposed_start: datetime = kwargs["proposed_start"]
        self.proposed_end: datetime = kwargs["proposed_end"]
        self.agreed_start: Optional[datetime] = kwargs.get("agreed_start")
        self.agreed_end: Optional[datetime] = kwargs.get("agreed_end")
        self.status: str = kwargs.get("status") or "proposed"
        self.graph_event_id: Optional[str] = kwargs.get("graph_event_id")
        self.followups_sent: int = kwargs.get("followups_sent", 0)
        self.sort_order: int = kwargs.get("sort_order", 0)

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "InductionSession":
        data = {
            key: row[key] for key in row.keys() if not key.endswith(("_enc", "_idx"))
        }
        return cls(
            **data,
            owner_email=FieldCipher(TABLE, row["induction_session_id"]).dec(
                "owner_email", row["owner_email_enc"]
            ),
        )

    @classmethod
    async def create(
        cls,
        case_id: uuid.UUID,
        title: str,
        owner_email: Optional[str],
        start: datetime,
        end: datetime,
        order: int,
    ) -> "InductionSession":
        session_id = uuid.uuid4()
        email = owner_email.lower() if owner_email else None
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO induction_sessions (
                induction_session_id, case_id, title, owner_email_enc, owner_email_idx, proposed_start, proposed_end, sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            session_id,
            case_id,
            title,
            FieldCipher(TABLE, session_id).enc("owner_email", email),
            blind_index(email),
            start,
            end,
            order,
        )
        return cls.from_row(row)

    @classmethod
    async def find_by_id(cls, session_id: uuid.UUID) -> Optional["InductionSession"]:
        row = await execute_query_one(
            "SELECT * FROM induction_sessions WHERE induction_session_id = $1",
            session_id,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def for_case(cls, case_id: uuid.UUID) -> List["InductionSession"]:
        rows = await execute_query(
            "SELECT * FROM induction_sessions WHERE case_id = $1 ORDER BY sort_order, proposed_start",
            case_id,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def asked_for_owner(cls, email: str) -> List["InductionSession"]:
        index = blind_index(email)
        if index is None:
            return []
        rows = await execute_query(
            # SQL
            """
            SELECT s.* FROM induction_sessions s
            JOIN cases c ON c.case_id = s.case_id
            WHERE s.owner_email_idx = $1 AND s.status IN ('asked', 'alternative') AND c.status IN ('open', 'on_hold')
            ORDER BY s.proposed_start
            """,
            index,
        )
        return [cls.from_row(row) for row in rows]

    async def update(self, **fields: Any) -> None:
        allowed = {
            "status",
            "agreed_start",
            "agreed_end",
            "graph_event_id",
            "followups_sent",
        }
        changes: Dict[str, Any] = {
            key: value for key, value in fields.items() if key in allowed
        }
        if not changes:
            return
        columns = ", ".join(
            f"{key} = ${index + 2}" for index, key in enumerate(changes)
        )
        row = await execute_command_with_return(
            f"UPDATE induction_sessions SET {columns}, updated_at = NOW() WHERE induction_session_id = $1 RETURNING *",
            self.induction_session_id,
            *changes.values(),
        )
        self.__dict__.update(InductionSession.from_row(row).__dict__)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "induction_session_id": str(self.induction_session_id),
            "title": self.title,
            "owner_email": self.owner_email,
            "proposed_start": self.proposed_start.isoformat(),
            "proposed_end": self.proposed_end.isoformat(),
            "agreed_start": self.agreed_start.isoformat()
            if self.agreed_start
            else None,
            "agreed_end": self.agreed_end.isoformat() if self.agreed_end else None,
            "status": self.status,
            "graph_event_id": self.graph_event_id,
        }
