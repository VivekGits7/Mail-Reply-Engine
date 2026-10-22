import re
from typing import List

PII_PATTERNS = {
    "pan": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    "aadhaar": re.compile(r"\b[2-9][0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b"),
    "phone": re.compile(r"(?<![\d<])(?:\+?91[\s-]?)?[6-9][0-9]{4}[\s-]?[0-9]{5}(?!\d)"),
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
}


class PIIGuardError(Exception):
    def __init__(self, found: List[str]):
        self.found = found
        super().__init__(f"Personal data found before an AI call: {', '.join(found)}")


def find_pii(text: str) -> List[str]:
    return sorted(
        name for name, pattern in PII_PATTERNS.items() if pattern.search(text or "")
    )


def assert_clean(text: str) -> None:
    found = find_pii(text)
    if found:
        raise PIIGuardError(found)
