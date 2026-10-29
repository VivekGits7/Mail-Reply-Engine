from unittest.mock import AsyncMock

import httpx

from app.graph import mail


async def test_get_message_selects_only_graph_message_fields(monkeypatch):
    graph_request = AsyncMock(
        return_value=httpx.Response(200, json={"id": "message-1"})
    )
    monkeypatch.setattr(mail, "request", graph_request)

    message = await mail.get_message("message-1")

    assert message.id == "message-1"
    _, kwargs = graph_request.call_args
    selected = kwargs["params"]["$select"].split(",")
    assert "internetMessageHeaders" in selected
    assert "uniqueBody" in selected
    assert "isDeliveryReceipt" not in selected
    assert "isReadReceipt" not in selected
