-- ============================================================
-- 2. TEDARİKÇİLERİ TEMİZLE (v2 - FK güvenli)
-- Tüm referansları önce temizler, sonra tabloyu siler.
-- ============================================================

-- 1. items tablosundaki supplier_id referanslarını sıfırla
UPDATE items SET supplier_id = NULL WHERE supplier_id IS NOT NULL;

-- 2. Ödemelerdeki tedarikçi referanslarını temizle
DELETE FROM payments WHERE entity_type = 'supplier';

-- 3. Başka olası FK'lar varsa TRUNCATE CASCADE ile temizle
-- (Bu satır yukarıdakiler yetmezse kullanılır)
-- TRUNCATE suppliers CASCADE;

-- 4. Tedarikçileri sil
DELETE FROM suppliers;

-- Kontrol
SELECT
  (SELECT COUNT(*) FROM suppliers)                               AS kalan_tedarikci,
  (SELECT COUNT(*) FROM items WHERE supplier_id IS NOT NULL)     AS items_supplier_bagli,
  (SELECT COUNT(*) FROM payments WHERE entity_type='supplier')   AS kalan_odeme;
