-- ============================================================
-- 5. ADRESLERİ ZENGİNLEŞTİRMEK İÇİN GEREKLİ KOLON GÜNCELLEMELERI
-- Bu scripti Supabase SQL Editor'de çalıştırın
-- ============================================================

-- customers tablosuna eksik kolonlar ekle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS district          text,
  ADD COLUMN IF NOT EXISTS country           text,
  ADD COLUMN IF NOT EXISTS postal_code       text,
  ADD COLUMN IF NOT EXISTS enrich_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS street            text,
  ADD COLUMN IF NOT EXISTS building_no       text,
  ADD COLUMN IF NOT EXISTS tax_office        text;

-- suppliers tablosuna eksik kolonlar ekle
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS district          text,
  ADD COLUMN IF NOT EXISTS country           text,
  ADD COLUMN IF NOT EXISTS postal_code       text,
  ADD COLUMN IF NOT EXISTS enrich_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS street            text,
  ADD COLUMN IF NOT EXISTS building_no       text;
  -- NOT: suppliers tablosu zaten tax_id kolonu var (tax_office yerine)

-- Yeni adres zenginleştirme için tüm kayıtları sıfırla
-- (Bir sonraki enrich çalıştırmasında hepsini tekrar işlesin)
UPDATE customers SET enrich_attempted_at = NULL;
UPDATE suppliers SET enrich_attempted_at = NULL;

-- Kontrol
SELECT
  (SELECT COUNT(*) FROM customers WHERE enrich_attempted_at IS NULL) AS cari_bekleyen,
  (SELECT COUNT(*) FROM suppliers WHERE enrich_attempted_at IS NULL) AS tedarikci_bekleyen;
