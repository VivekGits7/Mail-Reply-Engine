import asyncio
from datetime import datetime

from app.runtime.clock import local_tz
from app.worker import inline
from app.worker.beat import BEAT_SCHEDULE


async def test_inline_scheduler_runs_jobs_and_survives_a_failing_one(monkeypatch):
    calls = []

    async def poll():
        calls.append("poll")

    async def broken():
        raise RuntimeError("boom")

    monkeypatch.setattr(
        inline, "_jobs", lambda: {"poll-mailbox": poll, "run-due-jobs": broken}
    )
    inline.start()
    inline.start()
    for _ in range(3):
        await asyncio.sleep(0)
    assert calls == ["poll"] and len(inline._tasks) == 2
    assert all(not task.done() for task in inline._tasks)
    await inline.stop()
    assert inline._tasks == []


def test_inline_mode_covers_the_whole_beat_schedule():
    assert set(inline._jobs()) == set(BEAT_SCHEDULE)


def test_daily_checks_run_at_nine_ist():
    daily = BEAT_SCHEDULE["daily-checks"]["schedule"]
    before = datetime(2026, 10, 26, 8, 30, tzinfo=local_tz())
    after = datetime(2026, 10, 26, 13, 0, tzinfo=local_tz())
    assert inline.next_run(daily, before) == datetime(
        2026, 10, 26, 9, 0, tzinfo=local_tz()
    )
    assert inline.next_run(daily, after) == datetime(
        2026, 10, 27, 9, 0, tzinfo=local_tz()
    )
    assert not inline.slot_passed_today(daily, before)
    assert inline.slot_passed_today(daily, after)


async def test_missed_daily_check_runs_once_at_start(monkeypatch):
    calls = []

    async def daily():
        calls.append("daily")

    monkeypatch.setattr(inline, "_jobs", lambda: {"daily-checks": daily})
    monkeypatch.setattr(inline, "slot_passed_today", lambda schedule, now: True)
    inline.start()
    for _ in range(3):
        await asyncio.sleep(0)
    assert calls == ["daily"]
    await inline.stop()
