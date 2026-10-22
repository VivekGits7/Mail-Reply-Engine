import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, Optional, Union

from app.runtime.clock import utcnow
from app.worker.events import schedule_job
from app.worker.model import ScheduledJob

SEND_EMAIL = "send_email"


@dataclass
class Skip:
    reason: str


@dataclass
class Hold:
    retry_at: datetime
    reason: str


ComposerResult = Union[Any, Skip, Hold, None]
Composer = Callable[[ScheduledJob], Awaitable[ComposerResult]]
SentHook = Callable[[ScheduledJob], Awaitable[None]]
JobHandler = Callable[[ScheduledJob], Awaitable[None]]

_composers: Dict[str, Composer] = {}
_hooks: Dict[str, SentHook] = {}
_job_handlers: Dict[str, JobHandler] = {}


def composer(name: str) -> Callable[[Composer], Composer]:
    def wrap(fn: Composer) -> Composer:
        _composers[name] = fn
        return fn

    return wrap


def sent_hook(name: str) -> Callable[[SentHook], SentHook]:
    def wrap(fn: SentHook) -> SentHook:
        _hooks[name] = fn
        return fn

    return wrap


def job_handler(job_type: str) -> Callable[[JobHandler], JobHandler]:
    def wrap(fn: JobHandler) -> JobHandler:
        _job_handlers[job_type] = fn
        return fn

    return wrap


def get_composer(name: str) -> Optional[Composer]:
    return _composers.get(name)


def get_hook(name: str) -> Optional[SentHook]:
    return _hooks.get(name)


def get_job_handler(job_type: str) -> Optional[JobHandler]:
    return _job_handlers.get(job_type)


def followup(
    composer_name: str,
    gap: Union[str, int],
    max_attempts: Union[str, int],
    escalation: Optional[str] = None,
    unit: str = "hours",
) -> Dict[str, Any]:
    return {
        "composer": composer_name,
        "gap": gap,
        "max": max_attempts,
        "escalation": escalation,
        "unit": unit,
    }


def chain_key(
    case_id: Optional[uuid.UUID],
    task_id: Optional[uuid.UUID],
    scope: Optional[str] = None,
) -> str:
    return ":".join(
        part for part in (str(case_id or "-"), str(task_id or "-"), scope) if part
    )


async def start_email(
    composer_name: str,
    *,
    case_id: Optional[uuid.UUID] = None,
    task_id: Optional[uuid.UUID] = None,
    run_at: Optional[datetime] = None,
    chase: Optional[Dict[str, Any]] = None,
    on_sent: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
    scope: Optional[str] = None,
    attempt: int = 0,
) -> Optional[ScheduledJob]:
    chain = chain_key(case_id, task_id, scope)
    payload: Dict[str, Any] = {
        "composer": composer_name,
        "chain": chain,
        **(extra or {}),
    }
    if chase:
        payload["followup"] = chase
    if on_sent:
        payload["on_sent"] = on_sent
    return await schedule_job(
        SEND_EMAIL,
        run_at or utcnow(),
        f"{chain}:{composer_name}:{attempt}",
        case_id=case_id,
        task_id=task_id,
        attempt=attempt,
        payload=payload,
    )


async def start_job(
    job_type: str,
    run_at: datetime,
    dedupe_key: str,
    *,
    case_id: Optional[uuid.UUID] = None,
    task_id: Optional[uuid.UUID] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Optional[ScheduledJob]:
    return await schedule_job(
        job_type,
        run_at,
        dedupe_key,
        case_id=case_id,
        task_id=task_id,
        payload=payload or {},
    )
