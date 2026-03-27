-- =====================================================================
-- invoices tablosuna yeni sütunlar ekle (ADD COLUMN IF NOT EXISTS)
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

alter table invoices
  add column if not exists document_id          text,
  add column if not exists invoice_type         text,
  add column if not exists invoice_tip_type     text,
  add column if not exists envelope_status      text,
  add column if not exists create_date_utc      timestamp,
  add column if not exists tax_exclusive_amount numeric default 0,
  add column if not exists tax_total            numeric default 0,
  add column if not exists exchange_rate        numeric default 1,
  add column if not exists vat1                 numeric default 0,
  add column if not exists vat8                 numeric default 0,
  add column if not exists vat10                numeric default 0,
  add column if not exists vat18                numeric default 0,
  add column if not exists vat20                numeric default 0,
  add column if not exists vat1_taxable         numeric default 0,
  add column if not exists vat8_taxable         numeric default 0,
  add column if not exists vat10_taxable        numeric default 0,
  add column if not exists vat18_taxable        numeric default 0,
  add column if not exists vat20_taxable        numeric default 0,
  add column if not exists is_new               boolean default false,
  add column if not exists is_seen              boolean default false,
  add column if not exists envelope_identifier  text,
  add column if not exists order_document_id    text,
  add column if not exists message              text;

-- RLS: anon'a tam CRUD izni (eğer önceki SQL çalıştırılmadıysa)
drop policy if exists "Allow all authenticated operations" on invoices;
drop policy if exists "Allow all absolute public viewing" on invoices;
drop policy if exists "Allow all operations for anon" on invoices;
drop policy if exists "Allow all operations for authenticated" on invoices;

create policy "Allow all operations for anon" on invoices
  for all to anon using (true) with check (true);
create policy "Allow all operations for authenticated" on invoices
  for all to authenticated using (true) with check (true);
