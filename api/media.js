import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

const s3 = new S3Client({
  endpoint:        process.env.B2_ENDPOINT,
  region:          process.env.B2_REGION,
  credentials: {
    accessKeyId:     process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,   // B2 için zorunlu
});

const BUCKET = process.env.B2_BUCKET_NAME;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * GET  /api/media          → tüm medya listesi
 * POST /api/media          → upload (multipart/form-data)
 * DELETE /api/media?key=.. → dosya sil
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: Medya listesi ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, items: data });
  }

  // ── POST: Upload presigned URL al (frontend direkt B2'ye yükler) ──
  if (req.method === 'POST') {
    const { fileName, mimeType, fileSize, linkedItemId, name } = req.body || {};
    if (!fileName || !mimeType) {
      return res.status(400).json({ error: 'fileName ve mimeType gerekli' });
    }

    const ext      = fileName.split('.').pop();
    const fileKey  = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const displayName = name || fileName;

    // Presigned PUT URL oluştur (5 dakika geçerli)
    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         fileKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // Veritabanına kaydet (henüz upload tamamlanmadı, pending)
    const publicUrl = `${process.env.B2_ENDPOINT}/${BUCKET}/${fileKey}`;
    const { data: mediaRow, error: dbErr } = await supabase.from('media').insert({
      name:          displayName,
      file_key:      fileKey,
      file_url:      publicUrl,
      size_bytes:    fileSize || 0,
      mime_type:     mimeType,
      linked_item_id: linkedItemId || null,
    }).select().single();

    if (dbErr) return res.status(500).json({ error: dbErr.message });

    return res.json({
      success:   true,
      uploadUrl,          // Frontend buna PUT request atar (binary body)
      fileKey,
      publicUrl,
      mediaId:   mediaRow.id,
    });
  }

  // ── DELETE: Dosya sil ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const fileKey = req.query.key;
    if (!fileKey) return res.status(400).json({ error: 'key parametresi gerekli' });

    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
    } catch (e) {
      console.warn('[media] B2 silme hatası (devam edildi):', e.message);
    }

    const { error } = await supabase.from('media').delete().eq('file_key', fileKey);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
