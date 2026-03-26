CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uyumsoft ayarları için varsayılan satır
INSERT INTO app_settings (id, value) 
VALUES ('uyumsoft', '{"username": "", "password": ""}'::jsonb)
ON CONFLICT (id) DO NOTHING;
