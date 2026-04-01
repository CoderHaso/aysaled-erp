-- ============================================================
-- 2. TEDARIKC?LER? TEMIZLE
-- Suppliers tablosunu sifirlar.
-- payments tablosundaki supplier referanslari da temizlenir.
-- DIKKAT: Bu islemi geri almak mumkun degildir!
-- ============================================================

-- Once bagli odemeleri temizle
DELETE FROM payments WHERE entity_type = 'supplier';

-- Sonra tedarikçileri sil
DELETE FROM suppliers;

-- Kontrol
SELECT COUNT(*) AS kalan_tedarikci FROM suppliers;
