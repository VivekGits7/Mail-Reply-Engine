import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import asyncpg

from app.common.enums import HireCategory
from app.database import (
    execute_command,
    execute_command_with_return,
    execute_query,
    execute_query_one,
)
from app.people.enums import PersonRole, PersonStatus
from app.privacy.encryption import FieldCipher, blind_index

TABLE = "people"
EMAIL_FIELDS = ("personal_email", "work_email", "recruiter_email", "manager_email")


def _lower(value: Optional[str]) -> Optional[str]:
    return value.strip().lower() if value and value.strip() else None


class Person:
    def __init__(self, **kwargs: Any):
        self.person_id: uuid.UUID = kwargs.get("person_id") or uuid.uuid4()
        self.full_name: str = kwargs.get("full_name") or ""
        self.personal_email: Optional[str] = _lower(kwargs.get("personal_email"))
        self.work_email: Optional[str] = _lower(kwargs.get("work_email"))
        self.recruiter_email: Optional[str] = _lower(kwargs.get("recruiter_email"))
        self.manager_name: Optional[str] = kwargs.get("manager_name")
        self.manager_email: Optional[str] = _lower(kwargs.get("manager_email"))
        self.date_of_birth: Optional[date] = kwargs.get("date_of_birth")
        self.profile: Dict[str, Any] = kwargs.get("profile") or {}
        self.pan_hash: Optional[bytes] = kwargs.get("pan_hash")
        self.role = PersonRole(kwargs.get("role") or PersonRole.CANDIDATE.value)
        category = kwargs.get("hire_category")
        self.hire_category: Optional[HireCategory] = (
            HireCategory(category) if category else None
        )
        self.level: Optional[str] = kwargs.get("level")
        self.location: Optional[str] = kwargs.get("location")
        self.designation: Optional[str] = kwargs.get("designation")
        self.employee_code: Optional[str] = kwargs.get("employee_code")
        self.joining_date: Optional[date] = kwargs.get("joining_date")
        self.last_working_day: Optional[date] = kwargs.get("last_working_day")
        self.status = PersonStatus(kwargs.get("status") or PersonStatus.ACTIVE.value)
        self.photo_key: Optional[str] = kwargs.get("photo_key")
        self.created_by: Optional[uuid.UUID] = kwargs.get("created_by")
        self.created_at: Optional[datetime] = kwargs.get("created_at")
        self.updated_at: Optional[datetime] = kwargs.get("updated_at")

    @classmethod
    def from_row(cls, row: asyncpg.Record) -> "Person":
        cipher = FieldCipher(TABLE, row["person_id"])
        dob = cipher.dec("date_of_birth", row["date_of_birth_enc"])
        return cls(
            **{
                key: row[key]
                for key in row.keys()
                if not key.endswith(("_enc", "_idx"))
            },
            full_name=cipher.dec("full_name", row["full_name_enc"]),
            personal_email=cipher.dec("personal_email", row["personal_email_enc"]),
            work_email=cipher.dec("work_email", row["work_email_enc"]),
            recruiter_email=cipher.dec("recruiter_email", row["recruiter_email_enc"]),
            manager_name=cipher.dec("manager_name", row["manager_name_enc"]),
            manager_email=cipher.dec("manager_email", row["manager_email_enc"]),
            date_of_birth=date.fromisoformat(dob) if dob else None,
            profile=cipher.dec_json("profile", row["profile_enc"], default={}),
        )

    def _encrypted(self) -> List[Any]:
        cipher = FieldCipher(TABLE, self.person_id)
        return [
            cipher.enc("full_name", self.full_name),
            cipher.enc("personal_email", self.personal_email),
            blind_index(self.personal_email),
            cipher.enc("work_email", self.work_email),
            blind_index(self.work_email),
            cipher.enc("recruiter_email", self.recruiter_email),
            blind_index(self.recruiter_email),
            cipher.enc("manager_name", self.manager_name),
            cipher.enc("manager_email", self.manager_email),
            blind_index(self.manager_email),
            cipher.enc(
                "date_of_birth",
                self.date_of_birth.isoformat() if self.date_of_birth else None,
            ),
            cipher.enc_json("profile", self.profile),
        ]

    def _plain(self) -> List[Any]:
        return [
            self.pan_hash,
            self.role.value,
            self.hire_category.value if self.hire_category else None,
            self.level,
            self.location,
            self.designation,
            self.employee_code,
            self.joining_date,
            self.last_working_day,
            self.status.value,
        ]

    async def insert(self, created_by: Optional[uuid.UUID] = None) -> "Person":
        self.created_by = created_by
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO people (
                person_id, full_name_enc, personal_email_enc, personal_email_idx, work_email_enc, work_email_idx,
                recruiter_email_enc, recruiter_email_idx, manager_name_enc, manager_email_enc, manager_email_idx,
                date_of_birth_enc, profile_enc, pan_hash, role, hire_category, level, location, designation,
                employee_code, joining_date, last_working_day, status, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            RETURNING created_at, updated_at
            """,
            self.person_id,
            *self._encrypted(),
            *self._plain(),
            created_by,
        )
        self.created_at, self.updated_at = row["created_at"], row["updated_at"]
        return self

    async def save(self) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE people SET
                full_name_enc = $2, personal_email_enc = $3, personal_email_idx = $4, work_email_enc = $5, work_email_idx = $6,
                recruiter_email_enc = $7, recruiter_email_idx = $8, manager_name_enc = $9, manager_email_enc = $10,
                manager_email_idx = $11, date_of_birth_enc = $12, profile_enc = $13, pan_hash = $14, role = $15,
                hire_category = $16, level = $17, location = $18, designation = $19, employee_code = $20,
                joining_date = $21, last_working_day = $22, status = $23, updated_at = NOW()
            WHERE person_id = $1
            RETURNING updated_at
            """,
            self.person_id,
            *self._encrypted(),
            *self._plain(),
        )
        self.updated_at = row["updated_at"]

    async def set_photo(self, photo_key: Optional[str]) -> None:
        await execute_command(
            "UPDATE people SET photo_key = $2, updated_at = NOW() WHERE person_id = $1",
            self.person_id,
            photo_key,
        )
        self.photo_key = photo_key

    # Never overwrites a photo HR uploaded, only an empty slot or an earlier passport photo.
    async def adopt_photo(self, photo_key: str, hr_prefix: str) -> None:
        row = await execute_command_with_return(
            # SQL
            """
            UPDATE people SET photo_key = $2, updated_at = NOW()
            WHERE person_id = $1 AND (photo_key IS NULL OR photo_key NOT LIKE $3 || '/%')
            RETURNING photo_key
            """,
            self.person_id,
            photo_key,
            hr_prefix,
        )
        if row:
            self.photo_key = row["photo_key"]

    async def release_photo(self, photo_key: str) -> None:
        await execute_command(
            "UPDATE people SET photo_key = NULL, updated_at = NOW() WHERE person_id = $1 AND photo_key = $2",
            self.person_id,
            photo_key,
        )
        if self.photo_key == photo_key:
            self.photo_key = None

    @classmethod
    async def find_by_id(cls, person_id: uuid.UUID) -> Optional["Person"]:
        row = await execute_query_one(
            "SELECT * FROM people WHERE person_id = $1", person_id
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def find_by_ids(
        cls, person_ids: List[uuid.UUID]
    ) -> Dict[uuid.UUID, "Person"]:
        if not person_ids:
            return {}
        rows = await execute_query(
            "SELECT * FROM people WHERE person_id = ANY($1::uuid[])",
            list(set(person_ids)),
        )
        return {row["person_id"]: cls.from_row(row) for row in rows}

    @classmethod
    async def find_by_email(
        cls, email: str, fields: tuple[str, ...] = ("personal_email", "work_email")
    ) -> List["Person"]:
        index = blind_index(email)
        if index is None:
            return []
        conditions = " OR ".join(f"{field}_idx = $1" for field in fields)
        rows = await execute_query(
            f"SELECT * FROM people WHERE {conditions} ORDER BY created_at DESC", index
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    async def find_by_employee_code(cls, employee_code: str) -> Optional["Person"]:
        row = await execute_query_one(
            "SELECT * FROM people WHERE employee_code = $1", employee_code.strip()
        )
        return cls.from_row(row) if row else None

    @classmethod
    async def due_for_survey(
        cls, joining_dates: List[date], levels: List[str]
    ) -> List["Person"]:
        rows = await execute_query(
            # SQL
            """
            SELECT p.* FROM people p
            WHERE p.joining_date = ANY($1::date[])
              AND p.level = ANY($2::text[])
              AND p.status = 'active'
              AND p.role IN ('candidate', 'employee')
              AND NOT EXISTS (
                  SELECT 1 FROM cases c WHERE c.person_id = p.person_id AND c.case_type = 'exit' AND c.status <> 'cancelled'
              )
            """,
            joining_dates,
            levels,
        )
        return [cls.from_row(row) for row in rows]

    @staticmethod
    async def promote_joiners(on_or_before: date) -> int:
        result = await execute_command(
            # SQL
            """
            UPDATE people p SET role = 'employee', updated_at = NOW()
            WHERE p.role = 'candidate' AND p.joining_date <= $1 AND p.status = 'active' AND p.employee_code IS NOT NULL
            """,
            on_or_before,
        )
        return int(result.split()[-1])

    @property
    def first_name(self) -> str:
        return self.full_name.split(" ")[0] if self.full_name else ""

    @property
    def contact_email(self) -> Optional[str]:
        return self.work_email or self.personal_email

    def emails(self) -> List[str]:
        return [value for value in (self.personal_email, self.work_email) if value]
