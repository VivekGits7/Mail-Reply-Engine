import uuid
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app import runtime
from app.ai import helpers as ai
from app.audit import log_action, log_user_action
from app.auth.model import User
from app.cases import Case, CaseType, Task, TaskStatus, TaskType
from app.common.enums import HireCategory, SortOrder
from app.common.listing import contains, paginate, sort_in_app
from app.common.tables import read_table
from app.error import ConflictException, NotFoundException
from app.graph import excel
from app.logger import get_logger
from app.mail import Outbound
from app.people import Person
from app.runtime.clock import local_today
from app.storage import UploadPurpose, verify_upload
from app.storage import service as storage
from app.worker import (
    ScheduledJob,
    Skip,
    composer,
    enqueue_event,
    followup,
    sent_hook,
    start_email,
)
from app.workflows.feedback.model import FeedbackReport, SurveyResponse
from app.workflows.feedback.schemas import SurveySortBy, SurveyStatus
from app.workflows.feedback.utils import (
    EMAIL_HEADERS,
    SCORE_HEADERS,
    answers_of,
    build_pdf,
    find_column,
    row_score,
)

logger = get_logger(__name__)

MILESTONES = (30, 60, 90)
INVITE = "feedback.survey_invite"
REMINDER = "feedback.survey_reminder"
INVITE_SENT = "feedback.invite_sent"
LOW_SCORE = "feedback.low_score_alert"
REPORT_MAIL = "feedback.report_mail"
REPORT_SENT = "feedback.report_sent"


async def _feedback_case(person: Person) -> Case:
    case = await Case.find_active(person.person_id, CaseType.FEEDBACK)
    return case or await Case.create(CaseType.FEEDBACK, person.person_id, "active")


async def run_daily(today: Optional[date] = None) -> int:
    today = today or local_today()
    rs = await runtime.current()
    dates = [today - timedelta(days=days) for days in MILESTONES]
    started = 0
    for person in await Person.due_for_survey(dates, rs.survey_levels):
        milestone = (today - person.joining_date).days
        variant = (person.hire_category or HireCategory.LATERAL).value
        case = await _feedback_case(person)
        survey = await SurveyResponse.create(
            person.person_id, case.case_id, milestone, variant
        )
        if survey is None:
            continue
        task = await Task.create(
            TaskType.SURVEY_RESPONSE.value,
            "employee",
            person.contact_email,
            case_id=case.case_id,
            source_ref={"milestone": milestone},
        )
        await survey.attach_task(task.task_id)
        await start_email(
            INVITE,
            case_id=case.case_id,
            task_id=task.task_id,
            extra={"survey_response_id": str(survey.survey_response_id)},
            chase=followup(
                REMINDER,
                "survey_reminder_after_days",
                "survey_max_reminders",
                unit="days",
            ),
            on_sent=INVITE_SENT,
        )
        await log_action(
            "survey_started",
            case_id=case.case_id,
            entity_type="survey",
            entity_id=survey.survey_response_id,
            details={"milestone": milestone},
        )
        started += 1
    return started


async def _survey_job(
    job: ScheduledJob,
) -> Tuple[Optional[SurveyResponse], Optional[Person]]:
    survey = (
        await SurveyResponse.find_by_id(uuid.UUID(job.payload["survey_response_id"]))
        if job.payload.get("survey_response_id")
        else None
    )
    person = await Person.find_by_id(survey.person_id) if survey else None
    return survey, person


async def _form_link(variant: str) -> str:
    return (await runtime.current()).survey_form_links.get(variant, "")


@composer(INVITE)
async def compose_invite(job: ScheduledJob):
    survey, person = await _survey_job(job)
    if not survey or survey.responded_at:
        return Skip("survey answered")
    link = await _form_link(survey.form_variant)
    if not link:
        return Skip("no form link configured for this hire category")
    return Outbound(
        template_key="survey_invite",
        values={
            "employee_name": person.first_name,
            "milestone": survey.milestone,
            "form_link": link,
        },
        to=[person.contact_email],
        case_id=survey.case_id,
        task_id=survey.task_id,
    )


@composer(REMINDER)
async def compose_reminder(job: ScheduledJob):
    survey, person = await _survey_job(job)
    if not survey or survey.responded_at:
        return Skip("survey answered")
    link = await _form_link(survey.form_variant)
    if not link:
        return Skip("no form link configured")
    return Outbound(
        template_key="survey_reminder",
        values={
            "employee_name": person.first_name,
            "milestone": survey.milestone,
            "form_link": link,
            "attempt": job.attempt,
        },
        to=[person.contact_email],
        case_id=survey.case_id,
        task_id=survey.task_id,
    )


@sent_hook(INVITE_SENT)
async def on_invite_sent(job: ScheduledJob) -> None:
    survey, _ = await _survey_job(job)
    if survey:
        await survey.mark_sent()


@composer(LOW_SCORE)
async def compose_low_score(job: ScheduledJob):
    survey, person = await _survey_job(job)
    if not survey or not survey.flagged:
        return Skip("not flagged")
    rs = await runtime.current()
    return Outbound(
        template_key="low_score_alert",
        values={
            "employee_name": person.full_name,
            "milestone": survey.milestone,
            "score": survey.score,
        },
        to=[rs.contacts.hr_owner],
        case_id=survey.case_id,
    )


async def process_rows(variant: str, table: List[List[Any]]) -> Dict[str, int]:
    counts = {
        "rows_total": 0,
        "rows_matched": 0,
        "rows_unmatched": 0,
        "low_score_alerts": 0,
    }
    if len(table) < 2:
        return counts
    headers = [str(cell or "").strip().lower() for cell in table[0]]
    email_index = find_column(headers, EMAIL_HEADERS)
    score_index = find_column(headers, SCORE_HEADERS)
    rs = await runtime.current()
    for position, row in enumerate(table[1:], start=2):
        if not any(cell not in (None, "") for cell in row):
            continue
        counts["rows_total"] += 1
        email = (
            str(row[email_index]).strip().lower()
            if email_index is not None and email_index < len(row) and row[email_index]
            else ""
        )
        people = await Person.find_by_email(email) if email else []
        survey = (
            await SurveyResponse.open_for_person(people[0].person_id)
            if people
            else None
        )
        if not survey or survey.form_variant != variant:
            counts["rows_unmatched"] += 1
            continue
        score = row_score(headers, row, score_index)
        flagged = score is not None and score < rs.survey_low_score_threshold
        await survey.record_answer(
            score,
            answers_of(
                headers, row, {email_index} if email_index is not None else set()
            ),
            f"row-{position}",
            flagged,
        )
        if survey.task_id:
            task = await Task.find_by_id(survey.task_id)
            if task:
                await task.update(status=TaskStatus.DONE)
            await ScheduledJob.cancel_pending(task_id=survey.task_id)
        counts["rows_matched"] += 1
        if flagged:
            await start_email(
                LOW_SCORE,
                case_id=survey.case_id,
                scope=f"low-score-{survey.survey_response_id}",
                extra={"survey_response_id": str(survey.survey_response_id)},
            )
            counts["low_score_alerts"] += 1
    return counts


async def sync_from_graph() -> int:
    rs = await runtime.current()
    total = 0
    for variant, workbook in rs.survey_response_workbooks.items():
        if not all(workbook.get(key) for key in ("drive_id", "item_id", "sheet")):
            continue
        table = await excel.used_range(
            workbook["drive_id"], workbook["item_id"], workbook["sheet"]
        )
        total += (await process_rows(variant, table))["rows_matched"]
    return total


async def import_upload(variant: HireCategory, file, user: User) -> Dict[str, int]:
    await verify_upload(file, UploadPurpose.SURVEY_EXPORT)
    table = read_table(await storage.get_bytes(file.file_url), file.mime_type)
    counts = await process_rows(variant.value, table)
    await log_user_action(user.user_id, "survey_responses_imported", details=counts)
    return counts


async def list_surveys(
    search: Optional[str],
    milestone: Optional[int],
    status: Optional[SurveyStatus],
    flagged: Optional[bool],
    form_variant: Optional[HireCategory],
    sort_by: SurveySortBy,
    sort_order: SortOrder,
    limit: int,
    offset: int,
) -> Tuple[List[Dict[str, Any]], int]:
    rs = await runtime.current()
    rows = await SurveyResponse.filtered(
        milestone, flagged, form_variant.value if form_variant else None
    )
    people = await Person.find_by_ids([row["person_id"] for row in rows])
    items = []
    for row in rows:
        person = people.get(row["person_id"])
        if not person or (search and not contains(person.full_name, search)):
            continue
        reminders = row["followups_sent"] or 0
        state = (
            SurveyStatus.RESPONDED
            if row["responded_at"]
            else SurveyStatus.NO_RESPONSE
            if reminders >= rs.survey_max_reminders and row["sent_at"]
            else SurveyStatus.SENT
        )
        if status and state != status:
            continue
        items.append(
            {
                "survey_response_id": str(row["survey_response_id"]),
                "person_id": str(person.person_id),
                "full_name": person.full_name,
                "milestone": row["milestone"],
                "form_variant": row["form_variant"],
                "status": state,
                "sent_at": row["sent_at"],
                "reminders_sent": reminders,
                "responded_at": row["responded_at"],
                "score": row["score"],
                "flagged": row["flagged"],
                "created_at": row["created_at"],
            }
        )
    keys = {
        SurveySortBy.SENT_AT: lambda i: i["sent_at"],
        SurveySortBy.SCORE: lambda i: i["score"],
        SurveySortBy.FULL_NAME: lambda i: i["full_name"],
    }
    page, total = paginate(
        sort_in_app(
            items, keys[sort_by], lambda i: i["sent_at"] or i["created_at"], sort_order
        ),
        limit,
        offset,
    )
    for item in page:
        item.pop("created_at")
        item["sent_at"] = item["sent_at"].isoformat() if item["sent_at"] else None
        item["responded_at"] = (
            item["responded_at"].isoformat() if item["responded_at"] else None
        )
    return page, total


async def request_report(
    period_start: date, period_end: date, user: Optional[User]
) -> FeedbackReport:
    if await FeedbackReport.in_flight(period_start, period_end):
        raise ConflictException("A report for this period already exists")
    report = await FeedbackReport.create(
        period_start, period_end, user.user_id if user else None
    )
    if user:
        await log_user_action(
            user.user_id,
            "feedback_report_requested",
            entity_type="feedback_report",
            entity_id=report.feedback_report_id,
        )
    await enqueue_event(
        "feedback.report",
        {"feedback_report_id": str(report.feedback_report_id)},
        source="hr_action" if user else "scheduler",
        dedupe_key=f"report:{report.feedback_report_id}",
    )
    return report


async def build_report(report_id: uuid.UUID) -> None:
    report = await FeedbackReport.find_by_id(report_id)
    if not report or report.status != "queued":
        return
    responses = await SurveyResponse.responded_between(
        report.period_start, report.period_end
    )
    analysis = None
    if responses:
        people = await Person.find_by_ids([r.person_id for r in responses])
        names = [person.full_name for person in people.values()]
        answers = [
            {
                "milestone": r.milestone,
                "score": r.score,
                **{k: str(v) for k, v in r.answers.items()},
            }
            for r in responses
        ]
        analysis = await ai.analyse_feedback(answers, names)
    period = f"{report.period_start.strftime('%d %b %Y')} to {report.period_end.strftime('%d %b %Y')}"
    pdf = build_pdf("30-60-90 Day Feedback Report", period, len(responses), analysis)
    key = storage.new_key("reports/feedback", "report.pdf")
    await storage.put_bytes(key, pdf, "application/pdf")
    await report.finish("ready", storage_key=key, response_count=len(responses))
    await log_action(
        "feedback_report_built",
        entity_type="feedback_report",
        entity_id=report.feedback_report_id,
        details={"responses": len(responses)},
    )
    await start_email(
        REPORT_MAIL,
        scope=f"report-{report.feedback_report_id}",
        extra={"feedback_report_id": str(report.feedback_report_id)},
        on_sent=REPORT_SENT,
    )


@composer(REPORT_MAIL)
async def compose_report(job: ScheduledJob):
    report = await FeedbackReport.find_by_id(
        uuid.UUID(job.payload["feedback_report_id"])
    )
    if not report or not report.storage_key:
        return Skip("report not ready")
    rs = await runtime.current()
    period = (
        f"{report.period_start.strftime('%b %Y')}"
        if report.period_start.month == report.period_end.month
        else f"{report.period_start} to {report.period_end}"
    )
    return Outbound(
        template_key="feedback_report",
        values={"period_label": period, "response_count": report.response_count},
        to=[rs.contacts.hr_owner],
        extra_files=[
            {
                "name": f"feedback-report-{report.period_start.isoformat()}.pdf",
                "content_type": "application/pdf",
                "storage_key": report.storage_key,
            }
        ],
    )


@sent_hook(REPORT_SENT)
async def on_report_sent(job: ScheduledJob) -> None:
    report = await FeedbackReport.find_by_id(
        uuid.UUID(job.payload["feedback_report_id"])
    )
    if report:
        await report.finish("sent")


async def run_monthly(today: Optional[date] = None) -> Optional[FeedbackReport]:
    today = today or local_today()
    if today.day != (await runtime.current()).feedback_report_day_of_month:
        return None
    last_day = today.replace(day=1) - timedelta(days=1)
    try:
        return await request_report(last_day.replace(day=1), last_day, None)
    except ConflictException:
        return None


async def report_link(report_id: uuid.UUID) -> Tuple[FeedbackReport, str]:
    report = await FeedbackReport.find_by_id(report_id)
    if not report:
        raise NotFoundException("Report not found")
    if not report.storage_key:
        raise ConflictException("This report is not ready yet")
    url = await storage.presigned_get(
        report.storage_key, f"feedback-report-{report.period_start.isoformat()}.pdf"
    )
    return report, url
