-- RLS Policies Fix - Allow anonymous / public access for development
-- Supabase SQL Editor'da çalıştırın

-- 1. item_categories tablosu için RLS aktif edip anon/public policy ekleyelim
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can do everything on item_categories" ON item_categories;
CREATE POLICY "Public can do everything on item_categories" ON item_categories
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Diğer tüm tablolar için "authenticated" yerine "public" (anon) izni verelim
-- Mevcut policy'leri düşürüp (hata vermemesi için IF EXISTS kullanamıyoruz ama zaten aynı isimle silebiliriz)
DROP POLICY IF EXISTS "Authenticated users can do everything" ON items;
DROP POLICY IF EXISTS "Public can do everything" ON items;
CREATE POLICY "Public can do everything" ON items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON contacts;
DROP POLICY IF EXISTS "Public can do everything" ON contacts;
CREATE POLICY "Public can do everything" ON contacts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON transactions;
DROP POLICY IF EXISTS "Public can do everything" ON transactions;
CREATE POLICY "Public can do everything" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON transaction_items;
DROP POLICY IF EXISTS "Public can do everything" ON transaction_items;
CREATE POLICY "Public can do everything" ON transaction_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON bom_recipes;
DROP POLICY IF EXISTS "Public can do everything" ON bom_recipes;
CREATE POLICY "Public can do everything" ON bom_recipes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON work_orders;
DROP POLICY IF EXISTS "Public can do everything" ON work_orders;
CREATE POLICY "Public can do everything" ON work_orders
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON stock_movements;
DROP POLICY IF EXISTS "Public can do everything" ON stock_movements;
CREATE POLICY "Public can do everything" ON stock_movements
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read currencies" ON currencies;
DROP POLICY IF EXISTS "Public read currencies" ON currencies;
CREATE POLICY "Public read currencies" ON currencies
  FOR SELECT USING (true);

-- User Settings (Bu tabloda user_id kullanıldığı için geçici olarak herkese açıyoruz veya dev ortamında serbest bırakıyoruz)
DROP POLICY IF EXISTS "User can only see own settings" ON user_settings;
DROP POLICY IF EXISTS "Public read/write settings" ON user_settings;
CREATE POLICY "Public read/write settings" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);
