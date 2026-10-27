import uuid
from datetime import date, datetime, timedelta
from itertools import pairwise
from typing import Any, Dict, List, Optional, Tuple

from app import runtime
from app.admin.enums import InductionTrack
from app.admin.model import InductionTemplate
from app.ai import helpers as ai
from app.audit import log_action, log_user_action
from app.auth.model import User
from app.cases import (
    Approval,
    ApprovalType,
    Case,
    CaseFlag,
    CaseStatus,
    CaseType,
    Task,
    TaskStatus,
    TaskType,
)
from app.common.attachment import FileAttachment
from app.common.enums import HireCategory
from app.error import BadRequestException, ConflictException, NotFoundException
from app.graph import calendar
from app.logger import get_logger
from app.mail import Attachment, Email, Outbound, html_grid
from app.mail.templating import render
from app.people import Person
from app.runtime.clock import at_local, local_tz, parse_clock, to_local, utcnow
from app.storage import UploadPurpose, verify_upload
from app.worker import (
    Hold,
    ScheduledJob,
    Skip,
    composer,
    enqueue_event,
    followup,
    sent_hook,
    start_email,
)
from app.workflows.induction.enums import (
    SETTLED_SESSION_STATUSES,
    InductionStage,
    SessionStatus,
)
from app.workflows.induction.model import InductionSession

logger = get_logger(__name__)

AVAILABILITY = "induction.availability_request"
AVAILABILITY_FOLLOWUP = "induction.followup"
NO_REPLY = "induction.no_reply"
WELCOME = "induction.welcome"
WELCOME_SENT = "induction.welcome_sent"
LETTER_CHECK = "induction.letter_check"
SESSION_GAP = timedelta(minutes=15)
WELCOME_RETRY = timedelta(hours=1)


def pick_track(person: Person, senior_words: List[str]) -> InductionTrack:
    if person.hire_category == HireCategory.CAMPUS:
        return InductionTrack.CAMPUS
    designation = (person.designation or "").lower()
    if any(word in designation for word in senior_words):
        return InductionTrack.SENIOR
    return InductionTrack.MID


def show_time(moment: datetime) -> str:
    return to_local(moment).strftime("%a %d %b %Y, %I:%M %p IST")


async def resolve_owner(token: str, person: Person) -> Optional[str]:
    if "@" in token:
        return token.lower()
    if token == "manager":
        return person.manager_email
    return getattr((await runtime.current()).contacts, token, "") or None


async def plan(
    onboarding_case_id: uuid.UUID,
    user: Optional[User] = None,
    track: Optional[InductionTrack] = None,
) -> Case:
    parent = await Case.find_by_id(onboarding_case_id)
    if not parent or parent.case_type != CaseType.ONBOARDING:
        raise NotFoundException("Onboarding case not found")
    person = await Person.find_by_id(parent.person_id)
    if not person or not person.joining_date:
        raise BadRequestException("The joiner has no joining date yet")
    if await Case.find_active(person.person_id, CaseType.INDUCTION):
        raise ConflictException("Induction is already planned for this joiner")
    rs = await runtime.current()
    chosen = track or pick_track(person, rs.senior_track_designations)
    case = await Case.create(
        CaseType.INDUCTION,
        person.person_id,
        InductionStage.DRAFTING.value,
        created_by=user.user_id if user else None,
        parent_case_id=parent.case_id,
        track=chosen.value,
    )
    if user:
        await log_user_action(
            user.user_id,
            "induction_planned",
            case_id=case.case_id,
            entity_type="case",
            entity_id=case.case_id,
            details={"track": chosen.value},
        )
    else:
        await log_action(
            "induction_planned",
            case_id=case.case_id,
            entity_type="case",
            entity_id=case.case_id,
            details={"track": chosen.value},
        )
    await enqueue_event(
        "induction.draft",
        {"case_id": str(case.case_id)},
        source="system",
        dedupe_key=f"induction-draft:{case.case_id}",
        case_id=case.case_id,
    )
    return case


async def start_from_onboarding(onboarding_case_id: uuid.UUID) -> None:
    parent = await Case.find_by_id(onboarding_case_id)
    if not parent:
        return
    person = await Person.find_by_id(parent.person_id)
    if (
        not person
        or not person.joining_date
        or person.joining_date < runtime.local_today()
    ):
        return
    if await Case.find_active(person.person_id, CaseType.INDUCTION):
        return
    await plan(onboarding_case_id)


def _fallback_plan(
    sessions: List[Dict[str, Any]], days: List[date], day_start: str, day_end: str
) -> List[Tuple[int, datetime, datetime]]:
    cursors: Dict[date, datetime] = {}
    planned = []
    start_clock, end_clock = parse_clock(day_start), parse_clock(day_end)
    for session in sorted(sessions, key=lambda s: (s["day_number"], s["index"])):
        day_index = min(session["day_number"], len(days)) - 1
        while True:
            day = days[day_index]
            begin = cursors.get(day, at_local(day, start_clock))
            finish = begin + timedelta(minutes=session["duration_mins"])
            if finish <= at_local(day, end_clock) or day_index == len(days) - 1:
                break
            day_index += 1
        cursors[day] = finish + SESSION_GAP
        planned.append((session["index"], begin, finish))
    return planned


def _valid_ai_plan(
    result,
    sessions: List[Dict[str, Any]],
    days: List[date],
    day_start: str,
    day_end: str,
) -> Optional[List[Tuple[int, datetime, datetime]]]:
    by_index = {s["index"]: s for s in sessions}
    planned: List[Tuple[int, datetime, datetime]] = []
    try:
        for entry in result.sessions:
            start, end = (
                datetime.fromisoformat(entry.start),
                datetime.fromisoformat(entry.end),
            )
            session = by_index[entry.index]
            local_start, local_end = to_local(start), to_local(end)
            if (
                local_start.date() not in days
                or local_start.time() < parse_clock(day_start)
                or local_end.time() > parse_clock(day_end)
            ):
                return None
            if (end - start) != timedelta(minutes=session["duration_mins"]):
                return None
            planned.append((entry.index, start, end))
    except (KeyError, ValueError):
        return None
    if sorted(index for index, _, _ in planned) != sorted(by_index):
        return None
    ordered = sorted(planned, key=lambda item: item[1])
    if any(nxt[1] < cur[2] for cur, nxt in pairwise(ordered)):
        return None
    return planned


async def build_draft(case_id: uuid.UUID) -> Optional[Approval]:
    case = await Case.find_by_id(case_id)
    if not case or case.stage != InductionStage.DRAFTING.value:
        return None
    person = await Person.find_by_id(case.person_id)
    template = await InductionTemplate.find(case.track or InductionTrack.MID.value)
    if not template or not template.sessions:
        await case.add_flags(CaseFlag.NEEDS_HR.value)
        await log_action("induction_template_missing", case_id=case.case_id)
        return None
    rs = await runtime.current()
    sessions = [
        {
            "index": index,
            "title": s["title"],
            "duration_mins": s["duration_mins"],
            "day_number": s["day_number"],
        }
        for index, s in enumerate(template.sessions)
    ]
    holidays = await runtime.holidays(person.location)
    days = runtime.working_days_from(
        person.joining_date,
        max(s["day_number"] for s in sessions),
        rs.working_days,
        holidays,
    )
    offset = to_local(utcnow()).strftime("%z")
    note = ""
    planned = None
    try:
        result = await ai.build_induction_schedule(
            sessions,
            days,
            rs.induction_day_start,
            rs.induction_day_end,
            f"{offset[:3]}:{offset[3:]}",
        )
        planned = _valid_ai_plan(
            result, sessions, days, rs.induction_day_start, rs.induction_day_end
        )
        note = result.notes
    except Exception as e:
        logger.warning(
            f"AI induction draft failed with {type(e).__name__}, using the standard planner"
        )
    if planned is None:
        planned = _fallback_plan(
            sessions, days, rs.induction_day_start, rs.induction_day_end
        )
        note = note or "Planned with the standard planner"
    draft_sessions = []
    for index, start, end in sorted(planned, key=lambda item: item[1]):
        source = template.sessions[index]
        draft_sessions.append(
            {
                "title": source["title"],
                "owner_email": source["owner_email"],
                "start": to_local(start).isoformat(),
                "end": to_local(end).isoformat(),
            }
        )
    approval = await Approval.create(
        ApprovalType.INDUCTION_SCHEDULE,
        {"track": case.track, "sessions": draft_sessions, "notes": note},
        case_id=case.case_id,
        summary=f"Induction plan for {person.full_name}, {len(draft_sessions)} sessions",
    )
    await case.set_stage(InductionStage.AWAITING_APPROVAL.value)
    await log_action(
        "induction_drafted",
        case_id=case.case_id,
        entity_type="approval",
        entity_id=approval.approval_id,
    )
    return approval


async def validate_sessions(
    sessions: List[Dict[str, Any]], location: Optional[str]
) -> None:
    rs = await runtime.current()
    holidays = await runtime.holidays(location)
    for session in sessions:
        try:
            start, end = (
                datetime.fromisoformat(str(session["start"])),
                datetime.fromisoformat(str(session["end"])),
            )
        except (KeyError, ValueError):
            raise BadRequestException(
                "Every session needs a valid start and end"
            ) from None
        if start.tzinfo is None or end <= start:
            raise BadRequestException(
                f"{session.get('title', 'A session')} needs a timezone and an end after the start"
            )
        local_start, local_end = to_local(start), to_local(end)
        if not runtime.is_working_day(local_start.date(), rs.working_days, holidays):
            raise BadRequestException(
                f"{session.get('title', 'A session')} falls on a weekend or holiday"
            )
        if local_start.time() < parse_clock(
            rs.induction_day_start
        ) or local_end.time() > parse_clock(rs.induction_day_end):
            raise BadRequestException(
                f"{session.get('title', 'A session')} is outside induction hours"
            )
        if (
            not str(session.get("title", "")).strip()
            or not str(session.get("owner_email", "")).strip()
        ):
            raise BadRequestException("Every session needs a title and an owner")


async def on_approved(approval: Approval) -> int:
    case = await Case.find_by_id(approval.case_id)
    if not case or not case.is_active:
        return 0
    person = await Person.find_by_id(case.person_id)
    rs = await runtime.current()
    created = 0
    for order, item in enumerate(approval.draft.get("sessions", [])):
        owner = await resolve_owner(str(item["owner_email"]), person)
        session = await InductionSession.create(
            case.case_id,
            item["title"],
            owner,
            datetime.fromisoformat(item["start"]),
            datetime.fromisoformat(item["end"]),
            order,
        )
        task = await Task.create(
            TaskType.INDUCTION_AVAILABILITY.value,
            "session_owner",
            owner,
            case_id=case.case_id,
            source_ref={"session_id": str(session.induction_session_id)},
        )
        await session.update(status=SessionStatus.ASKED.value)
        await start_email(
            AVAILABILITY,
            case_id=case.case_id,
            task_id=task.task_id,
            extra={"session_id": str(session.induction_session_id)},
            chase=followup(
                AVAILABILITY_FOLLOWUP,
                "induction_followup_after_days",
                "induction_max_followups",
                escalation=NO_REPLY,
                unit="days",
            ),
        )
        created += 1
    await case.set_stage(InductionStage.BOOKING.value)
    welcome_at = at_local(person.joining_date, parse_clock(rs.welcome_email_time))
    # A weekend check would wait for Monday's window, too late for a Monday joiner.
    check_at = at_local(
        runtime.previous_working_day(
            person.joining_date, rs.sending_days, await runtime.holidays()
        ),
        parse_clock(rs.appointment_letter_check_time),
    )
    await start_email(
        WELCOME,
        case_id=case.case_id,
        scope="welcome",
        run_at=max(welcome_at, utcnow()),
        on_sent=WELCOME_SENT,
    )
    if check_at > utcnow():
        await start_email(
            LETTER_CHECK, case_id=case.case_id, scope="letter-check", run_at=check_at
        )
    await log_action(
        "induction_approved",
        case_id=case.case_id,
        entity_type="approval",
        entity_id=approval.approval_id,
        details={"sessions": created},
    )
    return created


async def on_rejected(approval: Approval) -> None:
    case = await Case.find_by_id(approval.case_id)
    if case and case.is_active:
        await case.set_status(CaseStatus.CANCELLED)
        await log_action(
            "induction_plan_rejected",
            case_id=case.case_id,
            entity_type="approval",
            entity_id=approval.approval_id,
        )


def _task_for_session(tasks: List[Task], session: InductionSession) -> Optional[Task]:
    return next(
        (
            t
            for t in tasks
            if t.source_ref.get("session_id") == str(session.induction_session_id)
        ),
        None,
    )


async def _check_booked(case: Case) -> None:
    sessions = await InductionSession.for_case(case.case_id)
    if (
        sessions
        and all(s.status in SETTLED_SESSION_STATUSES for s in sessions)
        and case.stage == InductionStage.BOOKING.value
    ):
        await case.set_stage(InductionStage.BOOKED.value)


async def book(
    session: InductionSession, start: datetime, end: datetime, force: bool
) -> InductionSession:
    case = await Case.find_by_id(session.case_id)
    person = await Person.find_by_id(case.person_id)
    rs = await runtime.current()
    if rs.kill_switch:
        await session.update(
            status=SessionStatus.AGREED.value, agreed_start=start, agreed_end=end
        )
        raise ConflictException(
            "Sending is stopped, the invite will be sent once the kill switch is off"
        )
    if (
        session.owner_email
        and not force
        and not await calendar.is_free(session.owner_email, start, end)
    ):
        await session.update(
            status=SessionStatus.CONFLICT.value, agreed_start=start, agreed_end=end
        )
        await case.add_flags(CaseFlag.CALENDAR_CONFLICT.value)
        raise ConflictException("The owner is busy at that time")
    joiner = person.work_email or person.personal_email
    attendees = [address for address in (session.owner_email, joiner) if address]
    if rs.dry_run:
        attendees = [rs.test_inbox] if rs.test_inbox else []
    subject, body = await render(
        "induction_calendar_invite",
        {"session_title": session.title, "joiner_name": person.full_name},
    )
    event_id = await calendar.create_event(subject, body, start, end, attendees)
    await session.update(
        status=SessionStatus.BOOKED.value,
        agreed_start=start,
        agreed_end=end,
        graph_event_id=event_id,
    )
    tasks = await Task.for_case(case.case_id)
    task = _task_for_session(tasks, session)
    if task:
        await task.update(status=TaskStatus.DONE)
        await ScheduledJob.cancel_pending(task_id=task.task_id)
    await log_action(
        "induction_session_booked",
        case_id=case.case_id,
        entity_type="induction_session",
        entity_id=session.induction_session_id,
        details={"dry_run": rs.dry_run},
    )
    await _check_booked(case)
    return session


async def book_manual(
    session_id: uuid.UUID, start: datetime, end: datetime, force: bool, user: User
) -> InductionSession:
    session = await InductionSession.find_by_id(session_id)
    if not session:
        raise NotFoundException("Session not found")
    case = await Case.find_by_id(session.case_id)
    if not case or not case.is_active:
        raise ConflictException("This induction is closed")
    booked = await book(session, start, end, force)
    await log_user_action(
        user.user_id,
        "induction_session_booked_by_hr",
        case_id=case.case_id,
        entity_type="induction_session",
        entity_id=session.induction_session_id,
    )
    return booked


async def handle_availability(email: Email, text: str) -> bool:
    sessions = await InductionSession.asked_for_owner(email.from_email or "")
    if not sessions:
        return False
    session = sessions[0]
    case = await Case.find_by_id(session.case_id)
    person = await Person.find_by_id(case.person_id)
    rs = await runtime.current()
    result = await ai.read_availability(
        text,
        session.proposed_start,
        session.proposed_end,
        known_names=[person.full_name],
    )
    if result.confidence < rs.ai_confidence_threshold:
        await case.add_flags(CaseFlag.NEEDS_HR.value)
        await log_action(
            "availability_reply_unclear",
            case_id=case.case_id,
            entity_type="email",
            entity_id=email.email_id,
        )
        return True
    if result.accepts_proposed:
        start, end = session.proposed_start, session.proposed_end
    elif result.alternatives:
        try:
            start, end = (
                datetime.fromisoformat(result.alternatives[0].start),
                datetime.fromisoformat(result.alternatives[0].end),
            )
        except ValueError:
            await case.add_flags(CaseFlag.NEEDS_HR.value)
            return True
        if start.tzinfo is None:
            start, end = (
                start.replace(tzinfo=local_tz()),
                end.replace(tzinfo=local_tz()),
            )
        await session.update(status=SessionStatus.ALTERNATIVE.value)
    else:
        await case.add_flags(CaseFlag.NEEDS_HR.value)
        return True
    try:
        await book(session, start, end, force=False)
    except ConflictException:
        tasks = await Task.for_case(case.case_id)
        task = _task_for_session(tasks, session)
        if task:
            await ScheduledJob.cancel_pending(task_id=task.task_id)
        await _check_booked(case)
    return True


async def upload_letter(
    case_id: uuid.UUID, file: FileAttachment, user: User
) -> Attachment:
    case = await Case.find_by_id(case_id)
    if not case or case.case_type not in (CaseType.ONBOARDING, CaseType.INDUCTION):
        raise NotFoundException("Onboarding or induction case not found")
    size = await verify_upload(file, UploadPurpose.APPOINTMENT_LETTER)
    attachment = await Attachment.create(
        file_name=file.file_name,
        mime_type=file.mime_type,
        size_bytes=size,
        storage_key=file.file_url,
        sha256=None,
        kind="appointment_letter",
        case_id=case.case_id,
        check_status="skipped",
        uploaded_by=user.user_id,
    )
    await Attachment.supersede(
        "appointment_letter", case.case_id, attachment.attachment_id
    )
    for related in [case] + await Case.children(case.case_id):
        await related.remove_flags(CaseFlag.APPOINTMENT_LETTER_MISSING.value)
    if case.parent_case_id:
        parent = await Case.find_by_id(case.parent_case_id)
        if parent:
            await parent.remove_flags(CaseFlag.APPOINTMENT_LETTER_MISSING.value)
    await log_user_action(
        user.user_id,
        "appointment_letter_uploaded",
        case_id=case.case_id,
        entity_type="attachment",
        entity_id=attachment.attachment_id,
    )
    return attachment


async def _letter(case: Case) -> Optional[Attachment]:
    case_ids = [case.case_id] + ([case.parent_case_id] if case.parent_case_id else [])
    return await Attachment.latest_of_kind("appointment_letter", case_ids)


async def _session_task(
    job: ScheduledJob,
) -> Tuple[Optional[Case], Optional[InductionSession], Optional[Task]]:
    case = await Case.find_by_id(job.case_id) if job.case_id else None
    session = (
        await InductionSession.find_by_id(uuid.UUID(job.payload["session_id"]))
        if job.payload.get("session_id")
        else None
    )
    task = await Task.find_by_id(job.task_id) if job.task_id else None
    return case, session, task


@composer(AVAILABILITY)
async def compose_availability(job: ScheduledJob):
    case, session, task = await _session_task(job)
    if (
        not case
        or not case.is_active
        or not session
        or session.status != SessionStatus.ASKED.value
    ):
        return Skip("session no longer waiting")
    person = await Person.find_by_id(case.person_id)
    minutes = int((session.proposed_end - session.proposed_start).total_seconds() // 60)
    return Outbound(
        template_key="induction_availability_request",
        values={
            "session_title": session.title,
            "proposed_time": show_time(session.proposed_start),
            "duration": minutes,
            "joiner_name": person.full_name,
        },
        to=[session.owner_email],
        case_id=case.case_id,
        task_id=task.task_id if task else None,
    )


@composer(AVAILABILITY_FOLLOWUP)
async def compose_availability_followup(job: ScheduledJob):
    case, session, task = await _session_task(job)
    if (
        not case
        or not case.is_active
        or not session
        or session.status != SessionStatus.ASKED.value
    ):
        return Skip("session no longer waiting")
    person = await Person.find_by_id(case.person_id)
    previous = (
        await Email.latest_in_task_thread(task.task_id, session.owner_email)
        if task
        else None
    )
    return Outbound(
        template_key="induction_followup",
        values={
            "session_title": session.title,
            "proposed_time": show_time(session.proposed_start),
            "joiner_name": person.full_name,
            "attempt": job.attempt,
        },
        to=[session.owner_email],
        reply_to_email_id=previous.email_id if previous else None,
        case_id=case.case_id,
        task_id=task.task_id if task else None,
    )


@composer(NO_REPLY)
async def compose_no_reply(job: ScheduledJob):
    case, session, task = await _session_task(job)
    if (
        not case
        or not session
        or session.status
        not in (SessionStatus.ASKED.value, SessionStatus.NO_REPLY.value)
    ):
        return Skip("session no longer waiting")
    person = await Person.find_by_id(case.person_id)
    rs = await runtime.current()
    await session.update(status=SessionStatus.NO_REPLY.value)
    await case.add_flags(CaseFlag.INDUCTION_NO_REPLY.value)
    if task:
        await task.update(status=TaskStatus.ESCALATED)
    await _check_booked(case)
    return Outbound(
        template_key="induction_no_reply_alert",
        values={"session_title": session.title, "joiner_name": person.full_name},
        to=[rs.contacts.hr_owner],
        case_id=case.case_id,
        task_id=task.task_id if task else None,
    )


@composer(WELCOME)
async def compose_welcome(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id) if job.case_id else None
    if not case or not case.is_active:
        return Skip("induction not active")
    person = await Person.find_by_id(case.person_id)
    letter = await _letter(case)
    if not letter:
        await case.add_flags(CaseFlag.APPOINTMENT_LETTER_MISSING.value)
        end_of_day = at_local(person.joining_date, parse_clock("18:00"))
        if utcnow() < end_of_day:
            return Hold(utcnow() + WELCOME_RETRY, "appointment letter missing")
        return Skip("appointment letter never uploaded")
    sou = await Attachment.latest_of_kind("statement_of_understanding")
    sessions = await InductionSession.for_case(case.case_id)
    rows = [
        [
            s.title,
            show_time(s.agreed_start or s.proposed_start),
            "Confirmed"
            if s.status == SessionStatus.BOOKED.value
            else "To be confirmed",
        ]
        for s in sessions
    ]
    return Outbound(
        template_key="welcome_email",
        values={
            "joiner_name": person.full_name,
            "joining_date": person.joining_date.strftime("%d %b %Y"),
            "manager_name": person.manager_name or "your manager",
            "schedule_table": html_grid(["Session", "When", "Status"], rows),
        },
        to=[person.personal_email or person.work_email],
        cc=[person.work_email] if person.personal_email and person.work_email else [],
        attachment_ids=[a.attachment_id for a in (letter, sou) if a],
        case_id=case.case_id,
    )


@sent_hook(WELCOME_SENT)
async def on_welcome_sent(job: ScheduledJob) -> None:
    case = await Case.find_by_id(job.case_id) if job.case_id else None
    if case and case.is_active:
        await case.close(InductionStage.WELCOME_SENT.value)
        await log_action(
            "welcome_sent",
            case_id=case.case_id,
            entity_type="case",
            entity_id=case.case_id,
        )


@composer(LETTER_CHECK)
async def compose_letter_check(job: ScheduledJob):
    case = await Case.find_by_id(job.case_id) if job.case_id else None
    if not case or not case.is_active or await _letter(case):
        return Skip("letter present or induction closed")
    person = await Person.find_by_id(case.person_id)
    rs = await runtime.current()
    await case.add_flags(CaseFlag.APPOINTMENT_LETTER_MISSING.value)
    return Outbound(
        template_key="appointment_letter_missing",
        values={
            "joiner_name": person.full_name,
            "joining_date": person.joining_date.strftime("%d %b %Y"),
        },
        to=[rs.contacts.hr_owner],
        case_id=case.case_id,
    )
