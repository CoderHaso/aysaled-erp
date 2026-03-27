create table invoices (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('inbox', 'outbox')), -- Gelen veya Giden
  invoice_id text not null, -- Fatura No (Örn: AYS2026...)
  vkntckn text,             -- Cari VKN veya TCKN
  cari_name text,           -- Gönderen/Alıcı isim (Müşteri veya Tedarikçi adı)
  amount numeric,           -- Tutar
  currency text default 'TRY', 
  issue_date timestamp,     -- Fatura kesim tarihi
  status text,              -- Onaylandı, vs. statusler
  raw_data jsonb,           -- Uyumsoft'tan dönen ham SOAP JSON'u (ne olur ne olmaz)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(invoice_id, type)  -- Bir fatura nosu o liste türünde tekrar eklenemesin diye upsert için
);

-- RLS (Row Level Security) ayarları opsiyonel ama önerilir:
alter table invoices enable row level security;
create policy "Allow all authenticated operations" on invoices for all to authenticated using (true);
create policy "Allow all absolute public viewing" on invoices for select to anon using (true);
-- api sunucusu admin bypass yapacağı için key fark etmeyebilir
