-- ============================================================
-- Stok & Recete Sistemi Migrasyonu
-- Calistirma: Supabase SQL Editor'e yapistir ve calistir
-- ============================================================

-- 1. Kategori tablosu (hammadde ve urun kategorileri)
CREATE TABLE IF NOT EXISTS item_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  item_scope  text NOT NULL CHECK (item_scope IN ('rawmaterial', 'product')),
  -- fields: [{ name: 'Guc', type: 'select'|'text'|'number', options: ['3W','5W'] }]
  fields      jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 2. items tablosuna eksik kolonlari ekle
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS category_id    uuid REFERENCES item_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS technical_specs jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supplier_id    uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- 3. Urun recete ana tablosu (bir urune ait birden fazla recete)
CREATE TABLE IF NOT EXISTS product_recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  tags        text[] DEFAULT '{}',   -- ['3000K', 'Tavan Montaj'] gibi etiketler
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4. Recete kalemleri
CREATE TABLE IF NOT EXISTS recipe_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id          uuid NOT NULL REFERENCES product_recipes(id) ON DELETE CASCADE,
  item_id            uuid REFERENCES items(id) ON DELETE SET NULL,
  item_name          text NOT NULL,     -- denormalized (item silinse diye)
  quantity           numeric NOT NULL DEFAULT 1,
  unit               text NOT NULL DEFAULT 'Adet',
  notes              text,
  order_index        integer DEFAULT 0,
  created_at         timestamptz DEFAULT now()
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

-- 6. Ornek kategoriler
INSERT INTO item_categories (name, item_scope, fields) VALUES
  ('LED', 'rawmaterial', '[
    {"name":"Güç","type":"select","options":["3W","5W","7W","10W","14W","18W","20W","24W","30W","36W","40W","50W"]},
    {"name":"Renk Sıcaklığı","type":"select","options":["2700K","3000K","3500K","4000K","5000K","6500K"]},
    {"name":"Voltaj","type":"select","options":["12V","24V","220V"]},
    {"name":"IP Derecesi","type":"select","options":["IP20","IP44","IP54","IP65","IP67","IP68"]}
  ]'),
  ('Profil', 'rawmaterial', '[
    {"name":"Genişlik","type":"text"},
    {"name":"Yüzey","type":"select","options":["Anodize","Ham","Beyaz Boyalı","Siyah Boyalı"]},
    {"name":"Et Kalınlığı","type":"text"}
  ]'),
  ('Driver', 'rawmaterial', '[
    {"name":"Akım","type":"text"},
    {"name":"Voltaj","type":"text"},
    {"name":"Güç","type":"text"},
    {"name":"Marka","type":"text"}
  ]'),
  ('Kablo', 'rawmaterial', '[
    {"name":"Kesit","type":"text"},
    {"name":"Renk","type":"select","options":["Beyaz","Siyah","Gri","Kırmızı-Siyah"]}
  ]'),
  ('Genel Hammadde', 'rawmaterial', '[
    {"name":"Açıklama","type":"text"}
  ]'),
  ('Lineer Aydınlatma', 'product', '[
    {"name":"Uzunluk (cm)","type":"text"},
    {"name":"Renk Sıcaklığı","type":"select","options":["2700K","3000K","3500K","4000K","5000K","6500K"]},
    {"name":"Montaj Tipi","type":"select","options":["Tavan","Askı","Sıva Altı","Sıva Üstü"]}
  ]'),
  ('Downlight', 'product', '[
    {"name":"Çap (mm)","type":"text"},
    {"name":"Güç (W)","type":"text"},
    {"name":"Renk Sıcaklığı","type":"select","options":["2700K","3000K","4000K","6500K"]}
  ]'),
  ('Genel Ürün', 'product', '[]')
ON CONFLICT DO NOTHING;

-- Tamamlandi
SELECT 'Migration tamamlandi!' as durum;
