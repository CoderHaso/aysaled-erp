-- ============================================================
-- 5c. invoices tablosuna invoice_scenario kolonu ekle
-- Uyumsoft API: Scenario = eInvoice veya eArchive
-- is_iade: gerçek değer InvoiceTipType='Return' (İngilizce!)
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_iade         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_scenario text;

-- Mevcut faturalarda is_iade'yi doğru değerle güncelle
-- API'den 'Return' geliyor (İngilizce), Türkçe 'IADE' değil!
UPDATE invoices
SET is_iade = true
WHERE invoice_type = 'Return'              -- InvoiceTipType = Return
   OR status       = 'Return'              -- Status = Return
   OR UPPER(COALESCE(invoice_type, '')) LIKE '%IADE%'  -- eski kayıtlar için fallback
   OR UPPER(COALESCE(status, ''))       = 'RETURN';

SELECT
  COUNT(*) FILTER (WHERE is_iade = true)  AS iade_sayisi,
  COUNT(*) FILTER (WHERE is_iade = false) AS normal_fatura_sayisi,
  COUNT(*) FILTER (WHERE invoice_type = 'Sales')  AS satis_sayisi,
  COUNT(*) FILTER (WHERE invoice_type = 'Return') AS return_sayisi
FROM invoices;
