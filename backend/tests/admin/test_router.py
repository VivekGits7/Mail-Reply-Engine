async def test_status_shows_switches_and_queue(client, viewer_headers):
    response = await client.get("/api/admin/status", headers=viewer_headers)
    data = response.json()["data"]
    assert (
        response.status_code == 200
        and data["dry_run"] is False
        and data["mailbox"]["subscription"] == "polling_only"
    )


async def test_kill_switch_and_dry_run_are_admin_only(
    client, admin_headers, viewer_headers
):
    assert (
        await client.post(
            "/api/admin/kill-switch", json={"enabled": True}, headers=viewer_headers
        )
    ).status_code == 403
    flipped = await client.post(
        "/api/admin/kill-switch",
        json={"enabled": True, "reason": "Wrong template"},
        headers=admin_headers,
    )
    assert flipped.json()["data"]["kill_switch"] is True
    status = await client.get("/api/admin/status", headers=admin_headers)
    assert status.json()["data"]["kill_switch"] is True


async def test_dry_run_needs_a_test_inbox(client, admin_headers):
    await client.patch(
        "/api/settings", json={"max_followups": 2}, headers=admin_headers
    )
    response = await client.post(
        "/api/admin/dry-run",
        json={"enabled": True, "test_inbox": "qa@tcgdigital.com"},
        headers=admin_headers,
    )
    assert (
        response.status_code == 200
        and response.json()["data"]["test_inbox"] == "qa@tcgdigital.com"
    )


async def test_settings_are_validated_merged_and_switches_blocked(
    client, admin_headers
):
    response = await client.patch(
        "/api/settings",
        json={
            "followup_gap_hours": 72,
            "contacts": {"finance_team": "fin@tcgdigital.com"},
        },
        headers=admin_headers,
    )
    assert response.status_code == 200
    values = {item["key"]: item["value"] for item in response.json()["data"]}
    assert values["followup_gap_hours"] == 72
    assert (
        values["contacts"]["finance_team"] == "fin@tcgdigital.com"
        and values["contacts"]["it_team"] == "it@tcgdigital.com"
    )
    assert (
        await client.patch(
            "/api/settings", json={"followup_gap_hours": 0}, headers=admin_headers
        )
    ).status_code == 400
    assert (
        await client.patch(
            "/api/settings", json={"salary_band": 1}, headers=admin_headers
        )
    ).status_code == 400
    assert (
        await client.patch(
            "/api/settings", json={"kill_switch": True}, headers=admin_headers
        )
    ).status_code == 400
    assert (
        await client.patch(
            "/api/settings", json={"sending_start": "9am"}, headers=admin_headers
        )
    ).status_code == 400


async def test_holidays_crud(client, admin_headers):
    created = await client.post(
        "/api/holidays",
        json={"holiday_date": "2026-12-25", "name": "Christmas"},
        headers=admin_headers,
    )
    assert created.status_code == 201
    assert (
        await client.post(
            "/api/holidays",
            json={"holiday_date": "2026-12-25", "name": "Again"},
            headers=admin_headers,
        )
    ).status_code == 409
    listed = await client.get("/api/holidays?year=2026", headers=admin_headers)
    assert [h["name"] for h in listed.json()["data"]] == ["Christmas"]
    holiday_id = created.json()["data"]["holiday_id"]
    assert (
        await client.delete(f"/api/holidays/{holiday_id}", headers=admin_headers)
    ).status_code == 204
    assert (
        await client.delete(f"/api/holidays/{holiday_id}", headers=admin_headers)
    ).status_code == 404


async def test_checklist_and_induction_templates(client, admin_headers):
    seeded = await client.get(
        "/api/checklist-templates?hire_category=lateral", headers=admin_headers
    )
    assert any(
        item["document_type"] == "relieving_letter"
        for item in seeded.json()["data"][0]["items"]
    )
    saved = await client.put(
        "/api/checklist-templates",
        json={
            "hire_category": "campus",
            "location": "Mumbai",
            "items": [
                {"document_type": "pan_card"},
                {"document_type": "passport_photo", "check_mode": "photo"},
            ],
        },
        headers=admin_headers,
    )
    assert saved.status_code == 200 and len(saved.json()["data"]["items"]) == 2
    duplicate = await client.put(
        "/api/checklist-templates",
        json={
            "hire_category": "campus",
            "items": [{"document_type": "pan_card"}, {"document_type": "pan_card"}],
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 422
    track = await client.get("/api/induction-templates/mid", headers=admin_headers)
    assert track.status_code == 200 and track.json()["data"]["sessions"]
    bad_owner = await client.put(
        "/api/induction-templates/mid",
        json={
            "sessions": [
                {
                    "title": "IT",
                    "owner_email": "nobody",
                    "duration_mins": 30,
                    "day_number": 1,
                }
            ]
        },
        headers=admin_headers,
    )
    assert bad_owner.status_code == 422


async def test_templates_can_be_edited_and_previewed(client, admin_headers):
    listed = await client.get(
        "/api/templates?search=doc_request", headers=admin_headers
    )
    assert listed.json()["data"][0]["template_key"] == "doc_request"
    edited = await client.patch(
        "/api/templates/doc_request",
        json={"subject": "Docs needed: {{ candidate_name }}"},
        headers=admin_headers,
    )
    assert edited.status_code == 200
    preview = await client.post(
        "/api/templates/doc_request/preview",
        json={"values": {"candidate_name": "Rahul Sharma"}},
        headers=admin_headers,
    )
    assert preview.json()["data"]["subject"] == "Docs needed: Rahul Sharma"
    assert (
        await client.patch(
            "/api/templates/doc_request",
            json={"subject": "{{ ctc }}"},
            headers=admin_headers,
        )
    ).status_code == 400
    assert (
        await client.get("/api/templates/nope", headers=admin_headers)
    ).status_code == 404


async def test_action_log_and_failures(client, admin_headers, env):
    await client.post(
        "/api/admin/kill-switch", json={"enabled": False}, headers=admin_headers
    )
    log = await client.get(
        "/api/action-log?action=kill_switch_changed", headers=admin_headers
    )
    assert (
        log.json()["total"] == 1 and log.json()["data"][0]["actor_name"] == "TCG User"
    )
    from app.worker import enqueue_event

    event_id = await enqueue_event("test.unhandled", {}, source="system")
    failures = await client.get("/api/admin/failures?kind=event", headers=admin_headers)
    assert failures.json()["data"][0]["failure_id"] == str(event_id)
    retried = await client.post(
        f"/api/admin/failures/{event_id}/retry",
        json={"kind": "event"},
        headers=admin_headers,
    )
    assert retried.status_code == 200
    missing = await client.post(
        f"/api/admin/failures/{event_id}/retry",
        json={"kind": "job"},
        headers=admin_headers,
    )
    assert missing.status_code == 404


async def test_presign_checks_purpose_type_and_size(
    client, admin_headers, viewer_headers, restricted_headers
):
    ok = await client.post(
        "/api/uploads/presign",
        json={
            "file_name": "a.pdf",
            "mime_type": "application/pdf",
            "size": 1000,
            "purpose": "appointment_letter",
        },
        headers=admin_headers,
    )
    assert ok.status_code == 200 and ok.json()["data"]["file_url"].startswith(
        "uploads/appointment_letter/"
    )
    wrong_type = await client.post(
        "/api/uploads/presign",
        json={
            "file_name": "a.png",
            "mime_type": "image/png",
            "size": 1000,
            "purpose": "appointment_letter",
        },
        headers=admin_headers,
    )
    assert wrong_type.status_code == 400
    too_big = await client.post(
        "/api/uploads/presign",
        json={
            "file_name": "a.pdf",
            "mime_type": "application/pdf",
            "size": 999_999_999,
            "purpose": "appointment_letter",
        },
        headers=admin_headers,
    )
    assert too_big.status_code == 400
    assert (
        await client.post(
            "/api/uploads/presign",
            json={
                "file_name": "a.pdf",
                "mime_type": "application/pdf",
                "size": 10,
                "purpose": "appointment_letter",
            },
            headers=viewer_headers,
        )
    ).status_code == 403
    transcript = await client.post(
        "/api/uploads/presign",
        json={
            "file_name": "n.txt",
            "mime_type": "text/plain",
            "size": 10,
            "purpose": "transcript",
        },
        headers=restricted_headers,
    )
    assert transcript.status_code == 200


async def test_root_health_and_openapi(client):
    assert (await client.get("/")).json()["data"]["version"] == "2.0.0"
    health = await client.get("/health")
    assert health.status_code == 200 and health.json()["data"]["redis"] == "inline"
    spec = (await client.get("/openapi.json")).json()
    operations = sum(len(item) for item in spec["paths"].values())
    assert operations == 64
