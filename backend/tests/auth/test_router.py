async def test_login_returns_a_token_that_works(client, admin):
    response = await client.post(
        "/api/auth/login",
        data={"username": "TCG@tcgdigital.com", "password": "Str0ngPass!"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer" and body["user"]["role"] == "hr_admin"
    me = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200 and me.json()["data"]["email"] == "tcg@tcgdigital.com"


async def test_login_with_a_wrong_password_returns_401(client, admin):
    response = await client.post(
        "/api/auth/login",
        data={"username": "tcg@tcgdigital.com", "password": "wrong-pass"},
    )
    assert response.status_code == 401 and response.json()["success"] is False


async def test_inactive_account_returns_403(client, admin, admin_headers):
    from app.auth.enums import UserRole
    from tests.conftest import make_user

    other = await make_user("second@tcgdigital.com", UserRole.HR_ADMIN)
    await client.patch(
        f"/api/users/{other.user_id}", json={"is_active": False}, headers=admin_headers
    )
    response = await client.post(
        "/api/auth/login",
        data={"username": "second@tcgdigital.com", "password": "Str0ngPass!"},
    )
    assert response.status_code == 403


async def test_logout_revokes_the_token(client, admin_headers):
    assert (
        await client.post("/api/auth/logout", headers=admin_headers)
    ).status_code == 200
    assert (await client.get("/api/auth/me", headers=admin_headers)).status_code == 401


async def test_missing_token_returns_401(client):
    assert (await client.get("/api/joiners")).status_code == 401


async def test_hr_admin_manages_admins_and_viewers_cannot(
    client, admin_headers, viewer_headers
):
    created = await client.post(
        "/api/users",
        json={
            "name": "New Viewer",
            "email": "new.viewer@tcgdigital.com",
            "password": "Str0ngPass!",
            "role": "hr_viewer",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201
    duplicate = await client.post(
        "/api/users",
        json={
            "name": "Again",
            "email": "NEW.viewer@tcgdigital.com",
            "password": "Str0ngPass!",
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 409
    listed = await client.get("/api/users?search=new.viewer", headers=admin_headers)
    assert listed.json()["total"] == 1
    assert (await client.get("/api/users", headers=viewer_headers)).status_code == 403
    user_id = created.json()["data"]["user_id"]
    updated = await client.patch(
        f"/api/users/{user_id}", json={"complaints_access": True}, headers=admin_headers
    )
    assert updated.json()["data"]["complaints_access"] is True


async def test_admin_cannot_remove_their_own_admin_role(client, admin, admin_headers):
    response = await client.patch(
        f"/api/users/{admin.user_id}", json={"role": "hr_viewer"}, headers=admin_headers
    )
    assert response.status_code == 400


async def test_short_password_and_bad_uuid_are_rejected(client, admin_headers):
    response = await client.post(
        "/api/users",
        json={"name": "X Y", "email": "x@tcgdigital.com", "password": "short"},
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert (
        await client.patch(
            "/api/users/not-a-uuid", json={"is_active": True}, headers=admin_headers
        )
    ).status_code == 400
