-- ==========================================================
-- Stok Yönetimi Tam Migrasyon
-- 1. Fiyat geçmişi tablosu
-- 2. Reçete bazlı mamül stok tablosu
-- 3. Stok değişim log tablosu
-- 4. Yardımcı RPC fonksiyonları
-- ==========================================================

-- ── 1. Fiyat Geçmişi ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_price_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  purchase_price NUMERIC(12,4),
  sale_price     NUMERIC(12,4),
  currency       TEXT DEFAULT 'TRY',
  source         TEXT DEFAULT 'manual', -- 'invoice', 'manual', 'import'
  source_ref     TEXT,                  -- fatura no veya işlem referansı
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  note           TEXT
);
CREATE INDEX IF NOT EXISTS idx_price_hist_item ON item_price_history(item_id, changed_at DESC);

-- ── 2. Reçete Bazlı Mamül Stok ──────────────────────────────
-- Her reçete varyantı için ayrı stok sayısı tutan tablo
CREATE TABLE IF NOT EXISTS product_recipe_stock (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  recipe_id  UUID REFERENCES product_recipes(id) ON DELETE CASCADE,
  stock_count NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, recipe_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_stock_product ON product_recipe_stock(product_id);

-- ── 3. Stok Hareket Logu ────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  delta       NUMERIC(12,4) NOT NULL,  -- pozitif=giriş, negatif=çıkış
  stock_after NUMERIC(12,4),
  source      TEXT NOT NULL,  -- 'work_order','sale','invoice','manual'
  source_id   UUID,           -- ilgili WO, sipariş, fatura id
  recipe_id   UUID REFERENCES product_recipes(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, created_at DESC);

-- ── 4. RPC: Stok Artır ──────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_stock(
  p_item_id  UUID,
  p_qty      NUMERIC,
  p_source   TEXT DEFAULT 'manual',
  p_source_id UUID DEFAULT NULL,
  p_recipe_id UUID DEFAULT NULL,
  p_note     TEXT DEFAULT NULL
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

  INSERT INTO stock_movements(item_id, delta, stock_after, source, source_id, recipe_id, note)
  VALUES(p_item_id, p_qty, v_new_count, p_source, p_source_id, p_recipe_id, p_note);

  -- Reçete bazlı stok (mamüller için)
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

-- ── 5. RPC: Stok Düşür ──────────────────────────────────────
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

  INSERT INTO stock_movements(item_id, delta, stock_after, source, source_id, recipe_id, note)
  VALUES(p_item_id, -p_qty, v_new_count, p_source, p_source_id, p_recipe_id, p_note);

  -- Reçete bazlı stok düş
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

-- ── 6. RPC: Fiyat Güncelle + Geçmiş Kaydet ──────────────────
CREATE OR REPLACE FUNCTION update_item_price(
  p_item_id       UUID,
  p_purchase_price NUMERIC DEFAULT NULL,
  p_sale_price     NUMERIC DEFAULT NULL,
  p_currency       TEXT    DEFAULT 'TRY',
  p_source         TEXT    DEFAULT 'manual',
  p_source_ref     TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_purchase NUMERIC;
  v_old_sale     NUMERIC;
BEGIN
  SELECT purchase_price, sale_price INTO v_old_purchase, v_old_sale
  FROM items WHERE id = p_item_id;

  -- Sadece değişiklik varsa güncelle
  IF (p_purchase_price IS NOT NULL AND p_purchase_price <> COALESCE(v_old_purchase, -1))
  OR (p_sale_price IS NOT NULL AND p_sale_price <> COALESCE(v_old_sale, -1))
  THEN
    UPDATE items SET
      purchase_price = COALESCE(p_purchase_price, purchase_price),
      sale_price     = COALESCE(p_sale_price, sale_price),
      base_currency  = p_currency
    WHERE id = p_item_id;

    INSERT INTO item_price_history(item_id, purchase_price, sale_price, currency, source, source_ref, note)
    VALUES(p_item_id,
      COALESCE(p_purchase_price, v_old_purchase),
      COALESCE(p_sale_price, v_old_sale),
      p_currency, p_source, p_source_ref, p_note);
  END IF;
END;
$$;

-- ── 7. invoices tablosuna is_stock_islendi kolonu ekle ───────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_stock_islendi BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stock_islendi_at TIMESTAMPTZ;
