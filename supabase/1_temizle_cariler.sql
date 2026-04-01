-- ============================================================
-- 1. CAR?LER? TEMIZLE
-- Customers tablosunu sifirlar.
-- payments tablosundaki customer referanslari da temizlenir.
-- DIKKAT: Bu islemi geri almak mumkun degildir!
-- ============================================================

-- Once bagli odemeleri temizle
DELETE FROM payments WHERE entity_type = 'customer';

-- Sonra carileri sil
DELETE FROM customers;

-- Kontrol
SELECT COUNT(*) AS kalan_cari FROM customers;
