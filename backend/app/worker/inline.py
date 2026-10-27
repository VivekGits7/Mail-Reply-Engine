import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any, Awaitable, Callable, Dict, List

from celery.schedules import crontab

from app.logger import get_logger
from app.runtime.clock import local_tz
from app.worker.beat import BEAT_SCHEDULE

logger = get_logger(__name__)

# Both are idempotent, so a restart after their slot still runs today's check once.
CATCH_UP_ON_START = {"daily-checks", "monthly-feedback-report"}

_tasks: List[asyncio.Task] = []


def _jobs() -> Dict[str, Callable[[], Awaitable[Any]]]:
    from app.d365 import poll_status_changes
    from app.engine.daily import (
        run_daily_checks,
        run_monthly_report,
        run_reminder_tick,
    )
    from app.engine.jobs import run_due_jobs
    from app.graph.service import ensure_subscription, poll_mailbox
    from app.llm.model import LlmRequest
    from app.worker.events import sweep_events

    return {
        "poll-mailbox": poll_mailbox,
        "run-due-jobs": run_due_jobs,
        "sweep-events": sweep_events,
        "reminder-rules": run_reminder_tick,
        "ensure-subscription": ensure_subscription,
        "daily-checks": run_daily_checks,
        "monthly-feedback-report": run_monthly_report,
        "d365-poll": poll_status_changes,
        "purge-llm-audit": LlmRequest.purge_expired,
    }


def _runs_on(schedule: crontab, day: date) -> bool:
    return (
        day.isoweekday() % 7 in schedule.day_of_week
        and day.day in schedule.day_of_month
        and day.month in schedule.month_of_year
    )


def _slots(schedule: crontab, day: date) -> List[datetime]:
    return sorted(
        datetime.combine(day, time(hour, minute), tzinfo=local_tz())
        for hour in schedule.hour
        for minute in schedule.minute
    )


def next_run(schedule: crontab, now: datetime) -> datetime:
    for offset in range(366):
        day = (now + timedelta(days=offset)).date()
        if not _runs_on(schedule, day):
            continue
        for slot in _slots(schedule, day):
            if slot > now:
                return slot
    raise ValueError("Schedule never runs")


def slot_passed_today(schedule: crontab, now: datetime) -> bool:
    today = now.date()
    return _runs_on(schedule, today) and any(
        slot <= now for slot in _slots(schedule, today)
    )


async def _run(name: str, job: Callable[[], Awaitable[Any]]) -> None:
    try:
        await job()
    except Exception as e:
        logger.error(f"Inline job {name} failed: {type(e).__name__}: {e}")


async def _every(name: str, seconds: float, job: Callable[[], Awaitable[Any]]) -> None:
    while True:
        await _run(name, job)
        await asyncio.sleep(seconds)


async def _on_schedule(
    name: str, schedule: crontab, job: Callable[[], Awaitable[Any]]
) -> None:
    if name in CATCH_UP_ON_START and slot_passed_today(
        schedule, datetime.now(local_tz())
    ):
        await _run(name, job)
    while True:
        now = datetime.now(local_tz())
        await asyncio.sleep((next_run(schedule, now) - now).total_seconds())
        await _run(name, job)


def start() -> None:
    if _tasks:
        return
    for name, job in _jobs().items():
        schedule = BEAT_SCHEDULE[name]["schedule"]
        runner = (
            _on_schedule(name, schedule, job)
            if isinstance(schedule, crontab)
            else _every(name, float(schedule), job)
        )
        _tasks.append(asyncio.create_task(runner))
    logger.info("Inline scheduler started, the API runs the full beat schedule")


async def stop() -> None:
    for task in _tasks:
        task.cancel()
    await asyncio.gather(*_tasks, return_exceptions=True)
    _tasks.clear()
