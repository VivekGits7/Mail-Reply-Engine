import asyncio

from app.worker import inline


async def test_inline_scheduler_runs_jobs_and_survives_a_failing_one(monkeypatch):
    calls = []

    async def poll():
        calls.append("poll")

    async def broken():
        raise RuntimeError("boom")

    monkeypatch.setattr(
        inline, "_jobs", lambda: [("poll-mailbox", poll), ("run-due-jobs", broken)]
    )
    inline.start()
    inline.start()
    for _ in range(3):
        await asyncio.sleep(0)
    assert calls == ["poll"] and len(inline._tasks) == 2
    assert all(not task.done() for task in inline._tasks)
    await inline.stop()
    assert inline._tasks == []
