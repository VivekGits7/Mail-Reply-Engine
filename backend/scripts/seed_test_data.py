import asyncio
import sys
from datetime import timedelta
from pathlib import Path

# Lets `guvrun scripts/<name>.py` import app the same way `-m scripts.<name>` does.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cases import Case, CaseType
from app.database import close_db_pool, create_db_pool
from app.engine import seed_defaults
from app.people import Person
from app.runtime.clock import local_today

TEST_EMPLOYEES = [
    ("Test Joiner Thirty", "test.thirty@tcgdigital.com", 30, "L3", "lateral"),
    ("Test Joiner Sixty", "test.sixty@tcgdigital.com", 60, "L1", "campus"),
    ("Test Joiner Ninety", "test.ninety@tcgdigital.com", 90, "L5", "lateral"),
]


async def seed() -> None:
    await create_db_pool()
    try:
        await seed_defaults()
        today = local_today()
        for name, email, days, level, category in TEST_EMPLOYEES:
            if await Person.find_by_email(email):
                continue
            person = await Person(
                full_name=name,
                work_email=email,
                role="employee",
                hire_category=category,
                level=level,
                location="Kolkata",
                employee_code=f"T{days}",
                joining_date=today - timedelta(days=days),
                manager_name="Test Manager",
                manager_email="test.manager@tcgdigital.com",
            ).insert()
            print(f"Seeded {person.full_name}")
        exiting = await Person.find_by_employee_code("T-EXIT")
        if not exiting:
            exiting = await Person(
                full_name="Test Leaver",
                work_email="test.leaver@tcgdigital.com",
                role="employee",
                employee_code="T-EXIT",
                manager_name="Test Manager",
                manager_email="test.manager@tcgdigital.com",
            ).insert()
            print("Seeded Test Leaver, create the exit from the dashboard")
        print(
            f"Open cases: {len(await Case.active_of_type(CaseType.ONBOARDING))} onboarding"
        )
    finally:
        await close_db_pool()


if __name__ == "__main__":
    asyncio.run(seed())
