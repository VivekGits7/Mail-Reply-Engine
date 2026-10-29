from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.audit import log_user_action
from app.auth.enums import UserRole, UserSortBy
from app.auth.model import User
from app.auth.schemas import (
    CreateUserRequest,
    LoginResponse,
    UpdateMyPhotoRequest,
    UpdateUserRequest,
    UserData,
    UserListResponse,
    UserResponse,
)
from app.auth.service import (
    authenticate,
    create_access_token,
    get_current_user,
    hash_password,
    oauth2_scheme,
    require_admin,
    revoke_token,
)
from app.common.enums import SortOrder
from app.common.schemas import (
    COMMON_ERROR_RESPONSES,
    PUBLIC_ERROR_RESPONSES,
    BadRequestResponse,
    ConflictResponse,
    EmptyResponse,
    ForbiddenResponse,
    NotFoundResponse,
    UnauthorizedResponse,
)
from app.error import (
    AppException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
    validate_uuid,
)
from app.limiter import limiter
from app.logger import get_logger
from app.storage.schemas import UploadPurpose
from app.storage.service import photo_url
from app.storage.uploads import replace_photo, verify_upload

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])
users_router = APIRouter(prefix="/api/users", tags=["Users"])


def to_user_data(user: User) -> UserData:
    return UserData(**user.to_dict(), photo_url=photo_url(user.photo_key))


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Log in",
    responses={
        **PUBLIC_ERROR_RESPONSES,
        200: {"model": LoginResponse, "description": "Login successful"},
        401: {"model": UnauthorizedResponse, "description": "Wrong email or password"},
        403: {"model": ForbiddenResponse, "description": "Account is inactive"},
    },
)
@limiter.limit("10/minute")
async def login(
    request: Request, form_data: OAuth2PasswordRequestForm = Depends()
) -> LoginResponse:
    """
    Log in with email and password and get a bearer token.

    - **username**: the account email, required, sent as form data
    - **password**: the account password, required, sent as form data
    """
    try:
        user = await authenticate(form_data.username, form_data.password)
        if not user:
            raise UnauthorizedException("Invalid email or password")
        if not user.is_active:
            raise ForbiddenException("This account is inactive")
        await user.mark_logged_in()
        access_token, expires_in = create_access_token(user)
        return LoginResponse(
            success=True,
            message="Login successful",
            access_token=access_token,
            token_type="bearer",
            expires_in=expires_in,
            user=to_user_data(user),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Login error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/logout",
    response_model=EmptyResponse,
    summary="Log out",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": EmptyResponse, "description": "Token revoked"},
    },
)
@limiter.limit("30/minute")
async def logout(
    request: Request,
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
) -> EmptyResponse:
    """
    Log out and revoke the current bearer token right away.

    - the same token is rejected on every later request
    """
    try:
        await revoke_token(token)
        return EmptyResponse(success=True, message="Logged out successfully")
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Logout error for {current_user.user_id}: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": UserResponse, "description": "Current user profile"},
    },
)
@limiter.limit("60/minute")
async def me(
    request: Request, current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Return the logged in user.
    """
    return UserResponse(
        success=True,
        message="Profile retrieved successfully",
        data=to_user_data(current_user),
    )


@router.patch(
    "/me/photo",
    response_model=UserResponse,
    summary="Change my photo",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": UserResponse, "description": "Photo saved or removed"},
        400: {
            "model": BadRequestResponse,
            "description": "Photo not uploaded, wrong type or not a user_photo upload",
        },
    },
)
@limiter.limit("10/minute")
async def update_my_photo(
    request: Request,
    data: UpdateMyPhotoRequest,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Set or remove the logged in user's profile photo, works for every role.

    - **photo**: required, a FileAttachment from presign with purpose user_photo, or null to remove the photo
    - the old photo file is deleted from storage once the new one is saved
    """
    try:
        if data.photo:
            await verify_upload(data.photo, UploadPurpose.USER_PHOTO)
        await replace_photo(current_user, data.photo, UploadPurpose.USER_PHOTO)
        await log_user_action(
            current_user.user_id,
            "user_photo_changed",
            entity_type="user",
            entity_id=current_user.user_id,
            details={"removed": data.photo is None},
        )
        return UserResponse(
            success=True,
            message="Photo saved" if data.photo else "Photo removed",
            data=to_user_data(current_user),
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update photo error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@users_router.get(
    "",
    response_model=UserListResponse,
    summary="List users",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": UserListResponse, "description": "Users"},
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can list users",
        },
    },
)
@limiter.limit("60/minute")
async def list_users(
    request: Request,
    search: Optional[str] = Query(
        default=None, max_length=100, description="Partial match on name or email"
    ),
    role: Optional[UserRole] = Query(default=None, description="Filter by role"),
    is_active: Optional[bool] = Query(
        default=None, description="Filter by active state"
    ),
    sort_by: UserSortBy = Query(
        default=UserSortBy.CREATED_AT, description="Column to sort on"
    ),
    sort_order: SortOrder = Query(
        default=SortOrder.LATEST, description="Sort direction"
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: User = Depends(require_admin),
) -> UserListResponse:
    """
    List HR dashboard users.

    - **search**: optional, partial match on name or email
    - **role**: optional, hr_admin or hr_viewer
    - **is_active**: optional, true or false
    - **sort_by**: created_at, name or last_login_at, defaults to created_at
    - **sort_order**: latest, oldest, a_to_z or z_to_a, defaults to latest
    - only HR admins can call this
    """
    try:
        users, total = await User.search(
            search, role, is_active, sort_by, sort_order, limit, offset
        )
        return UserListResponse(
            success=True,
            message=f"Found {total} users",
            data=[to_user_data(user) for user in users],
            total=total,
            limit=limit,
            offset=offset,
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"List users error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@users_router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
    responses={
        **COMMON_ERROR_RESPONSES,
        201: {"model": UserResponse, "description": "User created"},
        400: {
            "model": BadRequestResponse,
            "description": "Photo not uploaded, wrong type or not a user_photo upload",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can create users",
        },
        409: {"model": ConflictResponse, "description": "Email already used"},
    },
)
@limiter.limit("30/minute")
async def create_user(
    request: Request,
    data: CreateUserRequest,
    current_user: User = Depends(require_admin),
) -> UserResponse:
    """
    Create an HR dashboard user.

    - **name**: required, 2 to 255 characters
    - **email**: required, unique login email
    - **password**: required, at least 8 characters
    - **role**: optional, hr_admin or hr_viewer, defaults to hr_viewer
    - **complaints_access**: optional, defaults to false
    - **photo**: optional, a FileAttachment from presign with purpose user_photo
    """
    try:
        if await User.find_by_email(data.email):
            raise ConflictException("A user with this email already exists")
        if data.photo:
            await verify_upload(data.photo, UploadPurpose.USER_PHOTO)
        user = await User.create(
            data.name,
            data.email,
            hash_password(data.password),
            data.role,
            data.complaints_access,
            data.photo.file_url if data.photo else None,
        )
        await log_user_action(
            current_user.user_id,
            "user_created",
            entity_type="user",
            entity_id=user.user_id,
            details={"role": user.role.value, "has_photo": bool(data.photo)},
        )
        return UserResponse(
            success=True, message="User created successfully", data=to_user_data(user)
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Create user error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@users_router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": UserResponse, "description": "User updated"},
        400: {
            "model": BadRequestResponse,
            "description": "Would remove your own admin access or the last admin, or the photo is not a valid upload",
        },
        403: {
            "model": ForbiddenResponse,
            "description": "Only HR admins can update users",
        },
        404: {"model": NotFoundResponse, "description": "User not found"},
    },
)
@limiter.limit("30/minute")
async def update_user(
    request: Request,
    user_id: str,
    data: UpdateUserRequest,
    current_user: User = Depends(require_admin),
) -> UserResponse:
    """
    Change a user's role, restricted access, active state, password or photo.

    - **user_id**: the user's UUID, passed in the path
    - **role**: optional, hr_admin or hr_viewer
    - **complaints_access**: optional, true or false
    - **is_active**: optional, true or false
    - **password**: optional, at least 8 characters
    - **photo**: optional, a FileAttachment from presign with purpose user_photo, send null to remove it
    - you can't remove your own admin role or deactivate yourself
    """
    try:
        validate_uuid((user_id, "user_id"))
        user = await User.find_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        demoting = (
            data.role == UserRole.HR_VIEWER or data.is_active is False
        ) and user.is_admin
        if demoting and user.user_id == current_user.user_id:
            raise BadRequestException("You can't remove your own admin access")
        if demoting and await User.active_admin_count() <= 1:
            raise BadRequestException("At least one active HR admin is needed")
        photo_sent = "photo" in data.model_fields_set
        if data.photo:
            await verify_upload(data.photo, UploadPurpose.USER_PHOTO)
        await user.update(
            role=data.role,
            complaints_access=data.complaints_access,
            is_active=data.is_active,
            password_hash=hash_password(data.password) if data.password else None,
        )
        if photo_sent:
            await replace_photo(user, data.photo, UploadPurpose.USER_PHOTO)
        changed = sorted(
            [
                key
                for key, value in data.model_dump(exclude={"password", "photo"}).items()
                if value is not None
            ]
            + (["photo"] if photo_sent else [])
        )
        await log_user_action(
            current_user.user_id,
            "user_updated",
            entity_type="user",
            entity_id=user.user_id,
            details={"fields": changed + (["password"] if data.password else [])},
        )
        return UserResponse(
            success=True, message="User updated successfully", data=to_user_data(user)
        )
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Update user error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@users_router.delete(
    "/{user_id}",
    response_model=EmptyResponse,
    summary="Delete a user",
    responses={
        **COMMON_ERROR_RESPONSES,
        200: {"model": EmptyResponse, "description": "User deleted"},
        400: {"model": BadRequestResponse, "description": "Cannot delete yourself or the last active HR admin"},
        403: {"model": ForbiddenResponse, "description": "Only HR admins can delete users"},
        404: {"model": NotFoundResponse, "description": "User not found"},
    },
)
@limiter.limit("10/minute")
async def delete_user(
    request: Request, user_id: str, current_user: User = Depends(require_admin)
) -> EmptyResponse:
    """Delete an HR dashboard user while preserving related audit records."""
    try:
        validate_uuid((user_id, "user_id"))
        user = await User.find_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        if user.user_id == current_user.user_id:
            raise BadRequestException("You can't delete your own account")
        if user.is_admin and user.is_active and await User.active_admin_count() <= 1:
            raise BadRequestException("At least one active HR admin is needed")
        await user.delete()
        await log_user_action(
            current_user.user_id,
            "user_deleted",
            entity_type="user",
            entity_id=user.user_id,
            details={"role": user.role.value},
        )
        return EmptyResponse(success=True, message="User deleted successfully")
    except (HTTPException, AppException):
        raise
    except Exception as e:
        logger.error(f"Delete user error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")
