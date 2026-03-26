-- A-ERP Schema Migration v4 — Kategori & Tedarikçi Yönetimi
-- Supabase SQL Editor'da çalıştırın (idempotent)

-- Ürün kategorileri tablosu
CREATE TABLE IF NOT EXISTS item_categories (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name       TEXT NOT NULL,
    item_type  TEXT DEFAULT 'all' CHECK (item_type IN ('all', 'raw', 'product')),
    color      TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, item_type)
);

-- Varsayılan kategoriler
INSERT INTO item_categories (name, item_type) VALUES
  ('Hammadde',        'raw'),
  ('LED & Optik',     'raw'),
  ('Profil & Difüzör','raw'),
  ('Driver & Güç',    'raw'),
  ('Kablo & Bağlantı','raw'),
  ('Ambalaj',         'raw'),
  ('Sarf',            'raw'),
  ('Lineer Armatür',  'product'),
  ('Simit/Davul',     'product'),
  ('Magnet',          'product'),
  ('Panel',           'product'),
  ('Özel Ölçü',       'product'),
  ('Dış Mekan',       'product')
ON CONFLICT (name, item_type) DO NOTHING;

-- contacts tablosuna eksik alanlar (tedarikçi için)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
