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


def photo(key: str, mime_type: str = "image/jpeg") -> dict:
    return {"file_name": "me.jpg", "file_url": key, "mime_type": mime_type, "size": 3}


async def test_admin_sets_swaps_and_removes_a_user_photo(client, admin_headers, env):
    first = env.storage.preload("uploads/user_photo/first.jpg", b"one", "image/jpeg")
    created = await client.post(
        "/api/users",
        json={
            "name": "Photo User",
            "email": "photo.user@tcgdigital.com",
            "password": "Str0ngPass!",
            "photo": photo(first),
        },
        headers=admin_headers,
    )
    assert created.status_code == 201
    user = created.json()["data"]
    assert first in user["photo_url"]
    renamed = await client.patch(
        f"/api/users/{user['user_id']}",
        json={"complaints_access": True},
        headers=admin_headers,
    )
    assert first in renamed.json()["data"]["photo_url"]
    second = env.storage.preload("uploads/user_photo/second.png", b"two", "image/png")
    swapped = await client.patch(
        f"/api/users/{user['user_id']}",
        json={"photo": photo(second, "image/png")},
        headers=admin_headers,
    )
    assert second in swapped.json()["data"]["photo_url"]
    assert first not in env.storage.files
    removed = await client.patch(
        f"/api/users/{user['user_id']}", json={"photo": None}, headers=admin_headers
    )
    assert removed.json()["data"]["photo_url"] is None
    assert second not in env.storage.files


async def test_user_photo_must_be_a_real_user_photo_upload(client, admin_headers, env):
    payload = {
        "name": "Bad Photo",
        "email": "bad.photo@tcgdigital.com",
        "password": "Str0ngPass!",
    }
    missing = await client.post(
        "/api/users",
        json={**payload, "photo": photo("uploads/user_photo/nothing.jpg")},
        headers=admin_headers,
    )
    assert missing.status_code == 400
    joiner_key = env.storage.preload(
        "uploads/joiner_photo/someone.jpg", b"x", "image/jpeg"
    )
    wrong_purpose = await client.post(
        "/api/users",
        json={**payload, "photo": photo(joiner_key)},
        headers=admin_headers,
    )
    assert wrong_purpose.status_code == 400
    pdf_key = env.storage.preload("uploads/user_photo/cv.pdf", b"x", "application/pdf")
    not_an_image = await client.post(
        "/api/users",
        json={**payload, "photo": photo(pdf_key, "application/pdf")},
        headers=admin_headers,
    )
    assert not_an_image.status_code == 400


async def test_every_user_can_change_their_own_photo(client, viewer_headers, env):
    presign = {"file_name": "me.jpg", "mime_type": "image/jpeg", "size": 1000}
    own = await client.post(
        "/api/uploads/presign",
        json={**presign, "purpose": "user_photo"},
        headers=viewer_headers,
    )
    assert own.status_code == 200
    key = own.json()["data"]["file_url"]
    assert key.startswith("uploads/user_photo/")
    joiner = await client.post(
        "/api/uploads/presign",
        json={**presign, "purpose": "joiner_photo"},
        headers=viewer_headers,
    )
    assert joiner.status_code == 403
    too_big = await client.post(
        "/api/uploads/presign",
        json={**presign, "size": 6 * 1024 * 1024, "purpose": "user_photo"},
        headers=viewer_headers,
    )
    assert too_big.status_code == 400
    env.storage.preload(key, b"img", "image/jpeg")
    saved = await client.patch(
        "/api/auth/me/photo", json={"photo": photo(key)}, headers=viewer_headers
    )
    assert saved.status_code == 200 and key in saved.json()["data"]["photo_url"]
    me = await client.get("/api/auth/me", headers=viewer_headers)
    assert key in me.json()["data"]["photo_url"]
    cleared = await client.patch(
        "/api/auth/me/photo", json={"photo": None}, headers=viewer_headers
    )
    assert cleared.json()["data"]["photo_url"] is None
    assert key not in env.storage.files
