-- ============================================================
-- 4. TEDARİKÇİLERİ FATURALARDAN ÇEK (INBOX = gelen faturalar)
-- Tedarikçi = satın alma faturası gönderen taraf = inbox
--
-- Mantık:
--   1. inbox faturalarından benzersiz VKN/isim çek
--   2. suppliers tablosuna INSERT (çakışmada güncelle)
--   3. Adres, vergi dairesi, şehir, ilçe, ülke, telefon, e-posta ekle
-- ============================================================

INSERT INTO suppliers (
  name,
  vkntckn,
  tax_id,
  address,
  city,
  district,
  country,
  phone,
  email,
  source,
  is_active,
  created_at,
  updated_at
)
SELECT DISTINCT ON (
  COALESCE(NULLIF(TRIM(i.vkntckn), ''), TRIM(i.cari_name))
)
  TRIM(i.cari_name)                                                AS name,
  NULLIF(TRIM(i.vkntckn), '')                                     AS vkntckn,
  NULLIF(TRIM(i.tax_office), '')                                   AS tax_id,
  NULLIF(TRIM(COALESCE(i.address, i.cari_address, '')), '')        AS address,
  NULLIF(TRIM(COALESCE(i.city,    i.cari_city,    '')), '')        AS city,
  NULLIF(TRIM(COALESCE(i.district,i.cari_district,'')), '')        AS district,
  NULLIF(TRIM(COALESCE(i.country, i.cari_country, 'Türkiye')), '') AS country,
  NULLIF(TRIM(COALESCE(i.phone,   i.cari_phone,   '')), '')        AS phone,
  NULLIF(TRIM(COALESCE(i.email,   i.cari_email,   '')), '')        AS email,
  'invoice_sync'                                                   AS source,
  true                                                             AS is_active,
  NOW()                                                            AS created_at,
  NOW()                                                            AS updated_at
FROM invoices i
WHERE i.type = 'inbox'
  AND TRIM(COALESCE(i.cari_name, '')) <> ''
ORDER BY
  COALESCE(NULLIF(TRIM(i.vkntckn), ''), TRIM(i.cari_name)),
  i.issue_date DESC  -- En son faturanın bilgilerini tercih et

ON CONFLICT (vkntckn)
DO UPDATE SET
  name       = EXCLUDED.name,
  tax_id     = COALESCE(EXCLUDED.tax_id,   suppliers.tax_id),
  address    = COALESCE(EXCLUDED.address,  suppliers.address),
  city       = COALESCE(EXCLUDED.city,     suppliers.city),
  district   = COALESCE(EXCLUDED.district, suppliers.district),
  country    = COALESCE(EXCLUDED.country,  suppliers.country),
  phone      = COALESCE(EXCLUDED.phone,    suppliers.phone),
  email      = COALESCE(EXCLUDED.email,    suppliers.email),
  source     = 'invoice_sync',
  updated_at = NOW();

-- VKN'siz olanlar için name bazlı upsert
INSERT INTO suppliers (
  name, vkntckn, tax_id, address, city, district, country,
  phone, email, source, is_active, created_at, updated_at
)
SELECT DISTINCT ON (TRIM(i.cari_name))
  TRIM(i.cari_name)                                                AS name,
  NULL                                                             AS vkntckn,
  NULLIF(TRIM(i.tax_office), '')                                   AS tax_id,
  NULLIF(TRIM(COALESCE(i.address, i.cari_address, '')), '')        AS address,
  NULLIF(TRIM(COALESCE(i.city,    i.cari_city,    '')), '')        AS city,
  NULLIF(TRIM(COALESCE(i.district,i.cari_district,'')), '')        AS district,
  NULLIF(TRIM(COALESCE(i.country, i.cari_country, 'Türkiye')), '') AS country,
  NULLIF(TRIM(COALESCE(i.phone,   i.cari_phone,   '')), '')        AS phone,
  NULLIF(TRIM(COALESCE(i.email,   i.cari_email,   '')), '')        AS email,
  'invoice_sync'                                                   AS source,
  true                                                             AS is_active,
  NOW()                                                            AS created_at,
  NOW()                                                            AS updated_at
FROM invoices i
WHERE i.type = 'inbox'
  AND TRIM(COALESCE(i.vkntckn, '')) = ''  -- VKN'siz kayıtlar
  AND TRIM(COALESCE(i.cari_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s2
    WHERE LOWER(TRIM(s2.name)) = LOWER(TRIM(i.cari_name))
  )
ORDER BY TRIM(i.cari_name), i.issue_date DESC

ON CONFLICT DO NOTHING;

-- Sonuç
SELECT
  COUNT(*)                                                        AS toplam_tedarikci,
  COUNT(*) FILTER (WHERE vkntckn IS NOT NULL)                     AS vkn_li,
  COUNT(*) FILTER (WHERE vkntckn IS NULL)                         AS vkn_siz,
  COUNT(*) FILTER (WHERE address IS NOT NULL)                     AS adres_var,
  COUNT(*) FILTER (WHERE city IS NOT NULL)                        AS sehir_var
FROM suppliers;
