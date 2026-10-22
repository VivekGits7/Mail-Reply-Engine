from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


def _error_example(
    status_code: int, status_message: str, message: str, code: str
) -> dict:
    return {
        "example": {
            "success": False,
            "error": {
                "status_code": status_code,
                "status_message": status_message,
                "message": message,
                "code": code,
            },
        }
    }


class BaseResponse(BaseModel):
    success: bool = Field(
        default=True, description="Whether the request succeeded", examples=[True]
    )
    message: str = Field(
        ..., description="Result message", examples=["Request completed successfully"]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"success": True, "message": "Request completed successfully"}
        }
    )


class ErrorDetail(BaseModel):
    field: str = Field(
        ...,
        description="Dot separated path to the invalid field",
        examples=["body.personal_email"],
    )
    message: str = Field(
        ...,
        description="Validation error message",
        examples=["value is not a valid email address"],
    )
    type: str = Field(
        ..., description="Machine readable error type", examples=["value_error"]
    )


class ErrorBody(BaseModel):
    status_code: int = Field(..., description="HTTP status code", examples=[400])
    status_message: str = Field(
        ..., description="HTTP status text", examples=["BAD REQUEST"]
    )
    message: str = Field(
        ...,
        description="User friendly error message",
        examples=["Invalid request. Please check your input."],
    )
    code: Optional[str] = Field(
        default=None,
        description="Machine readable error code",
        examples=["BAD_REQUEST"],
    )
    details: Optional[List[ErrorDetail]] = Field(
        default=None, description="Per field errors on 422 responses"
    )


class ErrorResponse(BaseModel):
    success: bool = Field(
        default=False, description="Always false for error responses", examples=[False]
    )
    error: ErrorBody = Field(..., description="Error details")


class BadRequestResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            400,
            "BAD REQUEST",
            "Invalid request. Please check your input.",
            "BAD_REQUEST",
        )
    )


class UnauthorizedResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            401, "UNAUTHORIZED", "Please log in to continue.", "UNAUTHORIZED"
        )
    )


class ForbiddenResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            403,
            "FORBIDDEN",
            "You don't have permission to access this resource.",
            "FORBIDDEN",
        )
    )


class NotFoundResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            404, "NOT FOUND", "The requested resource was not found.", "NOT_FOUND"
        )
    )


class ConflictResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            409, "CONFLICT", "This resource already exists.", "CONFLICT"
        )
    )


class ValidationErrorResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": False,
                "error": {
                    "status_code": 422,
                    "status_message": "UNPROCESSABLE ENTITY",
                    "message": "Please check your input and try again.",
                    "code": "VALIDATION_ERROR",
                    "details": [
                        {
                            "field": "body.personal_email",
                            "message": "value is not a valid email address",
                            "type": "value_error",
                        }
                    ],
                },
            }
        }
    )


class RateLimitResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            429,
            "TOO MANY REQUESTS",
            "Rate limit exceeded. Please try again later.",
            "RATE_LIMITED",
        )
    )


class InternalServerErrorResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            500,
            "INTERNAL SERVER ERROR",
            "Something went wrong. Please try again later.",
            "INTERNAL_ERROR",
        )
    )


class GoneResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            410,
            "GONE",
            "This file was removed because it contained salary data.",
            "GONE",
        )
    )


class BadGatewayResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            502,
            "BAD GATEWAY",
            "The mailbox service is unavailable right now. Please try again shortly.",
            "GRAPH_ERROR",
        )
    )


class ServiceUnavailableResponse(ErrorResponse):
    model_config = ConfigDict(
        json_schema_extra=_error_example(
            503,
            "SERVICE UNAVAILABLE",
            "Service temporarily unavailable. Please try again later.",
            "SERVICE_UNAVAILABLE",
        )
    )


PUBLIC_ERROR_RESPONSES = {
    422: {
        "model": ValidationErrorResponse,
        "description": "Request failed schema validation",
    },
    429: {
        "model": RateLimitResponse,
        "description": "Rate limit exceeded for this endpoint",
    },
    500: {
        "model": InternalServerErrorResponse,
        "description": "Unexpected server error",
    },
}

COMMON_ERROR_RESPONSES = {
    401: {
        "model": UnauthorizedResponse,
        "description": "Authentication required or token invalid or expired",
    },
    **PUBLIC_ERROR_RESPONSES,
}


class PaginatedResponse(BaseResponse):
    total: int = Field(
        ..., description="Total items matching the filters", examples=[42]
    )
    limit: int = Field(..., description="Items per page", examples=[50])
    offset: int = Field(..., description="Items skipped", examples=[0])


class EmptyResponse(BaseResponse):
    data: None = Field(default=None, description="Always null for this endpoint")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"success": True, "message": "Done", "data": None}
        }
    )


class RootData(BaseModel):
    app_name: str = Field(
        ..., description="Application name", examples=["Mail Reply Engine"]
    )
    version: str = Field(..., description="Application version", examples=["2.0.0"])


class RootResponse(BaseResponse):
    data: RootData = Field(..., description="Application info")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "API is running",
                "data": {"app_name": "Mail Reply Engine", "version": "2.0.0"},
            }
        }
    )


class HealthData(BaseModel):
    database: str = Field(
        ..., description="Database connectivity", examples=["connected"]
    )
    redis: str = Field(
        ...,
        description="Broker connectivity, or inline when events run in process",
        examples=["connected"],
    )
    worker: str = Field(
        ..., description="Worker state as seen from the queue", examples=["online"]
    )
    mailbox_subscription: str = Field(
        ..., description="Graph subscription state", examples=["active"]
    )
    kill_switch: bool = Field(
        ..., description="Whether all sending is stopped", examples=[False]
    )
    dry_run: bool = Field(
        ..., description="Whether every email goes to the test inbox", examples=[True]
    )


class HealthCheckResponse(BaseResponse):
    data: HealthData = Field(..., description="Health details")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Service is healthy",
                "data": {
                    "database": "connected",
                    "redis": "connected",
                    "worker": "online",
                    "mailbox_subscription": "active",
                    "kill_switch": False,
                    "dry_run": True,
                },
            }
        }
    )
