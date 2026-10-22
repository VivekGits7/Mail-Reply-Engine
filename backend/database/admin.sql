CREATE TABLE IF NOT EXISTS checklist_templates (
    checklist_template_id UUID PRIMARY KEY,
    hire_category VARCHAR(16) NOT NULL,
    location VARCHAR(100) NOT NULL DEFAULT '*',
    document_type VARCHAR(64) NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    check_mode VARCHAR(8) NOT NULL DEFAULT 'text',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checklist_templates_unique UNIQUE (hire_category, location, document_type),
    CONSTRAINT checklist_templates_category_check CHECK (hire_category IN ('campus', 'lateral')),
    CONSTRAINT checklist_templates_mode_check CHECK (check_mode IN ('text', 'photo'))
);

CREATE TABLE IF NOT EXISTS induction_templates (
    induction_template_id UUID PRIMARY KEY,
    track VARCHAR(16) NOT NULL UNIQUE,
    sessions JSONB NOT NULL DEFAULT '[]',
    updated_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT induction_templates_track_check CHECK (track IN ('campus', 'mid', 'senior'))
);
