-- Supabase > SQL Editor'de çalıştırın
-- invoices tablosuna fatura kalemleri ve UBL detayı için iki yeni kolon ekler

alter table invoices
  add column if not exists line_items  jsonb,   -- GetInboxInvoice detayından parse edilen kalemler
  add column if not exists raw_detail  jsonb;   -- Tam UBL Invoice nesnesi (ham)
