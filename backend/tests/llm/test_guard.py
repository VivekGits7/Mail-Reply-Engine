import pytest

from app.ai.schemas import IdentifyResult
from app.llm import client
from app.llm.guard import PIIGuardError, assert_clean, find_pii


def test_guard_finds_each_kind_of_personal_data():
    assert find_pii("PAN ABCDE1234F") == ["pan"]
    assert find_pii("aadhaar 2345 6789 0123") == ["aadhaar"]
    assert find_pii("call 9876543210") == ["phone"]
    assert find_pii("mail me at a.b@c.com") == ["email"]
    assert find_pii("Hello <NAME>, your <PAN> is verified") == []


def test_assert_clean_raises_with_the_kinds_found():
    with pytest.raises(PIIGuardError) as error:
        assert_clean("ABCDE1234F and 9876543210")
    assert error.value.found == ["pan", "phone"]


async def test_parse_blocks_unmasked_text_and_never_calls_the_model(env):
    with pytest.raises(PIIGuardError):
        await client.parse(
            "identify_document", "x", "Name <NAME> PAN ABCDE1234F", IdentifyResult
        )
    assert env.llm.requests == []
    blocked = await env.conn.fetchval(
        "SELECT COUNT(*) FROM llm_requests WHERE blocked_by_guard"
    )
    assert blocked == 1


async def test_parse_records_the_masked_request_encrypted(env):
    env.llm.on(
        IdentifyResult,
        lambda text: IdentifyResult(
            document_type="pan_card", confidence=0.9, issues=[]
        ),
    )
    result = await client.parse(
        "identify_document", "x", "Income Tax Department <NAME>", IdentifyResult
    )
    assert result.document_type == "pan_card"
    row = await env.conn.fetchrow(
        "SELECT * FROM llm_requests ORDER BY created_at DESC LIMIT 1"
    )
    assert row["helper"] == "identify_document" and b"Income" not in bytes(
        row["request_enc"]
    )
