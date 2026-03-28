-- =====================================================================
-- cleanup-duplicate-contacts.sql
-- Zenginleştirme sırasında hatalı oluşturulan müşteri/tedarikçi kayıtlarını temizler.
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- 1) Oluşturulan fazla kayıtları görmek için:
SELECT COUNT(*) AS toplam_musteri FROM customers;
SELECT COUNT(*) AS toplam_tedarikci FROM suppliers;

-- 2) Aynı VKN'ye sahip kayıtların en eskisi dışındakileri sil (customers)
DELETE FROM customers
WHERE id NOT IN (
  SELECT DISTINCT ON (vkntckn) id
  FROM customers
  WHERE vkntckn IS NOT NULL AND vkntckn <> ''
  ORDER BY vkntckn, created_at ASC NULLS LAST
)
AND vkntckn IS NOT NULL AND vkntckn <> '';

-- 3) Duplicate olmayan ama istenmeyen kayıtları sil:
-- invoice_sync kaynağından gelen ve çok yeni oluşturulmuş kayıtları temizle
-- (eğer 82 müşteriniz vardı ve şimdi 110+ olduysa, fazladan gelenler yeni VKN'ler)
-- Bu sorguyu dikkatli kullanın - sadece manuel girmedikleriniz silinir.
-- Tarih filtresi: bugün oluşturuldu + invoice_sync kaynağı
DELETE FROM customers
WHERE source = 'invoice_sync'
  AND created_at > NOW() - INTERVAL '2 hours'  -- Son 2 saatte oluşturulanlar
  AND (phone IS NULL AND email IS NULL AND address IS NULL)  -- Hiç zenginleştirme yapılamadıysa
  AND id NOT IN (
    -- Fatura tablosunda VKN'si olan kayıtları koru
    SELECT DISTINCT c.id
    FROM customers c
    INNER JOIN invoices i ON i.vkntckn = c.vkntckn
  );

-- 4) Tekrar sayım
SELECT COUNT(*) AS musteri_sonras FROM customers;
SELECT COUNT(*) AS tedarikci_sonras FROM suppliers;
