import uuid
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, Optional

from app.config import settings
from app.logger import get_logger
from app.runtime.clock import utcnow
from app.worker.model import Event, ScheduledJob

logger = get_logger(__name__)

EventHandler = Callable[[Dict[str, Any], Event], Awaitable[None]]
RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 14400]
HEAVY_EVENTS = {"documents.check"}

_handlers: Dict[str, EventHandler] = {}


class PermanentEventError(Exception):
    pass


def register(event_type: str, handler: EventHandler) -> None:
    _handlers[event_type] = handler


def registered(event_type: str) -> bool:
    return event_type in _handlers


async def enqueue_event(
    event_type: str,
    payload: Dict[str, Any],
    *,
    source: str,
    dedupe_key: Optional[str] = None,
    case_id: Optional[uuid.UUID] = None,
) -> Optional[uuid.UUID]:
    event = await Event.create(event_type, source, payload, dedupe_key, case_id)
    if event is None:
        logger.info(f"Event {event_type} skipped as a duplicate")
        return None
    await dispatch(event.event_id, event.event_type)
    return event.event_id


async def dispatch(event_id: uuid.UUID, event_type: Optional[str] = None) -> None:
    if settings.EVENT_DISPATCH_MODE == "inline":
        await process_event(event_id)
        return
    from app.worker.celery_app import celery_app

    task = (
        "worker.process_heavy_event"
        if event_type in HEAVY_EVENTS
        else "worker.process_event"
    )
    celery_app.send_task(task, args=[str(event_id)])


async def process_event(event_id: uuid.UUID) -> None:
    event = await Event.claim(event_id)
    if event is None:
        return
    handler = _handlers.get(event.event_type)
    if handler is None:
        await event.mark_failed(f"No handler for {event.event_type}")
        return
    try:
        await handler(event.payload, event)
        await event.mark_done()
        logger.info(f"Event {event.event_type} {event.event_id} done")
    except PermanentEventError as e:
        logger.error(
            f"Event {event.event_type} {event.event_id} failed permanently: {e}"
        )
        await event.mark_failed(str(e))
    except Exception as e:
        reason = f"{type(e).__name__}: {e}"
        if event.attempts >= settings.EVENT_MAX_ATTEMPTS:
            logger.error(
                f"Event {event.event_type} {event.event_id} failed after {event.attempts} attempts: {type(e).__name__}"
            )
            await event.mark_failed(reason)
            return
        delay = RETRY_DELAYS_SECONDS[
            min(event.attempts - 1, len(RETRY_DELAYS_SECONDS) - 1)
        ]
        logger.warning(
            f"Event {event.event_type} {event.event_id} attempt {event.attempts} failed with {type(e).__name__}, retrying in {delay}s"
        )
        await event.mark_retry(reason, delay)


async def sweep_events() -> int:
    stuck = timedelta(minutes=settings.EVENT_STUCK_MINUTES)
    await Event.release_stuck(stuck)
    ids = await Event.due_ids(stuck)
    for event_id in ids:
        await dispatch(event_id)
    return len(ids)


async def schedule_job(
    job_type: str,
    run_at: datetime,
    dedupe_key: str,
    **fields: Any,
) -> Optional[ScheduledJob]:
    job = await ScheduledJob.create(job_type, run_at, dedupe_key, **fields)
    if job is not None and run_at <= utcnow():
        await enqueue_event(
            "job.due",
            {"scheduled_job_id": str(job.scheduled_job_id)},
            source="scheduler",
            dedupe_key=f"job:{job.scheduled_job_id}:{job.tries}",
            case_id=job.case_id,
        )
    return job
