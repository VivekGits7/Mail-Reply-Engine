import hashlib
import re
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from app import runtime
from app.ai import ReminderIntent
from app.ai import helpers as ai
from app.audit import log_action, log_user_action
from app.auth.model import User
from app.cases import Task, TaskStatus, TaskType
from app.common.enums import SortOrder
from app.common.listing import contains, paginate, sort_in_app
from app.common.tables import read_table
from app.error import BadRequestException, ConflictException, NotFoundException
from app.logger import get_logger
from app.mail import Email, Outbound
from app.mail.defaults import TEMPLATE_DEFAULTS
from app.mail.model import Template
from app.runtime.clock import at_local, local_today, parse_clock, to_local, utcnow
from app.storage import UploadPurpose, verify_upload
from app.storage import service as storage
from app.worker import ScheduledJob, Skip, composer, followup, start_email
from app.workflows.reminders.defaults import REMINDER_RULE_DEFAULTS
from app.workflows.reminders.model import ReminderRule
from app.workflows.reminders.schemas import (
    CreateRuleRequest,
    RuleSortBy,
    RuleTaskSortBy,
    UpdateRuleRequest,
)

logger = get_logger(__name__)

REMINDER = "reminders.reminder"
ESCALATION = "reminders.escalation"
PERFORMANCE_FYI = "reminders.performance_fyi"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
OPEN_STATUSES = {
    TaskStatus.OPEN,
    TaskStatus.PARTIAL,
    TaskStatus.PAUSED,
    TaskStatus.ESCALATED,
}
RESUME_TIME = "10:00"


def next_run(cron: str, after: datetime) -> datetime:
    from croniter import croniter

    return croniter(cron, to_local(after)).get_next(datetime)


def validate_cron(cron: str) -> None:
    from croniter import croniter

    if not croniter.is_valid(cron):
        raise BadRequestException("schedule_cron is not a valid cron expression")


async def _validate_template(key: str) -> None:
    if key not in TEMPLATE_DEFAULTS and not await Template.find(key):
        raise BadRequestException(f"Unknown template_key: {key}")


async def seed_rules() -> None:
    for rule in REMINDER_RULE_DEFAULTS:
        values = {**rule, "is_active": True, "escalate_to_email": None}
        await ReminderRule.create(
            rule["rule_key"],
            values,
            next_run(rule["schedule_cron"], utcnow()),
            insert_only=True,
        )


async def create_rule(data: CreateRuleRequest, user: User) -> ReminderRule:
    if await ReminderRule.find_by_key(data.rule_key):
        raise ConflictException("A rule with this key already exists")
    validate_cron(data.schedule_cron)
    await _validate_template(data.template_key)
    for stage in data.stages:
        await _validate_template(stage.template_key)
    values = data.model_dump(mode="json", exclude={"rule_key"})
    rule = await ReminderRule.create(
        data.rule_key, values, next_run(data.schedule_cron, utcnow())
    )
    await log_user_action(
        user.user_id,
        "reminder_rule_created",
        entity_type="reminder_rule",
        entity_id=rule.reminder_rule_id,
    )
    return rule


async def update_rule(
    rule_id: uuid.UUID, data: UpdateRuleRequest, user: User
) -> ReminderRule:
    rule = await ReminderRule.find_by_id(rule_id)
    if not rule:
        raise NotFoundException("Reminder rule not found")
    changes = data.model_dump(mode="json", exclude_unset=True)
    if "schedule_cron" in changes:
        validate_cron(changes["schedule_cron"])
        changes["next_run_at"] = next_run(changes["schedule_cron"], utcnow())
    if "template_key" in changes:
        await _validate_template(changes["template_key"])
    for stage in changes.get("stages") or []:
        await _validate_template(stage["template_key"])
    await rule.update(changes)
    await rule.refresh_open_count()
    await log_user_action(
        user.user_id,
        "reminder_rule_updated",
        entity_type="reminder_rule",
        entity_id=rule.reminder_rule_id,
        details={"fields": sorted(changes)},
    )
    return rule


async def list_rules(
    search: Optional[str],
    is_active: Optional[bool],
    data_source: Optional[str],
    sort_by: RuleSortBy,
    sort_order: SortOrder,
) -> List[ReminderRule]:
    column = "r.name" if sort_by == RuleSortBy.NAME else "r.created_at"
    if sort_order in (SortOrder.LATEST, SortOrder.OLDEST):
        order = f"r.created_at {'DESC' if sort_order == SortOrder.LATEST else 'ASC'}, r.reminder_rule_id"
    else:
        order = f"{column} {'ASC' if sort_order == SortOrder.A_TO_Z else 'DESC'}, r.reminder_rule_id"
    return await ReminderRule.search(search, is_active, data_source, order)


def _cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def _source_key(rule: ReminderRule, row: Dict[str, str], recipient: str) -> str:
    raw = "|".join(
        [
            rule.rule_key,
            recipient.lower(),
            row.get("item", ""),
            row.get("stage", ""),
            row.get("employee_email", "") or row.get("employee_name", ""),
        ]
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def _stage_of(rule: ReminderRule, row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    if not rule.stages:
        return None
    return next(
        (stage for stage in rule.stages if stage["stage"] == row.get("stage")), None
    )


async def import_list(rule_id: uuid.UUID, file, user: User) -> Dict[str, Any]:
    rule = await ReminderRule.find_by_id(rule_id)
    if not rule:
        raise NotFoundException("Reminder rule not found")
    await verify_upload(file, UploadPurpose.REMINDER_LIST)
    table = read_table(await storage.get_bytes(file.file_url), file.mime_type)
    if not table:
        raise BadRequestException("The file is empty")
    headers = [str(cell or "").strip().lower() for cell in table[0]]
    missing = [
        column
        for column in set(rule.required_columns) | {rule.recipient_field}
        if column not in headers
    ]
    if missing:
        raise BadRequestException(f"Missing columns: {', '.join(sorted(missing))}")
    result = {
        "rows_total": 0,
        "rows_valid": 0,
        "rows_invalid": [],
        "tasks_created": 0,
        "tasks_closed": 0,
        "tasks_reopened": 0,
    }
    seen: set[str] = set()
    open_tasks = {
        task.source_key: task
        for task in await Task.open_rule_tasks(rule.reminder_rule_id)
    }
    done_tasks = {
        task.source_key: task
        for task in await Task.done_rule_tasks(rule.reminder_rule_id)
    }
    for number, raw in enumerate(table[1:], start=2):
        if not any(cell not in (None, "") for cell in raw):
            continue
        result["rows_total"] += 1
        row = {
            headers[i]: _cell(raw[i])
            for i in range(min(len(headers), len(raw)))
            if headers[i]
        }
        stage = _stage_of(rule, row)
        if rule.stages and not stage:
            result["rows_invalid"].append(
                {"row": number, "reason": "stage is missing or unknown"}
            )
            continue
        empty = [column for column in rule.required_columns if not row.get(column)]
        if empty:
            result["rows_invalid"].append(
                {"row": number, "reason": f"{empty[0]} is missing"}
            )
            continue
        recipient = (
            row.get(stage["recipient_field"])
            if stage
            else row.get(rule.recipient_field) or ""
        ).lower()
        if not EMAIL_PATTERN.match(recipient):
            result["rows_invalid"].append(
                {"row": number, "reason": "recipient email is not valid"}
            )
            continue
        result["rows_valid"] += 1
        key = _source_key(rule, row, recipient)
        seen.add(key)
        if key in open_tasks:
            continue
        if key in done_tasks:
            await done_tasks[key].update(status=TaskStatus.OPEN)
            result["tasks_reopened"] += 1
            continue
        due = None
        if row.get("due_date"):
            try:
                due = at_local(
                    date.fromisoformat(row["due_date"][:10]), parse_clock("18:00")
                )
            except ValueError:
                due = None
        task = await Task.create(
            TaskType.REMINDER.value,
            stage["recipient_field"] if stage else rule.recipient_field,
            recipient,
            reminder_rule_id=rule.reminder_rule_id,
            source_ref=row,
            source_key=key,
            due_at=due,
        )
        result["tasks_created"] += 1
        if stage:
            await start_email(
                PERFORMANCE_FYI,
                task_id=task.task_id,
                scope="fyi",
                extra={"rule_id": str(rule.reminder_rule_id)},
            )
    for key, task in open_tasks.items():
        if key not in seen:
            await task.update(
                status=TaskStatus.DONE, progress_notes="No longer in the latest list"
            )
            await ScheduledJob.cancel_pending(task_id=task.task_id)
            result["tasks_closed"] += 1
    await log_user_action(
        user.user_id,
        "reminder_list_imported",
        entity_type="reminder_rule",
        entity_id=rule.reminder_rule_id,
        details={k: v for k, v in result.items() if k != "rows_invalid"},
    )
    return result


async def _start_chase(
    rule: ReminderRule,
    task: Task,
    run_at: Optional[datetime] = None,
    attempt: int = 0,
    scope: Optional[str] = None,
) -> None:
    await start_email(
        REMINDER,
        task_id=task.task_id,
        run_at=run_at,
        attempt=attempt,
        scope=scope,
        extra={"rule_id": str(rule.reminder_rule_id)},
        chase=followup(
            REMINDER,
            rule.followup_gap_hours,
            rule.max_rounds,
            escalation=ESCALATION if rule.escalate_to_email else None,
        ),
    )


async def tick(now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    started = 0
    for rule in await ReminderRule.due(now):
        for task in await Task.open_rule_tasks(rule.reminder_rule_id):
            if (
                task.status != TaskStatus.OPEN
                or task.followups_sent
                or await ScheduledJob.next_pending_at(task_id=task.task_id)
            ):
                continue
            await _start_chase(rule, task)
            started += 1
        await rule.update(
            {"last_run_at": now, "next_run_at": next_run(rule.schedule_cron, now)}
        )
    return started


async def _rule_task(
    job: ScheduledJob,
) -> Tuple[Optional[ReminderRule], Optional[Task]]:
    rule = (
        await ReminderRule.find_by_id(uuid.UUID(job.payload["rule_id"]))
        if job.payload.get("rule_id")
        else None
    )
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    return rule, task


def _recipient_name(task: Task) -> str:
    row = task.source_ref
    if row.get("recipient_name"):
        return row["recipient_name"]
    prefix = task.owner_role.removesuffix("_email")
    return (
        row.get(f"{prefix}_name")
        or ("" if prefix != "employee" else row.get("employee_name", ""))
        or "there"
    )


def _values(task: Task, attempt: int) -> Dict[str, Any]:
    row = task.source_ref
    return {
        "recipient_name": _recipient_name(task),
        "employee_name": row.get("employee_name", ""),
        "item": row.get("item", ""),
        "due_date": row.get("due_date", ""),
        "attempt": attempt,
    }


@composer(REMINDER)
async def compose_reminder(job: ScheduledJob):
    rule, task = await _rule_task(job)
    if (
        not rule
        or not task
        or not rule.is_active
        or task.status not in (TaskStatus.OPEN, TaskStatus.PARTIAL)
    ):
        return Skip("reminder no longer needed")
    stage = _stage_of(rule, task.source_ref)
    previous = await Email.latest_in_task_thread(task.task_id, task.owner_email)
    return Outbound(
        template_key=stage["template_key"] if stage else rule.template_key,
        values=_values(task, job.attempt),
        to=[task.owner_email],
        reply_to_email_id=previous.email_id if previous else None,
        task_id=task.task_id,
    )


@composer(ESCALATION)
async def compose_escalation(job: ScheduledJob):
    rule, task = await _rule_task(job)
    if (
        not rule
        or not task
        or task.status
        not in (TaskStatus.OPEN, TaskStatus.PARTIAL, TaskStatus.ESCALATED)
        or not rule.escalate_to_email
    ):
        return Skip("no escalation needed")
    await task.update(status=TaskStatus.ESCALATED)
    values = _values(task, job.attempt)
    return Outbound(
        template_key="reminder_escalation",
        values={
            "rule_name": rule.name,
            "recipient_name": values["recipient_name"]
            if values["recipient_name"] != "there"
            else task.owner_email,
            "item": values["item"],
        },
        to=[rule.escalate_to_email],
        task_id=task.task_id,
    )


@composer(PERFORMANCE_FYI)
async def compose_performance_fyi(job: ScheduledJob):
    rule, task = await _rule_task(job)
    rs = await runtime.current()
    if not rule or not task or not rs.contacts.performance_team:
        return Skip("no performance team configured")
    stage = _stage_of(rule, task.source_ref)
    return Outbound(
        template_key="appraisal_performance_update",
        values={
            "employee_name": task.source_ref.get("employee_name", ""),
            "stage": (stage or {}).get("stage", "").replace("_", " "),
        },
        to=[rs.contacts.performance_team],
        task_id=task.task_id,
    )


async def handle_reply(email: Email, text: str) -> Optional[str]:
    tasks = [
        task
        for task in await Task.open_for_owner(email.from_email or "")
        if task.task_type == TaskType.REMINDER.value
    ]
    if not tasks:
        return None
    task = tasks[0]
    result = await ai.read_reminder_reply(text, local_today())
    rs = await runtime.current()
    if result.confidence < rs.ai_confidence_threshold:
        await task.update(progress_notes="Reply needs HR review")
        return "unclear"
    if result.intent == ReminderIntent.DONE:
        await task.update(
            status=TaskStatus.DONE,
            progress_notes="Marked done by reply, re-checked on the next list",
        )
        await ScheduledJob.cancel_pending(task_id=task.task_id)
    elif result.intent == ReminderIntent.ON_LEAVE:
        await ScheduledJob.cancel_pending(task_id=task.task_id)
        back: Optional[date] = None
        if result.return_date:
            try:
                back = date.fromisoformat(result.return_date)
            except ValueError:
                back = None
        if back:
            resume_at = at_local(back, parse_clock(RESUME_TIME))
            await task.update(
                status=TaskStatus.PAUSED,
                paused_until=resume_at,
                progress_notes="On leave",
            )
            rule = await ReminderRule.find_by_id(task.reminder_rule_id)
            if rule:
                await _start_chase(
                    rule,
                    task,
                    run_at=resume_at,
                    attempt=task.followups_sent + 1,
                    scope=f"resume-{back.isoformat()}",
                )
        else:
            await task.update(
                status=TaskStatus.PAUSED,
                progress_notes="On leave, no return date given, needs HR",
            )
    await log_action(
        "reminder_reply_read",
        entity_type="task",
        entity_id=task.task_id,
        details={"intent": result.intent.value},
    )
    return result.intent.value


async def list_tasks(
    rule_id: uuid.UUID,
    search: Optional[str],
    status: Optional[str],
    sort_by: RuleTaskSortBy,
    sort_order: SortOrder,
    limit: int,
    offset: int,
):
    if not await ReminderRule.find_by_id(rule_id):
        raise NotFoundException("Reminder rule not found")
    tasks = await Task.for_rule(rule_id, status)
    matched = [
        t
        for t in tasks
        if not search
        or contains(t.owner_email, search)
        or contains(str(t.source_ref.get("employee_name", "")), search)
    ]
    key = (
        (lambda t: t.due_at)
        if sort_by == RuleTaskSortBy.DUE_AT
        else (lambda t: t.created_at)
    )
    page, total = paginate(
        sort_in_app(matched, key, lambda t: t.created_at, sort_order), limit, offset
    )
    items = []
    for task in page:
        next_at = await ScheduledJob.next_pending_at(task_id=task.task_id)
        items.append(
            {
                "task_id": str(task.task_id),
                "owner_email": task.owner_email,
                "status": task.status.value,
                "followups_sent": task.followups_sent,
                "next_followup_at": next_at.isoformat() if next_at else None,
                "details": task.source_ref,
                "paused_until": task.paused_until.isoformat()
                if task.paused_until
                else None,
                "completed_at": task.completed_at.isoformat()
                if task.completed_at
                else None,
            }
        )
    return items, total
