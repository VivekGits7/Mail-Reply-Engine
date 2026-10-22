import hmac
from typing import Optional

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import PlainTextResponse

from app.common.schemas import PUBLIC_ERROR_RESPONSES
from app.config import settings
from app.graph.service import ensure_subscription, poll_mailbox, queue_message
from app.limiter import limiter
from app.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/graph", tags=["Graph webhooks"])

MESSAGE_RESOURCE_MARKER = "/messages/"


def _valid_state(value: Optional[str]) -> bool:
    expected = settings.GRAPH_CLIENT_STATE
    return bool(expected) and value is not None and hmac.compare_digest(value, expected)


@router.post(
    "/notifications",
    summary="Receive new mail notifications",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        **PUBLIC_ERROR_RESPONSES,
        200: {"description": "Validation handshake, the token is echoed as plain text"},
        202: {"description": "Notifications accepted"},
    },
)
@limiter.limit("600/minute")
async def notifications(
    request: Request,
    validation_token: Optional[str] = Query(
        default=None,
        alias="validationToken",
        description="Sent by Microsoft when the subscription is created",
    ),
) -> Response:
    """
    Receive Microsoft's new mail notifications for the dedicated mailbox.

    - **validationToken**: on the handshake call, echoed back as text with status 200
    - every item must carry the shared clientState, others are dropped
    - each message id becomes one email.received event, duplicates are ignored
    """
    if validation_token is not None:
        return PlainTextResponse(validation_token, status_code=200)
    try:
        body = await request.json()
    except ValueError:
        return Response(status_code=status.HTTP_202_ACCEPTED)
    for item in body.get("value", []):
        if not _valid_state(item.get("clientState")):
            logger.warning("Dropped a Graph notification with a wrong clientState")
            continue
        message_id = (item.get("resourceData") or {}).get("id")
        if not message_id and MESSAGE_RESOURCE_MARKER in item.get("resource", ""):
            message_id = item["resource"].rsplit("/", 1)[-1]
        if message_id:
            await queue_message(message_id)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/lifecycle",
    summary="Receive subscription lifecycle events",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        **PUBLIC_ERROR_RESPONSES,
        200: {"description": "Validation handshake, the token is echoed as plain text"},
        202: {"description": "Lifecycle event accepted"},
    },
)
@limiter.limit("600/minute")
async def lifecycle(
    request: Request,
    validation_token: Optional[str] = Query(
        default=None,
        alias="validationToken",
        description="Sent by Microsoft when the subscription is created",
    ),
) -> Response:
    """
    Receive subscription lifecycle events from Microsoft.

    - **validationToken**: same handshake as notifications
    - reauthorizationRequired renews the subscription
    - subscriptionRemoved creates a new one
    - missed runs a mailbox poll right away
    """
    if validation_token is not None:
        return PlainTextResponse(validation_token, status_code=200)
    try:
        body = await request.json()
    except ValueError:
        return Response(status_code=status.HTTP_202_ACCEPTED)
    for item in body.get("value", []):
        if not _valid_state(item.get("clientState")):
            continue
        event = item.get("lifecycleEvent")
        if event == "reauthorizationRequired":
            await ensure_subscription()
        elif event == "subscriptionRemoved":
            await ensure_subscription(force_new=True)
        elif event == "missed":
            await poll_mailbox()
    return Response(status_code=status.HTTP_202_ACCEPTED)
