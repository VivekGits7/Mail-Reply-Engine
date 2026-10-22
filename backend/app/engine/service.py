import uuid
from typing import Any, Dict, Optional

from app.cases import Approval, ApprovalType, Case, Task
from app.engine import inbound, jobs, replies
from app.worker import Event, register
from app.workflows.exits import service as exits
from app.workflows.feedback import service as feedback
from app.workflows.induction import service as induction
from app.workflows.onboarding import service as onboarding

_ready = False


async def _job_due(payload: Dict[str, Any], event: Optional[Event] = None) -> None:
    await jobs.run_job(uuid.UUID(payload["scheduled_job_id"]))


async def _check_document(
    payload: Dict[str, Any], event: Optional[Event] = None
) -> None:
    await onboarding.check_attachment(uuid.UUID(payload["attachment_id"]))


async def _it_completed(payload: Dict[str, Any], event: Optional[Event] = None) -> None:
    await induction.start_from_onboarding(uuid.UUID(payload["case_id"]))


async def _induction_draft(
    payload: Dict[str, Any], event: Optional[Event] = None
) -> None:
    await induction.build_draft(uuid.UUID(payload["case_id"]))


async def _approval_approved(
    payload: Dict[str, Any], event: Optional[Event] = None
) -> None:
    approval = await Approval.find_by_id(uuid.UUID(payload["approval_id"]))
    if not approval:
        return
    if approval.approval_type == ApprovalType.REPLY:
        await replies.queue_approved_reply(approval)
    else:
        await induction.on_approved(approval)


async def _approval_rejected(
    payload: Dict[str, Any], event: Optional[Event] = None
) -> None:
    approval = await Approval.find_by_id(uuid.UUID(payload["approval_id"]))
    if approval and approval.approval_type == ApprovalType.INDUCTION_SCHEDULE:
        await induction.on_rejected(approval)


async def _task_updated(payload: Dict[str, Any], event: Optional[Event] = None) -> None:
    task = await Task.find_by_id(uuid.UUID(payload["task_id"]))
    if task:
        await onboarding.on_task_updated(task)
        await exits.on_task_updated(task)


async def _case_reopened(
    payload: Dict[str, Any], event: Optional[Event] = None
) -> None:
    case = await Case.find_by_id(uuid.UUID(payload["case_id"]))
    if case:
        await onboarding.on_case_reopened(case)


async def _feedback_report(
    payload: Dict[str, Any], event: Optional[Event] = None
) -> None:
    await feedback.build_report(uuid.UUID(payload["feedback_report_id"]))


def setup_engine() -> None:
    global _ready
    if _ready:
        return
    register("email.received", inbound.process_email)
    register("job.due", _job_due)
    register("documents.check", _check_document)
    register("it.completed", _it_completed)
    register("induction.draft", _induction_draft)
    register("approval.approved", _approval_approved)
    register("approval.rejected", _approval_rejected)
    register("task.updated", _task_updated)
    register("case.reopened", _case_reopened)
    register("feedback.report", _feedback_report)
    _ready = True
