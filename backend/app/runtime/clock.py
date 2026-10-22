from datetime import date, datetime, time, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

from app.config import settings


@lru_cache(maxsize=1)
def local_tz() -> ZoneInfo:
    return ZoneInfo(settings.TIMEZONE)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_local(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(local_tz())


def local_today(moment: datetime | None = None) -> date:
    return to_local(moment or utcnow()).date()


def at_local(day: date, clock: time) -> datetime:
    return datetime.combine(day, clock, tzinfo=local_tz())


def parse_clock(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))
