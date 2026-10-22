import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.audit import log_user_action
from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.common.attachment import FileAttachment
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadGatewayResponse,
    BadRequestResponse,
    ForbiddenResponse,
    GoneResponse,
    NotFoundResponse,
)
from app.config import settings
from app.error import (
    AppException,
    BadRequestException,
    ForbiddenException,
    GoneException,
    NotFoundException,
    validate_uuid,
)
from app.limiter import limiter
from app.logger import get_logger
from app.mail.model import Attachment, Template
from app.mail.schemas import (
    AttachmentData,
    AttachmentResponse,
    PreviewData,
    PreviewResponse,
    PreviewTemplateRequest,
    TemplateData,
    TemplateListResponse,
    TemplateResponse,
    TemplateSummary,
    UpdateTemplateRequest,
)
from app.mail.templating import (
    TemplateRenderError,
    allowed_placeholders,
    render_source,
    validate_source,
)
from app.storage import service as storage
from app.storage.schemas import DownloadUrlData, DownloadUrlResponse, UploadPurpose
from app.storage.uploads import verify_upload

logger = get_logger(__name__)

templates_router = APIRouter(prefix="/api/templates", tags=["Templates"])
attachments_router = APIRouter(prefix="/api/attachments", tags=["Attachments"])


async def _template(template_key: str) -> Template:
    template = await Template.find(template_key)
    if not template:
        raise NotFoundException("Template not found")
    return template


@templates_router.get(
    "",
    response_model=TemplateListResponse,
    summary="List email templates",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": TemplateListResponse, "description": "Templates"},
    },
)
@limiter.limit("60/minute")
async def list_templates(
    request: Request,
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Partial match on key, name or subject",
    ),
    is_active: Optional[bool] = Query(
        default=None, description="Filter by active state"
    ),
    current_user: User = Depends(get_current_user),
) -> TemplateListResponse:
    """
    List email templates.

    - **search**: optional, partial match on key, name or subject
    - **is_active**: optional, true or false
    """
    try:
        templates = await Template.search(search, is_active)
        return TemplateListResponse(
            success=True,
            message=f"Found {len(templates)} templates",
            data=[TemplateSummary(**t.to_dict(with_body=False)) for t in templates],
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List templates error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@templates_router.get(
    "/{template_key}",
    response_model=TemplateResponse,
    summary="Get one template",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": TemplateResponse, "description": "Template with body"},
        404: {"model": NotFoundResponse, "description": "Template not found"},
    },
)
@limiter.limit("60/minute")
async def get_template(
    request: Request, template_key: str, current_user: User = Depends(get_current_user)
) -> TemplateResponse:
    """
    Return one template with its body.

    - **template_key**: the template key, passed in the path
    """
    try:
        template = await _template(template_key)
        return TemplateResponse(
            success=True,
            message="Template retrieved",
            data=TemplateData(**template.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Get template error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@templates_router.patch(
    "/{template_key}",
    response_model=TemplateResponse,
    summary="Edit a template",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": TemplateResponse, "description": "Template updated"},
        400: {
            "model": BadRequestResponse,
            "description": "Unknown placeholder or template syntax error",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can edit templates",
        },
        404: {"model": NotFoundResponse, "description": "Template not found"},
    },
)
@limiter.limit("30/minute")
async def update_template(
    request: Request,
    template_key: str,
    data: UpdateTemplateRequest,
    current_user: User = Depends(require_admin),
) -> TemplateResponse:
    """
    Edit a template's wording.

    - **template_key**: the template key, passed in the path
    - **subject**: optional, new subject
    - **body_html**: optional, new HTML body
    - **is_active**: optional, true or false
    - placeholders are written like {{ candidate_name }}, unknown ones are rejected
    """
    try:
        template = await _template(template_key)
        validate_source(template_key, data.subject, data.body_html)
        await template.update(
            data.subject, data.body_html, data.is_active, current_user.user_id
        )
        await log_user_action(
            current_user.user_id,
            "template_updated",
            entity_type="template",
            details={"template_key": template_key},
        )
        return TemplateResponse(
            success=True,
            message="Template updated",
            data=TemplateData(**template.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update template error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@templates_router.post(
    "/{template_key}/preview",
    response_model=PreviewResponse,
    summary="Preview a template",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": PreviewResponse, "description": "Rendered preview"},
        400: {
            "model": BadRequestResponse,
            "description": "Template could not be rendered",
        },
        404: {"model": NotFoundResponse, "description": "Template not found"},
    },
)
@limiter.limit("60/minute")
async def preview_template(
    request: Request,
    template_key: str,
    data: PreviewTemplateRequest,
    current_user: User = Depends(get_current_user),
) -> PreviewResponse:
    """
    Render a template with the values sent, sample values fill any gaps.

    - **template_key**: the template key, passed in the path
    - **values**: optional, placeholder values
    """
    try:
        template = await _template(template_key)
        samples = {name: f"[{name}]" for name in allowed_placeholders(template_key)}
        try:
            subject, body = render_source(
                template.subject, template.body_html, {**samples, **data.values}
            )
        except TemplateRenderError as e:
            raise BadRequestException(f"Template could not be rendered: {e}")
        return PreviewResponse(
            success=True,
            message="Preview ready",
            data=PreviewData(subject=subject, body_html=body),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Preview template error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@attachments_router.get(
    "/{attachment_id}/download-url",
    response_model=DownloadUrlResponse,
    summary="Get a short lived file link",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": DownloadUrlResponse, "description": "Link ready"},
        403: {
            "model": ForbiddenResponse,
            "description": "Appointment letters and transcripts need more access",
        },
        404: {"model": NotFoundResponse, "description": "Attachment not found"},
        410: {
            "model": GoneResponse,
            "description": "File was deleted by the salary guard",
        },
        502: {
            "model": BadGatewayResponse,
            "description": "File storage is unavailable",
        },
    },
)
@limiter.limit("60/minute")
async def attachment_download_url(
    request: Request, attachment_id: str, current_user: User = Depends(get_current_user)
) -> DownloadUrlResponse:
    """
    Give a short lived link to view one stored file, every call is logged.

    - **attachment_id**: the attachment UUID, passed in the path
    - appointment letters need an HR admin, transcripts need restricted area access
    """
    try:
        validate_uuid((attachment_id, "attachment_id"))
        attachment = await Attachment.find_by_id(uuid.UUID(attachment_id))
        if not attachment:
            raise NotFoundException("Attachment not found")
        if attachment.kind == "appointment_letter" and not current_user.is_admin:
            raise ForbiddenException("Only HR admins can open appointment letters")
        if attachment.kind == "transcript" and not current_user.complaints_access:
            raise ForbiddenException("This file is in the restricted area")
        if not attachment.storage_key:
            raise GoneException(
                "This file was removed because it contained salary data"
            )
        url = await storage.presigned_get(attachment.storage_key, attachment.file_name)
        await log_user_action(
            current_user.user_id,
            "file_link_created",
            case_id=attachment.case_id,
            entity_type="attachment",
            entity_id=attachment.attachment_id,
        )
        return DownloadUrlResponse(
            success=True,
            message="Download link ready",
            data=DownloadUrlData(
                url=url, expires_in=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Attachment link error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


sou_router = APIRouter(prefix="/api/admin", tags=["Admin"])


@sou_router.post(
    "/statement-of-understanding",
    response_model=AttachmentResponse,
    summary="Set the Statement of Understanding PDF",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": AttachmentResponse, "description": "File saved"},
        400: {"model": BadRequestResponse, "description": "Not a PDF or not uploaded"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can change it",
        },
    },
)
@limiter.limit("20/minute")
async def set_statement_of_understanding(
    request: Request, data: FileAttachment, current_user: User = Depends(require_admin)
) -> AttachmentResponse:
    """
    Set the fixed Statement of Understanding PDF attached to every welcome email.

    - body is a FileAttachment from POST /api/uploads/presign with purpose statement_of_understanding
    - a new upload replaces the old one
    """
    try:
        size = await verify_upload(data, UploadPurpose.STATEMENT_OF_UNDERSTANDING)
        attachment = await Attachment.create(
            file_name=data.file_name,
            mime_type=data.mime_type,
            size_bytes=size,
            storage_key=data.file_url,
            sha256=None,
            kind="statement_of_understanding",
            check_status="skipped",
            uploaded_by=current_user.user_id,
        )
        await Attachment.supersede(
            "statement_of_understanding", None, attachment.attachment_id
        )
        await log_user_action(
            current_user.user_id,
            "statement_of_understanding_set",
            entity_type="attachment",
            entity_id=attachment.attachment_id,
        )
        return AttachmentResponse(
            success=True,
            message="File saved",
            data=AttachmentData(**attachment.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Statement of understanding error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
