-- =====================================================================
-- invoices tablosunu TAMAMEN sıfırlayıp TÜM sütunlarla yeniden oluştur
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

drop table if exists invoices;

create table invoices (
  -- Sistem / PK
  id                    uuid default gen_random_uuid() primary key,
  created_at            timestamp with time zone default timezone('utc', now()) not null,
  updated_at            timestamp with time zone default timezone('utc', now()) not null,

  -- Fatura Kimliği
  type                  text not null check (type in ('inbox', 'outbox')),
  invoice_id            text not null,          -- Fatura numarası (AYS2026...)
  document_id           text,                   -- Uyumsoft belge ID
  envelope_identifier   text,                   -- GİB zarf ID

  -- Cari Bilgileri
  cari_name             text,                   -- Unvan / Ad Soyad
  vkntckn               text,                   -- VKN veya TCKN

  -- Tarihler
  issue_date            timestamp,              -- Düzenlenme/İcra tarihi
  create_date_utc       timestamp,              -- Sisteme giriş tarihi (UTC)

  -- Fatura Tipi & Durum
  invoice_type          text,                   -- BaseInvoice, eArchive, Export...
  invoice_tip_type      text,                   -- Sales, Return, Exception...
  status                text,                   -- Approved, Canceled, Declined...
  envelope_status       text,                   -- Zarf işlem durumu
  message               text,                   -- Sistem mesajı

  -- Parasal Değerler
  amount                numeric default 0,      -- Ödenecek toplam (KDV dahil)
  tax_exclusive_amount  numeric default 0,      -- Matrah (KDV hariç)
  tax_total             numeric default 0,      -- Toplam KDV tutarı
  currency              text default 'TRY',     -- Para birimi kodu
  exchange_rate         numeric default 1,      -- Döviz kuru

  -- KDV Dökümü (tutar)
  vat1                  numeric default 0,
  vat8                  numeric default 0,
  vat10                 numeric default 0,
  vat18                 numeric default 0,
  vat20                 numeric default 0,

  -- KDV Dökümü (matrah)
  vat1_taxable          numeric default 0,
  vat8_taxable          numeric default 0,
  vat10_taxable         numeric default 0,
  vat18_taxable         numeric default 0,
  vat20_taxable         numeric default 0,

  -- Bayraklar
  is_archived           boolean default false,
  is_new                boolean default false,
  is_seen               boolean default false,

  -- Referanslar
  order_document_id     text,                   -- Sipariş referans no

  -- Ham Veri
  raw_data              jsonb,                  -- Uyumsoft'tan gelen tüm ham SOAP verisi

  -- Benzersizlik (Upsert için)
  unique(invoice_id, type)
);

-- RLS
alter table invoices enable row level security;

drop policy if exists "Allow all operations for anon" on invoices;
drop policy if exists "Allow all operations for authenticated" on invoices;
drop policy if exists "Allow all authenticated operations" on invoices;
drop policy if exists "Allow all absolute public viewing" on invoices;

create policy "Allow all operations for anon" on invoices
  for all to anon using (true) with check (true);

create policy "Allow all operations for authenticated" on invoices
  for all to authenticated using (true) with check (true);
