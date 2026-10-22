import io
import re
import zipfile
from datetime import date, datetime
from pathlib import PurePath
from typing import List, Optional, Tuple

PAN_PATTERN = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
NAME_LABEL = re.compile(
    r"(?im)^\s*(?:name|full\s+name|candidate\s+name|employee\s+name|name\s+of\s+the\s+candidate)\s*[:\-]\s*([A-Za-z][A-Za-z .'\-]{2,60})\s*$"
)
NAME_LABEL_ALONE = re.compile(r"(?im)^\s*(?:[^\n]*/\s*)?name\s*[:\-]?\s*$")
DOB_LABEL = re.compile(
    r"(?i)(?:d\.?\s?o\.?\s?b\.?|date\s+of\s+birth|birth\s*date|born\s+on)\s*[:\-]?\s*"
    r"([0-9]{1,2}[\s/.\-]+(?:[0-9]{1,2}|[A-Za-z]{3,9})[\s/.,\-]+[0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})"
)
DATE_FORMATS = (
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d %m %Y",
    "%d-%b-%Y",
    "%d %b %Y",
    "%d-%B-%Y",
    "%d %B %Y",
    "%Y-%m-%d",
    "%d/%m/%y",
    "%d-%m-%y",
    "%d %b, %Y",
    "%d %B, %Y",
)
STRONG_SALARY_TERMS = re.compile(
    r"(?i)\b(ctc|cost\s+to\s+company|gross\s+salary|net\s+pay|net\s+salary|pay\s*slip|salary\s+slip|salary\s+certificate|annual\s+package)\b"
)
WEAK_SALARY_TERMS = re.compile(
    r"(?i)\b(basic\s+pay|basic\s+salary|hra|house\s+rent\s+allowance|earnings|deductions|take\s+home|compensation|provident\s+fund)\b"
)
SKIPPED_ZIP_PARTS = ("__MACOSX", ".DS_Store")
IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tiff",
    "image/bmp",
    "image/webp",
    "image/gif",
}
PDF_TYPE = "application/pdf"
DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
ZIP_TYPES = {"application/zip", "application/x-zip-compressed", "application/x-zip"}
EXTENSION_TYPES = {
    ".pdf": PDF_TYPE,
    ".docx": DOCX_TYPE,
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".zip": "application/zip",
}
UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._ -]+")


def sanitize_file_name(file_name: Optional[str], fallback: str = "file") -> str:
    name = PurePath((file_name or "").replace("\\", "/")).name
    name = UNSAFE_FILENAME_CHARS.sub("_", name).strip(" .")
    return name[:200] or fallback


def resolve_mime(file_name: str, given: Optional[str]) -> str:
    given = (given or "").lower()
    if given and given not in {"application/octet-stream", "binary/octet-stream"}:
        return given
    return EXTENSION_TYPES.get(
        PurePath(file_name.lower()).suffix, given or "application/octet-stream"
    )


def is_zip(file_name: str, mime_type: str) -> bool:
    return mime_type in ZIP_TYPES or file_name.lower().endswith(".zip")


def unzip(
    data: bytes, max_files: int, max_bytes: int, depth: int = 0
) -> List[Tuple[str, bytes]]:
    files: List[Tuple[str, bytes]] = []
    total = 0
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for info in archive.infolist():
            if (
                info.is_dir()
                or any(part in info.filename for part in SKIPPED_ZIP_PARTS)
                or PurePath(info.filename).name.startswith(".")
            ):
                continue
            total += info.file_size
            if len(files) >= max_files or total > max_bytes:
                raise ValueError("Zip file is too large to unpack")
            content = archive.read(info)
            name = sanitize_file_name(info.filename, f"file-{len(files) + 1}")
            if name.lower().endswith(".zip") and depth == 0:
                files.extend(
                    unzip(content, max_files - len(files), max_bytes - total, depth + 1)
                )
                continue
            files.append((name, content))
    return files


def normalise_name(value: str) -> str:
    value = re.sub(r"[^a-z ]", " ", value.lower())
    return " ".join(part for part in value.split() if part)


def labelled_names(text: str) -> List[str]:
    names = [match.strip() for match in NAME_LABEL.findall(text)]
    lines = text.splitlines()
    for index, line in enumerate(lines[:-1]):
        if NAME_LABEL_ALONE.match(line):
            candidate = lines[index + 1].strip()
            if re.fullmatch(r"[A-Za-z][A-Za-z .'\-]{2,60}", candidate):
                names.append(candidate)
    return names


def parse_date(value: str) -> Optional[date]:
    cleaned = re.sub(r"\s+", " ", value.strip().replace(",", ", ")).replace(" ,", ",")
    cleaned = re.sub(r"\s*([/.\-])\s*", r"\1", cleaned)
    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
        if parsed.year < 1900:
            return None
        if parsed.year > date.today().year:
            parsed = parsed.replace(year=parsed.year - 100)
        return parsed
    return None


def labelled_dobs(text: str) -> List[date]:
    found = []
    for raw in DOB_LABEL.findall(text):
        parsed = parse_date(raw)
        if parsed and parsed not in found:
            found.append(parsed)
    return found


def pans(text: str) -> List[str]:
    found: List[str] = []
    for value in PAN_PATTERN.findall(text.upper()):
        if value not in found:
            found.append(value)
    return found


def has_salary_content(text: str) -> bool:
    if STRONG_SALARY_TERMS.search(text):
        return True
    return len({match.lower() for match in WEAK_SALARY_TERMS.findall(text)}) >= 2


def looks_like_photo(file_name: str, mime_type: str, chars: int) -> bool:
    lowered = file_name.lower()
    if "photo" in lowered or "passport" in lowered or "pic" in lowered:
        return True
    return mime_type in IMAGE_TYPES and chars < 20
