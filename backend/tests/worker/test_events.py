from app.worker import Event, PermanentEventError, enqueue_event, register
from app.worker.events import process_event


async def test_duplicate_events_are_skipped(env):
    calls = []

    async def handler(payload, event):
        calls.append(payload)

    register("test.dedupe", handler)
    first = await enqueue_event(
        "test.dedupe", {"n": 1}, source="system", dedupe_key="same"
    )
    second = await enqueue_event(
        "test.dedupe", {"n": 2}, source="system", dedupe_key="same"
    )
    assert first is not None and second is None and calls == [{"n": 1}]


async def test_failing_handler_is_retried_later_then_failed(env):
    async def boom(payload, event):
        raise RuntimeError("downstream down")

    register("test.boom", boom)
    event_id = await enqueue_event("test.boom", {}, source="system")
    row = await env.conn.fetchrow(
        "SELECT status, attempts, available_at > NOW() AS later FROM events WHERE event_id = $1",
        event_id,
    )
    assert row["status"] == "queued" and row["attempts"] == 1 and row["later"]
    await env.conn.execute(
        "UPDATE events SET attempts = 99, available_at = NOW() WHERE event_id = $1",
        event_id,
    )
    await process_event(event_id)
    assert (
        await env.conn.fetchval(
            "SELECT status FROM events WHERE event_id = $1", event_id
        )
        == "failed"
    )


async def test_permanent_errors_fail_right_away(env):
    async def bad(payload, event):
        raise PermanentEventError("never retry")

    register("test.permanent", bad)
    event_id = await enqueue_event("test.permanent", {}, source="system")
    assert (
        await env.conn.fetchval(
            "SELECT status FROM events WHERE event_id = $1", event_id
        )
        == "failed"
    )


async def test_unknown_event_type_is_marked_failed(env):
    event_id = await enqueue_event("test.nobody", {}, source="system")
    assert (
        await env.conn.fetchval(
            "SELECT last_error FROM events WHERE event_id = $1", event_id
        )
        == "No handler for test.nobody"
    )


async def test_failed_event_can_be_requeued(env):
    event_id = await enqueue_event("test.nobody2", {}, source="system")
    assert await Event.requeue(event_id)
    assert (
        await env.conn.fetchval(
            "SELECT status FROM events WHERE event_id = $1", event_id
        )
        == "queued"
    )
