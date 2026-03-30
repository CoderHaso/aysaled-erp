/**
 * /api/invoices-api.js
 * Tüm Uyumsoft fatura endpoint'lerini tek serverless function'da toplar.
 * Vercel Hobby limiti aşımını önler (max 12 fonksiyon).
 *
 * POST /api/invoices-api?action=list       → fatura listesi
 * POST /api/invoices-api?action=detail     → fatura detay
 * POST /api/invoices-api?action=view       → HTML/PDF görünüm
 * POST /api/invoices-api?action=url        → belge URL
 * POST /api/invoices-api?action=create     → manuel fatura oluştur (Supabase'e kaydet)
 * POST /api/invoices-api?action=formalize  → taslak faturayı Uyumsoft'a gönder (SaveAsDraft)
 */

import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL  || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
);

// ── Helpers (get-invoice-detail'den taşındı) ────────────────────────────────
function normalizeLines(lines) {
  if (!lines) return [];
  if (Array.isArray(lines)) return lines;
  if (typeof lines === 'object') return [lines];
  return [];
}
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
  const ac = (() => {
    const raw = line.AllowanceCharge || line['AllowanceCharge[]'];
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return list.find(a => {
      const ci = val(a?.ChargeIndicator ?? a?.['cbc:ChargeIndicator']);
      return ci === 'false' || ci === false;
    }) || null;
  })();
  const discountRate   = ac ? numVal(ac.MultiplierFactorNumeric ?? ac['cbc:MultiplierFactorNumeric']) : null;
  const discountAmount = ac ? numVal(ac.Amount ?? ac['cbc:Amount']) : null;
  return {
    id: val(line.ID) || null, name, item_code: itemCode,
    quantity: qty || null, unit, unit_price: unitPrice || null,
    line_total: lineTotal || null, tax_percent: taxPercent, tax_amount: taxAmount || null,
    discount_rate: discountRate, discount_amount: discountAmount, note: note || null,
  };
}

// ── Action handlers ─────────────────────────────────────────────────────────

async function handleList(body, res) {
  const { pageIndex = 0, pageSize = 20, startDate, endDate, status = 'Approved', type = 'inbox' } = body;
  const args = {
    query: {
      attributes: { PageIndex: pageIndex, PageSize: pageSize },
      CreateStartDate: startDate || '2026-01-01T00:00:00',
      CreateEndDate: endDate || new Date().toISOString().split('.')[0],
      Status: status,
      IsArchived: false,
    },
  };
  const client = await createUyumsoftClient();
  const methodName = type === 'outbox' ? 'GetOutboxInvoiceList' : 'GetInboxInvoiceList';
  const result = await callSoap(client, methodName, args);
  return res.json({ success: true, data: result });
}

async function handleDetail(body, res) {
  const { invoiceId, documentId, type = 'inbox' } = body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });
  const uyumsoftId = documentId || invoiceId;

  // Cache check
  const { data: cached } = await supabase
    .from('invoices').select('line_items, raw_detail')
    .eq('invoice_id', invoiceId).eq('type', type).single();
  if (cached?.line_items?.length > 0) {
    return res.json({ success: true, source: 'cache', line_items: cached.line_items, raw_detail: cached.raw_detail });
  }

  const client = await createUyumsoftClient();
  const method = type === 'outbox' ? 'GetOutboxInvoice' : 'GetInboxInvoice';
  const result = await callSoap(client, method, { invoiceId: uyumsoftId });
  const resultKey = type === 'outbox' ? 'GetOutboxInvoiceResult' : 'GetInboxInvoiceResult';
  const resultObj = result?.[resultKey];
  const invoice = resultObj?.Value?.Invoice || resultObj?.Value?.invoice || resultObj?.Value || null;
  if (!invoice) return res.status(404).json({ success: false, error: 'Fatura detayı bulunamadı.' });

  const rawLines = invoice['InvoiceLine[]'] || invoice.InvoiceLine || [];
  const line_items = normalizeLines(rawLines).map(parseLine).filter(l => l.name !== '-' || l.quantity > 0);

  await supabase.from('invoices').update({ line_items, raw_detail: invoice, updated_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId).eq('type', type);

  // Contact zenginleştirme
  try {
    const partyNode = type === 'inbox'
      ? (invoice.AccountingSupplierParty || invoice['cac:AccountingSupplierParty'])
      : (invoice.AccountingCustomerParty || invoice['cac:AccountingCustomerParty']);
    const party = partyNode?.Party || partyNode?.['cac:Party'] || partyNode;
    const partyName = val(party?.PartyName?.Name ?? party?.['cac:PartyName']?.['cbc:Name']) || '';
    const taxScheme = party?.PartyTaxScheme || party?.['cac:PartyTaxScheme'];
    const vkn = val(taxScheme?.CompanyID ?? taxScheme?.['cbc:CompanyID']) || '';
    const addrNode = party?.PostalAddress || party?.['cac:PostalAddress'] || party?.Address || party?.['cac:Address'];
    const street  = val(addrNode?.StreetName ?? addrNode?.['cbc:StreetName']) || '';
    const cityName = val(addrNode?.CityName ?? addrNode?.['cbc:CityName']) || '';
    const postal  = val(addrNode?.PostalZone ?? addrNode?.['cbc:PostalZone']) || '';
    const taxOfficeName = val(taxScheme?.RegistrationName ?? taxScheme?.['cbc:RegistrationName']) || '';
    const contactNode = party?.Contact || party?.['cac:Contact'];
    const phone = val(contactNode?.Telephone ?? contactNode?.['cbc:Telephone']) || '';
    const email = val(contactNode?.ElectronicMail ?? contactNode?.['cbc:ElectronicMail']) || '';
    if (vkn) {
      // inbox = bize gelen fatura → tedarikçi; outbox = bizim kestiğimiz → müşteri
      const table = type === 'inbox' ? 'suppliers' : 'customers';
      const cd = { vkntckn: vkn, name: partyName || 'Bilinmiyor', source: 'invoice_sync', updated_at: new Date().toISOString() };
      if (phone) cd.phone = phone;
      if (email) cd.email = email;
      if (street) cd.address = street;
      if (cityName) cd.city = cityName;
      if (postal) cd.postal_code = postal;
      if (taxOfficeName) cd.tax_office = taxOfficeName;
      await supabase.from(table).upsert(cd, { onConflict: 'vkntckn', ignoreDuplicates: false });
    }
  } catch (_) { /* contact sync opsiyonel */ }

  return res.json({ success: true, source: 'api', line_items, raw_detail: invoice });
}

async function handleView(body, res) {
  const { invoiceId, documentId, type = 'outbox', format = 'html' } = body;
  const uyumsoftId = documentId || invoiceId;
  if (!uyumsoftId) return res.status(400).json({ error: 'invoiceId veya documentId gerekli' });

  if (format === 'html' && invoiceId) {
    const { data: cached } = await supabase.from('invoices').select('html_view')
      .eq('invoice_id', invoiceId).eq('type', type).single();
    if (cached?.html_view) return res.json({ success: true, html: cached.html_view, source: 'cache' });
  }

  const client = await createUyumsoftClient();
  if (format === 'pdf') {
    const method    = type === 'inbox' ? 'GetInboxInvoicePdf' : 'GetOutboxInvoicePdf';
    const resultKey = type === 'inbox' ? 'GetInboxInvoicePdfResult' : 'GetOutboxInvoicePdfResult';
    const result = await callSoap(client, method, { invoiceId: uyumsoftId });
    const r = result?.[resultKey];
    const ok = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';
    if (!ok) return res.status(400).json({ success: false, error: r?.attributes?.Message || 'PDF alınamadı' });
    const pdfBase64 = r?.Value?.Data || '';
    if (!pdfBase64) return res.status(404).json({ success: false, error: 'PDF verisi boş geldi' });
    return res.json({ success: true, pdfBase64, format: 'pdf' });
  } else {
    const method    = type === 'inbox' ? 'GetInboxInvoiceView' : 'GetOutboxInvoiceView';
    const resultKey = type === 'inbox' ? 'GetInboxInvoiceViewResult' : 'GetOutboxInvoiceViewResult';
    const result = await callSoap(client, method, { invoiceId: uyumsoftId });
    const r = result?.[resultKey];
    const ok = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';
    if (!ok) return res.status(400).json({ success: false, error: r?.attributes?.Message || 'HTML görünümü alınamadı' });
    const html = r?.Value?.Html || '';
    if (!html) return res.status(404).json({ success: false, error: 'HTML içeriği boş geldi' });
    if (invoiceId) {
      await supabase.from('invoices').update({ html_view: html, updated_at: new Date().toISOString() })
        .eq('invoice_id', invoiceId).eq('type', type);
    }
    return res.json({ success: true, html, source: 'api' });
  }
}

async function handleUrl(body, res) {
  const { documentId, documentType = 'OutboxInvoice', fileType = 'Html' } = body;
  if (!documentId) return res.status(400).json({ error: 'documentId gerekli' });
  const client = await createUyumsoftClient();
  const result = await callSoap(client, 'GenerateDocumentUrl', {
    documentAccessInfo: { DocumentId: documentId, DocumentType: documentType, AllowedFileTypes: 'Html', FileType: fileType },
  });
  const r = result?.GenerateDocumentUrlResult;
  const ok = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';
  if (!ok) return res.status(400).json({ success: false, error: r?.attributes?.Message || 'URL üretilemedi' });
  const url = r?.attributes?.Message || r?.Message || '';
  return res.json({ success: true, url, fileType });
}

/**
 * create — Manuel fatura oluştur (Supabase'e kaydet, type='outbox')
 * Body: { cari_name, vkntckn, issue_date, lines[], currency, notes }
 */
async function handleCreate(body, res) {
  const {
    cari_name, vkntckn = '', issue_date, lines = [],
    currency = 'TRY', notes = '', type = 'outbox'
  } = body;

  if (!cari_name) return res.status(400).json({ error: 'cari_name zorunlu' });
  if (!lines.length) return res.status(400).json({ error: 'En az 1 kalem gerekli' });

  const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const taxTotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * (l.taxRate || 0) / 100, 0);
  const grandTotal = subtotal + taxTotal;

  // Otomatik fatura no: MNL-YYYY-NNN
  const year = new Date().getFullYear();
  const { data: last } = await supabase.from('invoices')
    .select('invoice_id').ilike('invoice_id', `MNL-${year}-%`)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  let seq = 1;
  if (last?.invoice_id) {
    const parts = last.invoice_id.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  const invoice_id = `MNL-${year}-${String(seq).padStart(3, '0')}`;

  const lineItems = lines.map((l, i) => ({
    id: String(i + 1), name: l.name, item_code: l.item_code || null,
    quantity: l.quantity, unit: l.unit || 'Adet',
    unit_price: l.unitPrice, tax_percent: l.taxRate || 0,
    tax_amount: (l.quantity || 0) * (l.unitPrice || 0) * (l.taxRate || 0) / 100,
    line_total: (l.quantity || 0) * (l.unitPrice || 0),
  }));

  const row = {
    type, invoice_id, vkntckn, cari_name,
    issue_date: issue_date || new Date().toISOString().slice(0, 10),
    amount: grandTotal, tax_exclusive_amount: subtotal, tax_total: taxTotal,
    currency, status: 'Draft', line_items: lineItems,
    message: notes, source: 'manual',
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('invoices').insert(row);
  if (error) return res.status(500).json({ success: false, error: error.message });
  return res.json({ success: true, invoice_id });
}

/**
 * formalize — Taslak (Draft) faturayı Uyumsoft'a SaveAsDraft ile gönder
 * Body: { invoiceId } — Supabase'deki invoice_id
 */
async function handleFormalize(body, res) {
  const { invoiceId } = body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });

  // Faturayı Supabase'den al
  const { data: inv, error: fetchErr } = await supabase
    .from('invoices').select('*').eq('invoice_id', invoiceId).single();
  if (fetchErr || !inv) return res.status(404).json({ success: false, error: 'Fatura bulunamadı' });

  if (inv.status !== 'Draft') {
    return res.status(400).json({ success: false, error: `Yalnızca taslak faturalar resmileştirilebilir (mevcut durum: ${inv.status})` });
  }

  // Uyumsoft SaveAsDraft çağrısı için basit UBL-benzeri yapı (Uyumsoft kendi XML'e dönüştürür)
  const invoiceData = {
    InvoiceId: inv.invoice_id,
    TargetTitle: inv.cari_name,
    TargetTcknVkn: inv.vkntckn || '',
    DocumentCurrencyCode: inv.currency || 'TRY',
    ExecutionDate: inv.issue_date,
    PayableAmount: inv.amount,
    TaxExclusiveAmount: inv.tax_exclusive_amount,
    TaxTotal: inv.tax_total,
    Lines: (inv.line_items || []).map(l => ({
      Name: l.name, Quantity: l.quantity, UnitCode: l.unit || 'C62',
      UnitPrice: l.unit_price, LineExtensionAmount: l.line_total,
      TaxPercent: l.tax_percent || 0, TaxAmount: l.tax_amount || 0,
    }))
  };

  try {
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'SaveAsDraft', { invoices: [invoiceData] });
    const r = result?.SaveAsDraftResult;
    const ok = String(r?.attributes?.IsSucceded ?? 'true').toLowerCase() !== 'false';

    if (!ok) {
      const msg = r?.attributes?.Message || JSON.stringify(r);
      return res.status(400).json({ success: false, error: msg });
    }

    // Durum güncelle
    await supabase.from('invoices').update({ status: 'Queued', updated_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId);

    return res.json({ success: true, message: 'Fatura Uyumsoft kuyruğuna alındı.' });
  } catch (err) {
    console.error('[invoices-api][formalize]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action || req.body?.action;

  try {
    switch (action) {
      case 'list':      return await handleList(req.body || {}, res);
      case 'detail':    return await handleDetail(req.body || {}, res);
      case 'view':      return await handleView(req.body || {}, res);
      case 'url':       return await handleUrl(req.body || {}, res);
      case 'create':    return await handleCreate(req.body || {}, res);
      case 'formalize': return await handleFormalize(req.body || {}, res);
      default:          return res.status(400).json({ error: `Bilinmeyen action: ${action}. list|detail|view|url|create|formalize` });
    }
  } catch (err) {
    console.error(`[invoices-api][${action}]`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
