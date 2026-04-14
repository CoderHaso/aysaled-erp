create table if not exists public.catalogs (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.catalogs enable row level security;

create policy "Enable all access for authenticated users" 
on public.catalogs for all using (true);
