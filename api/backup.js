import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

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

export const config = { api: { bodyParser: { sizeLimit: '100mb' }, responseLimit: '100mb' } };

// ── Tablo tanımları ──────────────────────────────────────────────────────────
const ALL_TABLES = [
  'app_settings', 'profiles', 'item_categories', 'suppliers', 'customers',
  'items', 'stock_movements', 'product_recipes', 'recipe_items', 'bom_recipes',
  'orders', 'order_items', 'work_orders', 'quotes', 'invoices',
  'payments', 'cari_hareketler', 'cheques', 'cash_transactions',
  'notifications', 'media', 'catalogs',
];

const MODULE_MAP = {
  cariler:       ['customers'],
  tedarikciler:  ['suppliers'],
  stok:          ['items', 'item_categories', 'stock_movements'],
  receteler:     ['product_recipes', 'recipe_items', 'bom_recipes'],
  siparisler:    ['orders', 'order_items', 'work_orders'],
  teklifler:     ['quotes'],
  faturalar:     ['invoices'],
  odemeler:      ['payments', 'cari_hareketler'],
  cekler:        ['cheques'],
  kasa:          ['cash_transactions'],
  medya:         ['media'],
  katalog:       ['catalogs'],
  ayarlar:       ['app_settings', 'profiles'],
  bildirimler:   ['notifications'],
};

// ── Yardımcı: Tabloyu tamamen çek (pagination ile) ────────────────────────
async function fetchFullTable(tableName) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${tableName}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

// ── B2'den dosya içeriğini base64 olarak getir ────────────────────────────
async function fetchB2FileBase64(fileKey) {
  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
    const resp = await s3.send(cmd);
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    return {
      base64: buf.toString('base64'),
      contentType: resp.ContentType || 'application/octet-stream',
      size: buf.length,
    };
  } catch (e) {
    console.warn(`B2 dosya alınamadı: ${fileKey}`, e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, modules, data: restoreData } = req.body || {};

  // ── YEDEKLEME ────────────────────────────────────────────────────────────
  if (action === 'backup') {
    try {
      // Hangi tablolar?
      let tablesToBackup;
      if (!modules || modules.length === 0 || modules.includes('full')) {
        tablesToBackup = [...ALL_TABLES];
      } else {
        const tableSet = new Set();
        modules.forEach(mod => {
          (MODULE_MAP[mod] || []).forEach(t => tableSet.add(t));
        });
        tablesToBackup = [...tableSet];
      }

      const result = { _manifest: {
        version: '1.0',
        created_at: new Date().toISOString(),
        modules: modules || ['full'],
        tables: tablesToBackup,
      }};

      // Her tabloyu çek
      for (const table of tablesToBackup) {
        result[table] = await fetchFullTable(table);
      }

      // Medya dosyaları dahilse B2'den base64 çek
      const includeMedia = tablesToBackup.includes('media');
      if (includeMedia && result.media && result.media.length > 0) {
        const mediaFiles = {};
        for (const m of result.media) {
          if (m.file_key) {
            const fileData = await fetchB2FileBase64(m.file_key);
            if (fileData) {
              mediaFiles[m.file_key] = fileData;
            }
          }
        }
        result._media_files = mediaFiles;
      }

      return res.json({ success: true, data: result });
    } catch (e) {
      console.error('Yedekleme hatası:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ── GERİ YÜKLEME ────────────────────────────────────────────────────────
  if (action === 'restore') {
    if (!restoreData || !restoreData._manifest) {
      return res.status(400).json({ error: 'Geçersiz yedek dosyası' });
    }

    try {
      const manifest = restoreData._manifest;
      let tablesToRestore;
      
      if (!modules || modules.length === 0 || modules.includes('full')) {
        tablesToRestore = manifest.tables || ALL_TABLES;
      } else {
        const tableSet = new Set();
        modules.forEach(mod => {
          (MODULE_MAP[mod] || []).forEach(t => tableSet.add(t));
        });
        // Sadece yedekte olan tabloları geri yükle
        tablesToRestore = [...tableSet].filter(t => restoreData[t]);
      }

      // FK bağımlılık sırasına göre — silme ters sırada, ekleme doğru sırada
      const RESTORE_ORDER = [
        'app_settings', 'profiles', 'item_categories', 'suppliers', 'customers',
        'items', 'stock_movements', 'product_recipes', 'recipe_items', 'bom_recipes',
        'orders', 'order_items', 'work_orders', 'quotes', 'invoices',
        'payments', 'cari_hareketler', 'cheques', 'cash_transactions',
        'notifications', 'media', 'catalogs',
      ];

      const orderedTables = RESTORE_ORDER.filter(t => tablesToRestore.includes(t));
      const log = [];

      // 1) Önce FK bağımlılıklarına göre TERS sırada sil
      const deleteOrder = [...orderedTables].reverse();
      for (const table of deleteOrder) {
        const rows = restoreData[table];
        if (!rows || rows.length === 0) continue;
        try {
          // Evrensel silme: id > '' (text) veya created_at not null gibi her zaman doğru koşul
          // Supabase delete() boş koşul kabul etmiyor, neq ile çözelim
          const { error: delErr } = await supabase.from(table).delete().neq('id', '___impossible_id___');
          if (delErr) {
            console.warn(`${table} silme hatası (gte):`, delErr.message);
            // Tek tek sil
            for (const row of rows) {
              if (row.id) await supabase.from(table).delete().eq('id', row.id);
            }
          }
        } catch (e) {
          console.warn(`${table} silme exception:`, e.message);
        }
      }

      // 2) Doğru sırada ekle
      for (const table of orderedTables) {
        const rows = restoreData[table];
        if (!rows || rows.length === 0) {
          log.push({ table, status: 'skipped', reason: 'no data' });
          continue;
        }

        let inserted = 0, errors = [];
        const chunks = [];
        for (let i = 0; i < rows.length; i += 50) chunks.push(rows.slice(i, i + 50));

        for (const chunk of chunks) {
          // Upsert kullan — conflict durumunda üzerine yaz
          const { error: insErr } = await supabase.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
          if (insErr) {
            // Tekil dene
            for (const row of chunk) {
              const { error: e2 } = await supabase.from(table).upsert(row, { onConflict: 'id' });
              if (e2) errors.push(`${row.id || 'unknown'}: ${e2.message}`);
              else inserted++;
            }
          } else {
            inserted += chunk.length;
          }
        }

        log.push({ table, status: 'ok', inserted, total: rows.length, errors: errors.length > 0 ? errors.slice(0, 5) : undefined });
      }

      // Medya dosyalarını B2'ye geri yükle
      if (restoreData._media_files && tablesToRestore.includes('media')) {
        const mediaLog = { uploaded: 0, failed: 0, errors: [] };
        for (const [fileKey, fileData] of Object.entries(restoreData._media_files)) {
          try {
            const buffer = Buffer.from(fileData.base64, 'base64');
            await s3.send(new PutObjectCommand({
              Bucket: BUCKET,
              Key: fileKey,
              Body: buffer,
              ContentType: fileData.contentType || 'application/octet-stream',
              ContentLength: buffer.length,
            }));
            mediaLog.uploaded++;
          } catch (e) {
            mediaLog.failed++;
            mediaLog.errors.push(`${fileKey}: ${e.message}`);
          }
        }
        log.push({ table: '_media_files_b2', status: 'ok', ...mediaLog });
      }

      return res.json({ success: true, log });
    } catch (e) {
      console.error('Geri yükleme hatası:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(400).json({ error: 'action must be "backup" or "restore"' });
}
