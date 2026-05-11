-- Ad-hoc (kayıtsız) reçeteli ürünlerin iş emrine gönderilebilmesi için
-- item_id nullable yapılıyor ve item_name alanı ekleniyor.

-- 1. item_id nullable yap
ALTER TABLE work_orders ALTER COLUMN item_id DROP NOT NULL;

-- 2. item_name kolonu ekle (ad-hoc ürün ismi)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS item_name TEXT;

-- 3. Mevcut kayıtları güncelle: item_name'i items tablosundan çek
UPDATE work_orders wo
SET item_name = i.name
FROM items i
WHERE wo.item_id = i.id AND wo.item_name IS NULL;
