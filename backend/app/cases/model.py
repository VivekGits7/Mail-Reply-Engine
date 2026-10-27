import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import asyncpg

from app.cases.enums import (
    ACTIVE_STATUSES,
    ApprovalStatus,
    ApprovalType,
    CaseStatus,
    CaseType,
    ChecklistStatus,
    TaskStatus,
)
from app.common.enums import CheckMode
from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_query_one,
    execute_scalar,
)
from app.privacy.encryption import FieldCipher, blind_index


class Case:
    def __init__(self, **kwargs: Any):
        self.case_id: uuid.UUID = kwargs["case_id"]
        self.case_type = CaseType(kwargs["case_type"])
        self.person_id: uuid.UUID = kwargs["person_id"]
        self.parent_case_id: Optional[uuid.UUID] = kwargs.get("parent_case_id")
        self.stage: str = kwargs["stage"]
        self.status = CaseStatus(kwargs.get("status") or CaseStatus.OPEN.value)
        self.flags: List[str] = list(kwargs.get("flags") or [])
        self.track: Optional[str] = kwargs.get("track")
        self.created_by: Optional[uuid.UUID] = kwargs.get("created_by")
        self.opened_at: Optional[datetime] = kwargs.get("opened_at")
        self.closed_at: Optional[datetime] = kwargs.get("closed_at")
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @property
    def is_active(self) -> bool:
        return self.status.value in ACTIVE_STATUSES

    @classmethod
    async def create(
        cls,
        case_type: CaseType,
        person_id: uuid.UUID,
        stage: str,
        created_by: Optional[uuid.UUID] = None,
        parent_case_id: Optional[uuid.UUID] = None,
        track: Optional[str] = None,
    ) -> "Case":
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO cases (case_id, case_type, person_id, parent_case_id, stage, track, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            uuid.uuid4(),
            case_type.value,
            person_id,
            parent_case_id,
            stage,
            track,
            created_by,
        )
        return cls(**dict(row))

    @classmethod
    async def find_by_id(cls, case_id: uuid.UUID) -> Optional["Case"]:
        row = await execute_query_one("SELECT * FROM cases WHERE case_id = $1", case_id)
        return cls(**dict(row)) if row else None

    @classmethod
    async def find_active(
        cls, person_id: uuid.UUID, case_type: CaseType
    ) -> Optional["Case"]:
        row = await execute_query_one(
            "SELECT * FROM cases WHERE person_id = $1 AND case_type = $2 AND status = ANY($3::text[])",
            person_id,
            case_type.value,
            list(ACTIVE_STATUSES),
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def latest(
        cls, person_id: uuid.UUID, case_type: CaseType
    ) -> Optional["Case"]:
        row = await execute_query_one(
            "SELECT * FROM cases WHERE person_id = $1 AND case_type = $2 ORDER BY opened_at DESC, case_id LIMIT 1",
            person_id,
            case_type.value,
        )
        return cls(**dict(row)) if row else None

    @classmethod
    async def active_for_people(cls, person_ids: Iterable[uuid.UUID]) -> List["Case"]:
        ids = list(set(person_ids))
        if not ids:
            return []
        rows = await execute_query(
            "SELECT * FROM cases WHERE person_id = ANY($1::uuid[]) AND status = ANY($2::text[]) ORDER BY opened_at DESC",
            ids,
            list(ACTIVE_STATUSES),
        )
        return [cls(**dict(row)) for row in rows]

    @classmethod
    async def active_of_type(
        cls, case_type: CaseType, stages: Optional[List[str]] = None
    ) -> List["Case"]:
        rows = await execute_query(
            # SQL
            """
            SELECT * FROM cases
            WHERE case_type = $1 AND status = ANY($2::text[]) AND ($3::text[] IS NULL OR stage = ANY($3))
            ORDER BY opened_at
            """,
            case_type.value,
            list(ACTIVE_STATUSES),
            stages,
        )
        return [cls(**dict(row)) for row in rows]

    @classmethod
    async def search(
        cls,
        case_type: CaseType,
        stage: Optional[str],
        status: Optional[str],
        flag: Optional[str],
    ) -> List[asyncpg.Record]:
        return await execute_query(
            # SQL
            """
            SELECT c.*, p.joining_date, p.last_working_day, p.level, p.location, p.hire_category, p.employee_code
            FROM cases c
            JOIN people p ON p.person_id = c.person_id
            WHERE c.case_type = $1
              AND ($2::text IS NULL OR c.stage = $2)
              AND ($3::text IS NULL OR c.status = $3)
              AND ($4::text IS NULL OR $4 = ANY(c.flags))
            """,
            case_type.value,
            stage,
            status,
            flag,
        )

    @classmethod
    async def for_person(cls, person_id: uuid.UUID) -> List["Case"]:
        rows = await execute_query(
            "SELECT * FROM cases WHERE person_id = $1 ORDER BY opened_at", person_id
        )
        return [cls(**dict(row)) for row in rows]

    @classmethod
    async def children(cls, parent_case_id: uuid.UUID) -> List["Case"]:
        rows = await execute_query(
            "SELECT * FROM cases WHERE parent_case_id = $1 ORDER BY opened_at",
            parent_case_id,
        )
        return [cls(**dict(row)) for row in rows]

    async def _apply(self, row: Optional[asyncpg.Record]) -> None:
        if row:
            self.__init__(**dict(row))

    async def set_stage(self, stage: str) -> None:
        await self._apply(
            await execute_command_with_return(
                "UPDATE cases SET stage = $2, updated_at = NOW() WHERE case_id = $1 RETURNING *",
                self.case_id,
                stage,
            )
        )

    async def set_status(self, status: CaseStatus) -> None:
        await self._apply(
            await execute_command_with_return(
                # SQL
                """
                UPDATE cases
                SET status = $2::text,
                    closed_at = CASE WHEN $2::text IN ('closed', 'cancelled') THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE case_id = $1
                RETURNING *
                """,
                self.case_id,
                status.value,
            )
        )

    async def close(self, stage: Optional[str] = None) -> None:
        if stage:
            await self.set_stage(stage)
        await self.set_status(CaseStatus.CLOSED)

    async def add_flags(self, *flags: str) -> None:
        await self._apply(
            await execute_command_with_return(
                # SQL
                """
                UPDATE cases
                SET flags = ARRAY(SELECT DISTINCT unnest(flags || $2::text[]) ORDER BY 1), updated_at = NOW()
                WHERE case_id = $1
                RETURNING *
                """,
                self.case_id,
                list(flags),
            )
        )

    async def remove_flags(self, *flags: str) -> None:
        await self._apply(
            await execute_command_with_return(
                # SQL
                """
                UPDATE cases
                SET flags = ARRAY(SELECT f FROM unnest(flags) AS f WHERE f <> ALL($2::text[]) ORDER BY 1), updated_at = NOW()
                WHERE case_id = $1
                RETURNING *
                """,
                self.case_id,
                list(flags),
            )
        )

    async def set_track(self, track: str) -> None:
        await self._apply(
            await execute_command_with_return(
                "UPDATE cases SET track = $2, updated_at = NOW() WHERE case_id = $1 RETURNING *",
                self.case_id,
                track,
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": str(self.case_id),
            "case_type": self.case_type.value,
            "stage": self.stage,
            "status": self.status.value,
            "flags": self.flags,
            "track": self.track,
            "parent_case_id": str(self.parent_case_id) if self.parent_case_id else None,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
        }


class ChecklistItem:
    TABLE = "checklist_items"

    def __init__(self, **kwargs: Any):
        self.checklist_item_id: uuid.UUID = kwargs["checklist_item_id"]
        self.case_id: uuid.UUID = kwargs["case_id"]
        self.document_type: str = kwargs["document_type"]
        self.is_mandatory: bool = kwargs.get("is_mandatory", True)
        self.check_mode = CheckMode(kwargs.get("check_mode") or CheckMode.TEXT.value)
        self.status = ChecklistStatus(
            kwargs.get("status") or ChecklistStatus.PENDING.value
        )
        self.attachment_id: Optional[uuid.UUID] = kwargs.get("attachment_id")
        self.person_check: Optional[str] = kwargs.get("person_check")
        self.notes: Optional[str] = kwargs.get("notes")
        self.sort_order: int = kwargs.get("sort_order", 0)
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "ChecklistItem":
        data = dict(row)
        notes = FieldCipher(cls.TABLE, data["checklist_item_id"]).dec(
            "notes", data.pop("notes_enc")
        )
        return cls(**data, notes=notes)

    @classmethod
    async def create_many(
        cls, case_id: uuid.UUID, items: List[Dict[str, Any]]
    ) -> List["ChecklistItem"]:
        created: List[ChecklistItem] = []
        for order, item in enumerate(items):
            row = await execute_command_with_return(
                # SQL
                """
                INSERT INTO checklist_items (checklist_item_id, case_id, document_type, is_mandatory, check_mode, sort_order)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                uuid.uuid4(),
                case_id,
                item["document_type"],
                item.get("is_mandatory", True),
                item.get("check_mode", CheckMode.TEXT.value),
                item.get("sort_order", order),
            )
            created.append(cls.from_row(row))
        return created

    @classmethod
    async def for_case(cls, case_id: uuid.UUID) -> List["ChecklistItem"]:
        rows = await execute_query(
            "SELECT * FROM checklist_items WHERE case_id = $1 ORDER BY sort_order, document_type",
            case_id,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def find(
        cls, case_id: uuid.UUID, checklist_item_id: uuid.UUID
    ) -> Optional["ChecklistItem"]:
        row = await execute_query_one(
            "SELECT * FROM checklist_items WHERE case_id = $1 AND checklist_item_id = $2",
            case_id,
            checklist_item_id,
        )
        return cls.from_row(row) if row else None

    @staticmethod
    async def counts_for(case_ids: List[uuid.UUID]) -> Dict[uuid.UUID, Tuple[int, int]]:
        if not case_ids:
            return {}
        rows = await execute_query(
            # SQL
            """
            SELECT case_id,
                   COUNT(*) FILTER (WHERE is_mandatory) AS total,
                   COUNT(*) FILTER (WHERE is_mandatory AND status = 'verified') AS verified
            FROM checklist_items
            WHERE case_id = ANY($1::uuid[])
            GROUP BY case_id
            """,
            case_ids,
        )
        return {row["case_id"]: (row["verified"], row["total"]) for row in rows}

    async def update(
        self,
        status: ChecklistStatus,
        *,
        attachment_id: Optional[uuid.UUID] = None,
        person_check: Optional[str] = None,
        notes: Optional[str] = None,
        verified_by: Optional[uuid.UUID] = None,
    ) -> None:
        cipher = FieldCipher(self.TABLE, self.checklist_item_id)
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE checklist_items
            SET status = $2::text,
                attachment_id = COALESCE($3, attachment_id),
                person_check = COALESCE($4, person_check),
                notes_enc = COALESCE($5, notes_enc),
                verified_by = CASE WHEN $2::text = 'verified' THEN $6 ELSE verified_by END,
                updated_at = NOW()
            WHERE checklist_item_id = $1
            RETURNING *
            """,
            self.checklist_item_id,
            status.value,
            attachment_id,
            person_check,
            cipher.enc("notes", notes),
            verified_by,
        )
        self.__init__(**{**dict(row), "notes": cipher.dec("notes", row["notes_enc"])})
        self.__dict__.pop("notes_enc", None)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "checklist_item_id": str(self.checklist_item_id),
            "document_type": self.document_type,
            "is_mandatory": self.is_mandatory,
            "check_mode": self.check_mode.value,
            "status": self.status.value,
            "person_check": self.person_check,
            "attachment_id": str(self.attachment_id) if self.attachment_id else None,
            "notes": self.notes,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Task:
    TABLE = "tasks"

    def __init__(self, **kwargs: Any):
        self.task_id: uuid.UUID = kwargs.get("task_id") or uuid.uuid4()
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.reminder_rule_id: Optional[uuid.UUID] = kwargs.get("reminder_rule_id")
        self.task_type: str = kwargs["task_type"]
        self.owner_role: str = kwargs["owner_role"]
        self.owner_email: Optional[str] = kwargs.get("owner_email")
        self.status = TaskStatus(kwargs.get("status") or TaskStatus.OPEN.value)
        self.sub_items: Dict[str, str] = dict(kwargs.get("sub_items") or {})
        self.progress_notes: Optional[str] = kwargs.get("progress_notes")
        self.source_ref: Dict[str, Any] = kwargs.get("source_ref") or {}
        self.source_key: Optional[str] = kwargs.get("source_key")
        self.followups_sent: int = kwargs.get("followups_sent", 0)
        self.due_at: Optional[datetime] = kwargs.get("due_at")
        self.paused_until: Optional[datetime] = kwargs.get("paused_until")
        self.completed_at: Optional[datetime] = kwargs.get("completed_at")
        self.created_at: Optional[datetime] = kwargs.get("created_at")
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "Task":
        data = {
            key: row[key] for key in row.keys() if not key.endswith(("_enc", "_idx"))
        }
        cipher = FieldCipher(cls.TABLE, row["task_id"])
        return cls(
            **data,
            owner_email=cipher.dec("owner_email", row["owner_email_enc"]),
            progress_notes=cipher.dec("progress_notes", row["progress_notes_enc"]),
            source_ref=cipher.dec_json("source_ref", row["source_ref_enc"], default={}),
        )

    @property
    def is_closed(self) -> bool:
        return self.status in {
            TaskStatus.DONE,
            TaskStatus.NOT_APPLICABLE,
            TaskStatus.CANCELLED,
            TaskStatus.BLOCKED,
        }

    @property
    def is_final(self) -> bool:
        return self.status in {
            TaskStatus.DONE,
            TaskStatus.NOT_APPLICABLE,
            TaskStatus.CANCELLED,
        }

    @classmethod
    async def create(
        cls,
        task_type: str,
        owner_role: str,
        owner_email: Optional[str],
        *,
        case_id: Optional[uuid.UUID] = None,
        sub_items: Optional[Dict[str, str]] = None,
        reminder_rule_id: Optional[uuid.UUID] = None,
        source_ref: Optional[Dict[str, Any]] = None,
        source_key: Optional[str] = None,
        due_at: Optional[datetime] = None,
    ) -> "Task":
        task_id = uuid.uuid4()
        cipher = FieldCipher(cls.TABLE, task_id)
        email = owner_email.strip().lower() if owner_email else None
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO tasks (
                task_id, case_id, reminder_rule_id, task_type, owner_role, owner_email_enc, owner_email_idx,
                sub_items, source_ref_enc, source_key, due_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
            RETURNING *
            """,
            task_id,
            case_id,
            reminder_rule_id,
            task_type,
            owner_role,
            cipher.enc("owner_email", email),
            blind_index(email),
            sub_items or {},
            cipher.enc_json("source_ref", source_ref),
            source_key,
            due_at,
        )
        return cls.from_row(row)

    @classmethod
    async def find_by_id(cls, task_id: uuid.UUID) -> Optional["Task"]:
        row = await execute_query_one("SELECT * FROM tasks WHERE task_id = $1", task_id)
        return cls.from_row(row) if row else None

    @classmethod
    async def for_case(cls, case_id: uuid.UUID) -> List["Task"]:
        rows = await execute_query(
            "SELECT * FROM tasks WHERE case_id = $1 ORDER BY created_at, task_id",
            case_id,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def for_case_type(
        cls, case_id: uuid.UUID, task_type: str
    ) -> Optional["Task"]:
        row = await execute_query_one(
            "SELECT * FROM tasks WHERE case_id = $1 AND task_type = $2 ORDER BY created_at DESC LIMIT 1",
            case_id,
            task_type,
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def open_for_owner(cls, email: str) -> List["Task"]:
        index = blind_index(email)
        if index is None:
            return []
        rows = await execute_query(
            "SELECT * FROM tasks WHERE owner_email_idx = $1 AND status IN ('open', 'partial', 'escalated', 'paused') ORDER BY created_at DESC",
            index,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def for_rule(
        cls, reminder_rule_id: uuid.UUID, status: Optional[str]
    ) -> List["Task"]:
        rows = await execute_query(
            "SELECT * FROM tasks WHERE reminder_rule_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC, task_id",
            reminder_rule_id,
            status,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def open_rule_tasks(cls, reminder_rule_id: uuid.UUID) -> List["Task"]:
        rows = await execute_query(
            "SELECT * FROM tasks WHERE reminder_rule_id = $1 AND status IN ('open', 'partial', 'escalated', 'paused')",
            reminder_rule_id,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def done_rule_tasks(cls, reminder_rule_id: uuid.UUID) -> List["Task"]:
        rows = await execute_query(
            "SELECT * FROM tasks WHERE reminder_rule_id = $1 AND status = 'done'",
            reminder_rule_id,
        )
        return [cls.from_row(row) for row in rows]

    async def update(
        self,
        *,
        status: Optional[TaskStatus] = None,
        sub_items: Optional[Dict[str, str]] = None,
        progress_notes: Optional[str] = None,
        paused_until: Optional[datetime] = None,
        clear_pause: bool = False,
    ) -> None:
        cipher = FieldCipher(self.TABLE, self.task_id)
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE tasks
            SET status = COALESCE($2::text, status),
                sub_items = COALESCE($3::jsonb, sub_items),
                progress_notes_enc = COALESCE($4, progress_notes_enc),
                paused_until = CASE WHEN $6 THEN NULL ELSE COALESCE($5, paused_until) END,
                completed_at = CASE
                    WHEN COALESCE($2::text, status) IN ('done', 'not_applicable', 'cancelled') THEN COALESCE(completed_at, NOW())
                    ELSE NULL
                END,
                updated_at = NOW()
            WHERE task_id = $1
            RETURNING *
            """,
            self.task_id,
            status.value if status else None,
            sub_items,
            cipher.enc("progress_notes", progress_notes),
            paused_until,
            clear_pause,
        )
        fresh = Task.from_row(row)
        self.__dict__.update(fresh.__dict__)

    async def bump_followups(self) -> None:
        self.followups_sent = await execute_scalar(
            "UPDATE tasks SET followups_sent = followups_sent + 1, updated_at = NOW() WHERE task_id = $1 RETURNING followups_sent",
            self.task_id,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": str(self.task_id),
            "case_id": str(self.case_id) if self.case_id else None,
            "task_type": self.task_type,
            "owner_role": self.owner_role,
            "owner_email": self.owner_email,
            "status": self.status.value,
            "sub_items": self.sub_items,
            "progress_notes": self.progress_notes,
            "followups_sent": self.followups_sent,
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
        }


class Approval:
    TABLE = "approvals"

    def __init__(self, **kwargs: Any):
        self.approval_id: uuid.UUID = kwargs["approval_id"]
        self.case_id: Optional[uuid.UUID] = kwargs.get("case_id")
        self.approval_type = ApprovalType(kwargs["approval_type"])
        self.source_email_id: Optional[uuid.UUID] = kwargs.get("source_email_id")
        self.summary: Optional[str] = kwargs.get("summary")
        self.draft: Dict[str, Any] = kwargs.get("draft") or {}
        self.status = ApprovalStatus(
            kwargs.get("status") or ApprovalStatus.PENDING.value
        )
        self.decided_by: Optional[uuid.UUID] = kwargs.get("decided_by")
        self.decided_at: Optional[datetime] = kwargs.get("decided_at")
        self.reject_reason: Optional[str] = kwargs.get("reject_reason")
        self.created_at: Optional[datetime] = kwargs.get("created_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "Approval":
        data = {key: row[key] for key in row.keys() if not key.endswith("_enc")}
        cipher = FieldCipher(cls.TABLE, row["approval_id"])
        return cls(
            **data,
            summary=cipher.dec("summary", row["summary_enc"]),
            draft=cipher.dec_json("draft", row["draft_enc"], default={}),
            reject_reason=cipher.dec("reject_reason", row["reject_reason_enc"]),
        )

    @classmethod
    async def create(
        cls,
        approval_type: ApprovalType,
        draft: Dict[str, Any],
        *,
        case_id: Optional[uuid.UUID],
        summary: Optional[str],
        source_email_id: Optional[uuid.UUID] = None,
    ) -> "Approval":
        approval_id = uuid.uuid4()
        cipher = FieldCipher(cls.TABLE, approval_id)
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO approvals (approval_id, case_id, approval_type, source_email_id, summary_enc, draft_enc)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            approval_id,
            case_id,
            approval_type.value,
            source_email_id,
            cipher.enc("summary", summary),
            cipher.enc_json("draft", draft),
        )
        return cls.from_row(row)

    @classmethod
    async def find_by_id(cls, approval_id: uuid.UUID) -> Optional["Approval"]:
        row = await execute_query_one(
            "SELECT * FROM approvals WHERE approval_id = $1", approval_id
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def for_case(cls, case_id: uuid.UUID) -> List["Approval"]:
        rows = await execute_query(
            "SELECT * FROM approvals WHERE case_id = $1 ORDER BY created_at DESC",
            case_id,
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def search(
        cls,
        status: Optional[str],
        approval_type: Optional[str],
        case_id: Optional[uuid.UUID],
        newest_first: bool,
        limit: int,
        offset: int,
    ) -> Tuple[List["Approval"], int]:
        # SQL
        where = """
            WHERE ($1::text IS NULL OR status = $1)
              AND ($2::text IS NULL OR approval_type = $2)
              AND ($3::uuid IS NULL OR case_id = $3)
        """
        direction = "DESC" if newest_first else "ASC"
        rows = await execute_query(
            f"SELECT * FROM approvals {where} ORDER BY created_at {direction}, approval_id LIMIT $4 OFFSET $5",
            status,
            approval_type,
            case_id,
            limit,
            offset,
        )
        total = await execute_scalar(
            f"SELECT COUNT(*) FROM approvals {where}", status, approval_type, case_id
        )
        return [cls.from_row(row) for row in rows], total

    async def save_draft(self, draft: Dict[str, Any]) -> None:
        cipher = FieldCipher(self.TABLE, self.approval_id)
        await execute_command(
            "UPDATE approvals SET draft_enc = $2, updated_at = NOW() WHERE approval_id = $1",
            self.approval_id,
            cipher.enc_json("draft", draft),
        )
        self.draft = draft

    async def decide(
        self, status: ApprovalStatus, user_id: uuid.UUID, reason: Optional[str] = None
    ) -> bool:
        cipher = FieldCipher(self.TABLE, self.approval_id)
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE approvals
            SET status = $2, decided_by = $3, decided_at = NOW(), reject_reason_enc = $4, updated_at = NOW()
            WHERE approval_id = $1 AND status = 'pending'
            RETURNING *
            """,
            self.approval_id,
            status.value,
            user_id,
            cipher.enc("reject_reason", reason),
        )
        if row:
            self.__dict__.update(Approval.from_row(row).__dict__)
        return row is not None

    async def mark_sent(self) -> None:
        await execute_command(
            "UPDATE approvals SET status = 'sent', updated_at = NOW() WHERE approval_id = $1",
            self.approval_id,
        )
        self.status = ApprovalStatus.SENT
