import argparse
import asyncio
import secrets
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

# Lets `guvrun scripts/<name>.py` import app the same way `-m scripts.<name>` does.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import User, UserRole, UserSortBy
from app.auth.service import create_access_token
from app.common.enums import SortOrder
from app.config import settings
from app.database import close_db_pool, create_db_pool
from app.runtime.clock import local_today
from app.worker.model import ScheduledJob

DEMO_DOMAIN = "demo.example.com"
WORKER_WAIT_SECONDS = 30

JOINERS = [
    ("Aarav Mehta", "lateral", "L4", "Kolkata", 2, "ready"),
    ("Ishita Banerjee", "campus", "L1", "Kolkata", 3, 3),
    ("Tara Sen", "lateral", "L5", "Kolkata", 4, "signed_off"),
    ("Kabir Nair", "lateral", "L5", "Bengaluru", 5, 0),
    ("Ananya Iyer", "lateral", "L3", "Pune", 6, "signed_off"),
    ("Rohan Das", "campus", "L1", "Kolkata", 8, 5),
    ("Meera Pillai", "lateral", "L6", "Bengaluru", 9, "ready"),
    ("Vihaan Kapoor", "campus", "L2", "Pune", 12, 0),
    ("Saanvi Ghosh", "lateral", "L4", "Kolkata", 13, 2),
    ("Arjun Reddy", "lateral", "L7", "Hyderabad", 16, 0),
    ("Diya Chatterjee", "campus", "L1", "Kolkata", 24, 0),
    ("Nikhil Joshi", "lateral", "L3", "Pune", 30, 1),
]

EXITS = [
    ("Rahul Verma", "70231", 1, 4),
    ("Priya Sharma", "70456", 4, 2),
    ("Sandeep Kulkarni", "70522", 7, 1),
    ("Neha Agarwal", "70611", 10, 0),
    ("Amit Bose", "70734", 15, 3),
    ("Pooja Menon", "70802", 19, 0),
]

INDUCTIONS = ["Aarav Mehta", "Meera Pillai", "Tara Sen", "Ananya Iyer"]

HR_USERS = [
    ("Riya Kapoor", UserRole.HR_VIEWER, False),
    ("Sameer Khan", UserRole.HR_VIEWER, True),
    ("Farah Ali", UserRole.HR_ADMIN, False),
]


def demo_email(name: str) -> str:
    return f"{name.lower().replace(' ', '.')}@{DEMO_DOMAIN}"


class Api:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def call(
        self, method: str, path: str, payload: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        response = await self.client.request(method, path, json=payload)
        if response.status_code >= 400:
            try:
                message = response.json()["error"]["message"]
            except (ValueError, KeyError, TypeError):
                message = response.text[:200]
            raise RuntimeError(f"{response.status_code} {message}")
        return response.json()


async def admin_token(email: Optional[str]) -> str:
    if email:
        user = await User.find_by_email(email)
        if not user or not user.is_admin or not user.is_active:
            raise SystemExit(f"{email} is not an active HR admin")
    else:
        users, _ = await User.search(
            None, UserRole.HR_ADMIN, True, UserSortBy.CREATED_AT, SortOrder.OLDEST, 1, 0
        )
        if not users:
            raise SystemExit(
                "No active HR admin found, create one with scripts/create_admin.py"
            )
        user = users[0]
    print(f"Seeding as {user.email}")
    return create_access_token(user)[0]


async def seed_joiners(api: Api, today: date) -> Dict[str, str]:
    cases: Dict[str, str] = {}
    for index, (name, category, level, location, days, progress) in enumerate(JOINERS):
        first = name.split()[0]
        try:
            created = (
                await api.call(
                    "POST",
                    "/api/joiners",
                    {
                        "full_name": name,
                        "personal_email": demo_email(name),
                        "recruiter_email": f"talent@{DEMO_DOMAIN}",
                        "hire_category": category,
                        "location": location,
                        "level": level,
                        "joining_date": (today + timedelta(days=days)).isoformat(),
                        "date_of_birth": date(
                            1992 + index % 8, 1 + index % 12, 10 + index
                        ).isoformat(),
                        "manager_name": "Kunal Basu" if index % 2 else "Shreya Dutta",
                        "manager_email": demo_email(
                            "Kunal Basu" if index % 2 else "Shreya Dutta"
                        ),
                    },
                )
            )["data"]
        except RuntimeError as e:
            print(f"  joiner {name}: skipped, {e}")
            continue
        case_id = created["case_id"]
        cases[name] = case_id
        items = created["checklist"]
        mandatory = [item for item in items if item["is_mandatory"]]
        to_verify = (
            mandatory if progress in ("ready", "signed_off") else items[: int(progress)]
        )
        for item in to_verify:
            await api.call(
                "PATCH",
                f"/api/cases/{case_id}/checklist/{item['checklist_item_id']}",
                {"status": "verified", "note": "Demo data"},
            )
        if progress == "signed_off":
            await api.call(
                "POST",
                f"/api/cases/{case_id}/sign-off",
                {
                    "employee_code": f"9{index:04d}",
                    "designation": "Software Engineer",
                    "gender": "Female" if index % 2 else "Male",
                    "bu_head": "Neha Gupta",
                    "employment_type": "Permanent",
                    "contact_number": f"90000{index:05d}",
                    "sector_region": "India",
                    "system_type": True,
                    "proj_ops": False,
                    "ess_d365": True,
                    "skills": "Python, React",
                    "business_card": index % 2 == 0,
                },
            )
        print(f"  joiner {first}: {len(to_verify)}/{len(items)} documents verified")
    return cases


async def seed_exits(api: Api, today: date) -> Dict[str, str]:
    cases: Dict[str, str] = {}
    for name, code, days, cleared in EXITS:
        try:
            created = (
                await api.call(
                    "POST",
                    "/api/exits",
                    {
                        "full_name": name,
                        "employee_code": code,
                        "work_email": demo_email(name),
                        "manager_name": "Kunal Basu",
                        "manager_email": demo_email("Kunal Basu"),
                        "last_working_day": (today + timedelta(days=days)).isoformat(),
                    },
                )
            )["data"]
        except RuntimeError as e:
            print(f"  exit {name}: skipped, {e}")
            continue
        cases[name] = created["case_id"]
        for task in created["tasks"][:cleared]:
            await api.call(
                "PATCH",
                f"/api/tasks/{task['task_id']}",
                {"status": "done", "note": "Demo data"},
            )
        print(
            f"  exit {name.split()[0]}: {cleared}/{len(created['tasks'])} teams cleared"
        )
    return cases


async def seed_inductions(api: Api, joiners: Dict[str, str]) -> List[str]:
    induction_cases: List[str] = []
    for name in INDUCTIONS:
        case_id = joiners.get(name)
        if not case_id:
            continue
        try:
            data = (await api.call("POST", f"/api/cases/{case_id}/induction", {}))[
                "data"
            ]
        except RuntimeError as e:
            print(f"  induction {name}: skipped, {e}")
            continue
        induction_cases.append(data["induction_case_id"])
        print(f"  induction plan drafting for {name.split()[0]}")
    return induction_cases


async def seed_users(api: Api) -> None:
    for name, role, complaints in HR_USERS:
        try:
            await api.call(
                "POST",
                "/api/users",
                {
                    "name": name,
                    "email": demo_email(name),
                    "password": secrets.token_urlsafe(18),
                    "role": role.value,
                    "complaints_access": complaints,
                },
            )
            print(f"  user {name.split()[0]}: added as {role.value}")
        except RuntimeError as e:
            print(f"  user {name}: skipped, {e}")


async def wait_for_drafts(api: Api, induction_cases: List[str]) -> None:
    pending = set(induction_cases)
    for _ in range(WORKER_WAIT_SECONDS):
        if not pending:
            return
        approvals = (
            await api.call("GET", "/api/approvals?status=pending&limit=100&offset=0")
        )["data"]
        pending -= {item["case_id"] for item in approvals}
        await asyncio.sleep(1)
    if pending:
        print(
            f"  {len(pending)} induction plans are still drafting, they show up in Approvals once the worker runs"
        )


async def seed(api_url: str, email: Optional[str]) -> None:
    await create_db_pool()
    try:
        token = await admin_token(email)
        async with httpx.AsyncClient(
            base_url=api_url, headers={"Authorization": f"Bearer {token}"}, timeout=60
        ) as client:
            api = Api(client)
            status = (await api.call("GET", "/api/admin/status"))["data"]
            if not status["kill_switch"]:
                await api.call("POST", "/api/admin/kill-switch", {"enabled": True})
                print("Kill switch turned on while seeding so nothing is emailed")
            try:
                today = local_today()
                print("Joiners")
                joiners = await seed_joiners(api, today)
                print("Exits")
                exits = await seed_exits(api, today)
                print("Induction plans")
                inductions = await seed_inductions(api, joiners)
                print("HR users")
                await seed_users(api)
                await wait_for_drafts(api, inductions)
                cancelled = 0
                for case_id in [*joiners.values(), *exits.values(), *inductions]:
                    cancelled += await ScheduledJob.cancel_pending(
                        case_id=uuid.UUID(case_id)
                    )
                print(
                    f"Cancelled {cancelled} queued emails and follow-ups for demo people"
                )
            finally:
                if not status["kill_switch"]:
                    await api.call("POST", "/api/admin/kill-switch", {"enabled": False})
                    print("Kill switch restored to off")
        print(
            f"Done. Demo people have {DEMO_DOMAIN} manager or recruiter addresses, which the cleanup script matches on."
        )
    finally:
        await close_db_pool()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Add demo joiners, exits, induction plans and HR users through the API"
    )
    parser.add_argument(
        "--api-url",
        default=f"http://localhost:{settings.PORT}",
        help="Running backend to seed through",
    )
    parser.add_argument(
        "--email", help="HR admin to act as, defaults to the oldest active admin"
    )
    args = parser.parse_args()
    asyncio.run(seed(args.api_url, args.email))


if __name__ == "__main__":
    main()
