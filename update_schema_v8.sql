
-- A-ERP Schema Migration v8 — Discount columns for orders
-- Supabase SQL Editor'da çalıştırın

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_rate NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Optional: Update existing orders to have 0 discount if null
UPDATE orders SET discount_rate = 0 WHERE discount_rate IS NULL;
UPDATE orders SET discount_amount = 0 WHERE discount_amount IS NULL;
