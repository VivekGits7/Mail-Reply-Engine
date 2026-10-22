import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.model import User
from app.auth.service import get_current_user, require_admin
from app.common.enums import HireCategory, SortOrder
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadRequestResponse,
    ConflictResponse,
    ForbiddenResponse,
    NotFoundResponse,
)
from app.config import settings
from app.error import AppException, validate_uuid
from app.limiter import limiter
from app.logger import get_logger
from app.storage.schemas import DownloadUrlData, DownloadUrlResponse
from app.workflows.feedback import service
from app.workflows.feedback.schemas import (
    CreateReportData,
    CreateReportRequest,
    CreateReportResponse,
    ReportItem,
    ReportListResponse,
    ReportStatus,
    SurveyItem,
    SurveyListResponse,
    SurveySortBy,
    SurveyStatus,
    UploadResponsesData,
    UploadResponsesRequest,
    UploadResponsesResponse,
)

logger = get_logger(__name__)

feedback_router = APIRouter(prefix="/api/feedback", tags=["Feedback"])


@feedback_router.get(
    "/surveys",
    response_model=SurveyListResponse,
    summary="List 30-60-90 surveys",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": SurveyListResponse, "description": "Surveys"},
    },
)
@limiter.limit("60/minute")
async def list_surveys(
    request: Request,
    search: Optional[str] = Query(
        default=None, max_length=100, description="Partial match on name"
    ),
    milestone: Optional[int] = Query(default=None, description="30, 60 or 90"),
    status_filter: Optional[SurveyStatus] = Query(
        default=None, alias="status", description="sent, responded or no_response"
    ),
    flagged: Optional[bool] = Query(default=None, description="Only low scores"),
    form_variant: Optional[HireCategory] = Query(
        default=None, description="campus or lateral form"
    ),
    sort_by: SurveySortBy = Query(
        default=SurveySortBy.SENT_AT, description="Column to sort on"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="Sort direction"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(get_current_user),
) -> SurveyListResponse:
    """
    List 30-60-90 surveys with their response status.

    - **search**: optional, partial match on name
    - **milestone**: optional, 30, 60 or 90
    - **status**: optional, sent, responded or no_response
    - **flagged**: optional, true for low scores
    - **form_variant**: optional, campus or lateral
    - **sort_by**: sent_at, score or full_name, defaults to sent_at
    """
    try:
        items, total = await service.list_surveys(
            search,
            milestone,
            status_filter,
            flagged,
            form_variant,
            sort_by,
            sort_order,
            limit,
            offset,
        )
        return SurveyListResponse(
            success=True,
            message=f"Found {total} surveys",
            data=[SurveyItem(**i) for i in items],
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List surveys error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@feedback_router.post(
    "/responses/upload",
    response_model=UploadResponsesResponse,
    summary="Import a Forms export",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": UploadResponsesResponse, "description": "Responses imported"},
        400: {
            "model": BadRequestResponse,
            "description": "Wrong file type or not uploaded",
        },
        403: {"model": ForbiddenResponse, "description": "Only HR admins can import"},
    },
)
@limiter.limit("20/minute")
async def upload_responses(
    request: Request,
    data: UploadResponsesRequest,
    current_user: User = Depends(require_admin),
) -> UploadResponsesResponse:
    """
    Fallback that reads survey responses from a Microsoft Forms export.

    - **form_variant**: required, campus or lateral
    - **file**: required, an XLSX FileAttachment from POST /api/uploads/presign with purpose survey_export
    - rows are matched to sent surveys by the email column, low scores alert the HR owner
    """
    try:
        counts = await service.import_upload(data.form_variant, data.file, current_user)
        return UploadResponsesResponse(
            success=True,
            message="Responses imported",
            data=UploadResponsesData(**counts),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Import responses error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@feedback_router.get(
    "/reports",
    response_model=ReportListResponse,
    summary="List feedback reports",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": ReportListResponse, "description": "Reports"},
    },
)
@limiter.limit("60/minute")
async def list_reports(
    request: Request,
    status_filter: Optional[ReportStatus] = Query(
        default=None, alias="status", description="queued, ready, sent or failed"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="latest or oldest by period"
    ),
    current_user: User = Depends(get_current_user),
) -> ReportListResponse:
    """
    List generated feedback reports.

    - **status**: optional, queued, ready, sent or failed
    - **sort_order**: latest or oldest by period start
    """
    try:
        reports = await service.FeedbackReport.all(
            status_filter.value if status_filter else None,
            sort_order != SortOrder.OLDEST,
        )
        return ReportListResponse(
            success=True,
            message=f"Found {len(reports)} reports",
            data=[ReportItem(**r.to_dict()) for r in reports],
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List reports error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@feedback_router.post(
    "/reports",
    response_model=CreateReportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate a report now",
    responses={
        **COMMON_ERROR_RESPONSES,
        202: {"model": CreateReportResponse, "description": "Report queued"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can generate reports",
        },
        409: {
            "model": ConflictResponse,
            "description": "A report for this period already exists",
        },
    },
)
@limiter.limit("10/minute")
async def create_report(
    request: Request,
    data: CreateReportRequest,
    current_user: User = Depends(require_admin),
) -> CreateReportResponse:
    """
    Generate a feedback report for any period and email it to the HR owner.

    - **period_start**, **period_end**: required dates, end on or after start
    - answers are masked before the AI writes the summary, the PDF is stored and emailed
    """
    try:
        report = await service.request_report(
            data.period_start, data.period_end, current_user
        )
        fresh = await service.FeedbackReport.find_by_id(report.feedback_report_id)
        return CreateReportResponse(
            success=True,
            message="Report queued",
            data=CreateReportData(
                feedback_report_id=str(fresh.feedback_report_id), status=fresh.status
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Create report error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@feedback_router.get(
    "/reports/{feedback_report_id}/download-url",
    response_model=DownloadUrlResponse,
    summary="Get a link to the report PDF",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": DownloadUrlResponse, "description": "Link ready"},
        404: {"model": NotFoundResponse, "description": "Report not found"},
        409: {"model": ConflictResponse, "description": "Report not ready yet"},
    },
)
@limiter.limit("60/minute")
async def report_link(
    request: Request,
    feedback_report_id: str,
    current_user: User = Depends(get_current_user),
) -> DownloadUrlResponse:
    """
    Give a short lived link to a report PDF.

    - **feedback_report_id**: the report UUID, passed in the path
    """
    try:
        validate_uuid((feedback_report_id, "feedback_report_id"))
        _, url = await service.report_link(uuid.UUID(feedback_report_id))
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
        logger.error(f"Report link error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
