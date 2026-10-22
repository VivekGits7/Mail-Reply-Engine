from datetime import timedelta
from typing import Optional

from app.config import settings
from app.error import GraphException
from app.graph import mail, subscriptions
from app.graph.model import MailboxState
from app.logger import get_logger
from app.runtime.clock import utcnow
from app.worker.events import enqueue_event

logger = get_logger(__name__)

RENEW_WHEN_LEFT = timedelta(hours=24)


async def ensure_subscription(force_new: bool = False) -> Optional[str]:
    if not settings.graph_configured or not settings.GRAPH_WEBHOOK_BASE_URL:
        return None
    state = await MailboxState.get(settings.mailbox)
    expires = state.subscription_expires_at
    if (
        not force_new
        and state.subscription_id
        and expires
        and expires - utcnow() > RENEW_WHEN_LEFT
    ):
        return state.subscription_id
    if state.subscription_id and not force_new:
        try:
            new_expiry = await subscriptions.renew(state.subscription_id)
            await state.save_subscription(state.subscription_id, new_expiry)
            logger.info("Graph subscription renewed")
            return state.subscription_id
        except GraphException:
            logger.warning("Graph subscription renewal failed, creating a new one")
    subscription_id, new_expiry = await subscriptions.create()
    await state.save_subscription(subscription_id, new_expiry)
    logger.info("Graph subscription created")
    return subscription_id


async def queue_message(message_id: str) -> None:
    await enqueue_event(
        "email.received",
        {"graph_message_id": message_id},
        source="email",
        dedupe_key=f"email:{message_id}",
    )


async def poll_mailbox() -> int:
    if not settings.graph_configured:
        return 0
    state = await MailboxState.get(settings.mailbox)
    message_ids, delta_link = await mail.delta(state.delta_link)
    for message_id in message_ids:
        await queue_message(message_id)
    await state.save_delta(delta_link)
    return len(message_ids)


async def subscription_status() -> str:
    if not settings.graph_configured:
        return "not_configured"
    state = await MailboxState.get(settings.mailbox)
    if not state.subscription_id or not state.subscription_expires_at:
        return "polling_only"
    return "active" if state.subscription_expires_at > utcnow() else "expired"
