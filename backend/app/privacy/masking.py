from collections import Counter
from functools import lru_cache
from typing import Dict, List, Optional

from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_analyzer.nlp_engine import NlpEngineProvider
from pydantic import BaseModel, Field

from app.config import settings
from app.privacy.recognizers import (
    ENTITY_LABELS,
    custom_recognizers,
    known_people_recognizer,
)

SCORE_THRESHOLD = 0.4


class MaskResult(BaseModel):
    text: str = Field(..., description="Text with personal data replaced by labels")
    counts: Dict[str, int] = Field(
        default_factory=dict, description="Masked items per label"
    )


@lru_cache(maxsize=1)
def _analyzer() -> AnalyzerEngine:
    provider = NlpEngineProvider(
        nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": settings.SPACY_MODEL}],
        }
    )
    engine = AnalyzerEngine(
        nlp_engine=provider.create_engine(), supported_languages=["en"]
    )
    for recognizer in custom_recognizers():
        engine.registry.add_recognizer(recognizer)
    return engine


def warm_up() -> None:
    _analyzer()


def _resolve_overlaps(results: List[RecognizerResult]) -> List[RecognizerResult]:
    chosen: List[RecognizerResult] = []
    for result in sorted(
        results, key=lambda r: (r.start, -(r.end - r.start), -r.score)
    ):
        if chosen and result.start < chosen[-1].end:
            if result.end > chosen[-1].end:
                last = chosen[-1]
                chosen[-1] = RecognizerResult(
                    last.entity_type,
                    last.start,
                    result.end,
                    max(last.score, result.score),
                )
            continue
        chosen.append(result)
    return chosen


def mask_text(text: str, known_names: Optional[List[str]] = None) -> MaskResult:
    if not text or not text.strip():
        return MaskResult(text=text or "")
    ad_hoc = known_people_recognizer(known_names or [])
    results = _analyzer().analyze(
        text=text,
        language="en",
        entities=list(ENTITY_LABELS),
        ad_hoc_recognizers=[ad_hoc] if ad_hoc else None,
        score_threshold=SCORE_THRESHOLD,
    )
    spans = _resolve_overlaps(results)
    counts: Counter = Counter()
    masked = text
    for span in reversed(spans):
        label = ENTITY_LABELS.get(span.entity_type, "PII")
        counts[label] += 1
        masked = f"{masked[: span.start]}<{label}>{masked[span.end :]}"
    return MaskResult(text=masked, counts=dict(counts))


def detect_people(text: str) -> List[str]:
    if not text or not text.strip():
        return []
    results = _analyzer().analyze(
        text=text, language="en", entities=["PERSON"], score_threshold=SCORE_THRESHOLD
    )
    return [text[r.start : r.end] for r in results]
