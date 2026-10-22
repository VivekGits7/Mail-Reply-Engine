import io
import zipfile
from datetime import date

import pytest

from app.common.enums import PersonCheck
from app.documents import (
    extract_text,
    has_salary_content,
    is_readable,
    looks_like_photo,
    name_in_text_score,
    person_check,
    resolve_mime,
    sanitize_file_name,
    unzip,
)
from app.documents.utils import labelled_dobs, parse_date
from app.privacy.encryption import blind_index
from tests.conftest import make_pdf
from tests.factories import pan_text


def test_matching_name_dob_and_pan_is_a_match():
    result = person_check(
        pan_text(), "Rahul Sharma", date(1990, 2, 20), blind_index("ABCDE1234F"), 85
    )
    assert result.result == PersonCheck.MATCH and result.dob_match and result.pan_match


def test_initials_still_match_the_full_name():
    result = person_check("Name: Rahul K. Sharma", "Rahul Kumar Sharma", None, None, 85)
    assert result.result == PersonCheck.MATCH and result.name_score >= 85


def test_someone_elses_document_is_a_mismatch():
    result = person_check(
        pan_text(name="Amit Verma"), "Rahul Sharma", date(1990, 2, 20), None, 85
    )
    assert result.result == PersonCheck.MISMATCH


def test_wrong_date_of_birth_is_a_mismatch_even_with_the_right_name():
    result = person_check(
        pan_text(dob="01/01/1991"), "Rahul Sharma", date(1990, 2, 20), None, 85
    )
    assert result.result == PersonCheck.MISMATCH and result.dob_match is False


def test_no_identifiers_means_not_found():
    assert (
        person_check("Bachelor of Technology", "Rahul Sharma", None, None, 85).result
        == PersonCheck.NOT_FOUND
    )


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("20/02/1990", date(1990, 2, 20)),
        ("20-Feb-1986", date(1986, 2, 20)),
        ("1990-02-20", date(1990, 2, 20)),
        ("31/02/1990", None),
    ],
)
def test_dates_parse_in_common_indian_formats(raw, expected):
    assert parse_date(raw) == expected


def test_only_labelled_birth_dates_are_read():
    assert labelled_dobs("Issue date 01/01/2020\nDOB: 20/02/1990") == [
        date(1990, 2, 20)
    ]


def test_salary_documents_are_detected():
    assert has_salary_content("Payslip for September\nNet Pay 85,000")
    assert has_salary_content("Basic salary 40000\nHRA 20000")
    assert not has_salary_content("Relieving letter, last working day 30 Sep")


async def test_text_pdf_is_extracted_and_readable():
    document = await extract_text(make_pdf(pan_text()), "application/pdf")
    assert document.method == "pdf_text" and "INCOME TAX" in document.text
    assert is_readable(document, 50, 60)


async def test_unsupported_and_tiny_files_are_not_readable():
    assert (
        await extract_text(b"\x00\x01", "application/x-binary")
    ).method == "unsupported"
    assert not is_readable(await extract_text(b"hi", "text/plain"), 50, 60)


def test_zip_is_unpacked_with_limits_and_junk_skipped():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("docs/pan.pdf", b"%PDF-1.4 a")
        archive.writestr("__MACOSX/._pan.pdf", b"junk")
        archive.writestr(".DS_Store", b"junk")
    files = unzip(buffer.getvalue(), 10, 1024 * 1024)
    assert [name for name, _ in files] == ["pan.pdf"]
    with pytest.raises(ValueError):
        unzip(buffer.getvalue(), 0, 1024)


def test_file_helpers():
    assert sanitize_file_name("../../etc/pass wd?.pdf") == "pass wd_.pdf"
    assert resolve_mime("scan.JPG", "application/octet-stream") == "image/jpeg"
    assert resolve_mime("x.pdf", "application/pdf") == "application/pdf"
    assert looks_like_photo("ManojMaraskolhe_Photo.JPG", "image/jpeg", 300)
    assert looks_like_photo("img.png", "image/png", 0)
    assert not looks_like_photo("pan.pdf", "application/pdf", 0)


def test_joiner_name_is_found_inside_free_text():
    assert (
        name_in_text_score(
            "Rahul Sharma", "Attaching documents for Rahul Sharma, joining next month"
        )
        == 100
    )
    assert name_in_text_score("Rahul Sharma", "RAHUL  SHARMA pan.pdf") == 100
    assert name_in_text_score("Rahul Kumar Sharma", "Docs of Rahul K Sharma") >= 85
    assert (
        name_in_text_score("Rahul Sharma", "Please find the files for Priya Das") < 85
    )
    assert name_in_text_score("Rahul Sharma", "") == 0
