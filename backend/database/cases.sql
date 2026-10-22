CREATE TABLE IF NOT EXISTS cases (
    case_id UUID PRIMARY KEY,
    case_type VARCHAR(16) NOT NULL,
    person_id UUID NOT NULL REFERENCES people (person_id) ON DELETE CASCADE,
    parent_case_id UUID REFERENCES cases (case_id) ON DELETE SET NULL,
    stage VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    flags TEXT[] NOT NULL DEFAULT '{}',
    track VARCHAR(16),
    created_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cases_type_check CHECK (case_type IN ('onboarding', 'exit', 'induction', 'feedback')),
    CONSTRAINT cases_status_check CHECK (status IN ('open', 'on_hold', 'closed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_one_active_per_type ON cases (person_id, case_type) WHERE status IN ('open', 'on_hold');
CREATE INDEX IF NOT EXISTS idx_cases_type_status_stage ON cases (case_type, status, stage);
CREATE INDEX IF NOT EXISTS idx_cases_person ON cases (person_id);
CREATE INDEX IF NOT EXISTS idx_cases_parent ON cases (parent_case_id);

CREATE TABLE IF NOT EXISTS checklist_items (
    checklist_item_id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases (case_id) ON DELETE CASCADE,
    document_type VARCHAR(64) NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    check_mode VARCHAR(8) NOT NULL DEFAULT 'text',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    attachment_id UUID,
    person_check VARCHAR(16),
    notes_enc BYTEA,
    sort_order INTEGER NOT NULL DEFAULT 0,
    verified_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checklist_items_unique_type UNIQUE (case_id, document_type),
    CONSTRAINT checklist_items_mode_check CHECK (check_mode IN ('text', 'photo')),
    CONSTRAINT checklist_items_status_check CHECK (status IN ('pending', 'received', 'verified', 'unreadable', 'wrong_type', 'name_mismatch')),
    CONSTRAINT checklist_items_person_check CHECK (person_check IS NULL OR person_check IN ('match', 'mismatch', 'not_found'))
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases (case_id) ON DELETE CASCADE,
    reminder_rule_id UUID,
    task_type VARCHAR(32) NOT NULL,
    owner_role VARCHAR(32) NOT NULL,
    owner_email_enc BYTEA,
    owner_email_idx BYTEA,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    sub_items JSONB NOT NULL DEFAULT '{}',
    progress_notes_enc BYTEA,
    source_ref_enc BYTEA,
    source_key VARCHAR(255),
    followups_sent INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ,
    paused_until TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tasks_status_check CHECK (status IN ('open', 'partial', 'done', 'blocked', 'not_applicable', 'escalated', 'paused', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_case ON tasks (case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_email_idx ON tasks (owner_email_idx);
CREATE INDEX IF NOT EXISTS idx_tasks_rule_status ON tasks (reminder_rule_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_rule_source_open ON tasks (reminder_rule_id, source_key)
    WHERE reminder_rule_id IS NOT NULL AND status IN ('open', 'partial', 'paused', 'escalated');

CREATE TABLE IF NOT EXISTS approvals (
    approval_id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases (case_id) ON DELETE CASCADE,
    approval_type VARCHAR(24) NOT NULL,
    source_email_id UUID,
    summary_enc BYTEA,
    draft_enc BYTEA NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    decided_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    reject_reason_enc BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT approvals_type_check CHECK (approval_type IN ('reply', 'induction_schedule')),
    CONSTRAINT approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'sent'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_status_created ON approvals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_case ON approvals (case_id);
