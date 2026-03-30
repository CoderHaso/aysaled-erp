-- quotes tablosuna project_name kolonunu ekler
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS project_name text;

-- Cache temizliği için opsiyonel (Supabase Dashboard'da otomatik yenilenir)
NOTIFY pgrst, 'reload schema';
