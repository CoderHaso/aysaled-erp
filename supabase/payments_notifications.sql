-- ─── payments tablosu ─────────────────────────────────────────────────────────
-- Her cari veya tedarikçiye ait alacak/borç kayıtları
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL CHECK (entity_type IN ('customer','supplier')),  -- 'customer' | 'supplier'
  entity_id       uuid NOT NULL,          -- customers.id veya suppliers.id
  entity_name     text,                   -- denormalize: hızlı okuma için
  direction       text NOT NULL CHECK (direction IN ('receivable','payable')),    -- alacak | borç
  amount          numeric(18,4) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'TRY',
  exchange_rate   numeric(18,6) DEFAULT 1, -- ödeme günündeki TCMB kuru
  amount_try      numeric(18,4),           -- TL karşılığı (otomatik hesap)
  due_date        date,                    -- son ödeme tarihi
  paid_amount     numeric(18,4) DEFAULT 0,
  paid_at         timestamptz,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue','cancelled')),
  description     text,
  invoice_ref     text,                    -- ilgili fatura no
  invoice_id      text,                    -- invoices tablosuna bağ
  reminder_settings jsonb DEFAULT '{"enabled":false,"schedule":[]}'::jsonb,
  -- örnek schedule: [{"days_before":3},{"days_before":0},{"days_after":3}]
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_all" ON payments FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS payments_entity_idx ON payments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS payments_due_date_idx ON payments (due_date);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);

-- ─── notifications tablosu ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL DEFAULT 'payment_reminder',
  -- 'payment_reminder' | 'overdue' | 'system' | 'invoice'
  title        text NOT NULL,
  message      text,
  related_id   uuid,        -- payment.id veya başka
  related_type text,        -- 'payment' | 'invoice' | ...
  entity_name  text,        -- cari/tedarikçi adı
  due_date     date,
  is_read      boolean DEFAULT false,
  priority     text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications (is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);
