from app.config import settings


async def test_validation_handshake_echoes_the_token(client):
    response = await client.post("/api/graph/notifications?validationToken=abc%20123")
    assert response.status_code == 200 and response.text == "abc 123"
    lifecycle = await client.post("/api/graph/lifecycle?validationToken=xyz")
    assert lifecycle.status_code == 200 and lifecycle.text == "xyz"


async def test_notifications_with_a_wrong_client_state_are_dropped(client, env):
    body = {"value": [{"clientState": "wrong", "resourceData": {"id": "in-1"}}]}
    response = await client.post("/api/graph/notifications", json=body)
    assert response.status_code == 202
    assert (
        await env.conn.fetchval(
            "SELECT COUNT(*) FROM events WHERE event_type = 'email.received'"
        )
        == 0
    )


async def test_valid_notification_queues_one_event_per_message(client, env):
    message_id = env.graph.add_message(
        from_email="news@vendor.com",
        subject="Webinar",
        body="Join us",
        headers={"List-Unsubscribe": "<x>"},
    )
    body = {
        "value": [
            {
                "clientState": settings.GRAPH_CLIENT_STATE,
                "resourceData": {"id": message_id},
            }
        ]
        * 2
    }
    response = await client.post("/api/graph/notifications", json=body)
    assert response.status_code == 202
    assert (
        await env.conn.fetchval(
            "SELECT COUNT(*) FROM events WHERE event_type = 'email.received'"
        )
        == 1
    )
    assert (
        await env.conn.fetchval(
            "SELECT processing_status FROM emails WHERE graph_message_id = $1",
            message_id,
        )
        == "filtered"
    )


async def test_delta_poll_queues_new_messages(env):
    from app.graph.service import poll_mailbox

    assert await poll_mailbox() == 0
    message_id = env.graph.add_message(
        from_email="news@vendor.com",
        subject="Offer",
        body="Buy",
        headers={"Precedence": "bulk"},
    )
    env.graph.delta_ids = [message_id]
    assert await poll_mailbox() == 1
