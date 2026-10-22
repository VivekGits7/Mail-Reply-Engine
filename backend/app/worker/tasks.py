import uuid

from app.worker.celery_app import celery_app, run


@celery_app.task(name="worker.process_event")
def process_event(event_id: str) -> None:
    from app.worker.events import process_event as handle

    run(handle(uuid.UUID(event_id)))


@celery_app.task(name="worker.process_heavy_event")
def process_heavy_event(event_id: str) -> None:
    from app.worker.events import process_event as handle

    run(handle(uuid.UUID(event_id)))


@celery_app.task(name="worker.run_due_jobs")
def run_due_jobs() -> int:
    from app.engine.jobs import run_due_jobs as run_jobs

    return run(run_jobs())


@celery_app.task(name="worker.poll_mailbox")
def poll_mailbox() -> int:
    from app.graph.service import poll_mailbox as poll

    return run(poll())


@celery_app.task(name="worker.ensure_subscription")
def ensure_subscription() -> None:
    from app.graph.service import ensure_subscription as ensure

    run(ensure())


@celery_app.task(name="worker.sweep_events")
def sweep_events() -> int:
    from app.worker.events import sweep_events as sweep

    return run(sweep())


@celery_app.task(name="worker.daily_checks")
def daily_checks() -> None:
    from app.engine.daily import run_daily_checks

    run(run_daily_checks())


@celery_app.task(name="worker.monthly_report")
def monthly_report() -> None:
    from app.engine.daily import run_monthly_report

    run(run_monthly_report())


@celery_app.task(name="worker.reminder_tick")
def reminder_tick() -> int:
    from app.engine.daily import run_reminder_tick

    return run(run_reminder_tick())


@celery_app.task(name="worker.d365_poll")
def d365_poll() -> None:
    from app.d365 import poll_status_changes

    run(poll_status_changes())


@celery_app.task(name="worker.purge_llm_audit")
def purge_llm_audit() -> int:
    from app.llm.model import LlmRequest

    return run(LlmRequest.purge_expired())
