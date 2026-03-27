-- =====================================================================
-- Cariler (customers) ve Tedarikçiler (suppliers) tabloları
-- + Otomatik senkronizasyon trigger'ı
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- ── 1. CUSTOMERS (Cariler / Müşteriler) ──────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  vkntckn     text,                          -- Null → faturasız cari
  tax_office  text,
  phone       text,
  email       text,
  address     text,
  city        text,
  notes       text,
  is_active   boolean DEFAULT true,
  source      text DEFAULT 'manual',         -- 'manual' | 'invoice_sync'
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
-- VKN benzersizliği sadece dolu değerler için
CREATE UNIQUE INDEX IF NOT EXISTS customers_vkntckn_unique
  ON customers (vkntckn) WHERE vkntckn IS NOT NULL;

-- ── 2. SUPPLIERS (Tedarikçiler) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  vkntckn     text,
  tax_office  text,
  phone       text,
  email       text,
  address     text,
  city        text,
  notes       text,
  is_active   boolean DEFAULT true,
  source      text DEFAULT 'manual',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_vkntckn_unique
  ON suppliers (vkntckn) WHERE vkntckn IS NOT NULL;

-- ── 3. RLS ───────────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_all_anon" ON customers;
DROP POLICY IF EXISTS "customers_all_auth" ON customers;
DROP POLICY IF EXISTS "suppliers_all_anon" ON suppliers;
DROP POLICY IF EXISTS "suppliers_all_auth" ON suppliers;

CREATE POLICY "customers_all_anon" ON customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "customers_all_auth" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "suppliers_all_anon" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "suppliers_all_auth" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. AUTO-SYNC TRIGGER ─────────────────────────────────────────────
-- Invoices tablosuna satır eklendiğinde/güncellendiğinde
-- otomatik olarak customers veya suppliers tablosunu günceller.

CREATE OR REPLACE FUNCTION sync_contact_from_invoice()
RETURNS trigger AS $$
BEGIN
  -- Sadece VKN'si olan faturaları işle
  IF NEW.vkntckn IS NULL OR NEW.vkntckn = '' THEN
    RETURN NEW;
  END IF;

  -- inbox = gelir = faturalandırdığımız müşteriler (customers)
  IF NEW.type = 'inbox' THEN
    INSERT INTO customers (name, vkntckn, source, updated_at)
    VALUES (NEW.cari_name, NEW.vkntckn, 'invoice_sync', now())
    ON CONFLICT (vkntckn) DO UPDATE
      SET name       = EXCLUDED.name,
          source     = 'invoice_sync',
          updated_at = now()
      WHERE customers.source = 'invoice_sync';  -- Manuel girişi koruma
  END IF;

  -- outbox = gider = bize fatura kesen tedarikçiler (suppliers)
  IF NEW.type = 'outbox' THEN
    INSERT INTO suppliers (name, vkntckn, source, updated_at)
    VALUES (NEW.cari_name, NEW.vkntckn, 'invoice_sync', now())
    ON CONFLICT (vkntckn) DO UPDATE
      SET name       = EXCLUDED.name,
          source     = 'invoice_sync',
          updated_at = now()
      WHERE suppliers.source = 'invoice_sync';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contact ON invoices;
CREATE TRIGGER trg_sync_contact
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_contact_from_invoice();

-- ── 5. İLK VERİ YÜKLEME (Mevcut faturalardan) ────────────────────────
-- Bu bloğu bir kez çalıştırın, mevcut tüm faturalardan cari/tedarikçi oluşturur.

INSERT INTO customers (name, vkntckn, source)
SELECT DISTINCT ON (vkntckn) cari_name, vkntckn, 'invoice_sync'
FROM invoices
WHERE type = 'inbox'
  AND vkntckn IS NOT NULL
  AND vkntckn <> ''
  AND cari_name IS NOT NULL
ORDER BY vkntckn, issue_date DESC
ON CONFLICT (vkntckn) DO NOTHING;

INSERT INTO suppliers (name, vkntckn, source)
SELECT DISTINCT ON (vkntckn) cari_name, vkntckn, 'invoice_sync'
FROM invoices
WHERE type = 'outbox'
  AND vkntckn IS NOT NULL
  AND vkntckn <> ''
  AND cari_name IS NOT NULL
ORDER BY vkntckn, issue_date DESC
ON CONFLICT (vkntckn) DO NOTHING;

-- ── 6. invoices tablosuna line_items + raw_detail kolonu ekle (yoksa) ─
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS line_items jsonb,
  ADD COLUMN IF NOT EXISTS raw_detail jsonb;
