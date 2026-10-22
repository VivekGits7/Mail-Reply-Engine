CREATE TABLE IF NOT EXISTS induction_sessions (
    induction_session_id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases (case_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    owner_email_enc BYTEA,
    owner_email_idx BYTEA,
    proposed_start TIMESTAMPTZ NOT NULL,
    proposed_end TIMESTAMPTZ NOT NULL,
    agreed_start TIMESTAMPTZ,
    agreed_end TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'proposed',
    graph_event_id VARCHAR(512),
    followups_sent INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT induction_sessions_status_check CHECK (status IN ('proposed', 'asked', 'agreed', 'alternative', 'booked', 'no_reply', 'conflict'))
);

CREATE INDEX IF NOT EXISTS idx_induction_sessions_case ON induction_sessions (case_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_induction_sessions_owner_idx ON induction_sessions (owner_email_idx);
