-- A-ERP Schema Migration v5 — Eksik Sütunlar
-- Supabase SQL Editor'da çalıştırın

-- 1. items tablosuna eksik olan alanları ekliyoruz
ALTER TABLE items ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'raw';
ALTER TABLE items ADD COLUMN IF NOT EXISTS margin_rate NUMERIC DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb;

-- 2. Mevcut kayıtları eski ismine göre item_type ile işaretleyelim (Kategori 'Lineer Armatür' vs ise product yap)
UPDATE items 
SET item_type = 'product' 
WHERE category IN ('Lineer Armatür', 'Simit/Davul', 'Magnet', 'Panel', 'Özel Ölçü', 'Dış Mekan');

UPDATE items 
SET item_type = 'raw' 
WHERE item_type IS NULL;

-- 3. item_units Tablosu (Birimleri yönetmek için)
CREATE TABLE IF NOT EXISTS item_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE item_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can do everything on item_units" ON item_units;
CREATE POLICY "Public can do everything on item_units" ON item_units
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO item_units (name) VALUES 
('pcs'), ('adet'), ('kg'), ('m'), ('lt'), ('m²'), ('m³'), ('kutu'), ('rulo')
ON CONFLICT (name) DO NOTHING;

