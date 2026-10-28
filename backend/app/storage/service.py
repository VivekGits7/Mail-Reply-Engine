import uuid
from pathlib import PurePath
from typing import Any, Dict, Optional

import aioboto3
import botocore.session
from aiobotocore.config import AioConfig
from botocore.config import Config

from app.config import settings
from app.error import StorageException
from app.logger import get_logger

logger = get_logger(__name__)

_session: Optional[aioboto3.Session] = None
_signer: Any = None


def _get_session() -> aioboto3.Session:
    global _session
    if _session is None:
        _session = aioboto3.Session()
    return _session


def _client(endpoint_url: str) -> Any:
    return _get_session().client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=AioConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


# Signing a GET link is pure computation, so a plain botocore client keeps photo links sync and cheap.
def _photo_signer() -> Any:
    global _signer
    if _signer is None:
        _signer = botocore.session.get_session().create_client(
            "s3",
            endpoint_url=settings.S3_PUBLIC_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _signer


def photo_url(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    try:
        return _photo_signer().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=settings.PHOTO_URL_EXPIRE_SECONDS,
        )
    except Exception as e:
        logger.error(f"Photo link signing failed: {type(e).__name__}")
        return None


def new_key(prefix: str, file_name: str) -> str:
    suffix = PurePath(file_name or "").suffix.lower()[:10]
    return f"{prefix.strip('/')}/{uuid.uuid4().hex}{suffix}"


async def put_bytes(key: str, data: bytes, content_type: str) -> str:
    try:
        async with _client(settings.S3_ENDPOINT_URL) as s3:
            await s3.put_object(
                Bucket=settings.S3_BUCKET, Key=key, Body=data, ContentType=content_type
            )
        return key
    except Exception as e:
        logger.error(f"Storage upload failed for {key}: {type(e).__name__}")
        raise StorageException("Could not store the file") from e


async def get_bytes(key: str) -> bytes:
    try:
        async with _client(settings.S3_ENDPOINT_URL) as s3:
            response = await s3.get_object(Bucket=settings.S3_BUCKET, Key=key)
            async with response["Body"] as stream:
                return await stream.read()
    except Exception as e:
        logger.error(f"Storage read failed for {key}: {type(e).__name__}")
        raise StorageException("Could not read the file") from e


async def head(key: str) -> Optional[Dict[str, Any]]:
    try:
        async with _client(settings.S3_ENDPOINT_URL) as s3:
            response = await s3.head_object(Bucket=settings.S3_BUCKET, Key=key)
        return {
            "size": response.get("ContentLength", 0),
            "content_type": response.get("ContentType"),
        }
    except Exception:
        return None


async def delete(key: str) -> None:
    try:
        async with _client(settings.S3_ENDPOINT_URL) as s3:
            await s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)
    except Exception as e:
        logger.error(f"Storage delete failed for {key}: {type(e).__name__}")
        raise StorageException("Could not delete the file") from e


async def presigned_get(key: str, file_name: str) -> str:
    safe_name = file_name.replace('"', "").replace("\n", " ")
    async with _client(settings.S3_PUBLIC_ENDPOINT_URL) as s3:
        return await s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.S3_BUCKET,
                "Key": key,
                "ResponseContentDisposition": f'inline; filename="{safe_name}"',
            },
            ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS,
        )


async def presigned_post(key: str, content_type: str, max_bytes: int) -> Dict[str, Any]:
    async with _client(settings.S3_PUBLIC_ENDPOINT_URL) as s3:
        return await s3.generate_presigned_post(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_bytes],
            ],
            ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS,
        )
