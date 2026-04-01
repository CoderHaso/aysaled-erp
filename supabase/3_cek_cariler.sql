-- ============================================================
-- 3. CARİLERİ FATURALARDAN ÇEK (OUTBOX = gönderilen faturalar)
-- invoices tablosunun gerçek kolonlarını kullanır:
--   cari_name, vkntckn (liste alanları)
--   raw_data JSONB (liste ham verisi - varsa ek alanlar)
-- ============================================================

INSERT INTO customers (
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
  TRIM(i.cari_name)        AS name,
  NULLIF(TRIM(i.vkntckn), '') AS vkntckn,
  'invoice_sync'           AS source,
  true                     AS is_active,
  NOW()                    AS created_at,
  NOW()                    AS updated_at
FROM invoices i
WHERE i.type = 'outbox'
  AND TRIM(COALESCE(i.cari_name, '')) <> ''
ORDER BY
  COALESCE(NULLIF(TRIM(i.vkntckn), ''), LOWER(TRIM(i.cari_name))),
  i.issue_date DESC NULLS LAST

ON CONFLICT (vkntckn)
DO UPDATE SET
  name       = EXCLUDED.name,
  source     = 'invoice_sync',
  updated_at = NOW()
WHERE customers.name IS DISTINCT FROM EXCLUDED.name
   OR customers.source IS DISTINCT FROM 'invoice_sync';

-- VKN'siz olanlar için name bazlı insert (var olanı atla)
INSERT INTO customers (name, vkntckn, source, is_active, created_at, updated_at)
SELECT DISTINCT ON (LOWER(TRIM(i.cari_name)))
  TRIM(i.cari_name) AS name,
  NULL              AS vkntckn,
  'invoice_sync'    AS source,
  true              AS is_active,
  NOW()             AS created_at,
  NOW()             AS updated_at
FROM invoices i
WHERE i.type = 'outbox'
  AND TRIM(COALESCE(i.vkntckn, '')) = ''
  AND TRIM(COALESCE(i.cari_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM customers c2
    WHERE LOWER(TRIM(c2.name)) = LOWER(TRIM(i.cari_name))
  )
ORDER BY LOWER(TRIM(i.cari_name)), i.issue_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- Sonuç
SELECT
  COUNT(*)                                         AS toplam_cari,
  COUNT(*) FILTER (WHERE vkntckn IS NOT NULL)      AS vkn_li,
  COUNT(*) FILTER (WHERE vkntckn IS NULL)          AS vkn_siz
FROM customers;

-- NOT: Adres/telefon/e-posta bilgileri raw_detail (UBL XML) içinde.
-- Çekildikten sonra Uyumsoft fatura senkronizasyonunu çalıştırırsanız
-- enrich-contacts API'si bu bilgileri otomatik dolduracak.
-- Ya da raw_data içindeki mevcut veriyi görmek için:
-- SELECT vkntckn, cari_name, raw_data->>'TargetAddress' as adres FROM invoices WHERE type='outbox' LIMIT 5;
