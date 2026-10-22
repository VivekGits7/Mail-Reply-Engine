import uuid
from typing import Any, Optional

from app.config import settings
from app.database import execute_command
from app.privacy.encryption import FieldCipher

TABLE = "llm_requests"


class LlmRequest:
    @staticmethod
    async def record(
        helper: str,
        model: str,
        request: Optional[str],
        response: Any,
        latency_ms: Optional[int],
        blocked_by_guard: bool = False,
        error: Optional[str] = None,
    ) -> None:
        request_id = uuid.uuid4()
        cipher = FieldCipher(TABLE, request_id)
        await execute_command(
            # SQL
            """
            INSERT INTO llm_requests (llm_request_id, helper, model, request_enc, response_enc, latency_ms, blocked_by_guard, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            request_id,
            helper,
            model,
            cipher.enc("request", request),
            cipher.enc_json("response", response),
            latency_ms,
            blocked_by_guard,
            error[:200] if error else None,
        )

    @staticmethod
    async def purge_expired() -> int:
        result = await execute_command(
            "DELETE FROM llm_requests WHERE created_at < NOW() - make_interval(days => $1)",
            settings.LLM_AUDIT_RETENTION_DAYS,
        )
        return int(result.split()[-1])
