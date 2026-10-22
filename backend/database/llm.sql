CREATE TABLE IF NOT EXISTS llm_requests (
    llm_request_id UUID PRIMARY KEY,
    helper VARCHAR(64) NOT NULL,
    model VARCHAR(64) NOT NULL,
    request_enc BYTEA,
    response_enc BYTEA,
    latency_ms INTEGER,
    blocked_by_guard BOOLEAN NOT NULL DEFAULT FALSE,
    error VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_requests_created ON llm_requests (created_at);
