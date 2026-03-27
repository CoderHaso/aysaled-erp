import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

/**
 * InvoiceLine[] dizisini normalize eder.
 * soap.js tek elemanlı dizileri objeye dönüştürebilir.
 */
function normalizeLines(lines) {
  if (!lines) return [];
  if (Array.isArray(lines)) return lines;
  if (typeof lines === 'object') return [lines];
  return [];
}

/**
 * UBL InvoiceLine nesnesinden temiz bir satır objesi çıkarır.
 */
function parseLine(line) {
  // Item bilgisi
  const item = line.Item || {};
  const name = item.Name || item.Description || '-';
  const itemCode = item.SellersItemIdentification?.ID?._
    || item.SellersItemIdentification?.ID
    || item.BuyersItemIdentification?.ID?._ 
    || item.BuyersItemIdentification?.ID
    || null;

  // Miktar ve birim
  const qty = parseFloat(line.InvoicedQuantity?._ || line.InvoicedQuantity || 0);
  const unit = line.InvoicedQuantity?.attributes?.unitCode || line.InvoicedQuantity?.unitCode || '';

  // Fiyat
  const unitPrice = parseFloat(
    line.Price?.PriceAmount?._ || line.Price?.PriceAmount || 0
  );

  // Satır tutarı (KDV hariç)
  const lineTotal = parseFloat(
    line.LineExtensionAmount?._ || line.LineExtensionAmount || 0
  );

  // KDV
  const taxAmount = parseFloat(
    line.TaxTotal?.TaxAmount?._ || line.TaxTotal?.TaxAmount || 0
  );
  const taxPercent = parseFloat(
    line.TaxTotal?.TaxSubtotal?.TaxCategory?.Percent || 0
  );

  // Açıklama notu
  const note = Array.isArray(line['Note[]'])
    ? line['Note[]'].map(n => n.Note || n).join(' ')
    : (line['Note[]']?.Note || '');

  return {
    id: line.ID?._ || line.ID || null,
    name,
    item_code: itemCode,
    quantity: qty,
    unit,
    unit_price: unitPrice,
    line_total: lineTotal,
    tax_percent: taxPercent,
    tax_amount: taxAmount,
    note: note || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { invoiceId, type = 'inbox' } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });

  try {
    // 1) Supabase'de zaten line_items var mı kontrol et
    const { data: cached } = await supabase
      .from('invoices')
      .select('line_items, raw_detail')
      .eq('invoice_id', invoiceId)
      .eq('type', type)
      .single();

    if (cached?.line_items && Array.isArray(cached.line_items) && cached.line_items.length > 0) {
      console.log(`[get-invoice-detail] ${invoiceId} - Cache'den döndürülüyor.`);
      return res.json({ success: true, source: 'cache', line_items: cached.line_items, raw_detail: cached.raw_detail });
    }

    // 2) Uyumsoft'tan çek
    console.log(`[get-invoice-detail] ${invoiceId} - Uyumsoft'tan çekiliyor... (type: ${type})`);
    const client = await createUyumsoftClient();
    const method = type === 'outbox' ? 'GetOutboxInvoice' : 'GetInboxInvoice';
    const result = await callSoap(client, method, { invoiceId });

    // Yanıt yapısını tamamen logla (ilk seviye)
    console.log('[get-invoice-detail] Result keys:', Object.keys(result || {}));

    const resultKey = type === 'outbox' ? 'GetOutboxInvoiceResult' : 'GetInboxInvoiceResult';
    const resultObj = result?.[resultKey];
    console.log('[get-invoice-detail] Result IsSucceded:', resultObj?.attributes?.IsSucceded);

    // Birden fazla olası path dene
    const invoice = resultObj?.Value?.Invoice
      || resultObj?.Value?.invoice
      || resultObj?.Value
      || null;

    if (!invoice) {
      console.warn('[get-invoice-detail] Invoice nesnesi bulunamadı. resultObj:', JSON.stringify(resultObj)?.slice(0, 500));
      return res.status(404).json({ success: false, error: 'Fatura detayı bulunamadı.', debug: JSON.stringify(resultObj)?.slice(0, 300) });
    }

    // 3) InvoiceLine[] parse et
    const rawLines = invoice['InvoiceLine[]'] || invoice.InvoiceLine || [];
    const normalized = normalizeLines(rawLines);
    const line_items = normalized.map(parseLine).filter(l => l.name !== '-' || l.quantity > 0);

    console.log(`[get-invoice-detail] ${invoiceId} - ${line_items.length} satır bulundu.`);

    // 4) Supabase'e kaydet (line_items + raw_detail)
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        line_items,
        raw_detail: invoice,  // Tam UBL objesi
        updated_at: new Date().toISOString()
      })
      .eq('invoice_id', invoiceId)
      .eq('type', type);

    if (updateErr) {
      console.error('[get-invoice-detail] Supabase update hatası:', updateErr.message);
      // Hata olsa bile veriyi döndür
    }

    res.json({ success: true, source: 'api', line_items, raw_detail: invoice });

  } catch (err) {
    console.error('[get-invoice-detail]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
