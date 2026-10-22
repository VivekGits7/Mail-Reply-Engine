from datetime import datetime
from typing import Any, Callable, List, Optional, Sequence, Tuple, TypeVar

from app.common.enums import SortOrder

ItemT = TypeVar("ItemT")


def sql_order(
    sort_column: str, sort_order: SortOrder, created_column: str, pk_column: str
) -> str:
    if sort_order == SortOrder.LATEST:
        return f"{created_column} DESC NULLS LAST, {pk_column}"
    if sort_order == SortOrder.OLDEST:
        return f"{created_column} ASC NULLS LAST, {pk_column}"
    direction = "ASC" if sort_order == SortOrder.A_TO_Z else "DESC"
    return f"{sort_column} {direction} NULLS LAST, {pk_column}"


def sort_in_app(
    items: Sequence[ItemT],
    sort_key: Callable[[ItemT], Any],
    created_key: Callable[[ItemT], Optional[datetime]],
    sort_order: SortOrder,
) -> List[ItemT]:
    if sort_order in (SortOrder.LATEST, SortOrder.OLDEST):
        dated = [item for item in items if created_key(item) is not None]
        undated = [item for item in items if created_key(item) is None]
        dated.sort(key=created_key, reverse=sort_order == SortOrder.LATEST)
        return dated + undated
    present = [item for item in items if sort_key(item) not in (None, "")]
    missing = [item for item in items if sort_key(item) in (None, "")]
    present.sort(
        key=lambda item: _normalise(sort_key(item)),
        reverse=sort_order == SortOrder.Z_TO_A,
    )
    return present + missing


def _normalise(value: Any) -> Any:
    return value.lower() if isinstance(value, str) else value


def paginate(
    items: Sequence[ItemT], limit: int, offset: int
) -> Tuple[List[ItemT], int]:
    return list(items[offset : offset + limit]), len(items)


def contains(haystack: Optional[str], needle: Optional[str]) -> bool:
    if not needle:
        return True
    return bool(haystack) and needle.strip().lower() in haystack.lower()
