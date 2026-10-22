import time
import uuid
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError

from app.config import settings
from app.error import BadRequestException
from app.runtime.model import Holiday, SettingRow
from app.runtime.schemas import RuntimeSettings, SettingItem

_settings_cache: Optional[Tuple[float, RuntimeSettings, Dict[str, Any]]] = None
_holiday_cache: Dict[str, Tuple[float, set[date]]] = {}


def invalidate() -> None:
    global _settings_cache
    _settings_cache = None
    _holiday_cache.clear()


def _fresh(stamp: float) -> bool:
    return time.monotonic() - stamp < settings.RUNTIME_SETTINGS_CACHE_SECONDS


async def _load() -> Tuple[RuntimeSettings, Dict[str, Any]]:
    global _settings_cache
    if _settings_cache and _fresh(_settings_cache[0]):
        return _settings_cache[1], _settings_cache[2]
    rows = await SettingRow.all()
    meta = {row["key"]: row for row in rows}
    known = RuntimeSettings.model_fields
    overrides = {key: row["value"] for key, row in meta.items() if key in known}
    current_settings = RuntimeSettings(**overrides)
    _settings_cache = (time.monotonic(), current_settings, meta)
    return current_settings, meta


async def current() -> RuntimeSettings:
    current_settings, _ = await _load()
    return current_settings


async def listing() -> List[SettingItem]:
    current_settings, meta = await _load()
    values = current_settings.model_dump(mode="json")
    items = []
    for key, field in RuntimeSettings.model_fields.items():
        row = meta.get(key)
        items.append(
            SettingItem(
                key=key,
                value=values[key],
                description=field.description or key,
                updated_by=row["updated_by"] if row else None,
                updated_at=row["updated_at"].isoformat()
                if row and row["updated_at"]
                else None,
            )
        )
    return items


async def update(
    changes: Dict[str, Any], user_id: Optional[uuid.UUID]
) -> RuntimeSettings:
    unknown = [key for key in changes if key not in RuntimeSettings.model_fields]
    if unknown:
        raise BadRequestException(f"Unknown setting: {', '.join(sorted(unknown))}")
    current_settings = await current()
    existing = current_settings.model_dump()
    merged = dict(existing)
    for key, value in changes.items():
        merged[key] = (
            {**existing[key], **value}
            if isinstance(existing.get(key), dict) and isinstance(value, dict)
            else value
        )
    try:
        validated = RuntimeSettings(**merged)
    except ValidationError as e:
        problem = e.errors()[0]
        field = ".".join(str(part) for part in problem["loc"])
        raise BadRequestException(f"Invalid value for {field}: {problem['msg']}") from e
    dumped = validated.model_dump(mode="json")
    for key in changes:
        await SettingRow.upsert(key, dumped[key], user_id)
    invalidate()
    return validated


async def holidays(location: Optional[str] = None) -> set[date]:
    cache_key = (location or "").lower()
    cached = _holiday_cache.get(cache_key)
    if cached and _fresh(cached[0]):
        return cached[1]
    dates = await Holiday.dates(location)
    _holiday_cache[cache_key] = (time.monotonic(), dates)
    return dates
