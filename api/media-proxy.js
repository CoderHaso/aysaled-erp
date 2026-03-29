import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

// Vercel'de response streaming için body parser kapalı değil (streaming default çalışır)
export const config = { api: { responseLimit: '50mb' } };

/**
 * GET /api/media-proxy?key=uploads/xxx.jpg
 * Private B2 bucket'tan dosyayı sunucudan geçirip tarayıcıya sunar.
 * Kimlik bilgisi hiç tarayıcıya gitmiyor.
 */
export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key parametresi gerekli' });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key:    decodeURIComponent(key),
    });

    const response = await s3.send(command);

    // Tarayıcı önbelleğe alsın (24 saat), bandwidth tasarrufu
    res.setHeader('Content-Type',  response.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }

    // Body'yi stream et
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    res.send(buf);
  } catch (e) {
    console.error('B2 proxy error:', e.message);
    res.status(404).json({ error: 'Dosya bulunamadı' });
  }
}
