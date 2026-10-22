import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.model import User
from app.auth.service import require_complaints_access
from app.common.enums import SortOrder
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadRequestResponse,
    ForbiddenResponse,
    NotFoundResponse,
)
from app.error import AppException, validate_uuid
from app.limiter import limiter
from app.logger import get_logger
from app.mail.schemas import AttachmentData
from app.workflows.complaints import service
from app.workflows.complaints.schemas import (
    ComplaintDetail,
    ComplaintDetailResponse,
    ComplaintListItem,
    ComplaintListResponse,
    ComplaintPerson,
    ComplaintSource,
    UploadTranscriptData,
    UploadTranscriptRequest,
    UploadTranscriptResponse,
)

logger = get_logger(__name__)

complaints_router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

RESTRICTED = {
    403: {"model": ForbiddenResponse, "description": "Restricted area access is needed"}
}


@complaints_router.get(
    "",
    response_model=ComplaintListResponse,
    summary="List restricted items",
    responses={
        **COMMON_ERROR_RESPONSES,
        **RESTRICTED,
        200: {"model": ComplaintListResponse, "description": "Restricted items"},
    },
)
@limiter.limit("60/minute")
async def list_complaints(
    request: Request,
    search: Optional[str] = Query(
        default=None, max_length=100, description="Partial match on sender or subject"
    ),
    source: Optional[ComplaintSource] = Query(
        default=None, description="Filter by source"
    ),
    date_from: Optional[datetime] = Query(
        default=None, description="Received on or after"
    ),
    date_to: Optional[datetime] = Query(
        default=None, description="Received on or before"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="Sort direction"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(require_complaints_access),
) -> ComplaintListResponse:
    """
    List complaints and uploaded transcripts in the restricted area.

    - **search**: optional, partial match on sender or subject
    - **source**: optional, email, exit_interview or hr_connect
    - **date_from**, **date_to**: optional time range
    - **sort_order**: latest, oldest, a_to_z or z_to_a, a_to_z sorts by subject
    - needs restricted area access
    """
    try:
        page, total = await service.list_items(
            search,
            source.value if source else None,
            date_from,
            date_to,
            sort_order,
            limit,
            offset,
        )
        data = [
            ComplaintListItem(
                complaint_id=str(complaint.complaint_id),
                received_at=complaint.received_at.isoformat(),
                source=complaint.source,
                sender_email=complaint.sender_email,
                person_name=person.full_name if person else None,
                subject=complaint.subject,
            )
            for complaint, person in page
        ]
        return ComplaintListResponse(
            success=True,
            message=f"Found {total} items",
            data=data,
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List complaints error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@complaints_router.get(
    "/{complaint_id}",
    response_model=ComplaintDetailResponse,
    summary="Open one restricted item",
    responses={
        **COMMON_ERROR_RESPONSES,
        **RESTRICTED,
        200: {"model": ComplaintDetailResponse, "description": "Full item"},
        404: {"model": NotFoundResponse, "description": "Item not found"},
    },
)
@limiter.limit("60/minute")
async def get_complaint(
    request: Request,
    complaint_id: str,
    current_user: User = Depends(require_complaints_access),
) -> ComplaintDetailResponse:
    """
    Show one restricted item in full, every view is written to the action log.

    - **complaint_id**: the item UUID, passed in the path
    """
    try:
        validate_uuid((complaint_id, "complaint_id"))
        complaint, person, attachment = await service.reveal(
            uuid.UUID(complaint_id), current_user
        )
        return ComplaintDetailResponse(
            success=True,
            message="Item retrieved",
            data=ComplaintDetail(
                complaint_id=str(complaint.complaint_id),
                received_at=complaint.received_at.isoformat(),
                source=complaint.source,
                sender_email=complaint.sender_email,
                person=ComplaintPerson(
                    person_id=str(person.person_id),
                    full_name=person.full_name,
                    employee_code=person.employee_code,
                )
                if person
                else None,
                subject=complaint.subject,
                content=complaint.content,
                attachment=AttachmentData(**attachment.to_dict())
                if attachment
                else None,
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Get complaint error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@complaints_router.post(
    "/uploads",
    response_model=UploadTranscriptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Store an exit interview or HR Connect transcript",
    responses={
        **COMMON_ERROR_RESPONSES,
        **RESTRICTED,
        201: {"model": UploadTranscriptResponse, "description": "Transcript stored"},
        400: {
            "model": BadRequestResponse,
            "description": "Wrong file type or file not uploaded",
        },
        404: {"model": NotFoundResponse, "description": "Person not found"},
    },
)
@limiter.limit("20/minute")
async def upload_transcript(
    request: Request,
    data: UploadTranscriptRequest,
    current_user: User = Depends(require_complaints_access),
) -> UploadTranscriptResponse:
    """
    Store an exit interview or HR Connect transcript for the later sentiment module.

    - **source**: required, exit_interview or hr_connect
    - **person_id**: optional, the employee it is about
    - **file**: required, a FileAttachment from POST /api/uploads/presign with purpose transcript
    """
    try:
        if data.person_id:
            validate_uuid((data.person_id, "person_id"))
        complaint = await service.upload(data, current_user)
        return UploadTranscriptResponse(
            success=True,
            message="Transcript stored",
            data=UploadTranscriptData(
                complaint_id=str(complaint.complaint_id),
                source=data.source,
                received_at=complaint.received_at.isoformat(),
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Upload transcript error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
