import pytest

PAYLOAD = {
    "template_key": "custom_welcome",
    "name": "Custom welcome",
    "subject": "Welcome to {{ company_name }}",
}


async def test_admin_can_create_edit_preview_and_list_template(
    client, admin_headers, viewer_headers
):
    created = await client.post("/api/templates", json=PAYLOAD, headers=admin_headers)
    assert created.status_code == 201
    data = created.json()["data"]
    assert data["template_key"] == PAYLOAD["template_key"]
    assert data["is_active"] is False
    assert "company_name" in data["placeholders"]
    edited = await client.patch(
        "/api/templates/custom_welcome",
        json={"body_html": "<p>Hello {{ company_name }}</p>", "is_active": True},
        headers=admin_headers,
    )
    assert edited.status_code == 200
    assert edited.json()["data"]["is_active"] is True
    preview = await client.post(
        "/api/templates/custom_welcome/preview",
        json={"values": {"company_name": "TCG"}},
        headers=viewer_headers,
    )
    assert preview.status_code == 200
    assert preview.json()["data"]["subject"] == "Welcome to TCG"
    assert preview.json()["data"]["body_html"] == "<p>Hello TCG</p>"
    listed = await client.get(
        "/api/templates?search=custom_welcome", headers=viewer_headers
    )
    assert listed.status_code == 200
    assert [item["template_key"] for item in listed.json()["data"]] == [
        "custom_welcome"
    ]
    actions = await client.get(
        "/api/action-log?action=template_created", headers=admin_headers
    )
    assert actions.status_code == 200
    assert actions.json()["total"] == 1


async def test_template_creation_rejects_duplicate_keys_without_overwriting(
    client, admin_headers
):
    assert (
        await client.post("/api/templates", json=PAYLOAD, headers=admin_headers)
    ).status_code == 201
    duplicate = await client.post(
        "/api/templates", json={**PAYLOAD, "subject": "Changed"}, headers=admin_headers
    )
    assert duplicate.status_code == 409
    detail = await client.get("/api/templates/custom_welcome", headers=admin_headers)
    assert detail.json()["data"]["subject"] == PAYLOAD["subject"]


async def test_template_creation_requires_an_admin(client, viewer_headers):
    assert (await client.post("/api/templates", json=PAYLOAD)).status_code == 401
    assert (
        await client.post("/api/templates", json=PAYLOAD, headers=viewer_headers)
    ).status_code == 403


@pytest.mark.parametrize(
    "changes, expected",
    [
        ({"template_key": "Invalid-Key"}, 422),
        ({"template_key": "a" * 65}, 422),
        ({"name": "   "}, 422),
        ({"subject": "   "}, 422),
        ({"subject": "Hi {{ salary }}"}, 400),
        ({"subject": "Hi {{ company_name"}, 400),
    ],
)
async def test_template_creation_validates_input(
    client, admin_headers, changes, expected
):
    response = await client.post(
        "/api/templates", json={**PAYLOAD, **changes}, headers=admin_headers
    )
    assert response.status_code == expected
