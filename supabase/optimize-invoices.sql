-- =====================================================================
-- optimize-invoices.sql
-- invoices tablosu için performans indeksleri ekler.
-- Statement timeout sorununu çözer.
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- 1) type + issue_date composite index (en sık kullanılan sorgu)
CREATE INDEX IF NOT EXISTS idx_invoices_type_date
  ON invoices(type, issue_date DESC);

-- 2) vkntckn index (cari/tedarikçi eşleşmesi için)
CREATE INDEX IF NOT EXISTS idx_invoices_vkntckn
  ON invoices(vkntckn);

-- 3) raw_detail ve html_view kolonlarını TOAST storage'a taşı
--    (büyük JSON'lar satır dışında saklanır, liste sorgularında okunmaz)
ALTER TABLE invoices
  ALTER COLUMN raw_detail   SET STORAGE EXTERNAL,
  ALTER COLUMN html_view    SET STORAGE EXTERNAL;

-- 4) Mevcut veriler için storage'ı güncelle (vacuum gerektirir)
-- Not: Bu işlem arka planda çalışır, birkaç dakika sürebilir
VACUUM FULL ANALYZE invoices;

SELECT 'OK: indexes created, column storage optimized.' AS status;
