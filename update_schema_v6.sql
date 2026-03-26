-- A-ERP Schema Migration v6 — has_bom
-- Supabase SQL Editor'da çalıştırın

ALTER TABLE items ADD COLUMN IF NOT EXISTS has_bom BOOLEAN DEFAULT false;

-- Önceden var olan 'product' (mamül) kayıtları için has_bom'u varsayılan olarak true yapalım
UPDATE items SET has_bom = true WHERE item_type = 'product';
