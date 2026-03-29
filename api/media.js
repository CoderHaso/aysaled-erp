import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// requestChecksumCalculation: 'WHEN_REQUIRED' — B2'ye gereksiz checksum header gönderme
const s3 = new S3Client({
  endpoint:  process.env.B2_ENDPOINT,
  region:    process.env.B2_REGION,
  credentials: {
    accessKeyId:     process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation:  'WHEN_REQUIRED',
  responseChecksumValidation:  'WHEN_REQUIRED',
});

const BUCKET = process.env.B2_BUCKET_NAME;

const supabase = createClient(
  process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Vercel body limit: 50 MB
export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

/**
 * GET  /api/media          → medya listesi
 * POST /api/media          → dosya yükle (base64 body — CORS yok, server-side B2 upload)
 * DELETE /api/media?key=.. → sil
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('media').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, items: data });
  }

  // ── POST: Dosya yükle (base64) ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const { fileName, mimeType, fileSize, fileData, name, linkedItemId } = req.body || {};

    if (!fileName || !mimeType || !fileData) {
      return res.status(400).json({ error: 'fileName, mimeType ve fileData gerekli' });
    }

    const ext        = fileName.split('.').pop().toLowerCase();
    const fileKey    = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const displayName = name || fileName.replace(/\.[^.]+$/, '');

    // base64 → Buffer
    const base64Clean = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer      = Buffer.from(base64Clean, 'base64');

    // B2'ye server-side yükle
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         fileKey,
      Body:        buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    }));

    const publicUrl = `${process.env.B2_ENDPOINT}/${BUCKET}/${fileKey}`;

    // Supabase'e kaydet
    const { data: mediaRow, error: dbErr } = await supabase.from('media').insert({
      name:           displayName,
      file_key:       fileKey,
      file_url:       publicUrl,
      size_bytes:     fileSize || buffer.length,
      mime_type:      mimeType,
      linked_item_id: linkedItemId || null,
    }).select().single();

    if (dbErr) return res.status(500).json({ error: dbErr.message });

    return res.json({ success: true, mediaId: mediaRow.id, publicUrl, fileKey });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const fileKey = req.query.key;
    if (!fileKey) return res.status(400).json({ error: 'key gerekli' });

    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
    } catch (e) { console.warn('B2 silme hatası:', e.message); }

    const { error } = await supabase.from('media').delete().eq('file_key', fileKey);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
