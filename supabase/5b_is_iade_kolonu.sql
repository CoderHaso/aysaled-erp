-- ============================================================
-- 5b. invoices tablosuna is_iade ve eksik alanlar ekle
-- 5_adres_kolonlari.sql'in tamamlayıcısı
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_iade boolean DEFAULT false;

-- Mevcut faturalarda is_iade'yi invoice_type/invoice_tip_type'a göre güncelle
UPDATE invoices
SET is_iade = true
WHERE UPPER(COALESCE(invoice_type, ''))     LIKE '%IADE%'
   OR UPPER(COALESCE(invoice_tip_type, '')) LIKE '%IADE%'
   OR UPPER(COALESCE(status, ''))           = 'RETURN';

SELECT
  COUNT(*) FILTER (WHERE is_iade = true)  AS iade_faturaları,
  COUNT(*) FILTER (WHERE is_iade = false) AS normal_faturalar
FROM invoices;
