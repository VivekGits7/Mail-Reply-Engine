from datetime import datetime, timezone
from typing import Dict, List

from app.graph.client import mailbox_path, request
from app.graph.schemas import BusySlot

FREE_STATUSES = {"free", "unknown"}
SLOT_MINUTES = 30


def _utc_naive(moment: datetime) -> str:
    return (
        moment.astimezone(timezone.utc)
        .replace(tzinfo=None)
        .isoformat(timespec="seconds")
    )


def _parse(node: Dict[str, str]) -> datetime:
    return datetime.fromisoformat(node["dateTime"].split(".")[0]).replace(
        tzinfo=timezone.utc
    )


async def busy_slots(
    emails: List[str], start: datetime, end: datetime
) -> Dict[str, List[BusySlot]]:
    response = await request(
        "POST",
        f"{mailbox_path()}/calendar/getSchedule",
        json={
            "schedules": emails,
            "startTime": {"dateTime": _utc_naive(start), "timeZone": "UTC"},
            "endTime": {"dateTime": _utc_naive(end), "timeZone": "UTC"},
            "availabilityViewInterval": SLOT_MINUTES,
        },
    )
    result: Dict[str, List[BusySlot]] = {}
    for schedule in response.json().get("value", []):
        items = schedule.get("scheduleItems") or []
        result[schedule.get("scheduleId", "").lower()] = [
            BusySlot(start=_parse(item["start"]), end=_parse(item["end"]))
            for item in items
            if (item.get("status") or "busy").lower() not in FREE_STATUSES
        ]
    return result


async def is_free(email: str, start: datetime, end: datetime) -> bool:
    slots = (await busy_slots([email], start, end)).get(email.lower(), [])
    return not any(slot.start < end and slot.end > start for slot in slots)


async def create_event(
    subject: str, html_body: str, start: datetime, end: datetime, attendees: List[str]
) -> str:
    response = await request(
        "POST",
        f"{mailbox_path()}/events",
        json={
            "subject": subject,
            "body": {"contentType": "HTML", "content": html_body},
            "start": {"dateTime": _utc_naive(start), "timeZone": "UTC"},
            "end": {"dateTime": _utc_naive(end), "timeZone": "UTC"},
            "attendees": [
                {"emailAddress": {"address": address}, "type": "required"}
                for address in attendees
            ],
        },
    )
    return response.json()["id"]
