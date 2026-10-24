import asyncio
from typing import Any, Awaitable, Callable, List, Tuple

from app.logger import get_logger
from app.worker.beat import BEAT_SCHEDULE

logger = get_logger(__name__)

_tasks: List[asyncio.Task] = []


def _jobs() -> List[Tuple[str, Callable[[], Awaitable[Any]]]]:
    from app.engine.daily import run_reminder_tick
    from app.engine.jobs import run_due_jobs
    from app.graph.service import poll_mailbox

    return [
        ("poll-mailbox", poll_mailbox),
        ("run-due-jobs", run_due_jobs),
        ("reminder-rules", run_reminder_tick),
    ]


async def _every(name: str, seconds: float, job: Callable[[], Awaitable[Any]]) -> None:
    while True:
        try:
            await job()
        except Exception as e:
            logger.error(f"Inline job {name} failed: {type(e).__name__}: {e}")
        await asyncio.sleep(seconds)


def start() -> None:
    if _tasks:
        return
    for name, job in _jobs():
        seconds = float(BEAT_SCHEDULE[name]["schedule"])
        _tasks.append(asyncio.create_task(_every(name, seconds, job)))
    logger.info("Inline scheduler started, mailbox poll and due jobs run in the API")


async def stop() -> None:
    for task in _tasks:
        task.cancel()
    await asyncio.gather(*_tasks, return_exceptions=True)
    _tasks.clear()
