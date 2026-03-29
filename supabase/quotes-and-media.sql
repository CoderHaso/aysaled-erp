-- =====================================================================
-- quotes-and-media.sql
-- Teklif formları ve medya kütüphanesi için tablolar
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- Teklifler ana tablosu
CREATE TABLE IF NOT EXISTS quotes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no         TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),

  -- Müşteri bilgileri
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  company_name     TEXT,
  address          TEXT,
  phone            TEXT,
  contact_person   TEXT,
  email            TEXT,

  -- Teklif meta
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE,
  prepared_by      TEXT DEFAULT 'Merkez',
  notes            TEXT,

  -- Finansal
  subtotal         NUMERIC(14,2) DEFAULT 0,
  vat_rate         NUMERIC(5,2),     -- NULL = KDV yok
  vat_amount       NUMERIC(14,2) DEFAULT 0,
  grand_total      NUMERIC(14,2) DEFAULT 0,
  currency         TEXT DEFAULT 'TRY',

  -- Kalem listesi (JSON array)
  line_items       JSONB DEFAULT '[]',

  -- Satışa dönüştürme
  converted_to_sale_id UUID,
  converted_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Medya kütüphanesi (Backblaze B2)
CREATE TABLE IF NOT EXISTS media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  file_key    TEXT NOT NULL UNIQUE,  -- B2'deki key (path)
  file_url    TEXT,                  -- Public URL (varsa)
  size_bytes  INTEGER,
  mime_type   TEXT,
  tags        TEXT[] DEFAULT '{}',
  linked_item_id UUID,              -- items tablosuna referans (opsiyonel)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Stok ürünlerine görsel alanı ekle
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_key  TEXT;   -- B2 file key
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url  TEXT;   -- Public/signed URL

-- Index
CREATE INDEX IF NOT EXISTS idx_quotes_status     ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_issue_date ON quotes(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_media_item        ON media(linked_item_id);

-- Auto quote number sequence
CREATE SEQUENCE IF NOT EXISTS quote_seq START 1;

SELECT 'OK: quotes and media tables created.' AS status;
