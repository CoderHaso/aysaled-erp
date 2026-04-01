-- ─── cash_transactions tablosu ────────────────────────────────────────────────
-- Kasa: maaş, avans, gider, çay/kargo/market vs.
CREATE TABLE IF NOT EXISTS cash_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction   text NOT NULL CHECK (direction IN ('in','out')),  -- 'in'=giren / 'out'=giden
  amount      numeric(18,2) NOT NULL,
  currency    text NOT NULL DEFAULT 'TRY',
  category    text NOT NULL DEFAULT 'diger',
  -- 'maas' | 'avans' | 'kargo' | 'market' | 'cay_kahve' | 'akaryakit' | 'diger'
  person      text,            -- çalışan / kişi adı (isteğe bağlı)
  description text,            -- açıklama
  tx_date     date NOT NULL DEFAULT CURRENT_DATE,
  is_settled  boolean DEFAULT false,  -- ödendi/kapandı mı
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_all" ON cash_transactions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cash_tx_date_idx ON cash_transactions (tx_date DESC);
CREATE INDEX IF NOT EXISTS cash_person_idx  ON cash_transactions (person);
