from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.auth.enums import UserRole
from app.common.schemas import BaseResponse, PaginatedResponse

USER_EXAMPLE: dict[str, Any] = {
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "TCG Admin",
    "email": "tcg@tcgdigital.com",
    "role": "hr_admin",
    "complaints_access": False,
    "is_active": True,
    "last_login_at": "2026-10-21T09:12:00+05:30",
}


class UserData(BaseModel):
    user_id: str = Field(
        ..., description="Admin UUID", examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
    )
    name: str = Field(..., description="Display name", examples=["TCG Admin"])
    email: str = Field(..., description="Login email", examples=["tcg@tcgdigital.com"])
    role: UserRole = Field(..., description="Dashboard role", examples=["hr_admin"])
    complaints_access: bool = Field(
        ...,
        description="Whether the admin can open the restricted area",
        examples=[False],
    )
    is_active: bool = Field(
        ..., description="Whether the account can log in", examples=[True]
    )
    last_login_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 time of the last login",
        examples=["2026-10-21T09:12:00+05:30"],
    )


class LoginResponse(BaseResponse):
    access_token: str = Field(
        ...,
        description="JWT bearer token",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
    )
    token_type: str = Field(
        default="bearer",
        description="Token type for the Authorization header",
        examples=["bearer"],
    )
    expires_in: int = Field(
        ..., description="Token lifetime in seconds", examples=[86400]
    )
    user: UserData = Field(..., description="Logged in admin")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Login successful",
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in": 86400,
                "user": USER_EXAMPLE,
            }
        }
    )


class UserResponse(BaseResponse):
    data: UserData = Field(..., description="Admin profile")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Admin retrieved",
                "data": USER_EXAMPLE,
            }
        }
    )


class UserListResponse(PaginatedResponse):
    data: List[UserData] = Field(..., description="Admins on this page")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "Found 1 admin",
                "data": [USER_EXAMPLE],
                "total": 1,
                "limit": 50,
                "offset": 0,
            }
        }
    )


class CreateUserRequest(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Display name",
        examples=["TCG Admin"],
    )
    email: EmailStr = Field(
        ..., description="Login email, must be unique", examples=["tcg@tcgdigital.com"]
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Initial password, at least 8 characters",
        examples=["Str0ngPass!"],
    )
    role: UserRole = Field(
        default=UserRole.HR_VIEWER, description="Dashboard role", examples=["hr_viewer"]
    )
    complaints_access: bool = Field(
        default=False,
        description="Whether the admin can open the restricted area",
        examples=[False],
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters")
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "TCG Admin",
                "email": "tcg@tcgdigital.com",
                "password": "Str0ngPass!",
                "role": "hr_viewer",
                "complaints_access": False,
            }
        }
    )


class UpdateUserRequest(BaseModel):
    role: Optional[UserRole] = Field(
        default=None, description="New dashboard role", examples=["hr_admin"]
    )
    complaints_access: Optional[bool] = Field(
        default=None,
        description="Grant or remove restricted area access",
        examples=[True],
    )
    is_active: Optional[bool] = Field(
        default=None, description="Turn the account on or off", examples=[True]
    )
    password: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=128,
        description="New password",
        examples=["N3wPassword!"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "role": "hr_admin",
                "complaints_access": True,
                "is_active": True,
                "password": None,
            }
        }
    )
