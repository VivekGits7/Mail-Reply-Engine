import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple

from app import runtime
from app.ai import ClearanceState
from app.ai import helpers as ai
from app.audit import log_action, log_user_action
from app.auth.model import User
from app.cases import Case, CaseFlag, CaseType, Task, TaskStatus
from app.common.enums import SortOrder
from app.common.listing import contains, paginate, sort_in_app
from app.error import ConflictException, NotFoundException
from app.logger import get_logger
from app.mail import Email, Outbound, html_list
from app.people import Person, PersonRole, PersonStatus
from app.runtime.clock import utcnow
from app.worker import ScheduledJob, Skip, composer, followup, start_email
from app.workflows.exits.enums import (
    DEFAULT_CLEARANCE_ITEMS,
    TASK_TEAMS,
    TEAM_LABELS,
    TEAM_TASK_TYPES,
    ClearanceTeam,
    ExitSortBy,
    ExitStage,
)
from app.workflows.exits.schemas import CreateExitRequest

logger = get_logger(__name__)

INTIMATION = "exits.intimation"
FOLLOWUP = "exits.followup"
ESCALATION = "exits.escalation"
BLOCKED_ALERT = "exits.blocked_alert"
ALL_CLEARED = "exits.all_cleared"
CLEARED_STATUSES = {TaskStatus.DONE, TaskStatus.NOT_APPLICABLE}


def _gap_setting(team: ClearanceTeam) -> str:
    return (
        "finance_followup_gap_hours"
        if team == ClearanceTeam.FINANCE
        else "followup_gap_hours"
    )


def _exit_date(value) -> str:
    return value.strftime("%d-%b-%Y") if value else ""


async def _owner(team: ClearanceTeam, person: Person) -> Optional[str]:
    contacts = (await runtime.current()).contacts
    return {
        ClearanceTeam.IT: contacts.it_team,
        ClearanceTeam.FINANCE: contacts.finance_team,
        ClearanceTeam.ADMIN: contacts.admin_team,
        ClearanceTeam.MANAGER: person.manager_email,
    }[team] or None


async def _resolve_person(data: CreateExitRequest, user: User) -> Person:
    if data.person_id:
        person = await Person.find_by_id(uuid.UUID(data.person_id))
        if not person:
            raise NotFoundException("Person not found")
        if data.manager_email:
            person.manager_email = str(data.manager_email)
            person.manager_name = data.manager_name or person.manager_name
        return person
    existing = await Person.find_by_employee_code(data.employee_code)
    if existing:
        return existing
    return await Person(
        full_name=data.full_name,
        work_email=str(data.work_email),
        manager_name=data.manager_name,
        manager_email=str(data.manager_email),
        employee_code=data.employee_code,
        role=PersonRole.EMPLOYEE.value,
    ).insert(created_by=user.user_id)


async def create_exit(
    data: CreateExitRequest, user: User
) -> Tuple[Case, Person, List[Task]]:
    person = await _resolve_person(data, user)
    if await Case.find_active(person.person_id, CaseType.EXIT):
        raise ConflictException("This person already has an open exit case")
    person.status = PersonStatus.EXITING
    person.last_working_day = data.last_working_day
    await person.save()
    case = await Case.create(
        CaseType.EXIT,
        person.person_id,
        ExitStage.CLEARANCE_REQUESTED.value,
        created_by=user.user_id,
    )
    tasks: List[Task] = []
    for team in ClearanceTeam:
        tasks.append(
            await Task.create(
                TEAM_TASK_TYPES[team],
                team.value,
                await _owner(team, person),
                case_id=case.case_id,
                sub_items={item: "pending" for item in DEFAULT_CLEARANCE_ITEMS[team]},
            )
        )
    await log_user_action(
        user.user_id,
        "exit_created",
        case_id=case.case_id,
        entity_type="person",
        entity_id=person.person_id,
    )
    await start_email(INTIMATION, case_id=case.case_id, scope="intimation")
    rs = await runtime.current()
    for task in tasks:
        team = TASK_TEAMS[task.task_type]
        gap = timedelta(hours=getattr(rs, _gap_setting(team)))
        await start_email(
            FOLLOWUP,
            case_id=case.case_id,
            task_id=task.task_id,
            run_at=utcnow() + gap,
            chase=followup(
                FOLLOWUP, _gap_setting(team), "max_followups", escalation=ESCALATION
            ),
            attempt=1,
        )
    return case, person, tasks


async def list_exits(
    search: Optional[str],
    stage: Optional[str],
    status: Optional[str],
    pending_team: Optional[ClearanceTeam],
    lwd_from,
    lwd_to,
    sort_by: ExitSortBy,
    sort_order: SortOrder,
    limit: int,
    offset: int,
) -> Tuple[List[Dict[str, Any]], int]:
    rows = await Case.search(CaseType.EXIT, stage, status, None)
    people = await Person.find_by_ids([row["person_id"] for row in rows])
    items = []
    for row in rows:
        person = people.get(row["person_id"])
        if not person:
            continue
        lwd = row["last_working_day"]
        if (lwd_from and (not lwd or lwd < lwd_from)) or (
            lwd_to and (not lwd or lwd > lwd_to)
        ):
            continue
        if search and not any(
            contains(value, search)
            for value in (person.full_name, person.employee_code, person.work_email)
        ):
            continue
        clearances = {
            TASK_TEAMS[t.task_type].value: t.status.value
            for t in await Task.for_case(row["case_id"])
            if t.task_type in TASK_TEAMS
        }
        if pending_team and clearances.get(pending_team.value) in (
            "done",
            "not_applicable",
        ):
            continue
        items.append({"row": row, "person": person, "clearances": clearances})
    keys = {
        ExitSortBy.LAST_WORKING_DAY: lambda item: item["row"]["last_working_day"],
        ExitSortBy.FULL_NAME: lambda item: item["person"].full_name,
        ExitSortBy.CREATED_AT: lambda item: item["row"]["opened_at"],
    }
    created = (
        keys[ExitSortBy.LAST_WORKING_DAY]
        if sort_by == ExitSortBy.LAST_WORKING_DAY
        else keys[ExitSortBy.CREATED_AT]
    )
    page, total = paginate(
        sort_in_app(items, keys[sort_by], created, sort_order), limit, offset
    )
    return [
        {
            "case_id": str(item["row"]["case_id"]),
            "person_id": str(item["person"].person_id),
            "full_name": item["person"].full_name,
            "employee_code": item["person"].employee_code,
            "last_working_day": item["row"]["last_working_day"].isoformat()
            if item["row"]["last_working_day"]
            else None,
            "stage": item["row"]["stage"],
            "status": item["row"]["status"],
            "flags": list(item["row"]["flags"] or []),
            "clearances": item["clearances"],
            "updated_at": item["row"]["updated_at"].isoformat()
            if item["row"]["updated_at"]
            else None,
        }
        for item in page
    ], total


async def _case_and_person(
    job: ScheduledJob,
) -> Tuple[Optional[Case], Optional[Person]]:
    case = await Case.find_by_id(job.case_id) if job.case_id else None
    person = await Person.find_by_id(case.person_id) if case else None
    return case, person


def _values(person: Person) -> Dict[str, Any]:
    return {
        "employee_name": person.full_name,
        "employee_code": person.employee_code or "",
        "last_working_day": _exit_date(person.last_working_day),
    }


def _pending(task: Task) -> List[str]:
    return [
        key.replace("_", " ").capitalize()
        for key, value in task.sub_items.items()
        if value != "done"
    ]


@composer(INTIMATION)
async def compose_intimation(job: ScheduledJob):
    case, person = await _case_and_person(job)
    if not case or not case.is_active:
        return Skip("exit case not active")
    rs = await runtime.current()
    return Outbound(
        template_key="exit_intimation",
        values=_values(person),
        to=[rs.contacts.offboarding_group, person.manager_email],
        case_id=case.case_id,
    )


@composer(FOLLOWUP)
async def compose_followup(job: ScheduledJob):
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    if not task or task.status not in (TaskStatus.OPEN, TaskStatus.PARTIAL):
        return Skip("clearance closed")
    case, person = await _case_and_person(job)
    if not case or not case.is_active:
        return Skip("exit case not active")
    previous = await Email.latest_in_thread(
        case.case_id, ["exit_intimation", "exit_followup"]
    )
    team = TASK_TEAMS[task.task_type]
    return Outbound(
        template_key="exit_followup",
        values={
            **_values(person),
            "team_name": TEAM_LABELS[team],
            "pending_items": html_list(_pending(task)),
            "attempt": job.attempt,
        },
        to=[task.owner_email],
        reply_to_email_id=previous.email_id if previous else None,
        case_id=case.case_id,
        task_id=task.task_id,
    )


@composer(ESCALATION)
async def compose_escalation(job: ScheduledJob):
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    if not task or task.status not in (
        TaskStatus.OPEN,
        TaskStatus.PARTIAL,
        TaskStatus.ESCALATED,
    ):
        return Skip("clearance closed")
    case, person = await _case_and_person(job)
    rs = await runtime.current()
    await task.update(status=TaskStatus.ESCALATED)
    await log_action(
        "clearance_escalated",
        case_id=case.case_id,
        entity_type="task",
        entity_id=task.task_id,
    )
    return Outbound(
        template_key="exit_escalation",
        values={
            **_values(person),
            "team_name": TEAM_LABELS[TASK_TEAMS[task.task_type]],
            "pending_items": html_list(_pending(task)),
        },
        to=[rs.contacts.hr_owner],
        case_id=case.case_id,
        task_id=task.task_id,
    )


@composer(BLOCKED_ALERT)
async def compose_blocked(job: ScheduledJob):
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    if not task or task.status != TaskStatus.BLOCKED:
        return Skip("no longer blocked")
    case, person = await _case_and_person(job)
    rs = await runtime.current()
    return Outbound(
        template_key="exit_blocked_alert",
        values={
            **_values(person),
            "team_name": TEAM_LABELS[TASK_TEAMS[task.task_type]],
            "blocker": task.progress_notes or "No reason given",
        },
        to=[rs.contacts.hr_owner],
        case_id=case.case_id,
        task_id=task.task_id,
    )


@composer(ALL_CLEARED)
async def compose_all_cleared(job: ScheduledJob):
    case, person = await _case_and_person(job)
    if not case or case.stage != ExitStage.ALL_CLEARED.value:
        return Skip("not all cleared")
    rs = await runtime.current()
    return Outbound(
        template_key="exit_all_cleared",
        values=_values(person),
        to=[rs.contacts.hr_owner],
        case_id=case.case_id,
    )


async def check_all_cleared(case: Case) -> None:
    if not case.is_active or case.case_type != CaseType.EXIT:
        return
    tasks = [
        task
        for task in await Task.for_case(case.case_id)
        if task.task_type in TASK_TEAMS
    ]
    if tasks and all(task.status in CLEARED_STATUSES for task in tasks):
        if case.stage != ExitStage.ALL_CLEARED.value:
            await case.set_stage(ExitStage.ALL_CLEARED.value)
            await log_action(
                "all_clearances_done",
                case_id=case.case_id,
                entity_type="case",
                entity_id=case.case_id,
            )
            await start_email(ALL_CLEARED, case_id=case.case_id, scope="cleared")
    elif case.stage == ExitStage.CLEARANCE_REQUESTED.value and any(
        task.status != TaskStatus.OPEN for task in tasks
    ):
        await case.set_stage(ExitStage.CLEARANCES_IN_PROGRESS.value)


async def _on_blocked(case: Case, task: Task) -> None:
    await ScheduledJob.cancel_pending(task_id=task.task_id)
    await start_email(
        BLOCKED_ALERT, case_id=case.case_id, task_id=task.task_id, scope="blocked"
    )


async def handle_clearance(email: Email, text: str, case: Case) -> None:
    tasks = [
        task
        for task in await Task.for_case(case.case_id)
        if task.task_type in TASK_TEAMS
    ]
    sender = (email.from_email or "").lower()
    sender_task = next(
        (task for task in tasks if task.owner_email and task.owner_email == sender),
        None,
    )
    sender_team = TASK_TEAMS[sender_task.task_type].value if sender_task else None
    person = await Person.find_by_id(case.person_id)
    result = await ai.read_clearance_status(
        text,
        sender_team,
        {TASK_TEAMS[t.task_type].value: list(t.sub_items) for t in tasks},
        known_names=[person.full_name] if person else None,
    )
    rs = await runtime.current()
    team_value = result.team or sender_team
    task = next((t for t in tasks if TASK_TEAMS[t.task_type].value == team_value), None)
    if not task or result.confidence < rs.ai_confidence_threshold:
        await case.add_flags(CaseFlag.NEEDS_HR.value)
        await log_action(
            "clearance_reply_unclear",
            case_id=case.case_id,
            entity_type="email",
            entity_id=email.email_id,
        )
        return
    if task.is_final:
        return
    sub_items = dict(task.sub_items)
    for entry in result.items:
        if entry.item in sub_items:
            sub_items[entry.item] = (
                "done"
                if entry.status in (ClearanceState.DONE, ClearanceState.NOT_APPLICABLE)
                else entry.status.value
            )
    if result.status == ClearanceState.DONE:
        sub_items = {key: "done" for key in sub_items}
        status = TaskStatus.DONE
    elif result.status == ClearanceState.NOT_APPLICABLE:
        status = TaskStatus.NOT_APPLICABLE
    elif result.status == ClearanceState.BLOCKED:
        status = TaskStatus.BLOCKED
    elif result.status == ClearanceState.PARTIAL or any(
        value == "done" for value in sub_items.values()
    ):
        status = TaskStatus.PARTIAL
    else:
        status = task.status
    await task.update(
        status=status,
        sub_items=sub_items,
        progress_notes=result.blocker if status == TaskStatus.BLOCKED else None,
    )
    await log_action(
        "clearance_updated",
        case_id=case.case_id,
        entity_type="task",
        entity_id=task.task_id,
        details={"status": status.value},
    )
    if status in CLEARED_STATUSES:
        await ScheduledJob.cancel_pending(task_id=task.task_id)
    if status == TaskStatus.BLOCKED:
        await _on_blocked(case, task)
    await check_all_cleared(await Case.find_by_id(case.case_id))


async def on_task_updated(task: Task) -> None:
    if not task.case_id or task.task_type not in TASK_TEAMS:
        return
    case = await Case.find_by_id(task.case_id)
    if not case:
        return
    if task.status == TaskStatus.BLOCKED:
        await _on_blocked(case, task)
    await check_all_cleared(case)


async def release_confirm(case_id: uuid.UUID, has_note: bool, user: User) -> Case:
    case = await Case.find_by_id(case_id)
    if not case or case.case_type != CaseType.EXIT:
        raise NotFoundException("Exit case not found")
    if case.stage != ExitStage.ALL_CLEARED.value or not case.is_active:
        raise ConflictException("Every clearance must be complete first")
    await case.close(ExitStage.CLOSED.value)
    person = await Person.find_by_id(case.person_id)
    if person:
        person.status = PersonStatus.EXITED
        await person.save()
    await ScheduledJob.cancel_pending(case_id=case.case_id)
    await log_user_action(
        user.user_id,
        "release_confirmed",
        case_id=case.case_id,
        entity_type="case",
        entity_id=case.case_id,
        details={"has_note": has_note},
    )
    return await Case.find_by_id(case.case_id)
