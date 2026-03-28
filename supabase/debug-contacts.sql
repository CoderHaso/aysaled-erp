-- =====================================================================
-- DEBUG: raw_detail durumunu kontrol et
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- 1) Kaç faturada raw_detail dolu?
SELECT
  type,
  COUNT(*) FILTER (WHERE raw_detail IS NOT NULL) AS has_raw_detail,
  COUNT(*) FILTER (WHERE raw_detail IS NULL)     AS no_raw_detail,
  COUNT(*)                                        AS total
FROM invoices
GROUP BY type;

-- 2) raw_detail dolu olan faturalardan birinin yapısını göster
SELECT
  invoice_id,
  type,
  jsonb_object_keys(raw_detail) AS top_level_keys
FROM invoices
WHERE raw_detail IS NOT NULL
LIMIT 1;

-- 3) AccountingCustomerParty ve AccountingSupplierParty içeriği
SELECT
  invoice_id,
  type,
  raw_detail -> 'AccountingCustomerParty' AS customer_party,
  raw_detail -> 'AccountingSupplierParty' AS supplier_party
FROM invoices
WHERE raw_detail IS NOT NULL
LIMIT 3;

-- 4) Customers tablosunda boş alanlar
SELECT
  COUNT(*) FILTER (WHERE phone IS NULL OR phone = '') AS no_phone,
  COUNT(*) FILTER (WHERE address IS NULL OR address = '') AS no_address,
  COUNT(*) FILTER (WHERE city IS NULL OR city = '') AS no_city,
  COUNT(*) total
FROM customers;

-- 5) Suppliers tablosunda boş alanlar
SELECT
  COUNT(*) FILTER (WHERE phone IS NULL OR phone = '') AS no_phone,
  COUNT(*) FILTER (WHERE address IS NULL OR address = '') AS no_address,
  COUNT(*) FILTER (WHERE city IS NULL OR city = '') AS no_city,
  COUNT(*) total
FROM suppliers;
