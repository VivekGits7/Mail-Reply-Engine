import argparse
import asyncio
import getpass
import sys
from pathlib import Path

# Lets `guvrun scripts/<name>.py` import app the same way `-m scripts.<name>` does.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import User, UserRole, hash_password
from app.database import close_db_pool, create_db_pool

MIN_PASSWORD_LENGTH = 8


async def create_admin(
    name: str, email: str, password: str, complaints_access: bool
) -> None:
    await create_db_pool()
    try:
        if await User.find_by_email(email):
            print(f"A user with {email} already exists")
            return
        user = await User.create(
            name, email, hash_password(password), UserRole.HR_ADMIN, complaints_access
        )
        print(f"Created HR admin {user.email}")
    finally:
        await close_db_pool()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an HR admin for the dashboard")
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--complaints-access",
        action="store_true",
        help="Also allow the restricted complaints area",
    )
    args = parser.parse_args()
    password = getpass.getpass("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match")
    asyncio.run(create_admin(args.name, args.email, password, args.complaints_access))


if __name__ == "__main__":
    main()
