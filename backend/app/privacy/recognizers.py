import re
from typing import List

from presidio_analyzer import Pattern, PatternRecognizer

PAN_REGEX = r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"
AADHAAR_REGEX = r"\b[2-9][0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b"
INDIAN_PHONE_REGEX = r"(?<!\d)(?:\+?91[\s-]?|0)?[6-9][0-9]{4}[\s-]?[0-9]{5}(?!\d)"
PIN_CODE_REGEX = r"(?<!\d)[1-9][0-9]{2}\s?[0-9]{3}(?!\d)"
DATE_PART = r"[0-9]{1,2}[\s/.\-]+(?:[0-9]{1,2}|[A-Za-z]{3,9})[\s/.,\-]+[0-9]{2,4}"
DOB_REGEX = rf"(?i)\b(?:d\.?\s?o\.?\s?b\.?|date\s+of\s+birth|birth\s*date|born\s+on)\s*[:\-]?\s*{DATE_PART}"
RELATIVE_NAME_REGEX = r"(?i)\b(?:father'?s?\s+name|mother'?s?\s+name|spouse'?s?\s+name|s/o|d/o|w/o|c/o)\s*[:\-]?\s*[^\n,]{2,60}"
ADDRESS_REGEX = r"(?i)\b(?:address|addr\.?|residing\s+at|r/o)\s*[:\-]?\s*[^\n]{5,160}"

ENTITY_LABELS = {
    "PERSON": "NAME",
    "KNOWN_PERSON": "NAME",
    "TCG_RELATIVE_NAME": "NAME",
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "TCG_PHONE": "PHONE",
    "TCG_PAN": "PAN",
    "TCG_AADHAAR": "AADHAAR",
    "TCG_DOB": "DOB",
    "TCG_ADDRESS": "ADDRESS",
    "TCG_PIN_CODE": "ADDRESS",
    "LOCATION": "ADDRESS",
}


def _pattern(
    entity: str, regex: str, score: float, context: List[str] | None = None
) -> PatternRecognizer:
    return PatternRecognizer(
        supported_entity=entity,
        patterns=[Pattern(name=entity.lower(), regex=regex, score=score)],
        context=context or [],
        supported_language="en",
    )


def custom_recognizers() -> List[PatternRecognizer]:
    return [
        _pattern(
            "TCG_PAN", PAN_REGEX, 0.85, ["pan", "permanent account", "income tax"]
        ),
        _pattern(
            "TCG_AADHAAR", AADHAAR_REGEX, 0.75, ["aadhaar", "aadhar", "uidai", "uid"]
        ),
        _pattern(
            "TCG_PHONE",
            INDIAN_PHONE_REGEX,
            0.6,
            ["phone", "mobile", "contact", "tel", "ph"],
        ),
        _pattern(
            "TCG_PIN_CODE",
            PIN_CODE_REGEX,
            0.3,
            ["pin", "pincode", "postal", "kolkata", "mumbai", "address"],
        ),
        _pattern("TCG_DOB", DOB_REGEX, 0.9),
        _pattern("TCG_RELATIVE_NAME", RELATIVE_NAME_REGEX, 0.85),
        _pattern("TCG_ADDRESS", ADDRESS_REGEX, 0.8),
    ]


def known_people_recognizer(names: List[str]) -> PatternRecognizer | None:
    terms = sorted(
        {part for name in names for part in _name_terms(name)}, key=len, reverse=True
    )
    if not terms:
        return None
    return PatternRecognizer(
        supported_entity="KNOWN_PERSON", deny_list=terms, supported_language="en"
    )


def _name_terms(name: str) -> List[str]:
    cleaned = re.sub(r"\s+", " ", name or "").strip()
    if not cleaned:
        return []
    parts = [p for p in cleaned.split(" ") if len(p) > 2]
    return [cleaned, *parts]
