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
    currency = 'TRY', notes = '', type = 'outbox',
    exchange_rate = null
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
    message: notes,
    updated_at: new Date().toISOString()
  };
  // Döviz kuru varsa ekle
  if (exchange_rate && currency !== 'TRY') row.exchange_rate = exchange_rate;

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
    return res.status(400).json({ success: false, error: `Yalnızca taslak faturalar gönderilebilir (mevcut durum: ${inv.status})` });
  }

  const lines = inv.line_items || [];
  const subtotal = inv.tax_exclusive_amount || lines.reduce((s, l) => s + (l.line_total || 0), 0);
  const taxTotal = inv.tax_total || lines.reduce((s, l) => s + (l.tax_amount || 0), 0);
  const grandTotal = inv.amount || (subtotal + taxTotal);
  const currency = inv.currency || 'TRY';
  const issueDate = (inv.issue_date || new Date().toISOString()).slice(0, 10);

  // UBL birim kodu eşleme
  const unitMap = { 'Adet': 'C62', 'Kg': 'KGM', 'Ton': 'TNE', 'm²': 'MTK', 'm³': 'MTQ', 'Litre': 'LTR', 'Paket': 'PA', 'Kutu': 'BX', 'Takım': 'SET' };

  // KDV dökümü
  const vatGroups = {};
  lines.forEach(l => {
    const pct = l.tax_percent || 0;
    if (!vatGroups[pct]) vatGroups[pct] = { taxable: 0, tax: 0 };
    vatGroups[pct].taxable += (l.line_total || 0);
    vatGroups[pct].tax += (l.tax_amount || 0);
  });

  // UBL InvoiceLine[] oluştur
  const invoiceLines = lines.map((l, i) => ({
    ID: { $value: String(i + 1) },
    InvoicedQuantity: { $value: String(l.quantity || 1), attributes: { unitCode: unitMap[l.unit] || 'C62' } },
    LineExtensionAmount: { $value: String(l.line_total || 0), attributes: { currencyID: currency } },
    TaxTotal: {
      TaxAmount: { $value: String(l.tax_amount || 0), attributes: { currencyID: currency } },
      TaxSubtotal: {
        TaxableAmount: { $value: String(l.line_total || 0), attributes: { currencyID: currency } },
        TaxAmount: { $value: String(l.tax_amount || 0), attributes: { currencyID: currency } },
        Percent: String(l.tax_percent || 0),
        TaxCategory: {
          TaxScheme: { Name: 'KDV', TaxTypeCode: '0015' }
        }
      }
    },
    Item: { Name: l.name || '-' },
    Price: {
      PriceAmount: { $value: String(l.unit_price || 0), attributes: { currencyID: currency } }
    },
    AllowanceCharge: {
      ChargeIndicator: 'false',
      MultiplierFactorNumeric: '0',
      Amount: { $value: '0', attributes: { currencyID: currency } },
      BaseAmount: { $value: String(l.line_total || 0), attributes: { currencyID: currency } }
    }
  }));

  // TaxSubtotal[] — grouped by rate
  const taxSubtotals = Object.entries(vatGroups).map(([pct, v]) => ({
    TaxableAmount: { $value: String(v.taxable), attributes: { currencyID: currency } },
    TaxAmount: { $value: String(v.tax), attributes: { currencyID: currency } },
    Percent: String(pct),
    TaxCategory: {
      TaxScheme: { Name: 'KDV', TaxTypeCode: '0015' }
    }
  }));

  // UBL Invoice nesnesi
  const ublInvoice = {
    UBLVersionID: '2.1',
    CustomizationID: 'TR1.2.1',
    ProfileID: 'TEMELFATURA',
    ID: invoiceId,
    CopyIndicator: false,
    IssueDate: issueDate,
    IssueTime: '00:00:00',
    InvoiceTypeCode: 'SATIS',
    DocumentCurrencyCode: currency,
    LineCountNumeric: String(lines.length),
    AccountingSupplierParty: {
      Party: {
        PartyName: { Name: (process.env.COMPANY_NAME || process.env.VITE_COMPANY_NAME || 'AYS LED').replace(/^["']|["']$/g, '') },
        PartyIdentification: { ID: { $value: (process.env.COMPANY_VKN || process.env.VITE_COMPANY_VKN || '').replace(/^["']|["']$/g, ''), attributes: { schemeID: 'VKN' } } },
        PostalAddress: {
          CityName: (process.env.COMPANY_CITY || process.env.VITE_COMPANY_CITY || '').replace(/^["']|["']$/g, ''),
          Country: { Name: 'Türkiye' }
        },
        PartyTaxScheme: {
          TaxScheme: { Name: (process.env.COMPANY_TAX_OFFICE || process.env.VITE_COMPANY_TAX_OFFICE || '').replace(/^["']|["']$/g, '') }
        }
      }
    },
    AccountingCustomerParty: {
      Party: {
        PartyIdentification: { ID: { $value: inv.vkntckn || '', attributes: { schemeID: (inv.vkntckn || '').length === 11 ? 'TCKN' : 'VKN' } } },
        PartyName: { Name: inv.cari_name },
        PostalAddress: {
          CityName: '',
          Country: { Name: 'Türkiye' }
        },
        PartyTaxScheme: {
          TaxScheme: { Name: '' }
        }
      }
    },
    TaxTotal: {
      TaxAmount: { $value: String(taxTotal), attributes: { currencyID: currency } },
      TaxSubtotal: taxSubtotals
    },
    LegalMonetaryTotal: {
      LineExtensionAmount: { $value: String(subtotal), attributes: { currencyID: currency } },
      TaxExclusiveAmount: { $value: String(subtotal), attributes: { currencyID: currency } },
      TaxInclusiveAmount: { $value: String(grandTotal), attributes: { currencyID: currency } },
      PayableAmount: { $value: String(grandTotal), attributes: { currencyID: currency } }
    },
    InvoiceLine: invoiceLines
  };

  // Döviz ise PricingExchangeRate ekle
  if (currency !== 'TRY') {
    const exchangeRate = inv.exchange_rate || 1;
    ublInvoice.PricingCurrencyCode = { $value: currency };
    ublInvoice.TaxCurrencyCode = { $value: 'TRY' };
    ublInvoice.PricingExchangeRate = {
      SourceCurrencyCode: currency,
      TargetCurrencyCode: 'TRY',
      CalculationRate: String(exchangeRate),
      Date: issueDate
    };
  }

  try {
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'SaveAsDraft', {
      invoices: {
        InvoiceInfo: [{
          Invoice: ublInvoice,
          attributes: { LocalDocumentId: invoiceId }
        }]
      }
    });
    const r = result?.SaveAsDraftResult;
    const ok = String(r?.attributes?.IsSucceded ?? 'true').toLowerCase() !== 'false';

    if (!ok) {
      const msg = r?.attributes?.Message || JSON.stringify(r);
      const sentVkn = ublInvoice.AccountingSupplierParty?.Party?.PartyIdentification?.ID?.$value;
      const sentUser = process.env.UYUMSOFT_USERNAME || process.env.VITE_UYUMSOFT_USERNAME || 'Uyumsoft';
      return res.status(400).json({ 
        success: false, 
        error: msg, 
        debug: `Gönderilen VKN: "${sentVkn}", Kullanıcı: "${sentUser}"` 
      });
    }

    // Uyumsoft'un verdiği draft ID'yi kaydet
    const draftId = r?.Value?.[0]?.attributes?.Id || r?.Value?.attributes?.Id || null;
    const draftNumber = r?.Value?.[0]?.attributes?.Number || r?.Value?.attributes?.Number || null;

    await supabase.from('invoices').update({
      status: 'Queued',
      document_id: draftId || inv.document_id,
      uyumsoft_number: draftNumber,
      updated_at: new Date().toISOString()
    }).eq('invoice_id', invoiceId);

    return res.json({ success: true, message: 'Fatura Uyumsoft\'a taslak olarak gönderildi.', draftId, draftNumber });
  } catch (err) {
    console.error('[invoices-api][formalize]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * sendDraft — Uyumsoft'taki taslağı resmileştir (SendDraft)
 * Body: { invoiceId }
 */
async function handleSendDraft(body, res) {
  const { invoiceId } = body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });

  const { data: inv } = await supabase.from('invoices').select('document_id, status')
    .eq('invoice_id', invoiceId).single();
  if (!inv?.document_id) return res.status(400).json({ success: false, error: 'Uyumsoft draft ID bulunamadı. Önce taslak olarak gönderin.' });

  try {
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'SendDraft', {
      invoiceIds: { string: [inv.document_id] }
    });
    const r = result?.SendDraftResult;
    const ok = String(r?.attributes?.IsSucceded ?? 'true').toLowerCase() !== 'false';
    if (!ok) return res.status(400).json({ success: false, error: r?.attributes?.Message || 'Resmileştirme başarısız' });

    await supabase.from('invoices').update({ status: 'Sent', updated_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId);

    return res.json({ success: true, message: 'Fatura resmileştirildi ve gönderildi.' });
  } catch (err) {
    console.error('[invoices-api][sendDraft]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * cancelDraft — Uyumsoft'taki taslağı iptal et (CancelDraft)
 * Body: { invoiceId }
 */
async function handleCancelDraft(body, res) {
  const { invoiceId } = body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });

  const { data: inv } = await supabase.from('invoices').select('document_id')
    .eq('invoice_id', invoiceId).single();
  if (!inv?.document_id) return res.status(400).json({ success: false, error: 'Uyumsoft draft ID bulunamadı.' });

  try {
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'CancelDraft', {
      invoiceIds: { string: [inv.document_id] }
    });
    const r = result?.CancelDraftResult;
    const ok = String(r?.attributes?.IsSucceded ?? 'true').toLowerCase() !== 'false';
    if (!ok) return res.status(400).json({ success: false, error: r?.attributes?.Message || 'İptal başarısız' });

    await supabase.from('invoices').update({ status: 'Cancelled', updated_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId);

    return res.json({ success: true, message: 'Taslak iptal edildi.' });
  } catch (err) {
    console.error('[invoices-api][cancelDraft]', err.message);
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
      case 'list':        return await handleList(req.body || {}, res);
      case 'detail':      return await handleDetail(req.body || {}, res);
      case 'view':        return await handleView(req.body || {}, res);
      case 'url':         return await handleUrl(req.body || {}, res);
      case 'create':      return await handleCreate(req.body || {}, res);
      case 'formalize':   return await handleFormalize(req.body || {}, res);
      case 'sendDraft':   return await handleSendDraft(req.body || {}, res);
      case 'cancelDraft': return await handleCancelDraft(req.body || {}, res);
      default:            return res.status(400).json({ error: `Bilinmeyen action: ${action}. list|detail|view|url|create|formalize|sendDraft|cancelDraft` });
    }
  } catch (err) {
    console.error(`[invoices-api][${action}]`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
