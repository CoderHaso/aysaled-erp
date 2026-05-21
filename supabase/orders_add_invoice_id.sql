-- Sipariş-Fatura bağlantısı: orders tablosuna invoice_id kolonu ekleme
-- Bu kolon, siparişin hangi fatura taslağına bağlı olduğunu doğrudan tutar.
-- Fatura iptali/güncelleme sırasında müşteri adı ile ILIKE araması yerine
-- doğrudan bu kolondan fatura bulunur.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id text;

-- İneks oluştur (opsiyonel ama sorgu performansını artırır)
CREATE INDEX IF NOT EXISTS orders_invoice_id_idx ON orders (invoice_id);
