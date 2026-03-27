-- =====================================================================
-- Bu SQL'i Supabase > SQL Editor'de çalıştırın
-- Mevcut hatalı policy'leri sil, tüm işlemlere izin ver
-- =====================================================================

-- Eski kısıtlayıcı policy'leri sil
drop policy if exists "Allow all authenticated operations" on invoices;
drop policy if exists "Allow all absolute public viewing" on invoices;

-- Anon dahil herkese tam CRUD izni (internal API key ile yazma için gerekli)
create policy "Allow all operations for anon" on invoices
  for all to anon using (true) with check (true);

create policy "Allow all operations for authenticated" on invoices
  for all to authenticated using (true) with check (true);
