-- =====================================================================
-- fix-media-rls.sql
-- media tablosu için Row Level Security politikası ekler.
-- "new row violates rls policy" hatasını çözer.
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- Seçenek 1 (Önerilen): Tüm işlemlere izin ver (dahili uygulama)
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_allow_all" ON media;
CREATE POLICY "media_allow_all"
  ON media
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- quotes tablosu için de aynısını yapalım
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_allow_all" ON quotes;
CREATE POLICY "quotes_allow_all"
  ON quotes
  FOR ALL
  USING (true)
  WITH CHECK (true);

SELECT 'OK: RLS policies added for media and quotes.' AS status;
