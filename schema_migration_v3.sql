-- ============================================================
-- A-ERP Schema Migration v3 — Üretim & Stok Merkezi
-- Supabase SQL Editor'da çalıştırın (idempotent)
-- ============================================================

-- Ürün tipi ayrımı (hammadde / mamül)
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'raw'
  CHECK (item_type IN ('raw', 'product'));

-- Teknik özellikler (JSONB — lümen, kelvin, watt, IP, ölçü, seri, renk, voltaj)
ALTER TABLE items ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}';

-- Tedarik / depo bilgileri
ALTER TABLE items ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_date DATE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS location TEXT;       -- Raf / depo yeri

-- Kâr marjı önerisi (ürün kartında hesaplanır)
ALTER TABLE items ADD COLUMN IF NOT EXISTS margin_rate NUMERIC DEFAULT 30;

-- bom_recipes tablosuna notlar alanı (zaten var ama emin olmak için)
ALTER TABLE bom_recipes ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index: item_type üzerinden hızlı filtre
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_bom_recipes_parent ON bom_recipes(parent_id);

-- Birkaç örnek hammadde verisi (isteğe bağlı — test için)
-- INSERT INTO items (name, sku, item_type, unit, base_currency, purchase_price, stock_count, critical_limit, category, supplier_name)
-- VALUES
--   ('LED Chip 24V 4000K', 'AYS-24V-LED-4K', 'raw', 'm', 'USD', 8.50, 450, 50, 'Hammadde', 'Ledim'),
--   ('Alüminyum Profil 5x3', 'PROF-2201-5X3', 'raw', 'm', 'TRY', 45.00, 120, 20, 'Hammadde', 'Aluplast'),
--   ('Driver 36W 24V', 'AYS-DRV-36W', 'raw', 'adet', 'USD', 12.00, 45, 10, 'Hammadde', 'Meanwell')
-- ON CONFLICT (sku) DO NOTHING;
