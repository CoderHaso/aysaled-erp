-- ============================================================
-- Stok & Recete Sistemi Migrasyonu v2
-- item_categories tablosu zaten varsa eksik kolonlari ekle
-- Supabase SQL Editor'e yapistir ve calistir
-- ============================================================

-- 1a. Eger item_categories tablosu yoksa olustur
CREATE TABLE IF NOT EXISTS item_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1b. Eksik kolonlari ALTER TABLE ile ekle (IF NOT EXISTS = hata vermez)
ALTER TABLE item_categories
  ADD COLUMN IF NOT EXISTS item_scope text NOT NULL DEFAULT 'rawmaterial',
  ADD COLUMN IF NOT EXISTS fields     jsonb NOT NULL DEFAULT '[]';

-- 1c. CHECK constraint item_scope icin (idempotent degil, once drop et)
ALTER TABLE item_categories DROP CONSTRAINT IF EXISTS item_categories_item_scope_check;
ALTER TABLE item_categories ADD CONSTRAINT item_categories_item_scope_check
  CHECK (item_scope IN ('rawmaterial', 'product'));

-- 2. items tablosuna eksik kolonlari ekle
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS category_id     uuid REFERENCES item_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS technical_specs jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supplier_id     uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- 3. Urun recete ana tablosu
CREATE TABLE IF NOT EXISTS product_recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  tags        text[] DEFAULT '{}',
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4. Recete kalemleri
CREATE TABLE IF NOT EXISTS recipe_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid NOT NULL REFERENCES product_recipes(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES items(id) ON DELETE SET NULL,
  item_name   text NOT NULL DEFAULT '',
  quantity    numeric NOT NULL DEFAULT 1,
  unit        text NOT NULL DEFAULT 'Adet',
  notes       text,
  order_index integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- 5. RLS politikalari
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_item_categories" ON item_categories;
DROP POLICY IF EXISTS "allow_all_product_recipes"  ON product_recipes;
DROP POLICY IF EXISTS "allow_all_recipe_items"     ON recipe_items;

CREATE POLICY "allow_all_item_categories" ON item_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_product_recipes"  ON product_recipes  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_recipe_items"     ON recipe_items     FOR ALL USING (true) WITH CHECK (true);

-- 6. Ornek kategoriler (ON CONFLICT DO NOTHING = tekrar calistirilabilir)
INSERT INTO item_categories (name, item_scope, fields) VALUES
  ('LED', 'rawmaterial', '[
    {"name":"Guc","type":"select","options":["3W","5W","7W","10W","14W","18W","20W","24W","30W","36W","40W","50W"]},
    {"name":"Renk Sicakligi","type":"select","options":["2700K","3000K","3500K","4000K","5000K","6500K"]},
    {"name":"Voltaj","type":"select","options":["12V","24V","220V"]},
    {"name":"IP Derecesi","type":"select","options":["IP20","IP44","IP54","IP65","IP67","IP68"]}
  ]'),
  ('Profil', 'rawmaterial', '[
    {"name":"Genislik","type":"text"},
    {"name":"Yuzey","type":"select","options":["Anodize","Ham","Beyaz Boyali","Siyah Boyali"]},
    {"name":"Et Kalinligi","type":"text"}
  ]'),
  ('Driver', 'rawmaterial', '[
    {"name":"Akim","type":"text"},
    {"name":"Voltaj","type":"text"},
    {"name":"Guc","type":"text"},
    {"name":"Marka","type":"text"}
  ]'),
  ('Kablo', 'rawmaterial', '[
    {"name":"Kesit","type":"text"},
    {"name":"Renk","type":"select","options":["Beyaz","Siyah","Gri","Kirmizi-Siyah"]}
  ]'),
  ('Genel Hammadde', 'rawmaterial', '[
    {"name":"Aciklama","type":"text"}
  ]'),
  ('Lineer Aydinlatma', 'product', '[
    {"name":"Uzunluk (cm)","type":"text"},
    {"name":"Renk Sicakligi","type":"select","options":["2700K","3000K","3500K","4000K","5000K","6500K"]},
    {"name":"Montaj Tipi","type":"select","options":["Tavan","Aski","Siva Alti","Siva Ustu"]}
  ]'),
  ('Downlight', 'product', '[
    {"name":"Cap (mm)","type":"text"},
    {"name":"Guc (W)","type":"text"},
    {"name":"Renk Sicakligi","type":"select","options":["2700K","3000K","4000K","6500K"]}
  ]'),
  ('Genel Urun', 'product', '[]')
ON CONFLICT DO NOTHING;

-- Tamamlandi
SELECT 'Migration v2 tamamlandi! Tablolar hazir.' as durum;
