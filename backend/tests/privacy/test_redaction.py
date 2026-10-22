from app.privacy.redaction import redact_credentials


def test_password_line_from_it_reply_is_redacted():
    text = "Hi Raina,\nPls find the email credentials below.\nEmail ID: Partha.Ghosh@tcgdigital.com\nPassword: Password#51\nThanks"
    redacted = redact_credentials(text)
    assert "Password#51" not in redacted
    assert "Password: [redacted]" in redacted
    assert "Email ID: Partha.Ghosh@tcgdigital.com" in redacted


def test_otp_and_pin_lines_are_redacted_and_plain_text_is_kept():
    redacted = redact_credentials("Your OTP is 448812\nPIN - 9911\nSee you Monday")
    assert "448812" not in redacted and "9911" not in redacted
    assert "See you Monday" in redacted
    assert redact_credentials("") == ""
