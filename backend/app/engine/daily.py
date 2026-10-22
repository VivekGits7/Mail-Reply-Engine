from datetime import date
from typing import Optional

from app.logger import get_logger
from app.people import Person
from app.runtime.clock import local_today
from app.workflows.feedback import service as feedback
from app.workflows.reminders import service as reminders

logger = get_logger(__name__)


async def run_daily_checks(today: Optional[date] = None) -> int:
    today = today or local_today()
    await Person.promote_joiners(today)
    started = await feedback.run_daily(today)
    try:
        await feedback.sync_from_graph()
    except Exception as e:
        logger.warning(f"Survey response sync failed: {type(e).__name__}")
    return started


async def run_monthly_report(today: Optional[date] = None) -> None:
    await feedback.run_monthly(today)


async def run_reminder_tick() -> int:
    return await reminders.tick()
