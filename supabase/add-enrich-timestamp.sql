-- =====================================================================
-- add-enrich-timestamp.sql
-- customers ve suppliers tablolarına enrich_attempted_at kolonu ekler.
-- Bu kolon, daha önce zenginleştirme denenmiş kayıtların tekrar
-- işlenmesini önler (sonsuz döngüyü engeller).
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS enrich_attempted_at TIMESTAMPTZ;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS enrich_attempted_at TIMESTAMPTZ;

-- Tüm mevcut kayıtların denenmeyi beklediğini işaretle (null = henüz denenmedi)
-- İstersen önceden "başarısız" olanları da sıfırlayabilirsin:
-- UPDATE customers SET enrich_attempted_at = NULL WHERE phone IS NULL;
-- UPDATE suppliers SET enrich_attempted_at = NULL WHERE phone IS NULL;

-- Index ekle (sorgu performansı için)
CREATE INDEX IF NOT EXISTS idx_customers_enrich ON customers(enrich_attempted_at) WHERE enrich_attempted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_enrich ON suppliers(enrich_attempted_at) WHERE enrich_attempted_at IS NULL;

SELECT 'OK: enrich_attempted_at columns added.' AS status;
