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
 * Bir soap-js node'undan düz değeri alır.
 * Olası formatlar: '5', 5, { _: '5', attributes: {...} }, { $value: '5', ... }
 */
function val(node) {
  if (node === null || node === undefined) return null;
  if (typeof node === 'number') return node;
  if (typeof node === 'string') return node;
  if (node._ !== undefined) return node._;
  if (node.$value !== undefined) return node.$value;
  return null;
}
function numVal(node) {
  const v = val(node);
  if (v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function parseLine(line) {
  const item    = line.Item || {};
  const rawName = item.Name || item.Description;
  const name    = val(rawName) || '-';

  const sellerId = item.SellersItemIdentification?.ID;
  const buyerId  = item.BuyersItemIdentification?.ID;
  const itemCode = val(sellerId) || val(buyerId) || null;

  // InvoicedQuantity: taşır değeri (qty) + unitCode (attribute)
  const iqNode = line.InvoicedQuantity;
  const qty    = numVal(iqNode);
  const unit   = iqNode?.attributes?.unitCode || iqNode?.unitCode || '';

  const unitPrice = numVal(line.Price?.PriceAmount);
  const lineTotal = numVal(line.LineExtensionAmount);

  const taxTotal   = line.TaxTotal;
  const taxAmount  = numVal(taxTotal?.TaxAmount);
  const subtotals  = taxTotal?.TaxSubtotal;
  const subtotal   = Array.isArray(subtotals) ? subtotals[0] : subtotals;
  const taxPercent = numVal(subtotal?.TaxCategory?.Percent);

  const noteNode = line['Note[]'] || line.Note;
  let note = '';
  if (Array.isArray(noteNode)) {
    note = noteNode.map(n => val(n?.Note ?? n) || '').filter(Boolean).join(' ');
  } else if (noteNode) {
    note = val(noteNode?.Note ?? noteNode) || '';
  }

  return {
    id:          val(line.ID) || null,
    name,
    item_code:   itemCode,
    quantity:    qty || null,
    unit,
    unit_price:  unitPrice || null,
    line_total:  lineTotal || null,
    tax_percent: taxPercent,
    tax_amount:  taxAmount || null,
    note:        note || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { invoiceId, documentId, type = 'inbox' } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });

  // Uyumsoft GetInboxInvoice/GetOutboxInvoice metodları için iç DocumentId kullanılır
  // (BLD2026... gibi fatura numaraları değil, Uyumsoft'un kendi UUID'si)
  const uyumsoftId = documentId || invoiceId;

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

    // 2) Uyumsoft'tan çek - DocumentId kullan (fatura numarası değil)
    console.log(`[get-invoice-detail] ${invoiceId} - Uyumsoft'tan çekiliyor. UyumsoftId: ${uyumsoftId} (type: ${type})`);
    const client = await createUyumsoftClient();
    const method = type === 'outbox' ? 'GetOutboxInvoice' : 'GetInboxInvoice';
    const result = await callSoap(client, method, { invoiceId: uyumsoftId });

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
