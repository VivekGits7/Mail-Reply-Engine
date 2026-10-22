import uuid
from datetime import timedelta
from typing import Any, Dict

from app import runtime
from app.audit import log_action
from app.cases import Case, CaseFlag, Task
from app.logger import get_logger
from app.mail import deliver
from app.mail.templating import TemplateRenderError
from app.runtime.clock import utcnow
from app.worker import (
    SEND_EMAIL,
    Hold,
    ScheduledJob,
    Skip,
    get_composer,
    get_hook,
    get_job_handler,
    schedule_job,
)

logger = get_logger(__name__)

MAX_JOB_TRIES = 5
RETRY_MINUTES = [5, 15, 60, 240]


async def _flag_failure(job: ScheduledJob, reason: str) -> None:
    if job.case_id:
        case = await Case.find_by_id(job.case_id)
        if case:
            await case.add_flags(CaseFlag.FAILED_ACTION.value)
    await log_action(
        "job_failed",
        case_id=job.case_id,
        entity_type="scheduled_job",
        entity_id=job.scheduled_job_id,
        details={"job_type": job.job_type, "reason": reason[:120]},
    )


def _setting(rs: Any, value: Any) -> int:
    return int(getattr(rs, value)) if isinstance(value, str) else int(value)


async def schedule_next(job: ScheduledJob) -> None:
    chase: Dict[str, Any] = job.payload.get("followup") or {}
    if not chase:
        return
    rs = await runtime.current()
    max_attempts = _setting(rs, chase["max"])
    gap_value = _setting(rs, chase["gap"])
    gap = (
        timedelta(days=gap_value)
        if chase.get("unit") == "days"
        else timedelta(hours=gap_value)
    )
    next_attempt = job.attempt + 1
    base = {key: value for key, value in job.payload.items() if key != "on_sent"}
    chain = job.payload["chain"]
    if next_attempt <= max_attempts:
        await schedule_job(
            SEND_EMAIL,
            utcnow() + gap,
            f"{chain}:{chase['composer']}:{next_attempt}",
            case_id=job.case_id,
            task_id=job.task_id,
            attempt=next_attempt,
            max_attempts=max_attempts,
            payload={**base, "composer": chase["composer"]},
        )
    elif chase.get("escalation"):
        payload = {key: value for key, value in base.items() if key != "followup"}
        await schedule_job(
            SEND_EMAIL,
            utcnow() + gap,
            f"{chain}:{chase['escalation']}:escalation",
            case_id=job.case_id,
            task_id=job.task_id,
            attempt=next_attempt,
            max_attempts=max_attempts,
            payload={**payload, "composer": chase["escalation"]},
        )


async def _send(job: ScheduledJob) -> None:
    name = job.payload.get("composer", "")
    compose = get_composer(name)
    if compose is None:
        await job.finish("failed", f"No composer named {name}")
        return
    outbound = await compose(job)
    if outbound is None or isinstance(outbound, Skip):
        await job.finish("skipped", outbound.reason if outbound else "nothing to send")
        return
    if isinstance(outbound, Hold):
        await job.reschedule(outbound.retry_at, outbound.reason)
        return
    result = await deliver(outbound, job.dedupe_key)
    if result.status in ("deferred", "held"):
        await job.reschedule(result.run_at, result.reason)
        return
    if result.status == "dropped":
        await job.finish("skipped", "no recipient configured")
        if job.case_id:
            case = await Case.find_by_id(job.case_id)
            if case:
                await case.add_flags(CaseFlag.NEEDS_HR.value)
        return
    await job.finish("done")
    if result.status != "sent":
        return
    if job.task_id and job.attempt > 0:
        task = await Task.find_by_id(job.task_id)
        if task:
            await task.bump_followups()
    await schedule_next(job)
    hook = (
        get_hook(job.payload.get("on_sent", "")) if job.payload.get("on_sent") else None
    )
    if hook:
        await hook(job)


async def run_job(job_id: uuid.UUID) -> None:
    job = await ScheduledJob.claim(job_id)
    if job is None:
        return
    try:
        if job.job_type == SEND_EMAIL:
            await _send(job)
            return
        handler = get_job_handler(job.job_type)
        if handler is None:
            await job.finish("failed", f"No handler for {job.job_type}")
            return
        await handler(job)
        await job.finish("done")
    except Exception as e:
        reason = f"{type(e).__name__}: {e}"
        if isinstance(e, TemplateRenderError) or job.tries >= MAX_JOB_TRIES:
            logger.error(
                f"Job {job.job_type} {job.scheduled_job_id} failed for good: {type(e).__name__}"
            )
            await job.finish("failed", reason)
            await _flag_failure(job, reason)
            return
        delay = RETRY_MINUTES[min(job.tries - 1, len(RETRY_MINUTES) - 1)]
        logger.warning(
            f"Job {job.job_type} {job.scheduled_job_id} try {job.tries} failed with {type(e).__name__}, retrying in {delay} minutes"
        )
        await job.reschedule(utcnow() + timedelta(minutes=delay), reason)


async def run_due_jobs() -> int:
    ids = await ScheduledJob.due_ids()
    for job_id in ids:
        await run_job(job_id)
    return len(ids)
