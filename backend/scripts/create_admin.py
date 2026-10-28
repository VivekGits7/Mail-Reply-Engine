import argparse
import asyncio
import getpass
import sys
from pathlib import Path
from typing import Optional, Tuple

# Lets `guvrun scripts/<name>.py` import app the same way `-m scripts.<name>` does.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import User, UserRole, hash_password
from app.common.attachment import FileAttachment
from app.config import settings
from app.database import close_db_pool, create_db_pool
from app.storage import UploadPurpose, replace_photo, upload_prefix
from app.storage import service as storage

MIN_PASSWORD_LENGTH = 8
PHOTO_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def read_photo(path: str) -> Tuple[Path, bytes, str]:
    file = Path(path).expanduser()
    mime_type = PHOTO_TYPES.get(file.suffix.lower())
    if not mime_type:
        raise SystemExit("Photo must be a JPG, PNG or WEBP file")
    if not file.is_file():
        raise SystemExit(f"No photo found at {file}")
    data = file.read_bytes()
    if len(data) > settings.PHOTO_MAX_BYTES:
        raise SystemExit(
            f"Photo is too large, the limit is {settings.PHOTO_MAX_BYTES // (1024 * 1024)} MB"
        )
    return file, data, mime_type


async def upload_photo(photo: Tuple[Path, bytes, str]) -> FileAttachment:
    file, data, mime_type = photo
    key = storage.new_key(upload_prefix(UploadPurpose.USER_PHOTO), file.name)
    await storage.put_bytes(key, data, mime_type)
    return FileAttachment(
        file_name=file.name, file_url=key, mime_type=mime_type, size=len(data)
    )


async def create_admin(
    name: str,
    email: str,
    password: str,
    complaints_access: bool,
    photo: Optional[Tuple[Path, bytes, str]],
) -> None:
    await create_db_pool()
    try:
        if await User.find_by_email(email):
            print(f"A user with {email} already exists")
            return
        uploaded = await upload_photo(photo) if photo else None
        user = await User.create(
            name,
            email,
            hash_password(password),
            UserRole.HR_ADMIN,
            complaints_access,
            uploaded.file_url if uploaded else None,
        )
        print(f"Created HR admin {user.email}{' with a photo' if uploaded else ''}")
    finally:
        await close_db_pool()


async def set_photo(email: str, photo: Tuple[Path, bytes, str]) -> None:
    await create_db_pool()
    try:
        user = await User.find_by_email(email)
        if not user:
            print(f"No user with {email}")
            return
        await replace_photo(user, await upload_photo(photo), UploadPurpose.USER_PHOTO)
        print(f"Saved a new photo for {user.email}")
    finally:
        await close_db_pool()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create an HR admin for the dashboard, or change a user's photo"
    )
    parser.add_argument("--name", help="Display name, needed when creating")
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--complaints-access",
        action="store_true",
        help="Also allow the restricted complaints area",
    )
    parser.add_argument("--photo", help="Path to a JPG, PNG or WEBP profile photo")
    parser.add_argument(
        "--set-photo",
        action="store_true",
        help="Only change the photo of an existing user, needs --photo",
    )
    args = parser.parse_args()
    photo = read_photo(args.photo) if args.photo else None
    if args.set_photo:
        if not photo:
            raise SystemExit("--set-photo needs --photo")
        asyncio.run(set_photo(args.email, photo))
        return
    if not args.name:
        raise SystemExit("--name is needed when creating a user")
    password = getpass.getpass("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match")
    asyncio.run(
        create_admin(args.name, args.email, password, args.complaints_access, photo)
    )


if __name__ == "__main__":
    main()
