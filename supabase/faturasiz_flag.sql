-- Customers ve Suppliers tablolarına faturasız bayrağı ekle
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_faturasiz boolean DEFAULT false;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_faturasiz boolean DEFAULT false;

-- Mevcut fatura_sync kayıtları kesin faturalı
UPDATE customers SET is_faturasiz = false WHERE source = 'invoice_sync';
