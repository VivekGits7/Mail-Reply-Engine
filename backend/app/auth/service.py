import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.auth.model import RevokedToken, User
from app.config import settings
from app.error import ForbiddenException, UnauthorizedException

BCRYPT_MAX_BYTES = 72

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def _truncate(password: str) -> str:
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    return pwd_context.hash(_truncate(password))


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(_truncate(password), password_hash)


def create_access_token(user: User) -> tuple[str, int]:
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.user_id),
        "role": user.role.value,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    ), expires_in


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        raise UnauthorizedException("Invalid or expired token") from None
    if not payload.get("sub") or not payload.get("jti"):
        raise UnauthorizedException("Invalid or expired token")
    return payload


async def authenticate(email: str, password: str) -> Optional[User]:
    user = await User.find_by_email(email)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


async def user_from_token(token: str) -> User:
    payload = decode_access_token(token)
    if await RevokedToken.is_revoked(payload["jti"]):
        raise UnauthorizedException("Token has been revoked")
    try:
        user = await User.find_by_id(payload["sub"])
    except ValueError:
        raise UnauthorizedException("Invalid or expired token") from None
    if not user or not user.is_active:
        raise UnauthorizedException("Account not found or inactive")
    return user


async def revoke_token(token: str) -> None:
    payload = decode_access_token(token)
    await RevokedToken.revoke(
        payload["jti"], datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    )
    await RevokedToken.purge_expired()


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    return await user_from_token(token)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise ForbiddenException("Only HR admins can do this")
    return current_user


async def require_complaints_access(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.complaints_access:
        raise ForbiddenException("This area is restricted")
    return current_user
