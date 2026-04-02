-- ═══════════════════════════════════════════════════════════════════
-- ADIM 3: GELEN FATURALARI ÇEK (inbox — Uyumsoft'tan)
-- ═══════════════════════════════════════════════════════════════════
--
-- Bu adım UYGULAMA üzerinden yapılır, SQL değil!
--
-- Yapmanız gereken:
--   Uygulamada → Tedarikçiler sayfasına gidin
--   → "Faturalardan Çek" butonuna basın
--   → "Çekiliyor..." yazısı bitene kadar bekleyin
--
-- Butona bastıktan sonra aşağıdaki sorguyu çalıştırarak kontrol edin:
-- ═══════════════════════════════════════════════════════════════════

SELECT
  COUNT(*)                                              AS toplam_gelen_fatura,
  COUNT(*) FILTER (WHERE detail_fetched_at IS NOT NULL) AS ubldeki_adres_var,
  COUNT(*) FILTER (WHERE cari_address IS NOT NULL)      AS adres_dolu,
  COUNT(*) FILTER (WHERE cari_city    IS NOT NULL)      AS sehir_dolu,
  COUNT(*) FILTER (WHERE cari_phone   IS NOT NULL)      AS telefon_dolu
FROM invoices
WHERE type = 'inbox';
