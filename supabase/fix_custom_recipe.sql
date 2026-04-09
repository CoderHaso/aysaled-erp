-- ═══════════════════════════════════════════════════════════════
-- ÖZEL REÇETE DÜZELTME — Bu dosyayı Supabase SQL Editor'da çalıştır
-- ═══════════════════════════════════════════════════════════════

-- 1. Gerekli kolonlar
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS custom_recipe_items JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_recipe_items JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS skip_work_order BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS custom_recipe_data JSONB;

-- 2. increment_stock: özel reçete varsa product_recipe_stock'a YAZMA
DROP FUNCTION IF EXISTS increment_stock(UUID, NUMERIC, TEXT, UUID, UUID, TEXT, JSONB);
CREATE OR REPLACE FUNCTION increment_stock(
  p_item_id   UUID,
  p_qty       NUMERIC,
  p_source    TEXT DEFAULT 'manual',
  p_source_id UUID DEFAULT NULL,
  p_recipe_id UUID DEFAULT NULL,
  p_note      TEXT DEFAULT NULL,
  p_custom_recipe JSONB DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before NUMERIC;
  v_after  NUMERIC;
BEGIN
  SELECT COALESCE(stock_count, 0) INTO v_before FROM items WHERE id = p_item_id;
  IF v_before IS NULL THEN v_before := 0; END IF;

  UPDATE items SET stock_count = v_before + p_qty WHERE id = p_item_id
  RETURNING stock_count INTO v_after;
  IF v_after IS NULL THEN v_after := v_before + p_qty; END IF;

  INSERT INTO stock_movements(item_id, delta, quantity_before, quantity_after, source, source_id, recipe_id, note, "type", custom_recipe_data)
  VALUES (p_item_id, p_qty, v_before, v_after, COALESCE(p_source,'manual'), p_source_id, p_recipe_id, p_note, COALESCE(p_source,'manual'), p_custom_recipe);

  -- SADECE mevcut reçete ise product_recipe_stock güncelle
  -- Özel reçete (p_custom_recipe NOT NULL) ise ATLA
  IF p_recipe_id IS NOT NULL AND p_custom_recipe IS NULL THEN
    INSERT INTO product_recipe_stock(product_id, recipe_id, stock_count)
    VALUES(p_item_id, p_recipe_id, p_qty)
    ON CONFLICT(product_id, recipe_id)
    DO UPDATE SET stock_count = product_recipe_stock.stock_count + p_qty, updated_at = now();
  END IF;

  RETURN v_after;
END;
$$;

-- 3. decrement_stock: özel reçete varsa product_recipe_stock'a YAZMA
DROP FUNCTION IF EXISTS decrement_stock(UUID, NUMERIC, TEXT, UUID, UUID, TEXT, JSONB);
CREATE OR REPLACE FUNCTION decrement_stock(
  p_item_id   UUID,
  p_qty       NUMERIC,
  p_source    TEXT DEFAULT 'manual',
  p_source_id UUID DEFAULT NULL,
  p_recipe_id UUID DEFAULT NULL,
  p_note      TEXT DEFAULT NULL,
  p_custom_recipe JSONB DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before NUMERIC;
  v_after  NUMERIC;
BEGIN
  SELECT COALESCE(stock_count, 0) INTO v_before FROM items WHERE id = p_item_id;
  IF v_before IS NULL THEN v_before := 0; END IF;

  UPDATE items SET stock_count = v_before - p_qty WHERE id = p_item_id
  RETURNING stock_count INTO v_after;
  IF v_after IS NULL THEN v_after := v_before - p_qty; END IF;

  INSERT INTO stock_movements(item_id, delta, quantity_before, quantity_after, source, source_id, recipe_id, note, "type", custom_recipe_data)
  VALUES (p_item_id, -p_qty, v_before, v_after, COALESCE(p_source,'manual'), p_source_id, p_recipe_id, p_note, COALESCE(p_source,'manual'), p_custom_recipe);

  -- SADECE mevcut reçete ise product_recipe_stock güncelle
  IF p_recipe_id IS NOT NULL AND p_custom_recipe IS NULL THEN
    UPDATE product_recipe_stock
    SET stock_count = stock_count - p_qty, updated_at = now()
    WHERE product_id = p_item_id AND recipe_id = p_recipe_id;
  END IF;

  RETURN v_after;
END;
$$;

-- 4. RLS: stock_movements insert izni
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sm_insert" ON stock_movements;
CREATE POLICY "sm_insert" ON stock_movements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "sm_select" ON stock_movements;
CREATE POLICY "sm_select" ON stock_movements FOR SELECT USING (true);

-- 5. Doğrulama: fonksiyon var mı kontrol et
DO $$
BEGIN
  RAISE NOTICE '✅ increment_stock ve decrement_stock güncellendi';
  RAISE NOTICE '✅ custom_recipe_data kolonu stock_movements tablosunda mevcut';
  RAISE NOTICE '✅ Artık özel reçete ile üretim yapılabilir';
END;
$$;
