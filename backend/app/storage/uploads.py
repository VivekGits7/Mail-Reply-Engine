from app.common.attachment import FileAttachment
from app.error import BadRequestException
from app.storage import service as storage
from app.storage.schemas import ALLOWED_TYPES, UploadPurpose, upload_prefix


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
