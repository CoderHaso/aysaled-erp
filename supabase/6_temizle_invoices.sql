-- ============================================================
-- 6. INVOICES TABLOSUNU SIFIRLA
-- Önce ilişkili verileri temizle, sonra invoices'ı temizle
-- ============================================================

-- Eski zenginleştirme denemelerini sıfırla
UPDATE customers SET enrich_attempted_at = NULL WHERE enrich_attempted_at IS NOT NULL;
UPDATE suppliers SET enrich_attempted_at = NULL WHERE enrich_attempted_at IS NOT NULL;

-- Invoices tablosunu sıfırla
DELETE FROM invoices;

-- Kontrol
SELECT COUNT(*) AS kalan_fatura FROM invoices;
