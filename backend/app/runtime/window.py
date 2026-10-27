from datetime import date, datetime, timedelta
from typing import Iterable

from app.runtime.clock import at_local, parse_clock, to_local
from app.runtime.schemas import RuntimeSettings

SEARCH_DAYS = 400


def is_working_day(
    day: date, working_weekdays: Iterable[int], holidays: set[date]
) -> bool:
    return day.weekday() in working_weekdays and day not in holidays


def next_send_time(
    moment: datetime, rs: RuntimeSettings, holidays: set[date]
) -> datetime:
    local = to_local(moment)
    start, end = parse_clock(rs.sending_start), parse_clock(rs.sending_end)
    for offset in range(SEARCH_DAYS):
        day = local.date() + timedelta(days=offset)
        if not is_working_day(day, rs.sending_days, holidays):
            continue
        window_start, window_end = at_local(day, start), at_local(day, end)
        if offset == 0:
            if local < window_start:
                return window_start
            if local < window_end:
                return local
            continue
        return window_start
    raise ValueError("No sending window found, check sending_days and holidays")


def in_sending_window(
    moment: datetime, rs: RuntimeSettings, holidays: set[date]
) -> bool:
    return next_send_time(moment, rs, holidays) == to_local(moment)


def add_working_days(
    day: date, count: int, working_weekdays: Iterable[int], holidays: set[date]
) -> date:
    weekdays = list(working_weekdays)
    current = day
    added = 0
    while added < count:
        current += timedelta(days=1)
        if is_working_day(current, weekdays, holidays):
            added += 1
    return current


def previous_working_day(
    day: date, working_weekdays: Iterable[int], holidays: set[date]
) -> date:
    weekdays = list(working_weekdays)
    current = day - timedelta(days=1)
    for _ in range(SEARCH_DAYS):
        if is_working_day(current, weekdays, holidays):
            return current
        current -= timedelta(days=1)
    raise ValueError("No working day found, check working days and holidays")


def working_days_from(
    day: date, count: int, working_weekdays: Iterable[int], holidays: set[date]
) -> list[date]:
    weekdays = list(working_weekdays)
    days: list[date] = []
    current = day
    while len(days) < count:
        if is_working_day(current, weekdays, holidays):
            days.append(current)
        current += timedelta(days=1)
    return days
