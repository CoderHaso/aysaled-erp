-- ═══════════════════════════════════════════════
-- ADIM 2: GİDEN FATURALARI SİL (outbox)
-- ═══════════════════════════════════════════════
DELETE FROM invoices WHERE type = 'outbox';

SELECT COUNT(*) AS kalan_giden_fatura FROM invoices WHERE type = 'outbox';
