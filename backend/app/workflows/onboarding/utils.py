import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from rapidfuzz import fuzz

from app.documents.utils import normalise_name
from app.people.model import Person

DOC_LABELS = {
    "pan_card": "PAN card",
    "aadhaar_card": "Aadhaar card",
    "passport_photo": "Passport size photo",
    "class_10_certificate": "Class 10 certificate",
    "class_12_certificate": "Class 12 certificate",
    "degree_certificate": "Degree certificate",
    "marksheets": "Marksheets",
    "relieving_letter": "Relieving letter",
    "experience_letter": "Experience letter",
    "resume": "Resume",
}

PROFILE_FIELDS = (
    "project_code",
    "gender",
    "blood_group",
    "date_of_marriage",
    "bu_head",
    "employment_type",
    "contact_number",
    "sector_region",
    "system_type",
    "proj_ops",
    "ess_d365",
    "skills",
    "business_card",
)


def doc_label(document_type: str) -> str:
    return DOC_LABELS.get(document_type, document_type.replace("_", " ").capitalize())


def show_date(value: Optional[date]) -> str:
    return value.strftime("%d %b %Y") if value else ""


def table_date(value: Optional[date]) -> str:
    return value.strftime("%d-%b-%Y") if value else ""


def yes_no(value: Any) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return "" if value is None else str(value)


def onboarding_rows(person: Person, has_photo: bool) -> List[Tuple[str, Any]]:
    profile: Dict[str, Any] = person.profile
    marriage = profile.get("date_of_marriage")
    return [
        ("Project Code", profile.get("project_code") or ""),
        ("Name", person.full_name),
        ("Employee ID", person.employee_code or ""),
        ("Designation", person.designation or ""),
        ("Level", person.level or ""),
        ("Email", person.work_email or ""),
        ("Date of Birth", table_date(person.date_of_birth)),
        (
            "Date of Marriage",
            table_date(date.fromisoformat(marriage)) if marriage else "NA",
        ),
        ("Blood Group", profile.get("blood_group") or ""),
        ("Gender", profile.get("gender") or ""),
        ("Passport Size Photo", yes_no(has_photo)),
        ("Date of Joining", table_date(person.joining_date)),
        ("Reporting Manager", person.manager_name or ""),
        ("BU Head", profile.get("bu_head") or ""),
        ("Base Location", person.location or ""),
        ("Employment Type", profile.get("employment_type") or ""),
        ("Contact Number", profile.get("contact_number") or ""),
        ("Sector/Region", profile.get("sector_region") or ""),
        ("System Type", yes_no(profile.get("system_type"))),
        ("Proj Ops", yes_no(profile.get("proj_ops"))),
        ("ESS D365", yes_no(profile.get("ess_d365"))),
        ("Skill Set", profile.get("skills") or ""),
        ("Personal Mail ID", person.personal_email or ""),
        ("Business Card", yes_no(profile.get("business_card"))),
    ]


def pick_work_email(
    text: str, domain: str, full_name: str, excluded: set[str]
) -> Optional[str]:
    pattern = re.compile(rf"[A-Za-z0-9._%+-]+@{re.escape(domain)}\b", re.IGNORECASE)
    candidates = []
    for match in pattern.findall(text or ""):
        address = match.lower()
        if address not in excluded and address not in candidates:
            candidates.append(address)
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    target = normalise_name(full_name)
    scored = [
        (
            fuzz.token_set_ratio(
                target, normalise_name(c.split("@")[0].replace(".", " "))
            ),
            c,
        )
        for c in candidates
    ]
    best_score, best = max(scored)
    return best if best_score >= 60 else None
