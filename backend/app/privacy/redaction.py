import re

REDACTED = "[redacted]"

CREDENTIAL_LINE = re.compile(
    r"(?im)^(?P<label>[^\n]*?\b(?:password|passwd|pwd|passcode|pass\s*code|one[\s-]*time\s*password|otp|pin)\b"
    r"\s*(?:is|:|=|-)?\s*)(?P<secret>\S[^\n]*)$"
)


def redact_credentials(text: str) -> str:
    if not text:
        return text
    return CREDENTIAL_LINE.sub(lambda m: f"{m.group('label')}{REDACTED}", text)
