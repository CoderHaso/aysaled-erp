-- ============================================================
-- 5. ADRES KOLONLARI — invoices, customers, suppliers
-- Bu scripti 6_temizle_invoices.sql'DEN ÖNCE çalıştırın
-- ============================================================

-- invoices tablosuna adres kolonları ekle
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS document_id        text,
  ADD COLUMN IF NOT EXISTS invoice_type       text,
  ADD COLUMN IF NOT EXISTS invoice_tip_type   text,
  ADD COLUMN IF NOT EXISTS envelope_status    text,
  ADD COLUMN IF NOT EXISTS create_date_utc    timestamptz,
  ADD COLUMN IF NOT EXISTS tax_exclusive_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate      numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vat1               numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat8               numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat10              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat18              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat20              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat1_taxable       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat8_taxable       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat10_taxable      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat18_taxable      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat20_taxable      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_archived        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_seen            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS envelope_identifier text,
  ADD COLUMN IF NOT EXISTS order_document_id  text,
  ADD COLUMN IF NOT EXISTS message            text,
  ADD COLUMN IF NOT EXISTS raw_detail         jsonb,
  -- Adres/iletişim kolonları (UBL XML'den parse edilir)
  ADD COLUMN IF NOT EXISTS cari_tax_office    text,
  ADD COLUMN IF NOT EXISTS cari_address       text,
  ADD COLUMN IF NOT EXISTS cari_city          text,
  ADD COLUMN IF NOT EXISTS cari_district      text,
  ADD COLUMN IF NOT EXISTS cari_country       text,
  ADD COLUMN IF NOT EXISTS cari_postal        text,
  ADD COLUMN IF NOT EXISTS cari_phone         text,
  ADD COLUMN IF NOT EXISTS cari_email         text,
  ADD COLUMN IF NOT EXISTS detail_fetched_at  timestamptz;

-- customers tablosuna eksik kolonlar ekle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS district               text,
  ADD COLUMN IF NOT EXISTS country                text,
  ADD COLUMN IF NOT EXISTS postal_code            text,
  ADD COLUMN IF NOT EXISTS enrich_attempted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS tax_office             text;

-- suppliers tablosuna eksik kolonlar ekle
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS district               text,
  ADD COLUMN IF NOT EXISTS country                text,
  ADD COLUMN IF NOT EXISTS postal_code            text,
  ADD COLUMN IF NOT EXISTS enrich_attempted_at    timestamptz;
  -- NOT: suppliers tablosu zaten tax_id kolonu var

-- Kontrol
SELECT
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('cari_address','cari_city','cari_phone','cari_email','detail_fetched_at')
ORDER BY column_name;
