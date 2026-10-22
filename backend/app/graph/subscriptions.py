from datetime import datetime, timedelta, timezone
from typing import Tuple

from app.config import settings
from app.error import GraphException
from app.graph.client import request


def _expiry() -> str:
    moment = datetime.now(timezone.utc) + timedelta(
        minutes=settings.GRAPH_SUBSCRIPTION_MINUTES
    )
    return moment.isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def create() -> Tuple[str, datetime]:
    base = settings.GRAPH_WEBHOOK_BASE_URL.rstrip("/")
    if not base:
        raise GraphException("GRAPH_WEBHOOK_BASE_URL is not set")
    response = await request(
        "POST",
        "/subscriptions",
        json={
            "changeType": "created",
            "notificationUrl": f"{base}/api/graph/notifications",
            "lifecycleNotificationUrl": f"{base}/api/graph/lifecycle",
            "resource": f"users/{settings.GRAPH_MAILBOX}/mailFolders('inbox')/messages",
            "expirationDateTime": _expiry(),
            "clientState": settings.GRAPH_CLIENT_STATE,
        },
        prefer=None,
    )
    body = response.json()
    return body["id"], _parse(body["expirationDateTime"])


async def renew(subscription_id: str) -> datetime:
    response = await request(
        "PATCH",
        f"/subscriptions/{subscription_id}",
        json={"expirationDateTime": _expiry()},
        prefer=None,
    )
    return _parse(response.json()["expirationDateTime"])


async def delete(subscription_id: str) -> None:
    await request("DELETE", f"/subscriptions/{subscription_id}", prefer=None)
