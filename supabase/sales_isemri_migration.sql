-- ============================================================
-- Sales/IsEmri/Stock İçin Ek Kolon Migrasyonları
-- Supabase SQL Editör'den çalıştırın
-- ============================================================

-- 1. orders tablosuna faturalı flag ve iade durumu
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_invoiced BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- status kolonu zaten text ise 'refunded' değerini alabilir

-- 2. work_orders tablosuna üretim notu + reçete değişiklik notu
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS production_note TEXT,
  ADD COLUMN IF NOT EXISTS recipe_change_note TEXT,
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES product_recipes(id) ON DELETE SET NULL;

-- 3. recipe_id index
CREATE INDEX IF NOT EXISTS idx_work_orders_recipe ON work_orders(recipe_id);

-- 4. İade stok geri yükleme RPC
CREATE OR REPLACE FUNCTION refund_order_stock(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oi.item_id, oi.quantity, oi.recipe_id
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.item_id IS NOT NULL
  LOOP
    PERFORM increment_stock(
      r.item_id,
      r.quantity,
      'refund',
      p_order_id,
      r.recipe_id,
      'Sipariş iadesi — stok geri yüklendi'
    );
  END LOOP;

  UPDATE orders
    SET status = 'refunded', refunded_at = now()
  WHERE id = p_order_id;
END;
$$;
