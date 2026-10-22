import io
from datetime import date, timedelta

from openpyxl import Workbook

from app.engine.daily import run_daily_checks, run_monthly_report
from app.people import Person
from tests.conftest import advance_jobs

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def employee(
    name: str,
    email: str,
    joined_days_ago: int,
    level: str = "L4",
    status: str = "active",
    category: str = "lateral",
) -> Person:
    return await Person(
        full_name=name,
        work_email=email,
        role="employee",
        hire_category=category,
        level=level,
        employee_code=email.split("@")[0],
        joining_date=date.today() - timedelta(days=joined_days_ago),
        status=status,
    ).insert()


def workbook(rows) -> bytes:
    book = Workbook()
    sheet = book.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()


async def test_daily_check_sends_surveys_only_to_eligible_people(
    client, admin_headers, env
):
    await employee("Rahul Sharma", "rahul.sharma@tcgdigital.com", 30)
    await employee("Priya Das", "priya.das@tcgdigital.com", 60, category="campus")
    await employee("Senior Lead", "senior.lead@tcgdigital.com", 30, level="L8")
    await employee("Leaving Person", "leaving@tcgdigital.com", 30, status="exiting")
    await employee("Not Yet", "not.yet@tcgdigital.com", 31)
    assert await run_daily_checks() == 2
    rahul = env.graph.last_to("rahul.sharma@tcgdigital.com")
    assert (
        rahul["subject"] == "How are your first 30 days going?"
        and "https://forms.test/lateral" in rahul["body"]
    )
    assert (
        "https://forms.test/campus"
        in env.graph.last_to("priya.das@tcgdigital.com")["body"]
    )
    assert not env.graph.to("senior.lead@tcgdigital.com") and not env.graph.to(
        "leaving@tcgdigital.com"
    )
    assert await run_daily_checks() == 0
    await advance_jobs(env.conn, timedelta(days=4))
    assert (
        env.graph.last_to("rahul.sharma@tcgdigital.com")["subject"]
        == "Reminder: your 30 day feedback"
    )
    surveys = (
        await client.get("/api/feedback/surveys?milestone=30", headers=admin_headers)
    ).json()["data"]
    assert surveys[0]["reminders_sent"] == 1 and surveys[0]["status"] == "sent"


async def test_imported_low_score_alerts_hr_and_stops_reminders(
    client, admin_headers, env
):
    await employee("Rahul Sharma", "rahul.sharma@tcgdigital.com", 30)
    await run_daily_checks()
    data = workbook(
        [
            ["ID", "Email", "Overall score", "What can improve?"],
            [1, "Rahul.Sharma@tcgdigital.com", 2, "Laptop came late"],
            [2, "stranger@x.com", 5, "ok"],
        ]
    )
    env.storage.preload("uploads/survey_export/r.xlsx", data, XLSX)
    response = await client.post(
        "/api/feedback/responses/upload",
        json={
            "form_variant": "lateral",
            "file": {
                "file_name": "r.xlsx",
                "file_url": "uploads/survey_export/r.xlsx",
                "mime_type": XLSX,
                "size": len(data),
            },
        },
        headers=admin_headers,
    )
    assert response.json()["data"] == {
        "rows_total": 2,
        "rows_matched": 1,
        "rows_unmatched": 1,
        "low_score_alerts": 1,
    }
    assert (
        env.graph.last_to("hr@tcgdigital.com")["subject"]
        == "Low 30 day feedback score: Rahul Sharma"
    )
    sent_before = len(env.graph.to("rahul.sharma@tcgdigital.com"))
    await advance_jobs(env.conn, timedelta(days=10))
    assert len(env.graph.to("rahul.sharma@tcgdigital.com")) == sent_before
    flagged = (
        await client.get("/api/feedback/surveys?flagged=true", headers=admin_headers)
    ).json()["data"]
    assert flagged[0]["status"] == "responded" and flagged[0]["score"] == 2


async def test_report_is_built_masked_and_emailed_as_pdf(client, admin_headers, env):
    await employee("Rahul Sharma", "rahul.sharma@tcgdigital.com", 30)
    await run_daily_checks()
    data = workbook(
        [
            ["Email", "Score", "Comment"],
            [
                "rahul.sharma@tcgdigital.com",
                4,
                "Rahul Sharma says the buddy system helped, call me on 9876543210",
            ],
        ]
    )
    env.storage.preload("uploads/survey_export/a.xlsx", data, XLSX)
    await client.post(
        "/api/feedback/responses/upload",
        json={
            "form_variant": "lateral",
            "file": {
                "file_name": "a.xlsx",
                "file_url": "uploads/survey_export/a.xlsx",
                "mime_type": XLSX,
                "size": len(data),
            },
        },
        headers=admin_headers,
    )
    today = date.today()
    queued = await client.post(
        "/api/feedback/reports",
        json={
            "period_start": (today - timedelta(days=1)).isoformat(),
            "period_end": today.isoformat(),
        },
        headers=admin_headers,
    )
    assert queued.status_code == 202
    report_mail = env.graph.last_to("hr@tcgdigital.com")
    assert report_mail["subject"].startswith(
        "30-60-90 feedback report"
    ) and report_mail["attachments"][0]["data"].startswith(b"%PDF")
    analysis_request = next(
        r for r in env.llm.requests if r["helper"] == "FeedbackAnalysis"
    )
    assert (
        "9876543210" not in analysis_request["content"]
        and "Rahul" not in analysis_request["content"]
    )
    reports = (await client.get("/api/feedback/reports", headers=admin_headers)).json()[
        "data"
    ]
    assert reports[0]["status"] == "sent" and reports[0]["response_count"] == 1
    link = await client.get(
        f"/api/feedback/reports/{reports[0]['feedback_report_id']}/download-url",
        headers=admin_headers,
    )
    assert link.json()["data"]["url"].startswith("https://files.test/reports/feedback/")
    duplicate = await client.post(
        "/api/feedback/reports",
        json={
            "period_start": (today - timedelta(days=1)).isoformat(),
            "period_end": today.isoformat(),
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 409


async def test_monthly_report_runs_on_the_configured_day(env):
    assert await run_monthly_report(date(2026, 11, 2)) is None
    await run_monthly_report(date(2026, 11, 1))
    period = await env.conn.fetchrow(
        "SELECT period_start, period_end, status FROM feedback_reports"
    )
    assert (
        period["period_start"] == date(2026, 10, 1)
        and period["period_end"] == date(2026, 10, 31)
        and period["status"] == "sent"
    )
