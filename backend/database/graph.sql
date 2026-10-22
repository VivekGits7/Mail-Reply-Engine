CREATE TABLE IF NOT EXISTS mailbox_state (
    mailbox_state_id UUID PRIMARY KEY,
    mailbox VARCHAR(320) NOT NULL UNIQUE,
    delta_link TEXT,
    subscription_id VARCHAR(128),
    subscription_expires_at TIMESTAMPTZ,
    last_poll_at TIMESTAMPTZ,
    last_email_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
