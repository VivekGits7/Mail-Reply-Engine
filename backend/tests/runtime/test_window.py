from datetime import date, datetime

from app.runtime import (
    RuntimeSettings,
    add_working_days,
    next_send_time,
    working_days_from,
)
from app.runtime.clock import local_tz

TZ = local_tz()
RS = RuntimeSettings()


def at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=TZ)


def test_inside_the_window_sends_now():
    assert next_send_time(at(21, 11), RS, set()) == at(21, 11)


def test_before_the_window_waits_for_nine_am():
    assert next_send_time(at(21, 7), RS, set()) == at(21, 9)


def test_after_the_window_moves_to_the_next_working_morning():
    assert next_send_time(at(23, 20), RS, set()) == at(26, 9)


def test_weekend_and_holiday_are_skipped():
    assert next_send_time(at(24, 10), RS, {date(2026, 10, 26)}) == at(27, 9)


def test_working_day_helpers_skip_weekends_and_holidays():
    assert add_working_days(date(2026, 10, 23), 1, RS.sending_days, set()) == date(
        2026, 10, 26
    )
    assert working_days_from(
        date(2026, 10, 23), 3, RS.sending_days, {date(2026, 10, 26)}
    ) == [date(2026, 10, 23), date(2026, 10, 27), date(2026, 10, 28)]
