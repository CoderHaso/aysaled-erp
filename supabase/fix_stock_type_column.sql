-- ============================================================
-- MASTER FIX: stock_movements kolon standardizasyonu
-- Tüm olası kolon isim çakışmalarını düzeltir.
-- Supabase SQL Editör'den çalıştırın.
-- ============================================================

-- 1. Mevcut kolonları kontrol et ve standartlaştır:
--    stock_after → quantity_after olarak RENAME
--    Eğer quantity_after yoksa ve stock_after varsa, rename et
--    Eğer ikisi de yoksa, ekle
DO $$
BEGIN
  -- stock_after varsa quantity_after olarak rename et
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='stock_after')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='quantity_after')
  THEN
    ALTER TABLE stock_movements RENAME COLUMN stock_after TO quantity_after;
    RAISE NOTICE 'RENAMED: stock_after → quantity_after';
  END IF;

  -- İkisi de varsa stock_after'ı düşür (quantity_after yeterli)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='stock_after')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='quantity_after')
  THEN
    -- Verileri taşı
    UPDATE stock_movements SET quantity_after = stock_after WHERE quantity_after IS NULL AND stock_after IS NOT NULL;
    ALTER TABLE stock_movements DROP COLUMN stock_after;
    RAISE NOTICE 'DROPPED: stock_after (data merged into quantity_after)';
  END IF;
END $$;

-- 2. quantity_after kolonu garanti et (yoksa ekle)
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS quantity_after NUMERIC(12,4);

-- 3. quantity_before kolonu garanti et (yoksa ekle)
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS quantity_before NUMERIC(12,4);

-- 4. NULL'ları düzelt (eski kayıtlar için)
UPDATE stock_movements SET quantity_after = 0 WHERE quantity_after IS NULL;
UPDATE stock_movements SET quantity_before = 0 WHERE quantity_before IS NULL;

-- 5. Artık DEFAULT set et (yeni kayıtlar NULL olmaz)
ALTER TABLE stock_movements ALTER COLUMN quantity_after SET DEFAULT 0;
ALTER TABLE stock_movements ALTER COLUMN quantity_before SET DEFAULT 0;

-- 6. type kolonu garanti
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE stock_movements ALTER COLUMN "type" SET DEFAULT 'manual';
UPDATE stock_movements SET "type" = 'manual' WHERE "type" IS NULL;

-- 7. recipe_id kolonu garanti
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS recipe_id UUID;

-- 8. source, source_id garanti
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT;

-- 9. orders tablosu ek kolonlar
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_invoiced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- 10. work_orders tablosu ek kolonlar
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS production_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS recipe_change_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS recipe_id UUID;

-- ============================================================
-- RPC FUNCTIONS — quantity_after kullanır
-- ============================================================

-- 11. increment_stock
CREATE OR REPLACE FUNCTION increment_stock(
  p_item_id   UUID,
  p_qty       NUMERIC,
  p_source    TEXT DEFAULT 'manual',
  p_source_id UUID DEFAULT NULL,
  p_recipe_id UUID DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_before    NUMERIC;
  v_new_count NUMERIC;
BEGIN
  SELECT COALESCE(stock_count, 0) INTO v_before FROM items WHERE id = p_item_id;
  IF v_before IS NULL THEN v_before := 0; END IF;

  UPDATE items SET stock_count = v_before + p_qty WHERE id = p_item_id
  RETURNING stock_count INTO v_new_count;

  IF v_new_count IS NULL THEN v_new_count := v_before + p_qty; END IF;

  INSERT INTO stock_movements(
    item_id, delta, quantity_before, quantity_after,
    source, source_id, recipe_id, note, "type"
  ) VALUES (
    p_item_id, p_qty, v_before, v_new_count,
    p_source, p_source_id, p_recipe_id, p_note,
    CASE p_source
      WHEN 'work_order' THEN 'production'
      WHEN 'invoice'    THEN 'invoice_in'
      WHEN 'sale'       THEN 'sale'
      WHEN 'refund'     THEN 'manual'
      ELSE 'manual'
    END
  );

  IF p_recipe_id IS NOT NULL THEN
    INSERT INTO product_recipe_stock(product_id, recipe_id, stock_count)
    VALUES(p_item_id, p_recipe_id, p_qty)
    ON CONFLICT(product_id, recipe_id)
    DO UPDATE SET stock_count = product_recipe_stock.stock_count + p_qty, updated_at = now();
  END IF;

  RETURN v_new_count;
END;
$$;

-- 12. decrement_stock
CREATE OR REPLACE FUNCTION decrement_stock(
  p_item_id   UUID,
  p_qty       NUMERIC,
  p_source    TEXT DEFAULT 'manual',
  p_source_id UUID DEFAULT NULL,
  p_recipe_id UUID DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_before    NUMERIC;
  v_new_count NUMERIC;
BEGIN
  SELECT COALESCE(stock_count, 0) INTO v_before FROM items WHERE id = p_item_id;
  IF v_before IS NULL THEN v_before := 0; END IF;

  UPDATE items SET stock_count = GREATEST(0, v_before - p_qty) WHERE id = p_item_id
  RETURNING stock_count INTO v_new_count;

  IF v_new_count IS NULL THEN v_new_count := GREATEST(0, v_before - p_qty); END IF;

  INSERT INTO stock_movements(
    item_id, delta, quantity_before, quantity_after,
    source, source_id, recipe_id, note, "type"
  ) VALUES (
    p_item_id, -p_qty, v_before, v_new_count,
    p_source, p_source_id, p_recipe_id, p_note,
    CASE p_source
      WHEN 'work_order' THEN 'production_raw'
      WHEN 'invoice'    THEN 'invoice_out'
      WHEN 'sale'       THEN 'sale'
      ELSE 'manual'
    END
  );

  IF p_recipe_id IS NOT NULL THEN
    UPDATE product_recipe_stock
    SET stock_count = GREATEST(0, stock_count - p_qty), updated_at = now()
    WHERE product_id = p_item_id AND recipe_id = p_recipe_id;
  END IF;

  RETURN v_new_count;
END;
$$;

-- 13. log_stock_change
CREATE OR REPLACE FUNCTION log_stock_change(
  p_item_id   UUID,
  p_old_qty   NUMERIC,
  p_new_qty   NUMERIC,
  p_source    TEXT DEFAULT 'manual',
  p_note      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_delta NUMERIC;
BEGIN
  v_delta := p_new_qty - p_old_qty;
  IF v_delta = 0 THEN RETURN; END IF;

  INSERT INTO stock_movements(
    item_id, delta, quantity_before, quantity_after, source, note, "type"
  ) VALUES (
    p_item_id, v_delta, p_old_qty, p_new_qty, p_source, p_note, p_source
  );
END;
$$;

-- 14. refund_order_stock
CREATE OR REPLACE FUNCTION refund_order_stock(p_order_id UUID)
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
    PERFORM increment_stock(r.item_id, r.quantity, 'refund', p_order_id, r.recipe_id, 'Sipariş iadesi — stok geri yüklendi');
  END LOOP;
  UPDATE orders SET status = 'refunded', refunded_at = now() WHERE id = p_order_id;
END;
$$;

-- 15. İndexler
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_time ON stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_recipe ON work_orders(recipe_id);
