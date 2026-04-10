-- ───────────────────────────────────────────────────────────────────────
-- Çek Yönetimi Tablosu
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cheques (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  direction    TEXT NOT NULL CHECK (direction IN ('received','given')), -- alınan / verilen
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'TRY',
  
  -- Çek bilgileri
  cheque_no    TEXT,            -- Çek numarası
  bank_name    TEXT,            -- Banka adı
  due_date     DATE,            -- Vade tarihi
  issue_date   DATE,            -- Düzenleme tarihi
  
  -- Kişi bilgileri
  from_name    TEXT,            -- Çeki veren (alınan çeklerde müşteri, verilen çeklerde biz/ciro eden)
  to_name      TEXT,            -- Çeki alan (verilen çeklerde tedarikçi, alınan çeklerde biz)
  
  -- Durum
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','deposited','bounced','cancelled')),
  -- active: aktif/beklemede, used: kullanıldı/devredildi, deposited: bankaya yatırıldı, bounced: karşılıksız, cancelled: iptal
  
  -- Devir bilgisi (alınan çek verilene aktarıldığında)
  transferred_to   UUID REFERENCES cheques(id) ON DELETE SET NULL, -- alınan çek -> verilen çek ilişkisi
  transferred_from UUID REFERENCES cheques(id) ON DELETE SET NULL, -- verilen çekin kaynağı (alınan çek)
  transfer_note    TEXT,         -- Devir açıklaması
  
  -- Genel
  notes        TEXT,
  image_url    TEXT,            -- Çek görseli (Supabase storage URL)
  
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cheques_all" ON cheques FOR ALL USING (true) WITH CHECK (true);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_cheques_direction ON cheques(direction);
CREATE INDEX IF NOT EXISTS idx_cheques_status ON cheques(status);
CREATE INDEX IF NOT EXISTS idx_cheques_due_date ON cheques(due_date);
