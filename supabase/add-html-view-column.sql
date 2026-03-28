-- invoices tablosuna html_view cache kolonu ekle (idempotent)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS html_view text;
