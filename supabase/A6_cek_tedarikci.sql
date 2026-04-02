-- ═══════════════════════════════════════════════════════════════════
-- ADIM 6: TEDARİKÇİLERİ ÇEK
-- Kaynak: inbox faturalar (bize gelen → karşı taraf tedarikçi)
-- Ön koşul: A3 tamamlandı (gelen faturalar çekildi ve adresler dolu)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO suppliers (
  name, vkntckn, tax_id,
  address, city, district, country, postal_code,
  phone, email,
  source, is_active, created_at, updated_at
)
SELECT
  name, vkntckn, tax_id,
  address, city, district, country, postal_code,
  phone, email,
  source, is_active, NOW(), NOW()
FROM (
  SELECT DISTINCT ON (grp_key)
    TRIM(cari_name)              AS name,
    NULLIF(TRIM(vkntckn), '')    AS vkntckn,
    MAX(cari_tax_office) OVER w  AS tax_id,
    MAX(cari_address)    OVER w  AS address,
    MAX(cari_city)       OVER w  AS city,
    MAX(cari_district)   OVER w  AS district,
    MAX(cari_country)    OVER w  AS country,
    MAX(cari_postal)     OVER w  AS postal_code,
    MAX(cari_phone)      OVER w  AS phone,
    MAX(cari_email)      OVER w  AS email,
    'invoice_sync'               AS source,
    true                         AS is_active,
    COALESCE(NULLIF(TRIM(vkntckn),''), LOWER(TRIM(cari_name))) AS grp_key
  FROM invoices
  WHERE type = 'inbox'
    AND TRIM(COALESCE(cari_name,'')) <> ''
    -- İade faturaları tedarikçi oluşturmaz
    -- API'den İNGİLİZCE gelir: InvoiceTipType = 'Return'
    AND COALESCE(is_iade, false) = false
    AND COALESCE(invoice_type, '') <> 'Return'
    AND COALESCE(status, '')       <> 'Return'
  WINDOW w AS (PARTITION BY COALESCE(NULLIF(TRIM(vkntckn),''), LOWER(TRIM(cari_name))))
  ORDER BY grp_key, issue_date DESC NULLS LAST
) src

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

-- VKN'siz (name bazlı) kayıtlar
INSERT INTO suppliers (name, vkntckn, tax_id, address, city, district, country, postal_code, phone, email, source, is_active, created_at, updated_at)
SELECT DISTINCT ON (LOWER(TRIM(cari_name)))
  TRIM(cari_name), NULL,
  MAX(cari_tax_office) OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_address)    OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_city)       OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_district)   OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_country)    OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_postal)     OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_phone)      OVER (PARTITION BY LOWER(TRIM(cari_name))),
  MAX(cari_email)      OVER (PARTITION BY LOWER(TRIM(cari_name))),
  'invoice_sync', true, NOW(), NOW()
FROM invoices
WHERE type = 'inbox'
  AND TRIM(COALESCE(vkntckn,'')) = ''
  AND TRIM(COALESCE(cari_name,'')) <> ''
  AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(cari_name)))
ORDER BY LOWER(TRIM(cari_name)), issue_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- ── Sonuç ─────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                         AS toplam_tedarikci,
  COUNT(*) FILTER (WHERE vkntckn IS NOT NULL)      AS vkn_li,
  COUNT(*) FILTER (WHERE address  IS NOT NULL)     AS adres_var,
  COUNT(*) FILTER (WHERE city     IS NOT NULL)     AS sehir_var,
  COUNT(*) FILTER (WHERE phone    IS NOT NULL)     AS telefon_var,
  COUNT(*) FILTER (WHERE email    IS NOT NULL)     AS email_var
FROM suppliers;
