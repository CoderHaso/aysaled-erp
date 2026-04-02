-- ============================================================
-- TRIGGER'I KALDIR — Senkronize Et artık cari/tedarikçi
-- oluşturmasın. Cari/tedarikçi yönetimi SQL üzerinden yapılır.
-- ============================================================

-- Trigger'ı kaldır
DROP TRIGGER IF EXISTS trg_sync_contact ON invoices;

-- Fonksiyonu da kaldır (temiz tutalım)
DROP FUNCTION IF EXISTS sync_contact_from_invoice();

-- Doğrulama: 0 satır döndürmeli
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_sync_contact';
