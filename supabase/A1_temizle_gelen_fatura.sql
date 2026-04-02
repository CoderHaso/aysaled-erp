-- ═══════════════════════════════════════════════
-- ADIM 1: GELEN FATURALARI SİL (inbox)
-- ═══════════════════════════════════════════════
DELETE FROM invoices WHERE type = 'inbox';

SELECT COUNT(*) AS kalan_gelen_fatura FROM invoices WHERE type = 'inbox';
