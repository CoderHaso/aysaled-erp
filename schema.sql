-- ============================================================
-- A-ERP Sistem Şeması v2.0 — TAM VE GÜNCEL
-- Supabase SQL Editor'da bu dosyanın tamamını çalıştırın.
-- ============================================================

-- ─────────────────────────────────────────
-- UZANTI: uuid-ossp (gen_random_uuid için)
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- 1. ÜRÜN / STOK (items)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    sku           TEXT UNIQUE,
    description   TEXT,
    unit          TEXT NOT NULL DEFAULT 'pcs',   -- pcs | kg | m | lt | adet
    stock_count   NUMERIC NOT NULL DEFAULT 0,
    critical_limit NUMERIC NOT NULL DEFAULT 10,
    base_currency TEXT NOT NULL DEFAULT 'TRY',   -- TRY | USD | EUR
    purchase_price NUMERIC NOT NULL DEFAULT 0,
    sale_price    NUMERIC NOT NULL DEFAULT 0,
    vat_rate      NUMERIC NOT NULL DEFAULT 20,   -- %18, %8, %1 vb.
    barcode       TEXT,
    qr_code_url   TEXT,
    image_url     TEXT,
    category      TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. CARİ KARTLAR (contacts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    short_name    TEXT,
    type          TEXT NOT NULL CHECK (type IN ('customer','supplier','both')),
    tax_id        TEXT,                          -- VKN / TC
    tax_office    TEXT,
    phone         TEXT,
    email         TEXT,
    address       TEXT,
    country       TEXT DEFAULT 'TR',
    -- Bakiye (3 para birimi)
    balance_try   NUMERIC NOT NULL DEFAULT 0,
    balance_usd   NUMERIC NOT NULL DEFAULT 0,
    balance_eur   NUMERIC NOT NULL DEFAULT 0,
    -- Vade bilgisi
    payment_days  INT DEFAULT 30,               -- ortalama vade (gün)
    credit_limit  NUMERIC DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. KUR TABLOSU (currencies)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currencies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code TEXT NOT NULL UNIQUE,         -- USD | EUR | GBP
    rate_to_try   NUMERIC NOT NULL,             -- 1 birim yabancı = X TRY
    source        TEXT DEFAULT 'TCMB',
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Başlangıç kur verileri
INSERT INTO currencies (currency_code, rate_to_try) VALUES
  ('USD', 38.50),
  ('EUR', 41.20)
ON CONFLICT (currency_code) DO NOTHING;

-- ─────────────────────────────────────────
-- 4. HAREKETLER / FATURALAR (transactions)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
    type              TEXT NOT NULL CHECK (type IN ('sale','purchase','return_in','return_out','expense')),
    is_official       BOOLEAN NOT NULL DEFAULT true,   -- Faturalı mı?
    invoice_number    TEXT,
    invoice_date      DATE DEFAULT CURRENT_DATE,
    -- Tevkifat
    has_withholding   BOOLEAN DEFAULT false,
    withholding_rate  TEXT,                            -- '5/10', '9/10' vb.
    -- Tutarlar
    subtotal          NUMERIC NOT NULL DEFAULT 0,
    vat_amount        NUMERIC NOT NULL DEFAULT 0,
    withholding_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount      NUMERIC NOT NULL DEFAULT 0,
    -- Para birimi
    currency          TEXT NOT NULL DEFAULT 'TRY',
    exchange_rate     NUMERIC NOT NULL DEFAULT 1,      -- İşlem anındaki kur
    total_try         NUMERIC NOT NULL DEFAULT 0,      -- TRY karşılığı (sabit)
    -- Durum
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','pending','completed','cancelled','approved')),
    -- Uyumsoft
    uyumsoft_id       TEXT,                            -- GİB UUID
    uyumsoft_status   TEXT,                            -- GİB durumu
    -- Notlar
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 5. FATURA KALEMLERİ (transaction_items)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
    item_name       TEXT NOT NULL,                     -- Anlık isim kopyası
    quantity        NUMERIC NOT NULL DEFAULT 1,
    unit            TEXT NOT NULL DEFAULT 'pcs',
    unit_price      NUMERIC NOT NULL DEFAULT 0,
    vat_rate        NUMERIC NOT NULL DEFAULT 20,
    vat_amount      NUMERIC NOT NULL DEFAULT 0,
    discount_rate   NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    total           NUMERIC NOT NULL DEFAULT 0,
    sort_order      INT DEFAULT 0
);

-- ─────────────────────────────────────────
-- 6. ÜRETİM REÇETELERİ — BOM (bom_recipes)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bom_recipes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    component_id      UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity_required NUMERIC NOT NULL,
    unit              TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (parent_id, component_id)
);

-- ─────────────────────────────────────────
-- 7. İŞ EMİRLERİ (work_orders)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES items(id),
    transaction_id  UUID REFERENCES transactions(id),
    quantity        NUMERIC NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','cancelled')),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 8. STOK HAREKETLERİ LOG (stock_movements)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL,
    work_order_id   UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    type            TEXT NOT NULL CHECK (type IN ('in','out','adjustment')),
    quantity        NUMERIC NOT NULL,
    quantity_before NUMERIC NOT NULL,
    quantity_after  NUMERIC NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 9. KULLANICI AYARLARI (user_settings)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,                      -- Supabase auth.users.id
    -- Tema
    theme_mode      TEXT NOT NULL DEFAULT 'light'
                    CHECK (theme_mode IN ('light','dark','system')),
    primary_color   TEXT NOT NULL DEFAULT '#0284c7',    -- Hex renk
    theme_preset    TEXT DEFAULT 'ocean',               -- ocean|forest|sunset|midnight|custom
    -- Genel
    language        TEXT NOT NULL DEFAULT 'tr',
    currency        TEXT NOT NULL DEFAULT 'TRY',
    date_format     TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
    -- Bildirimler
    notify_low_stock   BOOLEAN DEFAULT true,
    notify_due_dates   BOOLEAN DEFAULT true,
    notify_invoices    BOOLEAN DEFAULT true,
    -- Kısayollar (JSON dizi)
    quick_actions   JSONB DEFAULT '["sale","stock","contact","invoice","report"]',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ─────────────────────────────────────────
-- TRIGGER: updated_at otomatik güncelleme
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tüm tablolara uygula
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['items','contacts','transactions','user_settings']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- TRIGGER: Fatura kalemi eklenince stok güncelle
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_stock_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
  v_delta NUMERIC;
  v_before NUMERIC;
BEGIN
  SELECT t.type INTO v_type
  FROM transactions t WHERE t.id = NEW.transaction_id;

  -- Satış ve giden iade stok azaltır, alış ve gelen iade artırır
  IF v_type IN ('sale','return_out') THEN
    v_delta := -NEW.quantity;
  ELSIF v_type IN ('purchase','return_in') THEN
    v_delta := NEW.quantity;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.item_id IS NOT NULL THEN
    SELECT stock_count INTO v_before FROM items WHERE id = NEW.item_id;
    UPDATE items SET stock_count = stock_count + v_delta WHERE id = NEW.item_id;

    INSERT INTO stock_movements (item_id, transaction_id, type, quantity, quantity_before, quantity_after)
    VALUES (
      NEW.item_id, NEW.transaction_id,
      CASE WHEN v_delta > 0 THEN 'in' ELSE 'out' END,
      ABS(v_delta), v_before, v_before + v_delta
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_on_transaction_item
AFTER INSERT ON transaction_items
FOR EACH ROW EXECUTE FUNCTION update_stock_on_transaction();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────
ALTER TABLE items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_recipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings     ENABLE ROW LEVEL SECURITY;

-- Giriş yapmış herkes kendi hesabı içindeki veriyi görür
-- (Tek şirket kullanımı için basit politika — çok kullanıcıya göre genişletilebilir)
CREATE POLICY "Authenticated users can do everything" ON items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON transaction_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON bom_recipes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON work_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON stock_movements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read currencies" ON currencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "User can only see own settings" ON user_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────
-- REALTIME (Anlık güncelleme)
-- ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE currencies;
