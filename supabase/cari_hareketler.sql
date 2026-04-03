-- ============================================================
-- cari_hareketler.sql — Hesap Defteri tablosu
-- Hem cariler hem tedarikçiler için borç/alacak kayıtları
-- "payments" tablosunun yerini alır
-- ============================================================

CREATE TABLE IF NOT EXISTS cari_hareketler (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Kişi bağlantısı (biri dolu olur)
  musteri_id    uuid REFERENCES customers(id)  ON DELETE CASCADE,
  tedarikci_id  uuid REFERENCES suppliers(id)  ON DELETE CASCADE,

  -- Fatura bağlantısı (opsiyonel)
  invoice_id    text,           -- invoices.invoice_id  (fatura numarası)
  invoice_db_id uuid,           -- invoices.id          (UUID referans)

  -- Hareket bilgisi
  tarih         date NOT NULL DEFAULT CURRENT_DATE,
  baslik        text NOT NULL DEFAULT '',      -- "FAT-2025-001", "Ödeme", "Avans" vb.
  aciklama      text,
  borc          numeric(18,2) DEFAULT 0,       -- karşı taraf bize borçlandı / biz alacaklıyız
  alacak        numeric(18,2) DEFAULT 0,       -- ödeme yapıldı / biz ödedik
  currency      text DEFAULT 'TRY',

  -- Meta
  kaynak        text DEFAULT 'manual',   -- 'manual' | 'invoice' | 'payment'
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  -- Kısıt: en az biri dolu olmalı
  CONSTRAINT ch_contact_check CHECK (
    musteri_id IS NOT NULL OR tedarikci_id IS NOT NULL
  )
);

-- RLS
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch_all_anon" ON cari_hareketler FOR ALL TO anon        USING (true) WITH CHECK (true);
CREATE POLICY "ch_all_auth" ON cari_hareketler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- İndeksler
CREATE INDEX IF NOT EXISTS ch_musteri_idx    ON cari_hareketler (musteri_id,   tarih DESC);
CREATE INDEX IF NOT EXISTS ch_tedarikci_idx  ON cari_hareketler (tedarikci_id, tarih DESC);
CREATE INDEX IF NOT EXISTS ch_invoice_idx    ON cari_hareketler (invoice_id);
CREATE INDEX IF NOT EXISTS ch_tarih_idx      ON cari_hareketler (tarih DESC);

-- Doğrulama
SELECT 'cari_hareketler tablosu oluşturuldu' AS durum,
       COUNT(*) AS mevcut_kayit FROM cari_hareketler;
