CREATE TABLE IF NOT EXISTS settings (
    setting_id UUID PRIMARY KEY,
    key VARCHAR(64) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES users (user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holidays (
    holiday_id UUID PRIMARY KEY,
    holiday_date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date_location ON holidays (holiday_date, COALESCE(LOWER(location), ''));
