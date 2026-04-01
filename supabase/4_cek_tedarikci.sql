-- ============================================================
-- 4. TEDARİKÇİLERİ FATURALARDAN ÇEK (INBOX = gelen faturalar)
-- invoices tablosunun gerçek kolonlarını kullanır:
--   cari_name, vkntckn (liste alanları)
-- ============================================================

INSERT INTO suppliers (
  name,
  vkntckn,
  source,
  is_active,
  created_at,
  updated_at
)
SELECT DISTINCT ON (
  COALESCE(NULLIF(TRIM(i.vkntckn), ''), LOWER(TRIM(i.cari_name)))
)
  TRIM(i.cari_name)           AS name,
  NULLIF(TRIM(i.vkntckn), '')  AS vkntckn,
  'invoice_sync'              AS source,
  true                        AS is_active,
  NOW()                       AS created_at,
  NOW()                       AS updated_at
FROM invoices i
WHERE i.type = 'inbox'
  AND TRIM(COALESCE(i.cari_name, '')) <> ''
ORDER BY
  COALESCE(NULLIF(TRIM(i.vkntckn), ''), LOWER(TRIM(i.cari_name))),
  i.issue_date DESC NULLS LAST

ON CONFLICT (vkntckn)
DO UPDATE SET
  name       = EXCLUDED.name,
  source     = 'invoice_sync',
  updated_at = NOW()
WHERE suppliers.name IS DISTINCT FROM EXCLUDED.name
   OR suppliers.source IS DISTINCT FROM 'invoice_sync';

-- VKN'siz olanlar için name bazlı insert (var olanı atla)
INSERT INTO suppliers (name, vkntckn, source, is_active, created_at, updated_at)
SELECT DISTINCT ON (LOWER(TRIM(i.cari_name)))
  TRIM(i.cari_name) AS name,
  NULL              AS vkntckn,
  'invoice_sync'    AS source,
  true              AS is_active,
  NOW()             AS created_at,
  NOW()             AS updated_at
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

-- Sonuç
SELECT
  COUNT(*)                                        AS toplam_tedarikci,
  COUNT(*) FILTER (WHERE vkntckn IS NOT NULL)     AS vkn_li,
  COUNT(*) FILTER (WHERE vkntckn IS NULL)         AS vkn_siz
FROM suppliers;

-- NOT: Adres/telefon/e-posta raw_detail (UBL XML) içinde.
-- Tedarikçiler çekildikten sonra enrich-contacts API çalıştırınca
-- 3 katmanlı strateji (UBL XML → SOAP → GİB OnlyDb) devreye girer.
-- Raw data'ya bakmak için:
-- SELECT vkntckn, cari_name, raw_data FROM invoices WHERE type='inbox' LIMIT 3;
