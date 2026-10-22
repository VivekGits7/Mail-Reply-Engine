import uuid
from typing import Awaitable, Callable, List, Optional

import asyncpg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException

from app.logger import get_logger

logger = get_logger(__name__)


class AppException(Exception):
    def __init__(
        self,
        status_code: int = 500,
        detail: str = "Internal server error",
        error_code: Optional[str] = None,
        headers: Optional[dict] = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.headers = headers
        super().__init__(self.detail)


class BadRequestException(AppException):
    def __init__(self, detail: str = "Bad request", error_code: str = "BAD_REQUEST"):
        super().__init__(status_code=400, detail=detail, error_code=error_code)


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Unauthorized", error_code: str = "UNAUTHORIZED"):
        super().__init__(
            status_code=401,
            detail=detail,
            error_code=error_code,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Forbidden", error_code: str = "FORBIDDEN"):
        super().__init__(status_code=403, detail=detail, error_code=error_code)


class NotFoundException(AppException):
    def __init__(
        self, detail: str = "Resource not found", error_code: str = "NOT_FOUND"
    ):
        super().__init__(status_code=404, detail=detail, error_code=error_code)


class ConflictException(AppException):
    def __init__(
        self, detail: str = "Resource already exists", error_code: str = "CONFLICT"
    ):
        super().__init__(status_code=409, detail=detail, error_code=error_code)


class ValidationException(AppException):
    def __init__(
        self, detail: str = "Validation failed", error_code: str = "VALIDATION_ERROR"
    ):
        super().__init__(status_code=422, detail=detail, error_code=error_code)


class DatabaseException(AppException):
    def __init__(
        self, detail: str = "Database error", error_code: str = "DATABASE_ERROR"
    ):
        super().__init__(status_code=500, detail=detail, error_code=error_code)


class ExternalServiceException(AppException):
    def __init__(
        self,
        detail: str = "External service error",
        error_code: str = "EXTERNAL_SERVICE_ERROR",
    ):
        super().__init__(status_code=502, detail=detail, error_code=error_code)


class ServiceUnavailableException(AppException):
    def __init__(
        self,
        detail: str = "Service unavailable",
        error_code: str = "SERVICE_UNAVAILABLE",
    ):
        super().__init__(status_code=503, detail=detail, error_code=error_code)


class GoneException(AppException):
    def __init__(
        self, detail: str = "Resource is no longer available", error_code: str = "GONE"
    ):
        super().__init__(status_code=410, detail=detail, error_code=error_code)


class GraphException(AppException):
    def __init__(
        self,
        detail: str = "Microsoft Graph request failed",
        error_code: str = "GRAPH_ERROR",
    ):
        super().__init__(status_code=502, detail=detail, error_code=error_code)


class MailSendException(AppException):
    def __init__(
        self,
        detail: str = "The SMTP server did not accept the email",
        error_code: str = "MAIL_SEND_ERROR",
    ):
        super().__init__(status_code=502, detail=detail, error_code=error_code)


class StorageException(AppException):
    def __init__(
        self,
        detail: str = "File storage request failed",
        error_code: str = "STORAGE_ERROR",
    ):
        super().__init__(status_code=502, detail=detail, error_code=error_code)


class AIServiceException(AppException):
    def __init__(
        self, detail: str = "AI request failed", error_code: str = "AI_SERVICE_ERROR"
    ):
        super().__init__(status_code=502, detail=detail, error_code=error_code)


def validate_uuid(*values: tuple[str, str]) -> None:
    for value, param_name in values:
        try:
            uuid.UUID(value)
        except (ValueError, AttributeError, TypeError):
            raise BadRequestException(
                f"Invalid {param_name} format. Expected a valid UUID."
            ) from None


USER_FRIENDLY_MESSAGES = {
    "AI_SERVICE_ERROR": "The AI assistant is unavailable right now. Please try again shortly.",
    "GRAPH_ERROR": "The mailbox service is unavailable right now. Please try again shortly.",
    "MAIL_SEND_ERROR": "The email could not be sent right now. Please try again shortly.",
    "STORAGE_ERROR": "File storage is unavailable right now. Please try again shortly.",
    "EXTERNAL_SERVICE_ERROR": "Service temporarily unavailable. Please try again later.",
    "DATABASE_ERROR": "Something went wrong. Please try again later.",
    "CONFLICT": "This resource already exists.",
    "INTERNAL_ERROR": "Something went wrong. Please try again later.",
    "UNAUTHORIZED": "Please log in to continue.",
    "FORBIDDEN": "You don't have permission to access this resource.",
    "NOT_FOUND": "The requested resource was not found.",
    "BAD_REQUEST": "Invalid request. Please check your input.",
    "RATE_LIMITED": "Rate limit exceeded. Please try again later.",
}


def get_user_friendly_message(error: Exception) -> str:
    if isinstance(error, AppException) and error.error_code:
        return USER_FRIENDLY_MESSAGES.get(error.error_code, error.detail)
    error_str = str(error).lower()
    if "openai" in error_str:
        return USER_FRIENDLY_MESSAGES["AI_SERVICE_ERROR"]
    if "graph" in error_str:
        return USER_FRIENDLY_MESSAGES["GRAPH_ERROR"]
    if "database" in error_str or "postgres" in error_str:
        return USER_FRIENDLY_MESSAGES["DATABASE_ERROR"]
    if "timeout" in error_str:
        return "Request timed out. Please try again later."
    return USER_FRIENDLY_MESSAGES["INTERNAL_ERROR"]


HTTP_STATUS_MESSAGES = {
    400: "BAD REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT FOUND",
    405: "METHOD NOT ALLOWED",
    409: "CONFLICT",
    410: "GONE",
    422: "UNPROCESSABLE ENTITY",
    429: "TOO MANY REQUESTS",
    500: "INTERNAL SERVER ERROR",
    502: "BAD GATEWAY",
    503: "SERVICE UNAVAILABLE",
}


def create_error_response(
    status_code: int,
    detail: str,
    error_code: Optional[str] = None,
    errors: Optional[List[dict]] = None,
) -> dict:
    response = {
        "success": False,
        "error": {
            "status_code": status_code,
            "status_message": HTTP_STATUS_MESSAGES.get(status_code, "ERROR"),
            "message": detail,
        },
    }
    if error_code:
        response["error"]["code"] = error_code
    if errors:
        response["error"]["details"] = errors
    return response


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    log = logger.error if exc.status_code >= 500 else logger.warning
    log(f"AppException: {exc.detail} | Path: {request.url.path}")
    message = exc.detail if exc.status_code < 500 else get_user_friendly_message(exc)
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(exc.status_code, message, exc.error_code),
        headers=exc.headers,
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    log = logger.error if exc.status_code >= 500 else logger.warning
    log(f"HTTPException: {exc.detail} | Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(exc.status_code, str(exc.detail)),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError | ValidationError
) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(loc) for loc in e["loc"]),
            "message": e["msg"],
            "type": e["type"],
        }
        for e in exc.errors()
    ]
    logger.warning(f"Validation error | Path: {request.url.path}")
    return JSONResponse(
        status_code=422,
        content=create_error_response(
            422, "Please check your input and try again.", "VALIDATION_ERROR", errors
        ),
    )


async def asyncpg_exception_handler(
    request: Request, exc: asyncpg.PostgresError
) -> JSONResponse:
    logger.error(f"Database error | Path: {request.url.path} | Error: {exc}")
    if isinstance(exc, asyncpg.UniqueViolationError):
        return JSONResponse(
            status_code=409,
            content=create_error_response(
                409, USER_FRIENDLY_MESSAGES["CONFLICT"], "CONFLICT"
            ),
        )
    if isinstance(exc, asyncpg.ForeignKeyViolationError):
        return JSONResponse(
            status_code=400,
            content=create_error_response(
                400, "Related resource not found.", "FOREIGN_KEY_ERROR"
            ),
        )
    return JSONResponse(
        status_code=500,
        content=create_error_response(
            500, USER_FRIENDLY_MESSAGES["DATABASE_ERROR"], "DATABASE_ERROR"
        ),
    )


async def rate_limit_exception_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    logger.warning(
        f"Rate limit exceeded | Path: {request.url.path} | Limit: {exc.detail}"
    )
    return JSONResponse(
        status_code=429,
        content=create_error_response(
            429, USER_FRIENDLY_MESSAGES["RATE_LIMITED"], "RATE_LIMITED"
        ),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        f"Unhandled exception | Path: {request.url.path} | Error: {exc}", exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content=create_error_response(
            500, USER_FRIENDLY_MESSAGES["INTERNAL_ERROR"], "INTERNAL_ERROR"
        ),
    )


def setup_error_handlers(app: FastAPI) -> None:
    handlers: List[tuple[type[Exception], Callable[..., Awaitable[JSONResponse]]]] = [
        (AppException, app_exception_handler),
        (HTTPException, http_exception_handler),
        (RequestValidationError, validation_exception_handler),
        (ValidationError, validation_exception_handler),
        (asyncpg.PostgresError, asyncpg_exception_handler),
        (RateLimitExceeded, rate_limit_exception_handler),
        (Exception, generic_exception_handler),
    ]
    for exception_class, handler in handlers:
        app.add_exception_handler(exception_class, handler)
    logger.info("Error handlers registered")
