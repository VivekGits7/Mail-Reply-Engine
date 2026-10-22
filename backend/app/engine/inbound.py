import uuid
from typing import Any, Dict, List, Optional, Tuple

from app import runtime
from app.ai import helpers as ai
from app.audit import log_action
from app.cases import Case, CaseFlag, CaseType, Task
from app.common.enums import EmailCategory
from app.config import settings
from app.documents import best_name_score, name_in_text_score
from app.documents.utils import labelled_names
from app.engine.replies import draft_for
from app.graph import mail as graph_mail
from app.graph.model import MailboxState
from app.graph.schemas import GraphMessage
from app.llm import PIIGuardError
from app.logger import get_logger
from app.mail import Email, full_text, junk_reason, thread_message_ids, visible_text
from app.people import Person
from app.worker import Event, PermanentEventError
from app.workflows.complaints import service as complaints
from app.workflows.exits import service as exits
from app.workflows.induction import service as induction
from app.workflows.onboarding import service as onboarding
from app.workflows.onboarding.enums import OnboardingStage
from app.workflows.reminders import service as reminders

logger = get_logger(__name__)

SENDER_FIELDS = ("personal_email", "work_email", "recruiter_email", "manager_email")


async def _sender_role(sender: str, people: List[Person], tasks: List[Task]) -> str:
    contacts = (await runtime.current()).contacts.model_dump()
    for key, value in contacts.items():
        if value and value == sender:
            return key
    for person in people:
        if person.recruiter_email == sender:
            return "recruiter"
        if person.manager_email == sender:
            return "manager"
        if sender in person.emails():
            return person.role.value
    if tasks:
        return tasks[0].owner_role
    return "unknown"


async def _candidate_cases(
    message: GraphMessage,
) -> Tuple[Optional[uuid.UUID], List[Case], List[Person], List[Task]]:
    thread_case_id = await Email.case_for_thread(
        message.conversation_id, thread_message_ids(message)
    )
    people = await Person.find_by_email(message.from_email, SENDER_FIELDS)
    tasks = await Task.open_for_owner(message.from_email)
    cases = await Case.active_for_people([p.person_id for p in people])
    for task in tasks:
        if task.case_id and all(case.case_id != task.case_id for case in cases):
            case = await Case.find_by_id(task.case_id)
            if case and case.is_active:
                cases.append(case)
    if thread_case_id and all(case.case_id != thread_case_id for case in cases):
        case = await Case.find_by_id(thread_case_id)
        if case:
            cases.insert(0, case)
    return thread_case_id, cases, people, tasks


async def _names_for(cases: List[Case], people: List[Person]) -> List[str]:
    known = {p.person_id: p for p in people}
    missing = [case.person_id for case in cases if case.person_id not in known]
    known.update(await Person.find_by_ids(missing))
    names = []
    for person in known.values():
        names += [value for value in (person.full_name, person.manager_name) if value]
    return names


async def _match_joiner_by_name(text: str, threshold: int) -> Optional[Case]:
    from app.privacy.masking import detect_people

    found = labelled_names(text) + detect_people(text)
    scored = []
    for case, person in await onboarding.onboarding_people_for_name_match():
        score = max(
            best_name_score(person.full_name, found) or 0.0,
            name_in_text_score(person.full_name, text),
        )
        if score >= threshold:
            scored.append((score, case))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored or (len(scored) > 1 and scored[1][0] == scored[0][0]):
        return None
    return scored[0][1]


def _pick_case(
    category: EmailCategory,
    thread_case_id: Optional[uuid.UUID],
    ai_case_id: Optional[str],
    cases: List[Case],
) -> Optional[Case]:
    by_id = {case.case_id: case for case in cases}
    if thread_case_id and thread_case_id in by_id:
        return by_id[thread_case_id]
    if ai_case_id:
        try:
            wanted = uuid.UUID(ai_case_id)
        except ValueError:
            wanted = None
        if wanted in by_id:
            return by_id[wanted]
    preferred = {
        EmailCategory.DOC_SUBMISSION: CaseType.ONBOARDING,
        EmailCategory.IT_SETUP_REPLY: CaseType.ONBOARDING,
        EmailCategory.CLEARANCE_UPDATE: CaseType.EXIT,
        EmailCategory.AVAILABILITY_REPLY: CaseType.INDUCTION,
    }.get(category)
    matching = [
        case
        for case in cases
        if case.is_active and (preferred is None or case.case_type == preferred)
    ]
    return matching[0] if len(matching) == 1 else None


async def _route(
    category: EmailCategory,
    email: Email,
    message: GraphMessage,
    case: Optional[Case],
    text: str,
    known: List[str],
) -> bool:
    rs = await runtime.current()
    if category == EmailCategory.COMPLAINT:
        await complaints.capture(email)
        return True
    if category == EmailCategory.DOC_SUBMISSION:
        attachments = (
            await graph_mail.list_attachments(message.id)
            if message.has_attachments
            else []
        )
        if case is None:
            file_names = [
                a.name.replace("_", " ").rsplit(".", 1)[0]
                for a in attachments
                if not a.is_inline
            ]
            case = await _match_joiner_by_name(
                "\n".join([message.subject, text, *file_names]), rs.name_match_threshold
            )
            if case is not None:
                await case.add_flags(CaseFlag.SENDER_NOT_RECOGNISED.value)
                await email.link_case(case.case_id)
        if case is None or case.case_type != CaseType.ONBOARDING:
            return False
        await onboarding.handle_documents(email, attachments, case)
        return True
    if category == EmailCategory.IT_SETUP_REPLY:
        if case is None or case.case_type != CaseType.ONBOARDING:
            candidates = [
                c
                for c, _ in await onboarding.onboarding_people_for_name_match()
                if c.stage == OnboardingStage.IT_REQUESTED.value
            ]
            case = (
                candidates[0]
                if len(candidates) == 1
                else await _match_joiner_by_name(text, rs.name_match_threshold)
            )
            if case is None:
                return False
            await email.link_case(case.case_id)
        await onboarding.handle_it_reply(email, text, case)
        return True
    if category == EmailCategory.AVAILABILITY_REPLY:
        return await induction.handle_availability(email, text)
    if category == EmailCategory.CLEARANCE_UPDATE:
        if case is None or case.case_type != CaseType.EXIT:
            return False
        await exits.handle_clearance(email, text, case)
        return True
    if category == EmailCategory.REMINDER_RESPONSE:
        intent = await reminders.handle_reply(email, text)
        if intent == "question":
            await draft_for(email, case, known)
        return intent is not None
    if category == EmailCategory.QUERY:
        await draft_for(email, case, known)
        return True
    return False


async def process_email(payload: Dict[str, Any], event: Optional[Event] = None) -> None:
    graph_id = payload["graph_message_id"]
    if await Email.find_by_graph_id(graph_id):
        return
    message = await graph_mail.get_message(graph_id)
    text = visible_text(message)
    email = await Email.create_inbound(
        graph_message_id=message.id,
        internet_message_id=message.internet_message_id,
        conversation_id=message.conversation_id,
        in_reply_to=message.headers.get("in-reply-to"),
        from_email=message.from_email,
        from_name=message.from_name,
        to=message.to,
        cc=message.cc,
        subject=message.subject,
        body_text=text,
        received_at=message.received_at,
    )
    if email is None:
        return
    await MailboxState.touch_email(settings.mailbox)
    await Email.adopt_conversation(message.conversation_id, thread_message_ids(message))
    reason = junk_reason(message, settings.mailbox)
    if reason:
        await email.set_status("filtered", reason)
        await log_action(
            "email_filtered",
            entity_type="email",
            entity_id=email.email_id,
            details={"reason": reason},
        )
        return
    thread_case_id, cases, people, tasks = await _candidate_cases(message)
    known = await _names_for(cases, people) + (
        [message.from_name] if message.from_name else []
    )
    open_cases = [
        {
            "case_id": str(case.case_id),
            "case_type": case.case_type.value,
            "stage": case.stage,
        }
        for case in cases
        if case.is_active
    ]
    try:
        result = await ai.classify_email(
            message.subject,
            text,
            await _sender_role(message.from_email, people, tasks),
            open_cases,
            known,
        )
    except PIIGuardError as e:
        await email.set_status("failed", "pii_guard")
        raise PermanentEventError(str(e)) from e
    rs = await runtime.current()
    category = result.category
    case = _pick_case(category, thread_case_id, result.case_id, cases)
    if (
        result.confidence < rs.ai_confidence_threshold
        or category == EmailCategory.UNRELATED
    ):
        await email.classify(
            category=category.value,
            confidence=result.confidence,
            summary=result.summary,
            case_id=case.case_id if case else None,
            processing_status="unmatched",
        )
        await log_action(
            "email_unmatched",
            case_id=case.case_id if case else None,
            entity_type="email",
            entity_id=email.email_id,
            details={
                "category": category.value,
                "confidence": round(result.confidence, 2),
            },
        )
        return
    await email.classify(
        category=category.value,
        confidence=result.confidence,
        summary=result.summary,
        case_id=case.case_id if case else None,
        processing_status="routed",
    )
    handled = await _route(
        category,
        email,
        message,
        case,
        text
        if category != EmailCategory.IT_SETUP_REPLY
        else text or full_text(message),
        known,
    )
    if category == EmailCategory.COMPLAINT:
        await email.set_status("processed")
        await log_action(
            "email_processed",
            entity_type="email",
            entity_id=email.email_id,
            details={"category": category.value},
        )
        return
    await email.set_status("processed" if handled else "unmatched")
    await log_action(
        "email_processed" if handled else "email_unmatched",
        case_id=email.case_id,
        entity_type="email",
        entity_id=email.email_id,
        details={"category": category.value, "confidence": round(result.confidence, 2)},
    )
