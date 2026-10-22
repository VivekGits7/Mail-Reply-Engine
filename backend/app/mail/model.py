import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import asyncpg

from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_query_one,
    execute_scalar,
)
from app.privacy.encryption import FieldCipher, blind_index


class Email:
    TABLE = "emails"

    def __init__(self, **kwargs: Any):
        self.email_id: uuid.UUID = kwargs["email_id"]
        self.graph_message_id: Optional[str] = kwargs.get("graph_message_id")
        self.internet_message_id: Optional[str] = kwargs.get("internet_message_id")
        self.conversation_id: Optional[str] = kwargs.get("conversation_id")
        self.in_reply_to: Optional[str] = kwargs.get("in_reply_to")
        self.direction: str = kwargs["direction"]
        self.from_email: Optional[str] = kwargs.get("from_email")
        self.from_name: Optional[str] = kwargs.get("from_name")
        self.to: List[str] = kwargs.get("to") or []
        self.cc: List[str] = kwargs.get("cc") or []
        self.subject: Optional[str] = kwargs.get("subject")
        self.body_text: Optional[str] = kwargs.get("body_text")
        self.received_at: Optional[datetime] = kwargs.get("received_at")
        self.sent_at: Optional[datetime] = kwargs.get("sent_at")
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.task_id: Optional[uuid.UUID] = kwargs.get("task_id")
        self.category: Optional[str] = kwargs.get("category")
        self.confidence: Optional[float] = kwargs.get("confidence")
        self.ai_summary: Optional[str] = kwargs.get("ai_summary")
        self.processing_status: str = kwargs.get("processing_status") or "received"
        self.filter_reason: Optional[str] = kwargs.get("filter_reason")
        self.template_key: Optional[str] = kwargs.get("template_key")
        self.approval_id: Optional[uuid.UUID] = kwargs.get("approval_id")
        self.dedupe_key: Optional[str] = kwargs.get("dedupe_key")
        self.is_automatic: bool = kwargs.get("is_automatic", False)
        self.is_dry_run: bool = kwargs.get("is_dry_run", False)
        self.is_restricted: bool = kwargs.get("is_restricted", False)
        self.created_at: Optional[datetime] = kwargs.get("created_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "Email":
        data = {
            key: row[key] for key in row.keys() if not key.endswith(("_enc", "_idx"))
        }
        cipher = FieldCipher(cls.TABLE, row["email_id"])
        return cls(
            **data,
            from_email=cipher.dec("from_email", row["from_email_enc"]),
            from_name=cipher.dec("from_name", row["from_name_enc"]),
            to=cipher.dec_json("to", row["to_enc"], default=[]),
            cc=cipher.dec_json("cc", row["cc_enc"], default=[]),
            subject=cipher.dec("subject", row["subject_enc"]),
            body_text=cipher.dec("body_text", row["body_text_enc"]),
            ai_summary=cipher.dec("ai_summary", row["ai_summary_enc"]),
        )

    @classmethod
    async def create_inbound(
        cls,
        *,
        graph_message_id: str,
        internet_message_id: Optional[str],
        conversation_id: Optional[str],
        in_reply_to: Optional[str],
        from_email: str,
        from_name: Optional[str],
        to: List[str],
        cc: List[str],
        subject: str,
        body_text: str,
        received_at: Optional[datetime],
    ) -> Optional["Email"]:
        email_id = uuid.uuid4()
        cipher = FieldCipher(cls.TABLE, email_id)
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO emails (
                email_id, graph_message_id, internet_message_id, conversation_id, in_reply_to, direction,
                from_email_enc, from_email_idx, from_name_enc, to_enc, cc_enc, recipients_idx, subject_enc, body_text_enc, received_at
            )
            VALUES ($1, $2, $3, $4, $5, 'inbound', $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (graph_message_id) DO NOTHING
            RETURNING *
            """,
            email_id,
            graph_message_id,
            internet_message_id,
            conversation_id,
            in_reply_to,
            cipher.enc("from_email", from_email),
            blind_index(from_email),
            cipher.enc("from_name", from_name),
            cipher.enc_json("to", to),
            cipher.enc_json("cc", cc),
            [index for index in (blind_index(address) for address in to + cc) if index],
            cipher.enc("subject", subject),
            cipher.enc("body_text", body_text),
            received_at,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def claim_outbound(
        cls,
        *,
        dedupe_key: str,
        to: List[str],
        cc: List[str],
        subject: str,
        body_text: str,
        case_id: Optional[uuid.UUID],
        task_id: Optional[uuid.UUID],
        template_key: Optional[str],
        approval_id: Optional[uuid.UUID],
        is_automatic: bool,
        is_dry_run: bool,
        sender: str,
    ) -> Optional["Email"]:
        email_id = uuid.uuid4()
        cipher = FieldCipher(cls.TABLE, email_id)
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO emails (
                email_id, direction, from_email_enc, from_email_idx, to_enc, cc_enc, recipients_idx, subject_enc, body_text_enc,
                case_id, task_id, template_key, approval_id, dedupe_key, is_automatic, is_dry_run, processing_status
            )
            VALUES ($1, 'outbound', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'received')
            ON CONFLICT (dedupe_key) DO UPDATE SET updated_at = NOW()
            WHERE emails.processing_status = 'failed'
            RETURNING *
            """,
            email_id,
            cipher.enc("from_email", sender),
            blind_index(sender),
            cipher.enc_json("to", to),
            cipher.enc_json("cc", cc),
            [index for index in (blind_index(address) for address in to + cc) if index],
            cipher.enc("subject", subject),
            cipher.enc("body_text", body_text),
            case_id,
            task_id,
            template_key,
            approval_id,
            dedupe_key,
            is_automatic,
            is_dry_run,
        )
        if row is None:
            return None
        if row["email_id"] != email_id:
            await cls._rewrite_outbound(
                row["email_id"], to, cc, subject, body_text, sender
            )
            row = await execute_query_one(
                "SELECT * FROM emails WHERE email_id = $1", row["email_id"]
            )
        return cls.from_row(row)

    @classmethod
    async def _rewrite_outbound(
        cls,
        email_id: uuid.UUID,
        to: List[str],
        cc: List[str],
        subject: str,
        body_text: str,
        sender: str,
    ) -> None:
        cipher = FieldCipher(cls.TABLE, email_id)
        await execute_command(
            # SQL
            """
            UPDATE emails
            SET from_email_enc = $2, to_enc = $3, cc_enc = $4, subject_enc = $5, body_text_enc = $6, processing_status = 'received', updated_at = NOW()
            WHERE email_id = $1
            """,
            email_id,
            cipher.enc("from_email", sender),
            cipher.enc_json("to", to),
            cipher.enc_json("cc", cc),
            cipher.enc("subject", subject),
            cipher.enc("body_text", body_text),
        )

    async def mark_sent(
        self,
        graph_message_id: str,
        internet_message_id: Optional[str],
        conversation_id: Optional[str],
    ) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE emails
            SET graph_message_id = $2, internet_message_id = $3, conversation_id = $4, sent_at = NOW(),
                processing_status = 'sent', updated_at = NOW()
            WHERE email_id = $1
            RETURNING sent_at
            """,
            self.email_id,
            graph_message_id,
            internet_message_id,
            conversation_id,
        )
        self.graph_message_id, self.internet_message_id, self.conversation_id = (
            graph_message_id,
            internet_message_id,
            conversation_id,
        )
        self.sent_at, self.processing_status = row["sent_at"], "sent"

    async def mark_failed(self) -> None:
        await execute_command(
            "UPDATE emails SET processing_status = 'failed', updated_at = NOW() WHERE email_id = $1",
            self.email_id,
        )

    async def set_status(
        self, processing_status: str, filter_reason: Optional[str] = None
    ) -> None:
        await execute_command(
            "UPDATE emails SET processing_status = $2, filter_reason = COALESCE($3, filter_reason), updated_at = NOW() WHERE email_id = $1",
            self.email_id,
            processing_status,
            filter_reason,
        )
        self.processing_status = processing_status

    async def classify(
        self,
        *,
        category: Optional[str],
        confidence: Optional[float],
        summary: Optional[str],
        case_id: Optional[uuid.UUID],
        processing_status: str,
    ) -> None:
        cipher = FieldCipher(self.TABLE, self.email_id)
        await execute_command(
            # SQL
            """
            UPDATE emails
            SET category = $2, confidence = $3, ai_summary_enc = $4, case_id = $5, processing_status = $6, updated_at = NOW()
            WHERE email_id = $1
            """,
            self.email_id,
            category,
            confidence,
            cipher.enc("ai_summary", summary),
            case_id,
            processing_status,
        )
        self.category, self.confidence, self.ai_summary, self.case_id = (
            category,
            confidence,
            summary,
            case_id,
        )
        self.processing_status = processing_status

    async def link_case(self, case_id: uuid.UUID) -> None:
        await execute_command(
            "UPDATE emails SET case_id = $2, updated_at = NOW() WHERE email_id = $1",
            self.email_id,
            case_id,
        )
        self.case_id = case_id

    async def restrict(self) -> None:
        await execute_command(
            # SQL
            """
            UPDATE emails
            SET subject_enc = NULL, body_text_enc = NULL, ai_summary_enc = NULL, is_restricted = TRUE, case_id = NULL, updated_at = NOW()
            WHERE email_id = $1
            """,
            self.email_id,
        )
        self.subject = self.body_text = self.ai_summary = None
        self.is_restricted = True
        self.case_id = None

    @classmethod
    async def find_by_id(cls, email_id: uuid.UUID) -> Optional["Email"]:
        row = await execute_query_one(
            "SELECT * FROM emails WHERE email_id = $1", email_id
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def find_by_graph_id(cls, graph_message_id: str) -> Optional["Email"]:
        row = await execute_query_one(
            "SELECT * FROM emails WHERE graph_message_id = $1", graph_message_id
        )
        return cls.from_row(row) if row else None

    @staticmethod
    async def case_for_thread(
        conversation_id: Optional[str], message_ids: List[str]
    ) -> Optional[uuid.UUID]:
        if not conversation_id and not message_ids:
            return None
        return await execute_scalar(
            # SQL
            """
            SELECT case_id FROM emails
            WHERE case_id IS NOT NULL AND direction = 'outbound'
              AND (($1::text IS NOT NULL AND conversation_id = $1) OR internet_message_id = ANY($2::text[]))
            ORDER BY created_at DESC
            LIMIT 1
            """,
            conversation_id,
            message_ids,
        )

    @staticmethod
    async def started_by_us(
        conversation_id: Optional[str], message_ids: List[str]
    ) -> bool:
        if not conversation_id and not message_ids:
            return False
        found = await execute_scalar(
            # SQL
            """
            SELECT 1 FROM emails
            WHERE direction = 'outbound'
              AND (($1::text IS NOT NULL AND conversation_id = $1) OR internet_message_id = ANY($2::text[]))
            LIMIT 1
            """,
            conversation_id,
            message_ids,
        )
        return found is not None

    @classmethod
    async def latest_in_thread(
        cls, case_id: uuid.UUID, template_keys: List[str]
    ) -> Optional["Email"]:
        row = await execute_query_one(
            # SQL
            """
            SELECT latest.* FROM emails seed
            JOIN emails latest ON latest.conversation_id = seed.conversation_id
            WHERE seed.case_id = $1 AND seed.direction = 'outbound' AND seed.template_key = ANY($2::text[])
              AND seed.graph_message_id IS NOT NULL AND latest.graph_message_id IS NOT NULL AND latest.is_restricted = FALSE
            ORDER BY COALESCE(latest.received_at, latest.sent_at, latest.created_at) DESC
            LIMIT 1
            """,
            case_id,
            template_keys,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def latest_in_task_thread(
        cls, task_id: uuid.UUID, recipient: Optional[str] = None
    ) -> Optional["Email"]:
        row = await execute_query_one(
            # SQL
            """
            SELECT latest.* FROM emails seed
            JOIN emails latest ON latest.conversation_id = seed.conversation_id
            WHERE seed.task_id = $1 AND seed.direction = 'outbound'
              AND ($2::bytea IS NULL OR $2 = ANY(seed.recipients_idx))
              AND seed.graph_message_id IS NOT NULL AND latest.graph_message_id IS NOT NULL AND latest.is_restricted = FALSE
            ORDER BY COALESCE(latest.received_at, latest.sent_at, latest.created_at) DESC
            LIMIT 1
            """,
            task_id,
            blind_index(recipient) if recipient else None,
        )
        return cls.from_row(row) if row else None

    @staticmethod
    async def automatic_count_since(recipient: str, since: datetime) -> int:
        index = blind_index(recipient)
        if index is None:
            return 0
        return await execute_scalar(
            # SQL
            """
            SELECT COUNT(*) FROM emails
            WHERE direction = 'outbound' AND is_automatic AND processing_status = 'sent'
              AND sent_at >= $2 AND $1 = ANY(recipients_idx)
            """,
            index,
            since,
        )

    @classmethod
    async def for_case(cls, case_id: uuid.UUID) -> List["Email"]:
        rows = await execute_query(
            "SELECT * FROM emails WHERE case_id = $1 AND is_restricted = FALSE ORDER BY COALESCE(received_at, sent_at, created_at), email_id",
            case_id,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def find_by_approval(cls, approval_id: uuid.UUID) -> Optional["Email"]:
        row = await execute_query_one(
            "SELECT * FROM emails WHERE approval_id = $1 ORDER BY created_at DESC LIMIT 1",
            approval_id,
        )
        return cls.from_row(row) if row else None

    @staticmethod
    async def latest_received_at() -> Optional[datetime]:
        return await execute_scalar(
            "SELECT MAX(received_at) FROM emails WHERE direction = 'inbound'"
        )


class Attachment:
    TABLE = "attachments"

    def __init__(self, **kwargs: Any):
        self.attachment_id: uuid.UUID = kwargs["attachment_id"]
        self.email_id: Optional[uuid.UUID] = kwargs.get("email_id")
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.parent_attachment_id: Optional[uuid.UUID] = kwargs.get(
            "parent_attachment_id"
        )
        self.kind: str = kwargs.get("kind") or "email_document"
        self.file_name: str = kwargs.get("file_name") or ""
        self.mime_type: str = kwargs.get("mime_type") or "application/octet-stream"
        self.size_bytes: int = kwargs.get("size_bytes") or 0
        self.storage_key: Optional[str] = kwargs.get("storage_key")
        self.sha256: Optional[str] = kwargs.get("sha256")
        self.document_type_guess: Optional[str] = kwargs.get("document_type_guess")
        self.ai_confidence: Optional[float] = kwargs.get("ai_confidence")
        self.ocr_quality: Optional[float] = kwargs.get("ocr_quality")
        self.text_chars: Optional[int] = kwargs.get("text_chars")
        self.name_match_score: Optional[float] = kwargs.get("name_match_score")
        self.person_check: Optional[str] = kwargs.get("person_check")
        self.check_status: str = kwargs.get("check_status") or "pending"
        self.issues: List[str] = list(kwargs.get("issues") or [])
        self.is_latest: bool = kwargs.get("is_latest", True)
        self.created_at: Optional[datetime] = kwargs.get("created_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "Attachment":
        data = {key: row[key] for key in row.keys() if not key.endswith("_enc")}
        return cls(
            **data,
            file_name=FieldCipher(cls.TABLE, row["attachment_id"]).dec(
                "file_name", row["file_name_enc"]
            ),
        )

    @classmethod
    async def create(
        cls,
        *,
        file_name: str,
        mime_type: str,
        size_bytes: int,
        storage_key: Optional[str],
        sha256: Optional[str],
        kind: str = "email_document",
        email_id: Optional[uuid.UUID] = None,
        case_id: Optional[uuid.UUID] = None,
        parent_attachment_id: Optional[uuid.UUID] = None,
        check_status: str = "pending",
        uploaded_by: Optional[uuid.UUID] = None,
    ) -> "Attachment":
        attachment_id = uuid.uuid4()
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO attachments (
                attachment_id, email_id, case_id, parent_attachment_id, kind, file_name_enc, mime_type, size_bytes,
                storage_key, sha256, check_status, uploaded_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
            """,
            attachment_id,
            email_id,
            case_id,
            parent_attachment_id,
            kind,
            FieldCipher(cls.TABLE, attachment_id).enc("file_name", file_name),
            mime_type,
            size_bytes,
            storage_key,
            sha256,
            check_status,
            uploaded_by,
        )
        return cls.from_row(row)

    @classmethod
    async def find_by_id(cls, attachment_id: uuid.UUID) -> Optional["Attachment"]:
        row = await execute_query_one(
            "SELECT * FROM attachments WHERE attachment_id = $1", attachment_id
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def for_case(
        cls, case_id: uuid.UUID, kinds: Optional[List[str]] = None
    ) -> List["Attachment"]:
        rows = await execute_query(
            "SELECT * FROM attachments WHERE case_id = $1 AND ($2::text[] IS NULL OR kind = ANY($2)) ORDER BY created_at, attachment_id",
            case_id,
            kinds,
        )
        return [cls.from_row(row) for row in rows]

    @staticmethod
    async def sha_seen(case_id: uuid.UUID, sha256: str) -> bool:
        found = await execute_scalar(
            "SELECT 1 FROM attachments WHERE case_id = $1 AND sha256 = $2 AND check_status <> 'duplicate' LIMIT 1",
            case_id,
            sha256,
        )
        return found is not None

    @classmethod
    async def latest_of_kind(
        cls, kind: str, case_ids: Optional[List[uuid.UUID]] = None
    ) -> Optional["Attachment"]:
        row = await execute_query_one(
            # SQL
            """
            SELECT * FROM attachments
            WHERE kind = $1 AND is_latest AND storage_key IS NOT NULL AND ($2::uuid[] IS NULL OR case_id = ANY($2))
            ORDER BY created_at DESC
            LIMIT 1
            """,
            kind,
            case_ids,
        )
        return cls.from_row(row) if row else None

    async def record_check(
        self,
        *,
        check_status: str,
        document_type_guess: Optional[str] = None,
        ai_confidence: Optional[float] = None,
        ocr_quality: Optional[float] = None,
        text_chars: Optional[int] = None,
        name_match_score: Optional[float] = None,
        person_check: Optional[str] = None,
        issues: Optional[List[str]] = None,
    ) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE attachments
            SET check_status = $2, document_type_guess = $3, ai_confidence = $4, ocr_quality = $5, text_chars = $6,
                name_match_score = $7, person_check = $8, issues = $9, updated_at = NOW()
            WHERE attachment_id = $1
            RETURNING *
            """,
            self.attachment_id,
            check_status,
            document_type_guess,
            ai_confidence,
            ocr_quality,
            text_chars,
            name_match_score,
            person_check,
            issues or [],
        )
        self.__dict__.update(Attachment.from_row(row).__dict__)

    async def link_case(self, case_id: uuid.UUID) -> None:
        await execute_command(
            "UPDATE attachments SET case_id = $2, updated_at = NOW() WHERE attachment_id = $1",
            self.attachment_id,
            case_id,
        )
        self.case_id = case_id

    async def drop_file(self, reason: str) -> None:
        await execute_command(
            # SQL
            """
            UPDATE attachments
            SET storage_key = NULL, check_status = 'restricted', issues = ARRAY[$2]::text[], is_latest = FALSE, updated_at = NOW()
            WHERE attachment_id = $1
            """,
            self.attachment_id,
            reason,
        )
        self.storage_key, self.check_status, self.issues, self.is_latest = (
            None,
            "restricted",
            [reason],
            False,
        )

    @staticmethod
    async def supersede(
        kind: str,
        case_id: Optional[uuid.UUID],
        keep_id: uuid.UUID,
        document_type: Optional[str] = None,
    ) -> None:
        await execute_command(
            # SQL
            """
            UPDATE attachments SET is_latest = FALSE, updated_at = NOW()
            WHERE kind = $1 AND attachment_id <> $3 AND is_latest
              AND (($2::uuid IS NULL AND case_id IS NULL) OR case_id = $2)
              AND ($4::text IS NULL OR document_type_guess = $4)
            """,
            kind,
            case_id,
            keep_id,
            document_type,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "attachment_id": str(self.attachment_id),
            "kind": self.kind,
            "file_name": self.file_name,
            "mime_type": self.mime_type,
            "size": self.size_bytes,
            "document_type_guess": self.document_type_guess,
            "ai_confidence": self.ai_confidence,
            "ocr_quality": self.ocr_quality,
            "name_match_score": self.name_match_score,
            "person_check": self.person_check,
            "check_status": self.check_status,
            "issues": self.issues,
            "is_latest": self.is_latest,
            "received_at": self.created_at.isoformat() if self.created_at else None,
        }


class Template:
    def __init__(self, **kwargs: Any):
        self.template_id: uuid.UUID = kwargs["template_id"]
        self.template_key: str = kwargs["template_key"]
        self.name: str = kwargs["name"]
        self.subject: str = kwargs["subject"]
        self.body_html: str = kwargs["body_html"]
        self.placeholders: List[str] = list(kwargs.get("placeholders") or [])
        self.is_active: bool = kwargs.get("is_active", True)
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    async def find(cls, template_key: str) -> Optional["Template"]:
        row = await execute_query_one(
            "SELECT * FROM templates WHERE template_key = $1", template_key
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def search(
        cls, search: Optional[str], is_active: Optional[bool]
    ) -> List["Template"]:
        pattern = f"%{search.strip()}%" if search and search.strip() else None
        rows = await execute_query(
            # SQL
            """
            SELECT * FROM templates
            WHERE ($1::text IS NULL OR template_key ILIKE $1 OR name ILIKE $1 OR subject ILIKE $1)
              AND ($2::boolean IS NULL OR is_active = $2)
            ORDER BY template_key
            """,
            pattern,
            is_active,
        )
        return [cls(**dict(row)) for row in rows]

    @staticmethod
    async def insert_missing(
        template_key: str,
        name: str,
        subject: str,
        body_html: str,
        placeholders: List[str],
    ) -> None:
        await execute_command(
            # SQL
            """
            INSERT INTO templates (template_id, template_key, name, subject, body_html, placeholders)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (template_key) DO NOTHING
            """,
            uuid.uuid4(),
            template_key,
            name,
            subject,
            body_html,
            placeholders,
        )

    async def update(
        self,
        subject: Optional[str],
        body_html: Optional[str],
        is_active: Optional[bool],
        user_id: uuid.UUID,
    ) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE templates
            SET subject = COALESCE($2, subject), body_html = COALESCE($3, body_html), is_active = COALESCE($4, is_active),
                updated_by = $5, updated_at = NOW()
            WHERE template_id = $1
            RETURNING *
            """,
            self.template_id,
            subject,
            body_html,
            is_active,
            user_id,
        )
        self.__init__(**dict(row))

    def to_dict(self, with_body: bool = True) -> Dict[str, Any]:
        data = {
            "template_key": self.template_key,
            "name": self.name,
            "subject": self.subject,
            "placeholders": self.placeholders,
            "is_active": self.is_active,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if with_body:
            data["body_html"] = self.body_html
        return data
