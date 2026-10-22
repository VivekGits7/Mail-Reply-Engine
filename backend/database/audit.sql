CREATE TABLE IF NOT EXISTS action_log (
    action_log_id UUID PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_type VARCHAR(16) NOT NULL,
    actor_id UUID,
    action VARCHAR(64) NOT NULL,
    case_id UUID,
    entity_type VARCHAR(32),
    entity_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT action_log_actor_check CHECK (actor_type IN ('agent', 'user', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_action_log_case_time ON action_log (case_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_action_log_time ON action_log (occurred_at DESC);
