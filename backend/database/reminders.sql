CREATE TABLE IF NOT EXISTS reminder_rules (
    reminder_rule_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rule_key VARCHAR(64) NOT NULL UNIQUE,
    data_source VARCHAR(16) NOT NULL DEFAULT 'upload',
    recipient_field VARCHAR(64) NOT NULL,
    required_columns TEXT[] NOT NULL DEFAULT '{}',
    template_key VARCHAR(64) NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]',
    schedule_cron VARCHAR(64) NOT NULL,
    followup_gap_hours INTEGER NOT NULL DEFAULT 48,
    max_rounds INTEGER NOT NULL DEFAULT 3,
    escalate_to_email VARCHAR(320),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reminder_rules_source_check CHECK (data_source IN ('upload', 'd365', 'test'))
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_reminder_rule_fk') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_reminder_rule_fk
            FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules (reminder_rule_id) ON DELETE CASCADE;
    END IF;
END $$;
