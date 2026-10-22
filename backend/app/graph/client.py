import asyncio
import time
from typing import Any, Dict, Optional, Tuple

import httpx

from app.config import settings
from app.error import GraphException
from app.logger import get_logger

logger = get_logger(__name__)

RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_BACKOFF_SECONDS = 30
TOKEN_REFRESH_MARGIN_SECONDS = 120
IMMUTABLE_IDS = 'IdType="ImmutableId"'

_http: Optional[httpx.AsyncClient] = None
_token: Optional[Tuple[str, float]] = None


def http() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=settings.GRAPH_TIMEOUT_SECONDS)
    return _http


async def close() -> None:
    global _http, _token
    if _http is not None:
        await _http.aclose()
    _http = None
    _token = None


def mailbox_path() -> str:
    return f"/users/{settings.GRAPH_MAILBOX}"


async def _access_token() -> str:
    global _token
    if _token and _token[1] - TOKEN_REFRESH_MARGIN_SECONDS > time.monotonic():
        return _token[0]
    if not settings.graph_configured:
        raise GraphException("Microsoft Graph is not configured")
    response = await http().post(
        f"{settings.GRAPH_AUTHORITY}/{settings.GRAPH_TENANT_ID}/oauth2/v2.0/token",
        data={
            "client_id": settings.GRAPH_CLIENT_ID,
            "client_secret": settings.GRAPH_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
    )
    if response.status_code != 200:
        logger.error(f"Graph token request failed with status {response.status_code}")
        raise GraphException("Could not sign in to Microsoft Graph")
    body = response.json()
    _token = (
        body["access_token"],
        time.monotonic() + int(body.get("expires_in", 3600)),
    )
    return _token[0]


def _retry_delay(response: Optional[httpx.Response], attempt: int) -> float:
    if response is not None and response.headers.get("Retry-After", "").isdigit():
        return min(float(response.headers["Retry-After"]), MAX_BACKOFF_SECONDS)
    return min(2**attempt, MAX_BACKOFF_SECONDS)


async def request(
    method: str,
    path: str,
    *,
    json: Any = None,
    params: Optional[Dict[str, Any]] = None,
    prefer: Optional[str] = IMMUTABLE_IDS,
    absolute_url: bool = False,
) -> httpx.Response:
    url = path if absolute_url else f"{settings.GRAPH_BASE_URL}{path}"
    for attempt in range(settings.GRAPH_MAX_RETRIES + 1):
        headers = {"Authorization": f"Bearer {await _access_token()}"}
        if prefer:
            headers["Prefer"] = prefer
        response: Optional[httpx.Response] = None
        try:
            response = await http().request(
                method, url, json=json, params=params, headers=headers
            )
        except httpx.TransportError as e:
            logger.warning(
                f"Graph {method} transport error {type(e).__name__}, attempt {attempt + 1}"
            )
        if response is not None and response.status_code < 400:
            return response
        if response is not None and response.status_code not in RETRY_STATUSES:
            logger.error(
                f"Graph {method} {path.split('?')[0]} failed with status {response.status_code}"
            )
            raise GraphException()
        if attempt < settings.GRAPH_MAX_RETRIES:
            await asyncio.sleep(_retry_delay(response, attempt))
    raise GraphException("Microsoft Graph kept failing, try again later")
