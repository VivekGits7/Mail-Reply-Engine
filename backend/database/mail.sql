CREATE TABLE IF NOT EXISTS emails (
    email_id UUID PRIMARY KEY,
    graph_message_id VARCHAR(512) UNIQUE,
    internet_message_id VARCHAR(998),
    conversation_id VARCHAR(512),
    in_reply_to VARCHAR(998),
    direction VARCHAR(16) NOT NULL,
    from_email_enc BYTEA,
    from_email_idx BYTEA,
    from_name_enc BYTEA,
    to_enc BYTEA,
    cc_enc BYTEA,
    recipients_idx BYTEA[] NOT NULL DEFAULT '{}',
    subject_enc BYTEA,
    body_text_enc BYTEA,
    received_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    case_id UUID REFERENCES cases (case_id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks (task_id) ON DELETE SET NULL,
    category VARCHAR(32),
    confidence REAL,
    ai_summary_enc BYTEA,
    processing_status VARCHAR(16) NOT NULL DEFAULT 'received',
    filter_reason VARCHAR(64),
    template_key VARCHAR(64),
    approval_id UUID REFERENCES approvals (approval_id) ON DELETE SET NULL,
    dedupe_key VARCHAR(255) UNIQUE,
    is_automatic BOOLEAN NOT NULL DEFAULT FALSE,
    is_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT emails_direction_check CHECK (direction IN ('inbound', 'outbound')),
    CONSTRAINT emails_processing_check CHECK (processing_status IN ('received', 'filtered', 'unmatched', 'routed', 'processed', 'failed', 'sent'))
);

CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails (conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_internet_message ON emails (internet_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_case_time ON emails (case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_emails_from_idx ON emails (from_email_idx);
CREATE INDEX IF NOT EXISTS idx_emails_outbound_sent ON emails (direction, sent_at);
CREATE INDEX IF NOT EXISTS idx_emails_recipients_idx ON emails USING GIN (recipients_idx);

CREATE TABLE IF NOT EXISTS attachments (
    attachment_id UUID PRIMARY KEY,
    email_id UUID REFERENCES emails (email_id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases (case_id) ON DELETE SET NULL,
    parent_attachment_id UUID REFERENCES attachments (attachment_id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL DEFAULT 'email_document',
    file_name_enc BYTEA NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_key VARCHAR(512),
    sha256 VARCHAR(64),
    document_type_guess VARCHAR(64),
    ai_confidence REAL,
    ocr_quality REAL,
    text_chars INTEGER,
    name_match_score REAL,
    person_check VARCHAR(16),
    check_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    issues TEXT[] NOT NULL DEFAULT '{}',
    is_latest BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT attachments_kind_check CHECK (kind IN ('email_document', 'appointment_letter', 'reminder_list', 'survey_export', 'transcript', 'statement_of_understanding', 'report')),
    CONSTRAINT attachments_check_status_check CHECK (check_status IN ('pending', 'processed', 'unreadable', 'wrong_type', 'restricted', 'duplicate', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_case ON attachments (case_id);
CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments (email_id);
CREATE INDEX IF NOT EXISTS idx_attachments_case_sha ON attachments (case_id, sha256);
CREATE INDEX IF NOT EXISTS idx_attachments_kind ON attachments (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS templates (
    template_id UUID PRIMARY KEY,
    template_key VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    placeholders TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_items_attachment_fk') THEN
        ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_attachment_fk
            FOREIGN KEY (attachment_id) REFERENCES attachments (attachment_id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approvals_source_email_fk') THEN
        ALTER TABLE approvals ADD CONSTRAINT approvals_source_email_fk
            FOREIGN KEY (source_email_id) REFERENCES emails (email_id) ON DELETE SET NULL;
    END IF;
END $$;
