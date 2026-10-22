import asyncio
from typing import Any, Coroutine, Optional

from celery import Celery
from celery.signals import worker_process_shutdown

from app.config import settings
from app.worker.beat import BEAT_SCHEDULE

celery_app = Celery(
    "mail_reply_engine", broker=settings.REDIS_URL, include=["app.worker.tasks"]
)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_default_queue="events",
    task_routes={"worker.process_heavy_event": {"queue": "documents"}},
    timezone=settings.TIMEZONE,
    enable_utc=True,
    beat_schedule=BEAT_SCHEDULE,
    broker_connection_retry_on_startup=True,
)

_loop: Optional[asyncio.AbstractEventLoop] = None


def _start() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None:
        from app.database import create_db_pool
        from app.engine import setup_engine
        from app.logger import setup_logging

        setup_logging()
        setup_engine()
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
        _loop.run_until_complete(create_db_pool())
    return _loop


def run(coro: Coroutine[Any, Any, Any]) -> Any:
    return _start().run_until_complete(coro)


@worker_process_shutdown.connect
def _stop(**_: Any) -> None:
    if _loop is None:
        return
    from app.database import close_db_pool
    from app.graph.client import close as close_graph

    _loop.run_until_complete(close_graph())
    _loop.run_until_complete(close_db_pool())
