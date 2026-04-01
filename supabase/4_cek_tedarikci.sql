-- ============================================================
-- 4. TEDARİKÇİLERİ FATURALARDAN ÇEK
-- Kaynak: invoices tablosu (inbox = bize gelen, karşı taraf tedarikçi)
-- Ön koşul: 5_adres_kolonlari.sql çalışmış, invoices senkronize edilmiş,
--           UBL detayı çekilmiş (detail_fetched_at dolu) olmalı.
-- ============================================================

INSERT INTO suppliers (
  name,
  vkntckn,
  tax_id,
  address,
  city,
  district,
  country,
  postal_code,
  phone,
  email,
  source,
  is_active,
  created_at,
  updated_at
)
SELECT DISTINCT ON (grp_key)
  TRIM(i.cari_name)                                  AS name,
  NULLIF(TRIM(i.vkntckn), '')                        AS vkntckn,
  MAX(i.cari_tax_office) OVER (PARTITION BY grp_key) AS tax_id,
  MAX(i.cari_address)    OVER (PARTITION BY grp_key) AS address,
  MAX(i.cari_city)       OVER (PARTITION BY grp_key) AS city,
  MAX(i.cari_district)   OVER (PARTITION BY grp_key) AS district,
  MAX(i.cari_country)    OVER (PARTITION BY grp_key) AS country,
  MAX(i.cari_postal)     OVER (PARTITION BY grp_key) AS postal_code,
  MAX(i.cari_phone)      OVER (PARTITION BY grp_key) AS phone,
  MAX(i.cari_email)      OVER (PARTITION BY grp_key) AS email,
  'invoice_sync'                                     AS source,
  true                                               AS is_active,
  NOW()                                              AS created_at,
  NOW()                                              AS updated_at
FROM (
  SELECT *,
    COALESCE(NULLIF(TRIM(vkntckn), ''), LOWER(TRIM(cari_name))) AS grp_key
  FROM invoices
  WHERE type = 'inbox'
    AND TRIM(COALESCE(cari_name, '')) <> ''
) i
ORDER BY grp_key, i.issue_date DESC NULLS LAST

ON CONFLICT (vkntckn)
DO UPDATE SET
  name        = EXCLUDED.name,
  tax_id      = COALESCE(EXCLUDED.tax_id,      suppliers.tax_id),
  address     = COALESCE(EXCLUDED.address,     suppliers.address),
  city        = COALESCE(EXCLUDED.city,        suppliers.city),
  district    = COALESCE(EXCLUDED.district,    suppliers.district),
  country     = COALESCE(EXCLUDED.country,     suppliers.country),
  postal_code = COALESCE(EXCLUDED.postal_code, suppliers.postal_code),
  phone       = COALESCE(EXCLUDED.phone,       suppliers.phone),
  email       = COALESCE(EXCLUDED.email,       suppliers.email),
  source      = 'invoice_sync',
  updated_at  = NOW();

-- VKN'siz olanlar
INSERT INTO suppliers (name, vkntckn, tax_id, address, city, district, country, postal_code, phone, email, source, is_active, created_at, updated_at)
SELECT DISTINCT ON (LOWER(TRIM(i.cari_name)))
  TRIM(i.cari_name),
  NULL,
  MAX(i.cari_tax_office) OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_address)    OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_city)       OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_district)   OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_country)    OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_postal)     OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_phone)      OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  MAX(i.cari_email)      OVER (PARTITION BY LOWER(TRIM(i.cari_name))),
  'invoice_sync', true, NOW(), NOW()
FROM invoices i
WHERE i.type = 'inbox'
  AND TRIM(COALESCE(i.vkntckn, '')) = ''
  AND TRIM(COALESCE(i.cari_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s2
    WHERE LOWER(TRIM(s2.name)) = LOWER(TRIM(i.cari_name))
  )
ORDER BY LOWER(TRIM(i.cari_name)), i.issue_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- ── Sonuç raporu ──────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                                   AS toplam_tedarikci,
  COUNT(*) FILTER (WHERE vkntckn IS NOT NULL)                AS vkn_li,
  COUNT(*) FILTER (WHERE vkntckn IS NULL)                    AS vkn_siz,
  COUNT(*) FILTER (WHERE address  IS NOT NULL)               AS adres_var,
  COUNT(*) FILTER (WHERE city     IS NOT NULL)               AS sehir_var,
  COUNT(*) FILTER (WHERE phone    IS NOT NULL)               AS telefon_var,
  COUNT(*) FILTER (WHERE email    IS NOT NULL)               AS email_var
FROM suppliers;
