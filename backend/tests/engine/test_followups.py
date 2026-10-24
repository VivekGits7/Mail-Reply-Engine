from datetime import timedelta

from app.mail import Outbound
from app.worker import Hold, ScheduledJob, Skip, composer, followup, start_email
from tests.conftest import advance_jobs

calls = {"count": 0, "skip_after": 99, "hold_once": False}


@composer("test.chase")
async def compose_chase(job):
    calls["count"] += 1
    if calls["hold_once"]:
        calls["hold_once"] = False
        from app.runtime.clock import utcnow

        return Hold(utcnow() + timedelta(minutes=5), "waiting")
    if calls["count"] > calls["skip_after"]:
        return Skip("done")
    return Outbound(
        template_key="complaint_alert", values={}, to=["chase@tcgdigital.com"]
    )


@composer("test.escalate")
async def compose_escalate(job):
    return Outbound(
        template_key="complaint_alert", values={}, to=["boss@tcgdigital.com"]
    )


@composer("test.nobody")
async def compose_nobody(job):
    return Outbound(template_key="complaint_alert", values={}, to=[None])


async def test_missing_recipient_skips_the_job_instead_of_crashing(env):
    job = await start_email("test.nobody", scope="chain-n")
    fresh = await ScheduledJob.find_by_id(job.scheduled_job_id)
    assert fresh.status == "skipped" and env.graph.sent == []


async def test_chain_follows_up_then_escalates_once(env):
    calls.update(count=0, skip_after=99, hold_once=False)
    await start_email(
        "test.chase",
        scope="chain-a",
        chase=followup("test.chase", 2, 2, escalation="test.escalate"),
    )
    assert len(env.graph.to("chase@tcgdigital.com")) == 1
    for _ in range(4):
        await advance_jobs(env.conn, timedelta(hours=3))
    assert (
        len(env.graph.to("chase@tcgdigital.com")) == 3
        and len(env.graph.to("boss@tcgdigital.com")) == 1
    )
    keys = [
        row["dedupe_key"]
        for row in await env.conn.fetch(
            "SELECT dedupe_key FROM scheduled_jobs ORDER BY attempt"
        )
    ]
    assert keys == [
        "-:-:chain-a:test.chase:0",
        "-:-:chain-a:test.chase:1",
        "-:-:chain-a:test.chase:2",
        "-:-:chain-a:test.escalate:escalation",
    ]


async def test_skipped_follow_up_stops_the_chain(env):
    calls.update(count=0, skip_after=1, hold_once=False)
    await start_email(
        "test.chase",
        scope="chain-b",
        chase=followup("test.chase", 2, 3, escalation="test.escalate"),
    )
    await advance_jobs(env.conn, timedelta(hours=3))
    await advance_jobs(env.conn, timedelta(hours=3))
    assert len(env.graph.to("chase@tcgdigital.com")) == 1 and not env.graph.to(
        "boss@tcgdigital.com"
    )
    assert await ScheduledJob.pending_count() == 0


async def test_held_job_is_rescheduled_not_lost(env):
    calls.update(count=0, skip_after=99, hold_once=True)
    job = await start_email("test.chase", scope="chain-c")
    fresh = await ScheduledJob.find_by_id(job.scheduled_job_id)
    assert fresh.status == "pending" and fresh.last_error == "waiting"
    await advance_jobs(env.conn, timedelta(hours=1))
    assert len(env.graph.to("chase@tcgdigital.com")) == 1


async def test_kill_switch_keeps_jobs_pending(env):
    from tests.conftest import configure_runtime

    calls.update(count=0, skip_after=99, hold_once=False)
    await configure_runtime(kill_switch=True)
    job = await start_email("test.chase", scope="chain-d")
    assert (
        await ScheduledJob.find_by_id(job.scheduled_job_id)
    ).last_error == "kill_switch"
    await configure_runtime(kill_switch=False)
    await advance_jobs(env.conn, timedelta(hours=1))
    assert len(env.graph.to("chase@tcgdigital.com")) == 1
