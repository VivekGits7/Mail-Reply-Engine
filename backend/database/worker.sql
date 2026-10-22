CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    source VARCHAR(16) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    dedupe_key VARCHAR(255) UNIQUE,
    status VARCHAR(16) NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    case_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT events_source_check CHECK (source IN ('email', 'scheduler', 'hr_action', 'd365', 'system')),
    CONSTRAINT events_status_check CHECK (status IN ('queued', 'processing', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_events_status_available ON events (status, available_at);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    scheduled_job_id UUID PRIMARY KEY,
    job_type VARCHAR(48) NOT NULL,
    case_id UUID REFERENCES cases (case_id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks (task_id) ON DELETE CASCADE,
    template_key VARCHAR(64),
    run_at TIMESTAMPTZ NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    dedupe_key VARCHAR(255) NOT NULL UNIQUE,
    payload JSONB NOT NULL DEFAULT '{}',
    tries INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT scheduled_jobs_status_check CHECK (status IN ('pending', 'running', 'done', 'skipped', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_due ON scheduled_jobs (status, run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_task ON scheduled_jobs (task_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_case ON scheduled_jobs (case_id, status);
