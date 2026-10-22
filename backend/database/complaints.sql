CREATE TABLE IF NOT EXISTS complaints (
    complaint_id UUID PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(16) NOT NULL,
    sender_email_enc BYTEA,
    sender_email_idx BYTEA,
    person_id UUID REFERENCES people (person_id) ON DELETE SET NULL,
    subject_enc BYTEA,
    content_enc BYTEA,
    email_id UUID REFERENCES emails (email_id) ON DELETE SET NULL,
    attachment_id UUID REFERENCES attachments (attachment_id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT complaints_source_check CHECK (source IN ('email', 'exit_interview', 'hr_connect'))
);

CREATE INDEX IF NOT EXISTS idx_complaints_received ON complaints (received_at DESC);
