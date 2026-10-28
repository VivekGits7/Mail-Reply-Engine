CREATE TABLE IF NOT EXISTS people (
    person_id UUID PRIMARY KEY,
    full_name_enc BYTEA NOT NULL,
    personal_email_enc BYTEA,
    personal_email_idx BYTEA,
    work_email_enc BYTEA,
    work_email_idx BYTEA,
    recruiter_email_enc BYTEA,
    recruiter_email_idx BYTEA,
    manager_name_enc BYTEA,
    manager_email_enc BYTEA,
    manager_email_idx BYTEA,
    date_of_birth_enc BYTEA,
    profile_enc BYTEA,
    pan_hash BYTEA,
    role VARCHAR(16) NOT NULL DEFAULT 'candidate',
    hire_category VARCHAR(16),
    level VARCHAR(16),
    location VARCHAR(100),
    designation VARCHAR(255),
    employee_code VARCHAR(32),
    joining_date DATE,
    last_working_day DATE,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    photo_key VARCHAR(512),
    created_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT people_role_check CHECK (role IN ('candidate', 'employee', 'stakeholder', 'manager')),
    CONSTRAINT people_hire_category_check CHECK (hire_category IS NULL OR hire_category IN ('campus', 'lateral')),
    CONSTRAINT people_status_check CHECK (status IN ('active', 'exiting', 'exited', 'dropped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_employee_code ON people (employee_code) WHERE employee_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_personal_email_idx ON people (personal_email_idx);
CREATE INDEX IF NOT EXISTS idx_people_work_email_idx ON people (work_email_idx);
CREATE INDEX IF NOT EXISTS idx_people_recruiter_email_idx ON people (recruiter_email_idx);
CREATE INDEX IF NOT EXISTS idx_people_manager_email_idx ON people (manager_email_idx);
CREATE INDEX IF NOT EXISTS idx_people_joining_date ON people (joining_date);
CREATE INDEX IF NOT EXISTS idx_people_role_status ON people (role, status);
