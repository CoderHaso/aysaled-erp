import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase    = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

/**
 * Fatura HTML veya PDF görünümü alır.
 *
 * POST body:
 *   { invoiceId, documentId, type: 'inbox'|'outbox', format: 'html'|'pdf' }
 *
 * format='html' → { success, html }
 * format='pdf'  → { success, pdfBase64 }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { invoiceId, documentId, type = 'outbox', format = 'html' } = req.body || {};
  const uyumsoftId = documentId || invoiceId;
  if (!uyumsoftId) return res.status(400).json({ error: 'invoiceId veya documentId gerekli' });

  // ── HTML cache kontrolü (sadece 'html' için) ────────────────────────────────
  if (format === 'html' && invoiceId) {
    const { data: cached } = await supabase
      .from('invoices')
      .select('html_view')
      .eq('invoice_id', invoiceId)
      .eq('type', type)
      .single();

    if (cached?.html_view) {
      console.log(`[get-invoice-view] ${invoiceId} html_view cache'den döndürülüyor.`);
      return res.json({ success: true, html: cached.html_view, source: 'cache' });
    }
  }

  try {
    const client = await createUyumsoftClient();

    if (format === 'pdf') {
      // ── PDF ────────────────────────────────────────────────────────────────
      const method    = type === 'inbox' ? 'GetInboxInvoicePdf' : 'GetOutboxInvoicePdf';
      const resultKey = type === 'inbox' ? 'GetInboxInvoicePdfResult' : 'GetOutboxInvoicePdfResult';

      const result = await callSoap(client, method, { invoiceId: uyumsoftId });
      const r      = result?.[resultKey];
      const ok     = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';

      if (!ok) {
        return res.status(400).json({ success: false, error: r?.attributes?.Message || 'PDF alınamadı' });
      }

      const pdfBase64 = r?.Value?.Data || '';
      if (!pdfBase64) {
        return res.status(404).json({ success: false, error: 'PDF verisi boş geldi' });
      }
      return res.json({ success: true, pdfBase64, format: 'pdf' });

    } else {
      // ── HTML ───────────────────────────────────────────────────────────────
      const method    = type === 'inbox' ? 'GetInboxInvoiceView' : 'GetOutboxInvoiceView';
      const resultKey = type === 'inbox' ? 'GetInboxInvoiceViewResult' : 'GetOutboxInvoiceViewResult';

      const result = await callSoap(client, method, { invoiceId: uyumsoftId });
      const r      = result?.[resultKey];
      const ok     = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';

      if (!ok) {
        const msg = r?.attributes?.Message || 'HTML görünümü alınamadı';
        console.warn(`[get-invoice-view] ${method} başarısız:`, msg);
        return res.status(400).json({ success: false, error: msg });
      }

      const html = r?.Value?.Html || '';
      if (!html) {
        return res.status(404).json({ success: false, error: 'HTML içeriği boş geldi' });
      }

      // Supabase'e cache olarak kaydet
      if (invoiceId) {
        await supabase
          .from('invoices')
          .update({ html_view: html, updated_at: new Date().toISOString() })
          .eq('invoice_id', invoiceId)
          .eq('type', type);
      }

      return res.json({ success: true, html, source: 'api' });
    }

  } catch (err) {
    console.error('[get-invoice-view]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
