-- ============================================================
-- FIX: stock_movements tablosundaki "type" NOT NULL hatası
-- Bu SQL'i Supabase SQL Editör'den çalıştırın.
-- ============================================================

-- 1. Eğer 'type' sütunu varsa DEFAULT ekle (sorun çözülür)
ALTER TABLE stock_movements
  ALTER COLUMN "type" SET DEFAULT 'manual';

-- 2. Eğer 'type' sütunu yoksa ekle
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'manual';

-- 3. Mevcut NULL değerleri düzelt
UPDATE stock_movements SET "type" = 'manual' WHERE "type" IS NULL;

-- 4. RPC: increment_stock — type sütununu da set eder
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
  v_new_count NUMERIC;
BEGIN
  UPDATE items
    SET stock_count = COALESCE(stock_count, 0) + p_qty
  WHERE id = p_item_id
  RETURNING stock_count INTO v_new_count;

  INSERT INTO stock_movements(item_id, delta, stock_after, source, source_id, recipe_id, note, "type")
  VALUES(p_item_id, p_qty, v_new_count, p_source, p_source_id, p_recipe_id, p_note,
         CASE p_source
           WHEN 'work_order' THEN 'production'
           WHEN 'invoice'    THEN 'invoice_in'
           WHEN 'sale'       THEN 'sale'
           ELSE 'manual'
         END);

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

-- 5. RPC: decrement_stock — type sütununu da set eder
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
  v_new_count NUMERIC;
BEGIN
  UPDATE items
    SET stock_count = COALESCE(stock_count, 0) - p_qty
  WHERE id = p_item_id
  RETURNING stock_count INTO v_new_count;

  INSERT INTO stock_movements(item_id, delta, stock_after, source, source_id, recipe_id, note, "type")
  VALUES(p_item_id, -p_qty, v_new_count, p_source, p_source_id, p_recipe_id, p_note,
         CASE p_source
           WHEN 'work_order' THEN 'production_raw'
           WHEN 'invoice'    THEN 'invoice_out'
           WHEN 'sale'       THEN 'sale'
           ELSE 'manual'
         END);

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

-- 6. Manual stok hareketi ekle (hızlı düzenleme / toplu güncelleme için)
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

  INSERT INTO stock_movements(item_id, delta, stock_after, source, note, "type")
  VALUES(p_item_id, v_delta, p_new_qty, p_source, p_note, p_source);
END;
$$;

-- 7. stock_movements: created_at index (geçmiş sorgusu için)
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_time
  ON stock_movements(item_id, created_at DESC);
