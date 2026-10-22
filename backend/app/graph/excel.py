from typing import Any, List

from app.graph.client import request


async def used_range(drive_id: str, item_id: str, sheet: str) -> List[List[Any]]:
    response = await request(
        "GET",
        f"/drives/{drive_id}/items/{item_id}/workbook/worksheets('{sheet}')/usedRange",
        params={"$select": "values"},
        prefer=None,
    )
    return response.json().get("values") or []
