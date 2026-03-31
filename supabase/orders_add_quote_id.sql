-- =====================================================================
-- orders tablosuna quote_id kolonu ekle
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders(quote_id);
