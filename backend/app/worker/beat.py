from celery.schedules import crontab

BEAT_SCHEDULE = {
    "poll-mailbox": {"task": "worker.poll_mailbox", "schedule": 120.0},
    "run-due-jobs": {"task": "worker.run_due_jobs", "schedule": 300.0},
    "sweep-events": {"task": "worker.sweep_events", "schedule": 600.0},
    "reminder-rules": {"task": "worker.reminder_tick", "schedule": 300.0},
    "ensure-subscription": {
        "task": "worker.ensure_subscription",
        "schedule": crontab(minute=0, hour="*/12"),
    },
    "daily-checks": {
        "task": "worker.daily_checks",
        "schedule": crontab(hour=9, minute=0),
    },
    "monthly-feedback-report": {
        "task": "worker.monthly_report",
        "schedule": crontab(hour=9, minute=15),
    },
    "d365-poll": {"task": "worker.d365_poll", "schedule": 900.0},
    "purge-llm-audit": {
        "task": "worker.purge_llm_audit",
        "schedule": crontab(hour=2, minute=0),
    },
}
