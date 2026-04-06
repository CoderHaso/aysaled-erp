-- order_items tablosuna reçete bilgisi için kolonlar ekle
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS recipe_id   UUID    REFERENCES product_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_key  TEXT,
  ADD COLUMN IF NOT EXISTS recipe_note TEXT;

-- work_orders tablosuna recipe_id ekle (zaten recipe_key var, id de alalım)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES product_recipes(id) ON DELETE SET NULL;
