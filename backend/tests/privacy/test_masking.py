from app.llm.guard import find_pii
from app.privacy.masking import detect_people, mask_text


def test_indian_identifiers_and_contacts_are_masked():
    text = (
        "Name: Rahul Sharma\nPAN: ABCDE1234F\nAadhaar 2345 6789 0123\nMobile +91 98765 43210\n"
        "Email rahul.sharma@gmail.com\nDate of Birth: 20/02/1990\nAddress: 12 Park Street, Kolkata 700016"
    )
    masked = mask_text(text, known_names=["Rahul Sharma"]).text
    for secret in (
        "ABCDE1234F",
        "2345 6789 0123",
        "98765 43210",
        "rahul.sharma@gmail.com",
        "20/02/1990",
        "Rahul",
        "Park Street",
    ):
        assert secret not in masked
    assert find_pii(masked) == []


def test_known_names_are_masked_even_when_the_model_misses_them():
    masked = mask_text(
        "Please share documents for Partha Ghosh today", known_names=["Partha Ghosh"]
    ).text
    assert "Partha" not in masked and "Ghosh" not in masked
    assert "<NAME>" in masked


def test_relative_names_on_id_cards_are_masked():
    masked = mask_text("Father's Name: Suresh Kumar Sharma\nIncome Tax Department").text
    assert "Suresh" not in masked
    assert "Income Tax Department" in masked


def test_dates_that_are_not_birth_dates_stay_readable():
    masked = mask_text("Can we meet on 16 Nov 2026 at 11 am?").text
    assert "16 Nov 2026" in masked


def test_empty_text_is_returned_as_is():
    assert mask_text("").text == ""
    assert detect_people("") == []
