-- ==========================================================
-- STOCK MOVEMENTS TABLOSUNU DÜZELTME MİGRASYONU
-- Eğer "column 'delta' of relation 'stock_movements' does not exist"
-- hatası alıyorsanız bu SQL komutunu Supabase SQL Editör'den çalıştırın.
-- ==========================================================

DO $$
BEGIN
    -- Eğer önceden 'quantity' adında eski bir kolon varsa onu 'delta' olarak yeniden adlandırır:
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='quantity') THEN
        ALTER TABLE stock_movements RENAME COLUMN quantity TO delta;
    END IF;
END $$;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS delta NUMERIC(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_after NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES product_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Not: stock_movements tablonuzu baştan oluşturmak için DROP TABLE edip
-- stock_management_migration.sql dosyasını tamamen tekrar da çalıştırabilirsiniz.
