-- ============================================================
-- is_islendi_kolonu.sql
-- invoices tablosuna işlenme takibi ekle
-- Mevcut tüm faturaları "işlendi" say (geriye doğru temiz başlangıç)
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_islendi  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS islendi_at  timestamptz;

-- Mevcut tüm faturalar işlendi sayılır (temiz başlangıç)
-- Yeni gelecek faturalar is_islendi=false olarak gelecek
UPDATE invoices
SET is_islendi = true,
    islendi_at = NOW()
WHERE is_islendi IS DISTINCT FROM true;

-- Doğrulama
SELECT
  COUNT(*)                                          AS toplam,
  COUNT(*) FILTER (WHERE is_islendi = true)         AS islendi,
  COUNT(*) FILTER (WHERE is_islendi = false OR is_islendi IS NULL) AS islenmedi
FROM invoices;
