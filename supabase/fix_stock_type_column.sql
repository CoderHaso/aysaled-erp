-- ============================================================
-- FIX v2: quantity_before hatası + is_invoiced + refund RPC
-- Supabase SQL Editör'den çalıştırın
-- ============================================================

-- 1. stock_movements: quantity_before sütunu ekle (yoksa)
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS quantity_before NUMERIC NOT NULL DEFAULT 0;

-- 2. orders tablosuna is_invoiced + refunded_at (yoksa)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_invoiced BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- 3. work_orders: production_note + recipe_change_note + recipe_id
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS production_note TEXT,
  ADD COLUMN IF NOT EXISTS recipe_change_note TEXT,
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES product_recipes(id) ON DELETE SET NULL;

-- 4. RPC: increment_stock — quantity_before dahil
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
  -- Mevcut stoğu al
  SELECT COALESCE(stock_count, 0) INTO v_before FROM items WHERE id = p_item_id;

  UPDATE items
    SET stock_count = v_before + p_qty
  WHERE id = p_item_id
  RETURNING stock_count INTO v_new_count;

  INSERT INTO stock_movements(
    item_id, delta, quantity_before, stock_after,
    source, source_id, recipe_id, note, "type"
  )
  VALUES(
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
    DO UPDATE SET
      stock_count = product_recipe_stock.stock_count + p_qty,
      updated_at  = now();
  END IF;

  RETURN v_new_count;
END;
$$;

-- 5. RPC: decrement_stock — quantity_before dahil
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

  UPDATE items
    SET stock_count = GREATEST(0, v_before - p_qty)
  WHERE id = p_item_id
  RETURNING stock_count INTO v_new_count;

  INSERT INTO stock_movements(
    item_id, delta, quantity_before, stock_after,
    source, source_id, recipe_id, note, "type"
  )
  VALUES(
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
    SET
      stock_count = GREATEST(0, stock_count - p_qty),
      updated_at  = now()
    WHERE product_id = p_item_id AND recipe_id = p_recipe_id;
  END IF;

  RETURN v_new_count;
END;
$$;

-- 6. RPC: log_stock_change — quantity_before dahil
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
    item_id, delta, quantity_before, stock_after, source, note, "type"
  )
  VALUES(
    p_item_id, v_delta, p_old_qty, p_new_qty,
    p_source, p_note, p_source
  );
END;
$$;

-- 7. RPC: refund_order_stock
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

-- 8. type sütununa DEFAULT ekle (var olan kayıtlar için güvenlik)
ALTER TABLE stock_movements
  ALTER COLUMN "type" SET DEFAULT 'manual';

UPDATE stock_movements SET "type" = 'manual' WHERE "type" IS NULL;

-- 9. İndexler
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_time
  ON stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_recipe
  ON work_orders(recipe_id);
