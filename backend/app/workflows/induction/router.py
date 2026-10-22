import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth.model import User
from app.auth.service import require_admin
from app.cases import Case
from app.common.attachment import FileAttachment
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    BadGatewayResponse,
    BadRequestResponse,
    ConflictResponse,
    ForbiddenResponse,
    NotFoundResponse,
)
from app.error import AppException, validate_uuid
from app.limiter import limiter
from app.logger import get_logger
from app.mail.schemas import AttachmentData
from app.workflows.induction import service
from app.workflows.induction.schemas import (
    AppointmentLetterResponse,
    BookSessionRequest,
    InductionSessionData,
    PlanInductionData,
    PlanInductionRequest,
    PlanInductionResponse,
    SessionResponse,
)

logger = get_logger(__name__)

induction_router = APIRouter(prefix="/api/cases", tags=["Induction"])
sessions_router = APIRouter(prefix="/api/induction-sessions", tags=["Induction"])


@induction_router.post(
    "/{case_id}/induction",
    response_model=PlanInductionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Plan induction",
    responses={
        **COMMON_ERROR_RESPONSES,
        202: {
            "model": PlanInductionResponse,
            "description": "Induction draft is being prepared",
        },
        400: {"model": BadRequestResponse, "description": "No joining date yet"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can plan induction",
        },
        404: {"model": NotFoundResponse, "description": "Onboarding case not found"},
        409: {"model": ConflictResponse, "description": "Induction already planned"},
    },
)
@limiter.limit("30/minute")
async def plan_induction(
    request: Request,
    case_id: str,
    data: PlanInductionRequest,
    current_user: User = Depends(require_admin),
) -> PlanInductionResponse:
    """
    HR's Plan induction on an onboarding case, opens an induction case and queues the AI draft for the approval queue.

    - **case_id**: the onboarding case UUID, passed in the path
    - **track**: optional, campus, mid or senior, overrides the auto-picked track
    - the draft skips weekends and holidays and shows up in the approval queue
    """
    try:
        validate_uuid((case_id, "case_id"))
        case = await service.plan(uuid.UUID(case_id), current_user, data.track)
        return PlanInductionResponse(
            success=True,
            message="Induction draft is being prepared",
            data=PlanInductionData(
                induction_case_id=str(case.case_id),
                stage=(await Case.find_by_id(case.case_id)).stage,
                track=case.track,
            ),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Plan induction error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@induction_router.post(
    "/{case_id}/appointment-letter",
    response_model=AppointmentLetterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach the appointment letter",
    responses={
        **COMMON_ERROR_RESPONSES,
        201: {
            "model": AppointmentLetterResponse,
            "description": "Appointment letter attached",
        },
        400: {"model": BadRequestResponse, "description": "Not a PDF or not uploaded"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can attach letters",
        },
        404: {"model": NotFoundResponse, "description": "Case not found"},
    },
)
@limiter.limit("20/minute")
async def attach_letter(
    request: Request,
    case_id: str,
    data: FileAttachment,
    current_user: User = Depends(require_admin),
) -> AppointmentLetterResponse:
    """
    Attach the appointment letter HR uploaded, it only rides along on the welcome email and is never opened.

    - **case_id**: the joiner's onboarding or induction case UUID, passed in the path
    - body is a FileAttachment from POST /api/uploads/presign with purpose appointment_letter
    - a new upload replaces the old one
    """
    try:
        validate_uuid((case_id, "case_id"))
        attachment = await service.upload_letter(uuid.UUID(case_id), data, current_user)
        return AppointmentLetterResponse(
            success=True,
            message="Appointment letter attached",
            data=AttachmentData(**attachment.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Attach letter error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@sessions_router.post(
    "/{induction_session_id}/book",
    response_model=SessionResponse,
    summary="Book a session by hand",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": SessionResponse, "description": "Session booked"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can book"},
        404: {"model": NotFoundResponse, "description": "Session not found"},
        409: {
            "model": ConflictResponse,
            "description": "Owner is busy, or sending is stopped",
        },
        502: {"model": BadGatewayResponse, "description": "Graph failed"},
    },
)
@limiter.limit("30/minute")
async def book_session(
    request: Request,
    induction_session_id: str,
    data: BookSessionRequest,
    current_user: User = Depends(require_admin),
) -> SessionResponse:
    """
    HR books a flagged session by hand after a no reply or a calendar conflict.

    - **induction_session_id**: the session UUID, passed in the path
    - **start**, **end**: required, ISO 8601 with a timezone offset
    - **force**: optional, books even if the owner looks busy
    - the invite goes to the owner and the joiner, or the test inbox in dry-run
    """
    try:
        validate_uuid((induction_session_id, "induction_session_id"))
        session = await service.book_manual(
            uuid.UUID(induction_session_id),
            data.start,
            data.end,
            data.force,
            current_user,
        )
        return SessionResponse(
            success=True,
            message="Session booked",
            data=InductionSessionData(**session.to_dict()),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Book session error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
