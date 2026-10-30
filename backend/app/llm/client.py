import asyncio
import json
import time
from typing import Any, Optional, Type, TypeVar

from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    InternalServerError,
    RateLimitError,
)
from pydantic import BaseModel

from app.config import settings
from app.error import AIServiceException
from app.llm.guard import PIIGuardError, find_pii
from app.llm.model import LlmRequest
from app.logger import get_logger

logger = get_logger(__name__)

ModelT = TypeVar("ModelT", bound=BaseModel)

MAX_RETRIES = 3
RETRY_DELAYS = [2, 4, 8]
RETRYABLE = (APITimeoutError, APIConnectionError, RateLimitError, InternalServerError)

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT_SECONDS
        )
    return _client


def set_client(client: Any) -> None:
    global _client
    _client = client


async def parse(
    helper: str, instructions: str, masked_input: str, output_model: Type[ModelT]
) -> ModelT:
    found = find_pii(masked_input)
    if found:
        await LlmRequest.record(
            helper,
            settings.OPENAI_MODEL,
            None,
            None,
            None,
            blocked_by_guard=True,
            error=f"blocked: {', '.join(found)}",
        )
        logger.error(
            f"AI helper {helper} blocked, personal data still present: {', '.join(found)}"
        )
        raise PIIGuardError(found)
    if settings.LOG_AI_PAYLOADS:
        logger.info(f"AI helper {helper} request:\n{masked_input}")
    client = get_client()
    started = time.perf_counter()
    for attempt in range(MAX_RETRIES):
        try:
            response = await client.responses.parse(
                model=settings.OPENAI_MODEL,
                instructions=instructions,
                input=[{"role": "user", "content": masked_input}],
                text_format=output_model,
                reasoning={"effort": settings.OPENAI_REASONING_EFFORT},
                max_output_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
                prompt_cache_key=f"helper-{helper}-v1",
                store=False,
            )
            parsed = response.output_parsed
            if parsed is None:
                raise AIServiceException("AI returned no structured output")
            latency = int((time.perf_counter() - started) * 1000)
            result = parsed.model_dump(mode="json")
            await LlmRequest.record(
                helper,
                settings.OPENAI_MODEL,
                masked_input,
                result,
                latency,
            )
            usage = getattr(response, "usage", None)
            tokens = (
                f", {usage.input_tokens} tokens in, {usage.output_tokens} out"
                if usage
                else ""
            )
            logger.info(
                f"AI helper {helper} answered in {latency}ms on {settings.OPENAI_MODEL}{tokens}"
            )
            if settings.LOG_AI_PAYLOADS:
                logger.info(f"AI helper {helper} response: {json.dumps(result)}")
            return parsed
        except RETRYABLE as e:
            if attempt == MAX_RETRIES - 1:
                await LlmRequest.record(
                    helper,
                    settings.OPENAI_MODEL,
                    masked_input,
                    None,
                    None,
                    error=type(e).__name__,
                )
                logger.error(
                    f"AI helper {helper} failed after {MAX_RETRIES} attempts: {type(e).__name__}"
                )
                raise AIServiceException() from e
            logger.warning(
                f"AI helper {helper} attempt {attempt + 1} failed with {type(e).__name__}, retrying in {RETRY_DELAYS[attempt]}s"
            )
            await asyncio.sleep(RETRY_DELAYS[attempt])
        except AIServiceException:
            await LlmRequest.record(
                helper,
                settings.OPENAI_MODEL,
                masked_input,
                None,
                None,
                error="no structured output",
            )
            raise
        except Exception as e:
            await LlmRequest.record(
                helper,
                settings.OPENAI_MODEL,
                masked_input,
                None,
                None,
                error=type(e).__name__,
            )
            logger.error(f"AI helper {helper} failed: {type(e).__name__}")
            raise AIServiceException() from e
    raise AIServiceException()
