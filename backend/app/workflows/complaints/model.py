import uuid
from datetime import datetime
from typing import Any, List, Optional

import asyncpg

from app.database import execute_command_with_return, execute_query, execute_query_one
from app.privacy.encryption import FieldCipher, blind_index

TABLE = "complaints"


class Complaint:
    def __init__(self, **kwargs: Any):
        self.complaint_id: uuid.UUID = kwargs["complaint_id"]
        self.received_at: datetime = kwargs["received_at"]
        self.source: str = kwargs["source"]
        self.sender_email: Optional[str] = kwargs.get("sender_email")
        self.person_id: Optional[uuid.UUID] = kwargs.get("person_id")
        self.subject: Optional[str] = kwargs.get("subject")
        self.content: Optional[str] = kwargs.get("content")
        self.email_id: Optional[uuid.UUID] = kwargs.get("email_id")
        self.attachment_id: Optional[uuid.UUID] = kwargs.get("attachment_id")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "Complaint":
        data = {
            key: row[key] for key in row.keys() if not key.endswith(("_enc", "_idx"))
        }
        cipher = FieldCipher(TABLE, row["complaint_id"])
        return cls(
            **data,
            sender_email=cipher.dec("sender_email", row["sender_email_enc"]),
            subject=cipher.dec("subject", row["subject_enc"]),
            content=cipher.dec("content", row["content_enc"]),
        )

    @classmethod
    async def create(
        cls,
        source: str,
        *,
        sender_email: Optional[str] = None,
        person_id: Optional[uuid.UUID] = None,
        subject: Optional[str] = None,
        content: Optional[str] = None,
        email_id: Optional[uuid.UUID] = None,
        attachment_id: Optional[uuid.UUID] = None,
        uploaded_by: Optional[uuid.UUID] = None,
        received_at: Optional[datetime] = None,
    ) -> "Complaint":
        complaint_id = uuid.uuid4()
        cipher = FieldCipher(TABLE, complaint_id)
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO complaints (
                complaint_id, received_at, source, sender_email_enc, sender_email_idx, person_id, subject_enc, content_enc,
                email_id, attachment_id, uploaded_by
            )
            VALUES ($1, COALESCE($2, NOW()), $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            """,
            complaint_id,
            received_at,
            source,
            cipher.enc("sender_email", sender_email),
            blind_index(sender_email),
            person_id,
            cipher.enc("subject", subject),
            cipher.enc("content", content),
            email_id,
            attachment_id,
            uploaded_by,
        )
        return cls.from_row(row)

    @classmethod
    async def find_by_id(cls, complaint_id: uuid.UUID) -> Optional["Complaint"]:
        row = await execute_query_one(
            "SELECT * FROM complaints WHERE complaint_id = $1", complaint_id
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def filtered(
        cls,
        source: Optional[str],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
    ) -> List["Complaint"]:
        rows = await execute_query(
            # SQL
            """
            SELECT * FROM complaints
            WHERE ($1::text IS NULL OR source = $1)
              AND ($2::timestamptz IS NULL OR received_at >= $2)
              AND ($3::timestamptz IS NULL OR received_at <= $3)
            """,
            source,
            date_from,
            date_to,
        )
        return [cls.from_row(row) for row in rows]
