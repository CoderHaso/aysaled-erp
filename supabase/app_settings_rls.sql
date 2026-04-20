-- ═══════════════════════════════════════════════════════════════════
-- app_settings RLS politikaları
-- Tüm authenticate kullanıcılar okuyabilir ve yazabilir
-- ═══════════════════════════════════════════════════════════════════

-- RLS'i etkinleştir (zaten açıksa hata vermez)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Okuma politikası
DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
CREATE POLICY "app_settings_select" ON app_settings
    FOR SELECT TO authenticated USING (true);

-- Insert politikası
DROP POLICY IF EXISTS "app_settings_insert" ON app_settings;
CREATE POLICY "app_settings_insert" ON app_settings
    FOR INSERT TO authenticated WITH CHECK (true);

-- Update politikası
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
CREATE POLICY "app_settings_update" ON app_settings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Varsayılan döviz kurları satırı (yoksa ekle)
INSERT INTO app_settings (id, value)
VALUES ('default_fx_rates', '{"USD": 38.50, "EUR": 42.00, "GBP": 49.00, "_updated": ""}'::jsonb)
ON CONFLICT (id) DO NOTHING;
