CREATE TABLE IF NOT EXISTS survey_responses (
    survey_response_id UUID PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES people (person_id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases (case_id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks (task_id) ON DELETE SET NULL,
    milestone SMALLINT NOT NULL,
    form_variant VARCHAR(16) NOT NULL,
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    response_ref VARCHAR(255),
    score REAL,
    answers_enc BYTEA,
    flagged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT survey_responses_unique UNIQUE (person_id, milestone),
    CONSTRAINT survey_responses_milestone_check CHECK (milestone IN (30, 60, 90)),
    CONSTRAINT survey_responses_variant_check CHECK (form_variant IN ('campus', 'lateral'))
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_sent ON survey_responses (sent_at DESC);

CREATE TABLE IF NOT EXISTS feedback_reports (
    feedback_report_id UUID PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    response_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'queued',
    storage_key VARCHAR(512),
    error VARCHAR(200),
    requested_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT feedback_reports_status_check CHECK (status IN ('queued', 'ready', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_period ON feedback_reports (period_start DESC);
