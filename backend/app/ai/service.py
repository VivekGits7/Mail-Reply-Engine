import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.ai.schemas import (
    AvailabilityResult,
    ClassifyResult,
    ClearanceResult,
    DraftReply,
    FeedbackAnalysis,
    IdentifyResult,
    InductionPlan,
    ItSetupResult,
    ReminderReplyResult,
)
from app.config import settings
from app.llm.client import parse
from app.privacy.masking import mask_text
from app.prompts.loader import get_system_prompt, render_prompt

MAX_EMAIL_CHARS = 6000


def _instructions(name: str) -> str:
    return render_prompt(
        get_system_prompt(name), {"COMPANY_NAME": settings.COMPANY_NAME}
    )


def _mask(text: str, known_names: Optional[List[str]] = None) -> str:
    return mask_text(text or "", known_names).text


def _block(label: str, payload: Any) -> str:
    return f"{label}:\n{json.dumps(payload, default=str, ensure_ascii=False)}"


async def classify_email(
    subject: str,
    body: str,
    sender_role: str,
    open_cases: List[Dict[str, str]],
    known_names: Optional[List[str]] = None,
) -> ClassifyResult:
    masked = _mask(f"Subject: {subject}\n\n{body[:MAX_EMAIL_CHARS]}", known_names)
    refs = {
        f"case_{index + 1}": case["case_id"] for index, case in enumerate(open_cases)
    }
    listed = [
        {"case_id": ref, "case_type": case["case_type"], "stage": case["stage"]}
        for ref, case in zip(refs, open_cases, strict=True)
    ]
    prompt = "\n\n".join(
        [
            _block("Sender role", sender_role),
            _block("Open cases", listed),
            f"Email:\n{masked}",
        ]
    )
    result = await parse(
        "classify_email", _instructions("classify_email"), prompt, ClassifyResult
    )
    result.case_id = refs.get(result.case_id or "")
    return result


async def identify_document(
    text: str, document_types: List[str], known_names: Optional[List[str]] = None
) -> IdentifyResult:
    masked = _mask(text[: settings.DOCUMENT_TEXT_FOR_AI_CHARS], known_names)
    prompt = "\n\n".join(
        [_block("Allowed types", document_types), f"Document text:\n{masked}"]
    )
    return await parse(
        "identify_document", _instructions("identify_document"), prompt, IdentifyResult
    )


async def read_it_setup(
    body: str, known_names: Optional[List[str]] = None
) -> ItSetupResult:
    masked = _mask(body[:MAX_EMAIL_CHARS], known_names)
    return await parse(
        "read_it_setup",
        _instructions("read_it_setup"),
        f"IT reply:\n{masked}",
        ItSetupResult,
    )


async def read_availability(
    body: str,
    proposed_start: datetime,
    proposed_end: datetime,
    known_names: Optional[List[str]] = None,
) -> AvailabilityResult:
    masked = _mask(body[:MAX_EMAIL_CHARS], known_names)
    prompt = "\n\n".join(
        [
            _block(
                "Proposed slot",
                {"start": proposed_start.isoformat(), "end": proposed_end.isoformat()},
            ),
            f"Reply:\n{masked}",
        ]
    )
    return await parse(
        "read_availability",
        _instructions("read_availability"),
        prompt,
        AvailabilityResult,
    )


async def read_clearance_status(
    body: str,
    sender_team: Optional[str],
    items: Dict[str, List[str]],
    known_names: Optional[List[str]] = None,
) -> ClearanceResult:
    masked = _mask(body[:MAX_EMAIL_CHARS], known_names)
    prompt = "\n\n".join(
        [
            _block("Sender team", sender_team),
            _block("Items per team", items),
            f"Reply:\n{masked}",
        ]
    )
    return await parse(
        "read_clearance_status",
        _instructions("read_clearance_status"),
        prompt,
        ClearanceResult,
    )


async def read_reminder_reply(
    body: str, today: date, known_names: Optional[List[str]] = None
) -> ReminderReplyResult:
    masked = _mask(body[:MAX_EMAIL_CHARS], known_names)
    prompt = "\n\n".join([_block("Today", today.isoformat()), f"Reply:\n{masked}"])
    return await parse(
        "read_reminder_reply",
        _instructions("read_reminder_reply"),
        prompt,
        ReminderReplyResult,
    )


async def draft_reply(
    subject: str,
    body: str,
    context: Dict[str, Any],
    known_names: Optional[List[str]] = None,
) -> DraftReply:
    masked = _mask(f"Subject: {subject}\n\n{body[:MAX_EMAIL_CHARS]}", known_names)
    prompt = "\n\n".join([_block("Context", context), f"Email:\n{masked}"])
    return await parse("draft_reply", _instructions("draft_reply"), prompt, DraftReply)


async def build_induction_schedule(
    sessions: List[Dict[str, Any]],
    working_days: List[date],
    day_start: str,
    day_end: str,
    utc_offset: str,
) -> InductionPlan:
    prompt = "\n\n".join(
        [
            _block("Sessions", sessions),
            _block("Working days", [day.isoformat() for day in working_days]),
            _block(
                "Day hours",
                {"start": day_start, "end": day_end, "timezone_offset": utc_offset},
            ),
        ]
    )
    return await parse(
        "build_induction_schedule",
        _instructions("build_induction_schedule"),
        prompt,
        InductionPlan,
    )


async def analyse_feedback(
    responses: List[Dict[str, Any]], known_names: Optional[List[str]] = None
) -> FeedbackAnalysis:
    masked = [
        {
            key: _mask(str(value), known_names) if isinstance(value, str) else value
            for key, value in response.items()
        }
        for response in responses
    ]
    return await parse(
        "analyse_feedback",
        _instructions("analyse_feedback"),
        _block("Survey answers", masked),
        FeedbackAnalysis,
    )
