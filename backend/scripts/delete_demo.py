import argparse
import asyncio
import sys
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Dict, List

import asyncpg

# Lets `guvrun scripts/<name>.py` import app the same way `-m scripts.<name>` does.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import close_db_pool, create_db_pool, get_pool
from app.people import Person
from app.privacy import blind_index
from scripts.seed_demo import DEMO_DOMAIN, EXITS, HR_USERS, JOINERS, demo_email
from scripts.seed_test_data import TEST_EMPLOYEES

DEMO_MANAGERS = ["Kunal Basu", "Shreya Dutta"]
TEST_MANAGER_EMAIL = "test.manager@tcgdigital.com"
TEST_LEAVER_EMAIL = "test.leaver@tcgdigital.com"
TEST_EMPLOYEE_CODES = [f"T{days}" for _, _, days, _, _ in TEST_EMPLOYEES] + ["T-EXIT"]
SEED_WINDOW = timedelta(minutes=3)


def seeded_addresses() -> List[str]:
    return [
        *(demo_email(name) for name, *_ in JOINERS),
        *(demo_email(name) for name, *_ in EXITS),
        *(demo_email(name) for name in DEMO_MANAGERS),
        f"talent@{DEMO_DOMAIN}",
        *(email for _, email, *_ in TEST_EMPLOYEES),
        TEST_LEAVER_EMAIL,
        TEST_MANAGER_EMAIL,
    ]


async def ids(conn: asyncpg.Connection, query: str, *args) -> List[uuid.UUID]:
    return [row[0] for row in await conn.fetch(query, *args)]


async def collect(conn: asyncpg.Connection) -> Dict[str, List]:
    indexes = [blind_index(address) for address in seeded_addresses()]
    people = await conn.fetch(
        # SQL
        """
        SELECT * FROM people
        WHERE personal_email_idx = ANY($1::bytea[])
           OR work_email_idx = ANY($1::bytea[])
           OR recruiter_email_idx = ANY($1::bytea[])
           OR manager_email_idx = ANY($1::bytea[])
           OR employee_code = ANY($2::text[])
        """,
        indexes,
        TEST_EMPLOYEE_CODES,
    )
    person_ids = [row["person_id"] for row in people]
    cases = await ids(
        conn,
        # SQL
        """
        SELECT case_id FROM cases
        WHERE person_id = ANY($1::uuid[])
           OR parent_case_id IN (SELECT case_id FROM cases WHERE person_id = ANY($1::uuid[]))
        """,
        person_ids,
    )
    tasks = await ids(
        conn, "SELECT task_id FROM tasks WHERE case_id = ANY($1::uuid[])", cases
    )
    approvals = await ids(
        conn, "SELECT approval_id FROM approvals WHERE case_id = ANY($1::uuid[])", cases
    )
    checklist = await ids(
        conn,
        "SELECT checklist_item_id FROM checklist_items WHERE case_id = ANY($1::uuid[])",
        cases,
    )
    sessions = await ids(
        conn,
        "SELECT induction_session_id FROM induction_sessions WHERE case_id = ANY($1::uuid[])",
        cases,
    )
    jobs = await ids(
        conn,
        "SELECT scheduled_job_id FROM scheduled_jobs WHERE case_id = ANY($1::uuid[]) OR task_id = ANY($2::uuid[])",
        cases,
        tasks,
    )
    emails = await ids(
        conn,
        # SQL
        """
        SELECT email_id FROM emails
        WHERE case_id = ANY($1::uuid[])
           OR task_id = ANY($2::uuid[])
           OR approval_id = ANY($3::uuid[])
           OR from_email_idx = ANY($4::bytea[])
           OR recipients_idx && $4::bytea[]
        """,
        cases,
        tasks,
        approvals,
        indexes,
    )
    attachments = await ids(
        conn,
        "SELECT attachment_id FROM attachments WHERE case_id = ANY($1::uuid[]) OR email_id = ANY($2::uuid[])",
        cases,
        emails,
    )
    users = await conn.fetch(
        "SELECT user_id, email, created_at FROM users WHERE LOWER(email) = ANY($1::text[])",
        [demo_email(name) for name, *_ in HR_USERS],
    )
    user_ids = [row["user_id"] for row in users]
    linked = [
        *person_ids,
        *cases,
        *tasks,
        *approvals,
        *checklist,
        *sessions,
        *emails,
        *attachments,
        *user_ids,
    ]
    events = await ids(
        conn,
        # SQL
        """
        SELECT event_id FROM events e
        WHERE case_id = ANY($1::uuid[])
           OR EXISTS (SELECT 1 FROM unnest($2::text[]) AS id WHERE e.payload::text LIKE '%' || id || '%')
        """,
        cases,
        [str(value) for value in linked],
    )
    seed_switches: List[uuid.UUID] = []
    demo_people = [
        row for row in people if row["employee_code"] not in TEST_EMPLOYEE_CODES
    ]
    demo_times = [row["created_at"] for row in [*demo_people, *users]]
    if demo_times:
        seed_switches = await ids(
            conn,
            # SQL
            """
            SELECT action_log_id FROM action_log
            WHERE action = 'kill_switch_changed' AND occurred_at BETWEEN $1 AND $2
            """,
            min(demo_times) - SEED_WINDOW,
            max(demo_times) + SEED_WINDOW,
        )
    audit = await ids(
        conn,
        # SQL
        """
        SELECT action_log_id FROM action_log
        WHERE case_id = ANY($1::uuid[])
           OR entity_id = ANY($2::uuid[])
           OR actor_id = ANY($3::uuid[])
           OR action_log_id = ANY($4::uuid[])
        """,
        cases,
        linked,
        user_ids,
        seed_switches,
    )
    return {
        "people": people,
        "cases": cases,
        "checklist_items": checklist,
        "tasks": tasks,
        "approvals": approvals,
        "induction_sessions": sessions,
        "scheduled_jobs": jobs,
        "emails": emails,
        "attachments": attachments,
        "events": events,
        "action_log": audit,
        "kill_switch_rows": seed_switches,
        "users": users,
    }


def report(found: Dict[str, List]) -> None:
    people = [Person.from_row(row) for row in found["people"]]
    demo = sorted(
        p.full_name for p in people if p.employee_code not in TEST_EMPLOYEE_CODES
    )
    test = sorted(p.full_name for p in people if p.employee_code in TEST_EMPLOYEE_CODES)
    print(f"Demo people ({len(demo)}): {', '.join(demo) or 'none'}")
    print(f"Test seed people ({len(test)}): {', '.join(test) or 'none'}")
    print(
        f"HR users ({len(found['users'])}): {', '.join(row['email'] for row in found['users']) or 'none'}"
    )
    for table in (
        "cases",
        "checklist_items",
        "tasks",
        "approvals",
        "induction_sessions",
        "scheduled_jobs",
        "emails",
        "attachments",
        "events",
        "action_log",
    ):
        print(f"  {table}: {len(found[table])}")
    print(
        f"  of which kill switch toggles from the seed run: {len(found['kill_switch_rows'])}"
    )


async def delete(conn: asyncpg.Connection, found: Dict[str, List]) -> None:
    person_ids = [row["person_id"] for row in found["people"]]
    user_ids = [row["user_id"] for row in found["users"]]
    await conn.execute(
        "DELETE FROM action_log WHERE action_log_id = ANY($1::uuid[])",
        found["action_log"],
    )
    await conn.execute(
        "DELETE FROM events WHERE event_id = ANY($1::uuid[])", found["events"]
    )
    await conn.execute(
        "DELETE FROM attachments WHERE attachment_id = ANY($1::uuid[])",
        found["attachments"],
    )
    await conn.execute(
        "DELETE FROM emails WHERE email_id = ANY($1::uuid[])", found["emails"]
    )
    # Checklist items, tasks, approvals, sessions and scheduled jobs cascade from cases.
    await conn.execute(
        "DELETE FROM cases WHERE case_id = ANY($1::uuid[])", found["cases"]
    )
    await conn.execute(
        "DELETE FROM people WHERE person_id = ANY($1::uuid[])", person_ids
    )
    await conn.execute("DELETE FROM users WHERE user_id = ANY($1::uuid[])", user_ids)


async def run(apply: bool) -> None:
    await create_db_pool()
    try:
        async with get_pool().acquire() as conn:
            found = await collect(conn)
            report(found)
            if not apply:
                print(
                    "Dry run, nothing deleted. Run again with --apply to delete these rows."
                )
                return
            async with conn.transaction():
                await delete(conn, found)
            left = await collect(conn)
            remaining = len(left["people"]) + len(left["users"]) + len(left["cases"])
            print(
                "Deleted."
                if remaining == 0
                else f"Deleted, but {remaining} demo rows are still there"
            )
    finally:
        await close_db_pool()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove the people, cases and HR users added by seed_demo.py and seed_test_data.py"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete the rows, without it only a dry run is printed",
    )
    args = parser.parse_args()
    asyncio.run(run(args.apply))


if __name__ == "__main__":
    main()
