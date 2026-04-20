-- ═══════════════════════════════════════════════════════════════════
-- AYSALED ERP — Tam Sıfırlama (Satışlar + Stok)
-- DİKKAT: Bu işlem geri alınamaz!
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────┐
-- │  1. TÜM SATIŞLARI TEMİZLE          │
-- └─────────────────────────────────────┘

-- Önce sipariş kalemlerini sil
DELETE FROM order_items;

-- Sonra siparişlerin kendisini sil (tüm durumlar: pending, urgent, cancelled...)
DELETE FROM orders;

-- İş emirlerini de temizle (satışlardan türeyen)
DELETE FROM work_orders WHERE TRUE;

-- ┌─────────────────────────────────────┐
-- │  2. STOK VERİLERİNİ SIFIRLA        │
-- └─────────────────────────────────────┘

-- Tüm ürünlerin stok sayısı, alış ve satış fiyatlarını sıfırla
UPDATE items SET
    stock_count    = 0,
    purchase_price = 0,
    sale_price     = 0,
    updated_at     = NOW();

-- ┌─────────────────────────────────────┐
-- │  3. REÇETELERİ KALDIR              │
-- └─────────────────────────────────────┘

-- Önce reçete malzemelerini sil
DELETE FROM recipe_items;

-- Sonra reçetelerin kendisini sil
DELETE FROM product_recipes;

-- ┌─────────────────────────────────────┐
-- │  DOĞRULAMA                         │
-- └─────────────────────────────────────┘

-- Sonuçları kontrol et
SELECT 'orders' AS tablo, COUNT(*) AS kalan FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'items (stock>0)', COUNT(*) FROM items WHERE stock_count > 0
UNION ALL
SELECT 'product_recipes', COUNT(*) FROM product_recipes
UNION ALL
SELECT 'recipe_items', COUNT(*) FROM recipe_items;
