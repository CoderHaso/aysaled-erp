-- =====================================================================
-- Satış Siparişleri: orders + order_items
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- ── 1. ORDERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text UNIQUE NOT NULL,          -- AYS-MÜŞTERI-001
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   text NOT NULL,
  customer_vkntckn text,
  status          text DEFAULT 'pending'         -- pending | processing | completed | cancelled
                    CHECK (status IN ('pending','processing','completed','cancelled')),
  currency        text DEFAULT 'TRY',
  due_date        timestamptz,
  completed_at    timestamptz,
  delivery_address text,
  billing_address  text,
  notes           text,
  subtotal        numeric DEFAULT 0,
  tax_total       numeric DEFAULT 0,
  grand_total     numeric DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 2. ORDER_ITEMS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES items(id) ON DELETE SET NULL,
  item_name   text NOT NULL,
  item_type   text,               -- 'raw' | 'product'
  quantity    numeric DEFAULT 1,
  unit        text DEFAULT 'Adet',
  unit_price  numeric DEFAULT 0,
  tax_rate    numeric DEFAULT 18, -- KDV %
  tax_amount  numeric GENERATED ALWAYS AS (ROUND((quantity * unit_price * tax_rate / 100)::numeric, 2)) STORED,
  line_total  numeric GENERATED ALWAYS AS (ROUND((quantity * unit_price)::numeric, 2)) STORED,
  stock_count numeric DEFAULT 0,  -- Snapshot of stock at order time
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- ── 3. RLS ────────────────────────────────────────────────────────────
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_all_anon"       ON orders;
DROP POLICY IF EXISTS "orders_all_auth"       ON orders;
DROP POLICY IF EXISTS "order_items_all_anon"  ON order_items;
DROP POLICY IF EXISTS "order_items_all_auth"  ON order_items;

CREATE POLICY "orders_all_anon"      ON orders      FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "orders_all_auth"      ON orders      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "order_items_all_anon" ON order_items FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "order_items_all_auth" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. updated_at trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
