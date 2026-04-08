-- ============================================================
-- MASTER FIX v4: stock_movements + product_recipe_stock
-- Supabase SQL Editör'den çalıştırın
-- ============================================================

-- ▶ 1. CHECK CONSTRAINT'i KALDIR
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;

-- ▶ 2. Eski "quantity" → "delta" (varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='quantity')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='delta')
  THEN
    ALTER TABLE stock_movements RENAME COLUMN quantity TO delta;
  END IF;
END $$;

-- ▶ 3. stock_after → quantity_after (varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='stock_after')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='quantity_after')
  THEN
    ALTER TABLE stock_movements RENAME COLUMN stock_after TO quantity_after;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='stock_after')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='quantity_after')
  THEN
    UPDATE stock_movements SET quantity_after = stock_after WHERE quantity_after IS NULL AND stock_after IS NOT NULL;
    ALTER TABLE stock_movements DROP COLUMN stock_after;
  END IF;
END $$;

-- ▶ 4. Kolonları garanti et
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS delta NUMERIC(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_before NUMERIC(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_after NUMERIC(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS recipe_id UUID,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'manual';

-- ▶ 5. NULL kayıtları düzelt + DEFAULT + NOT NULL kaldır
UPDATE stock_movements SET quantity_before = 0 WHERE quantity_before IS NULL;
UPDATE stock_movements SET quantity_after = 0 WHERE quantity_after IS NULL;
UPDATE stock_movements SET delta = 0 WHERE delta IS NULL;
UPDATE stock_movements SET "type" = 'manual' WHERE "type" IS NULL;
UPDATE stock_movements SET source = 'manual' WHERE source IS NULL;
ALTER TABLE stock_movements ALTER COLUMN quantity_before SET DEFAULT 0;
ALTER TABLE stock_movements ALTER COLUMN quantity_after SET DEFAULT 0;
ALTER TABLE stock_movements ALTER COLUMN "type" SET DEFAULT 'manual';
ALTER TABLE stock_movements ALTER COLUMN "type" DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN quantity_before DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN quantity_after DROP NOT NULL;

-- ▶ 6. orders + work_orders + order_items ek kolonlar
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_invoiced BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS production_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS recipe_change_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS recipe_id UUID;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS custom_recipe_items JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_recipe_items JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS skip_work_order BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS custom_recipe_data JSONB;

-- ============================================================
-- ▶ 7. product_recipe_stock RLS
-- ============================================================
ALTER TABLE product_recipe_stock ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri temizle (idempotent)
DROP POLICY IF EXISTS "prs_select" ON product_recipe_stock;
DROP POLICY IF EXISTS "prs_insert" ON product_recipe_stock;
DROP POLICY IF EXISTS "prs_update" ON product_recipe_stock;
DROP POLICY IF EXISTS "prs_delete" ON product_recipe_stock;
DROP POLICY IF EXISTS "prs_all" ON product_recipe_stock;

-- Tüm authenticated kullanıcılara tam erişim
CREATE POLICY "prs_all" ON product_recipe_stock
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role (RPC'ler için) — anon da erişsin
DROP POLICY IF EXISTS "prs_anon_all" ON product_recipe_stock;
CREATE POLICY "prs_anon_all" ON product_recipe_stock
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- RPC FONKSİYONLARI
-- ============================================================

-- ▶ 8. increment_stock
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

  IF p_recipe_id IS NOT NULL THEN
    INSERT INTO product_recipe_stock(product_id, recipe_id, stock_count)
    VALUES(p_item_id, p_recipe_id, p_qty)
    ON CONFLICT(product_id, recipe_id)
    DO UPDATE SET stock_count = product_recipe_stock.stock_count + p_qty, updated_at = now();
  END IF;

  RETURN v_after;
END;
$$;

-- ▶ 9. decrement_stock  (negatif stoka izin verir)
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

  IF p_recipe_id IS NOT NULL THEN
    UPDATE product_recipe_stock
    SET stock_count = stock_count - p_qty, updated_at = now()
    WHERE product_id = p_item_id AND recipe_id = p_recipe_id;
  END IF;

  RETURN v_after;
END;
$$;

-- ▶ 10. log_stock_change
CREATE OR REPLACE FUNCTION log_stock_change(
  p_item_id UUID, p_old_qty NUMERIC, p_new_qty NUMERIC,
  p_source TEXT DEFAULT 'manual', p_note TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_delta NUMERIC;
BEGIN
  v_delta := p_new_qty - p_old_qty;
  IF v_delta = 0 THEN RETURN; END IF;
  INSERT INTO stock_movements(item_id, delta, quantity_before, quantity_after, source, note, "type")
  VALUES (p_item_id, v_delta, p_old_qty, p_new_qty, COALESCE(p_source,'manual'), p_note, COALESCE(p_source,'manual'));
END;
$$;

-- ▶ 11. refund_order_stock
CREATE OR REPLACE FUNCTION refund_order_stock(p_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oi.item_id, oi.quantity, oi.recipe_id
    FROM order_items oi WHERE oi.order_id = p_order_id AND oi.item_id IS NOT NULL
  LOOP
    PERFORM increment_stock(r.item_id, r.quantity, 'refund', p_order_id, r.recipe_id, 'Sipariş iadesi — stok geri yüklendi');
  END LOOP;
  UPDATE orders SET status = 'refunded', refunded_at = now() WHERE id = p_order_id;
END;
$$;

-- ▶ 12. İndexler
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_time ON stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_recipe ON work_orders(recipe_id);
CREATE INDEX IF NOT EXISTS idx_prs_product ON product_recipe_stock(product_id);
