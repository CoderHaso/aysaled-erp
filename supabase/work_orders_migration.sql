-- ============================================================
-- İş Emirleri Genişletme Migrasyonu
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- 1. work_orders tablosuna sipariş bağlantısı ve reçete notu ekle
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_note TEXT,
  ADD COLUMN IF NOT EXISTS line_key    TEXT;

-- 2. items tablosuna tags ekle
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. orders tablosuna iş emri gönderildi bayrağı ekle
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS work_orders_sent BOOLEAN DEFAULT FALSE;

-- 4. Stok düşürme RPC fonksiyonu (negatife izin verir)
CREATE OR REPLACE FUNCTION decrement_stock(p_item_id UUID, p_qty NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE items
  SET stock_count = COALESCE(stock_count, 0) - p_qty
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Indexler
CREATE INDEX IF NOT EXISTS idx_work_orders_order_id ON work_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status   ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_items_tags           ON items USING GIN(tags);

-- 6. Kontrol
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('work_orders', 'orders', 'items')
  AND column_name IN ('order_id','recipe_note','line_key','work_orders_sent','tags')
ORDER BY table_name, column_name;
