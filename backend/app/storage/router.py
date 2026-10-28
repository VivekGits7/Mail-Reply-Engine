from fastapi import APIRouter, Depends, HTTPException, Request

from app import runtime
from app.auth.model import User
from app.auth.service import get_current_user
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadGatewayResponse,
    BadRequestResponse,
    ForbiddenResponse,
)
from app.config import settings
from app.error import AppException, BadRequestException, ForbiddenException
from app.limiter import limiter
from app.logger import get_logger
from app.storage import service as storage
from app.storage.schemas import (
    PHOTO_PURPOSES,
    PresignData,
    PresignRequest,
    PresignResponse,
    UploadPurpose,
    upload_prefix,
)
from app.storage.uploads import check_type

logger = get_logger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

MB = 1024 * 1024


@router.post(
    "/presign",
    response_model=PresignResponse,
    summary="Get a presigned upload link",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": PresignResponse, "description": "Upload link ready"},
        400: {
            "model": BadRequestResponse,
            "description": "File type or size not allowed for this purpose",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Not allowed to upload for this purpose",
        },
        502: {
            "model": BadGatewayResponse,
            "description": "File storage is unavailable",
        },
    },
)
@limiter.limit("20/minute")
async def presign_upload(
    request: Request,
    data: PresignRequest,
    current_user: User = Depends(get_current_user),
) -> PresignResponse:
    """
    Get a presigned POST so the browser uploads a file straight to storage.

    - **file_name**: required, the original file name
    - **mime_type**: required, must match the purpose
    - **size**: required, bytes, up to the upload_max_mb setting, photos up to 5 MB
    - **purpose**: required, one of appointment_letter, reminder_list, survey_export, transcript, statement_of_understanding, user_photo, joiner_photo
    - appointment_letter and statement_of_understanding take PDF, reminder_list takes CSV or XLSX, survey_export takes XLSX, transcript takes PDF, DOCX or TXT
    - user_photo and joiner_photo take JPG, PNG or WEBP
    - transcripts need restricted area access, user_photo is open to every signed in HR user, every other purpose needs an HR admin
    - send the returned file_url back inside a FileAttachment
    """
    try:
        if data.purpose == UploadPurpose.TRANSCRIPT:
            if not current_user.complaints_access:
                raise ForbiddenException(
                    "Transcripts can only be uploaded from the restricted area"
                )
        elif data.purpose != UploadPurpose.USER_PHOTO and not current_user.is_admin:
            raise ForbiddenException("Only HR admins can upload files")
        check_type(data.purpose, data.mime_type)
        max_bytes = (
            settings.PHOTO_MAX_BYTES
            if data.purpose in PHOTO_PURPOSES
            else (await runtime.current()).upload_max_mb * MB
        )
        if data.size > max_bytes:
            raise BadRequestException(
                f"File is too large, the limit is {max_bytes // MB} MB"
            )
        key = storage.new_key(upload_prefix(data.purpose), data.file_name)
        signed = await storage.presigned_post(key, data.mime_type.lower(), max_bytes)
        return PresignResponse(
            success=True,
            message="Upload link ready",
            data=PresignData(
                upload_url=signed["url"],
                fields=signed["fields"],
                file_url=key,
                expires_in=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS,
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Presign error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
