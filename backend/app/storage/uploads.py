from typing import Any, Optional

from app.common.attachment import FileAttachment
from app.error import BadRequestException
from app.logger import get_logger
from app.storage import service as storage
from app.storage.schemas import ALLOWED_TYPES, UploadPurpose, upload_prefix

logger = get_logger(__name__)


def check_type(purpose: UploadPurpose, mime_type: str) -> None:
    if mime_type.lower() not in ALLOWED_TYPES[purpose]:
        allowed = ", ".join(sorted(ALLOWED_TYPES[purpose]))
        raise BadRequestException(
            f"File type not allowed here. Allowed types: {allowed}"
        )


async def verify_upload(attachment: FileAttachment, purpose: UploadPurpose) -> int:
    check_type(purpose, attachment.mime_type)
    if (
        not attachment.file_url.startswith(f"{upload_prefix(purpose)}/")
        or ".." in attachment.file_url
    ):
        raise BadRequestException("This file was not uploaded for this purpose")
    stored = await storage.head(attachment.file_url)
    if stored is None:
        raise BadRequestException("Upload the file first, it was not found in storage")
    return int(stored["size"] or attachment.size)


def owns_key(key: Optional[str], purpose: UploadPurpose) -> bool:
    return bool(key) and key.startswith(f"{upload_prefix(purpose)}/")


# Only files uploaded for this purpose are removed, a passport photo used as an avatar stays with its case.
async def discard_upload(key: Optional[str], purpose: UploadPurpose) -> None:
    if not owns_key(key, purpose):
        return
    try:
        await storage.delete(key)
    except Exception as e:
        logger.error(f"Old {purpose.value} cleanup failed: {type(e).__name__}")


# The owner is any model with a photo_key and set_photo, the new key is saved before the old file goes.
async def replace_photo(
    owner: Any, photo: Optional[FileAttachment], purpose: UploadPurpose
) -> None:
    old_key = owner.photo_key
    new_key = photo.file_url if photo else None
    if new_key == old_key:
        return
    await owner.set_photo(new_key)
    await discard_upload(old_key, purpose)
