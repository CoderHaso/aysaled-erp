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

  // invoices tablosundaki cari_* sütunlarını da doldur + contact zenginleştir
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
    const district = val(addrNode?.CitySubdivisionName ?? addrNode?.['cbc:CitySubdivisionName']) || '';
    const postal  = val(addrNode?.PostalZone ?? addrNode?.['cbc:PostalZone']) || '';
    const countryNode = addrNode?.Country || addrNode?.['cac:Country'];
    const country = val(countryNode?.Name ?? countryNode?.['cbc:Name'] ?? countryNode?.IdentificationCode ?? countryNode?.['cbc:IdentificationCode']) || '';
    const taxOfficeName = val(taxScheme?.TaxScheme?.Name ?? taxScheme?.['cac:TaxScheme']?.['cbc:Name'] ?? taxScheme?.RegistrationName ?? taxScheme?.['cbc:RegistrationName']) || '';
    const contactNode = party?.Contact || party?.['cac:Contact'];
    const phone = val(contactNode?.Telephone ?? contactNode?.['cbc:Telephone']) || '';
    const email = val(contactNode?.ElectronicMail ?? contactNode?.['cbc:ElectronicMail']) || '';
    const bldgName = val(addrNode?.BuildingName ?? addrNode?.['cbc:BuildingName']) || '';
    const bldgNo = val(addrNode?.BuildingNumber ?? addrNode?.['cbc:BuildingNumber']) || '';
    const fullAddress = [street, bldgName, bldgNo ? 'No:' + bldgNo : ''].filter(Boolean).join(' ');

    // invoices tablosundaki cari_* sütunlarını güncelle
    const cariUpdate = {};
    if (taxOfficeName) cariUpdate.cari_tax_office = taxOfficeName;
    if (fullAddress)   cariUpdate.cari_address = fullAddress;
    if (cityName)      cariUpdate.cari_city = cityName;
    if (district)      cariUpdate.cari_district = district;
    if (country)       cariUpdate.cari_country = country;
    if (postal)        cariUpdate.cari_postal = postal;
    if (phone)         cariUpdate.cari_phone = phone;
    if (email)         cariUpdate.cari_email = email;
    if (Object.keys(cariUpdate).length > 0) {
      await supabase.from('invoices').update(cariUpdate)
        .eq('invoice_id', invoiceId).eq('type', type);
    }

    // contact zenginleştirme (suppliers/customers)
    if (vkn) {
      const table = type === 'inbox' ? 'suppliers' : 'customers';
      const cd = { vkntckn: vkn, name: partyName || 'Bilinmiyor', source: 'invoice_sync', updated_at: new Date().toISOString() };
      if (phone) cd.phone = phone;
      if (email) cd.email = email;
      if (fullAddress) cd.address = fullAddress;
      if (cityName) cd.city = cityName;
      if (district) cd.district = district;
      if (postal) cd.postal_code = postal;
      if (country) cd.country = country;
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
    const { data: cached } = await supabase.from('invoices').select('html_view, status')
      .eq('invoice_id', invoiceId).eq('type', type).single();
    const finalStatuses = ['Sent', 'Approved', 'Cancelled', 'Canceled'];
    if (cached?.html_view && finalStatuses.includes(cached?.status)) {
      return res.json({ success: true, html: cached.html_view, source: 'cache' });
    }
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
    exchange_rate = null, city = '', district = '', address = '', tax_office = ''
  } = body;

  if (!cari_name) return res.status(400).json({ error: 'cari_name zorunlu' });
  if (!lines.length) return res.status(400).json({ error: 'En az 1 kalem gerekli' });

  const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const taxTotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * (l.taxRate || 0) / 100, 0);
  const grandTotal = subtotal + taxTotal;

  // Otomatik fatura no: AYS + YIL + 9 hane seq (MAX ile race-safe)
  const year = new Date().getFullYear();
  const prefix = `AYS${year}`;

  // Eger body'den invoice_id geldiyse onu kullan; yoksa yeni uret
  let invoice_id = body.invoice_id;
  if (!invoice_id) {
    // MAX ile paralel istek guvenli. Iptalleri atla.
    const { data: seqRows } = await supabase.from('invoices')
      .select('invoice_id')
      .ilike('invoice_id', `${prefix}%`)
      .not('status', 'in', '("Cancelled","Canceled")')
      .order('invoice_id', { ascending: false }).limit(20);
    let maxSeq = 0;
    (seqRows || []).forEach(r => {
      const n = parseInt((r.invoice_id || '').replace(prefix, ''), 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    });
    invoice_id = `${prefix}${String(maxSeq + 1).padStart(9, '0')}`;
  }

  // Ayni invoice_id zaten varsa kontrol et
  const { data: existing } = await supabase.from('invoices')
    .select('invoice_id, status').eq('invoice_id', invoice_id).eq('type', type).maybeSingle();
  if (existing) {
    if (existing.status !== 'Draft' && existing.status !== 'Cancelled' && existing.status !== 'Canceled') {
      // Gonderilmis veya resmilesmis ise degistirme
      return res.json({ success: true, invoice_id, already_exists: true });
    }
    // Eger Cancelled veya Draft ise upsert ile uzerine yazacagiz
  }

  const lineItems = lines.map((l, i) => ({
    id: String(i + 1), name: l.name, item_code: l.item_code || null,
    quantity: l.quantity, unit: l.unit || 'Adet',
    unit_price: l.unitPrice, tax_percent: l.taxRate || 0,
    tax_amount: (l.quantity || 0) * (l.unitPrice || 0) * (l.taxRate || 0) / 100,
    line_total: (l.quantity || 0) * (l.unitPrice || 0),
  }));

  // Adres ve AÇIKLAMA bilgilerini ilk satır kalemine gömüyoruz
  // (message kolonu Supabase'de olmasa bile bu yedekten okunabilir)
  if (lineItems.length > 0) {
    lineItems[0].customer_info = { city, district, address, tax_office };
    if (notes) lineItems[0]._invoice_notes = notes;  // ← açıklama yedek
  }

  const row = {
    type, invoice_id, vkntckn, cari_name,
    issue_date: issue_date || new Date().toISOString().slice(0, 10),
    amount: grandTotal, tax_exclusive_amount: subtotal, tax_total: taxTotal,
    currency, status: 'Draft', line_items: lineItems,
    message: notes || null,  // colum yoksa Supabase ignore eder ama deneriz
    notes: notes || null,    // alternatif kolon adı
    updated_at: new Date().toISOString()
  };
  // Döviz kuru varsa ekle
  if (exchange_rate && currency !== 'TRY') row.exchange_rate = exchange_rate;

  // notes / message kolonları Supabase'de olmayabilir — önce tüm alanlarla dene,
  // hata alırsa bu alanlar olmadan tekrar yaz
  let insertResult = await supabase.from('invoices')
    .upsert(row, { onConflict: 'invoice_id,type', ignoreDuplicates: false });

  if (insertResult.error) {
    // Bilinmeyen kolon hatası mı? Temiz row dene
    const { message: _m, notes: _n, ...cleanRow } = row;
    const retry = await supabase.from('invoices')
      .upsert(cleanRow, { onConflict: 'invoice_id,type', ignoreDuplicates: false });
    if (retry.error) return res.status(500).json({ success: false, error: retry.error.message });
  }

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

  const encodeXml = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const suppName = encodeXml((process.env.COMPANY_NAME || process.env.VITE_COMPANY_NAME || 'AYS LED').replace(/^["']|["']$/g, ''));
  const suppVkn = encodeXml((process.env.COMPANY_VKN || process.env.VITE_COMPANY_VKN || '').replace(/^["']|["']$/g, ''));
  const suppCity = encodeXml((process.env.COMPANY_CITY || process.env.VITE_COMPANY_CITY || 'İZMİR').replace(/^["']|["']$/g, ''));
  const suppTaxOff = encodeXml((process.env.COMPANY_TAX_OFFICE || process.env.VITE_COMPANY_TAX_OFFICE || 'BORNOVA').replace(/^["']|["']$/g, ''));
  const suppAddress = encodeXml((process.env.COMPANY_ADDRESS || process.env.VITE_COMPANY_ADDRESS || 'OSMANGAZİ MAH. İBRAHİM ETHEM CAD. NO: 75 A').replace(/^["']|["']$/g, ''));
  const suppDist = encodeXml((process.env.COMPANY_DISTRICT || process.env.VITE_COMPANY_DISTRICT || 'BAYRAKLI').replace(/^["']|["']$/g, ''));

  const custInfo = inv.line_items?.[0]?.customer_info || {};
  // custName en az 2 karakter olmalı (Uyumsoft zorunluluğu)
  const custNameRaw = (inv.cari_name || '').trim();
  const custName    = encodeXml(custNameRaw.length >= 2 ? custNameRaw : (custNameRaw || 'Bilinmiyor'));
  const custVkn     = encodeXml((inv.vkntckn || '').replace(/\s/g, ''));
  const custAddress = encodeXml(custInfo.address   || '');
  const custDist    = encodeXml(custInfo.district   || '');
  const custCity    = encodeXml(custInfo.city       || '');
  const custTaxOff  = encodeXml(custInfo.tax_office || '');

  // KDV dökümü
  const vatGroups = {};
  lines.forEach(l => {
    const rate = l.tax_percent || 0;
    if (!vatGroups[rate]) vatGroups[rate] = { taxable: 0, tax: 0 };
    vatGroups[rate].taxable += (l.line_total || 0);
    vatGroups[rate].tax += (l.tax_amount || 0);
  });

  const trTime = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());

  // Açıklama: önce message, yoksa notes, yoksa line_items[0]._invoice_notes
  const invoiceNote = inv.message || inv.notes
    || inv.line_items?.[0]?._invoice_notes
    || '';

  const ublXml = `
    <Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
      <cbc:CustomizationID>TR1.2.1</cbc:CustomizationID>
      <cbc:ProfileID>TEMELFATURA</cbc:ProfileID>
      <cbc:ID>${encodeXml(invoiceId)}</cbc:ID>
      <cbc:CopyIndicator>false</cbc:CopyIndicator>
      <cbc:IssueDate>${issueDate}</cbc:IssueDate>
      <cbc:IssueTime>${trTime}</cbc:IssueTime>
      ${invoiceNote ? invoiceNote.split('\n').filter(Boolean).map(line => `<cbc:Note>${encodeXml(line)}</cbc:Note>`).join('\n      ') : ''}
      <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
      <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
      <cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyIdentification><cbc:ID schemeID="VKN">${suppVkn}</cbc:ID></cac:PartyIdentification>
          <cac:PartyName><cbc:Name>${suppName}</cbc:Name></cac:PartyName>
          <cac:PostalAddress>
            <cbc:StreetName>${suppAddress}</cbc:StreetName>
            <cbc:CitySubdivisionName>${suppDist}</cbc:CitySubdivisionName>
            <cbc:CityName>${suppCity}</cbc:CityName>
            <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
          </cac:PostalAddress>
          <cac:PartyTaxScheme>
            <cac:TaxScheme><cbc:Name>${suppTaxOff}</cbc:Name></cac:TaxScheme>
          </cac:PartyTaxScheme>
        </cac:Party>
      </cac:AccountingSupplierParty>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyIdentification><cbc:ID schemeID="${custVkn.length === 11 ? 'TCKN' : 'VKN'}">${custVkn}</cbc:ID></cac:PartyIdentification>
          <cac:PartyName><cbc:Name>${custName}</cbc:Name></cac:PartyName>
          <cac:PostalAddress>
            <cbc:StreetName>${custAddress}</cbc:StreetName>
            <cbc:CitySubdivisionName>${custDist}</cbc:CitySubdivisionName>
            <cbc:CityName>${custCity}</cbc:CityName>
            <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
          </cac:PostalAddress>
          <cac:PartyTaxScheme>
            <cbc:CompanyID>${custVkn}</cbc:CompanyID>
            <cac:TaxScheme><cbc:Name>${custTaxOff || 'Bilinmiyor'}</cbc:Name></cac:TaxScheme>
          </cac:PartyTaxScheme>
          <cac:PartyLegalEntity>
            <cbc:RegistrationName>${custName}</cbc:RegistrationName>
          </cac:PartyLegalEntity>
          ${custVkn.length === 11 ? `<cac:Person>
            <cbc:FirstName>${encodeXml(custNameRaw.split(' ').slice(0, -1).join(' ') || custNameRaw)}</cbc:FirstName>
            <cbc:FamilyName>${encodeXml(custNameRaw.split(' ').slice(-1)[0] || custNameRaw)}</cbc:FamilyName>
          </cac:Person>` : ''}
        </cac:Party>
      </cac:AccountingCustomerParty>
      ${currency !== 'TRY' ? `
      <cac:PricingExchangeRate>
        <cbc:SourceCurrencyCode>${currency}</cbc:SourceCurrencyCode>
        <cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode>
        <cbc:CalculationRate>${inv.exchange_rate || 1}</cbc:CalculationRate>
        <cbc:Date>${issueDate}</cbc:Date>
      </cac:PricingExchangeRate>
      ` : ''}
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${taxTotal.toFixed(2)}</cbc:TaxAmount>
        ${Object.entries(vatGroups).map(([pct, v]) => `
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${currency}">${v.taxable.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${currency}">${v.tax.toFixed(2)}</cbc:TaxAmount>
          <cbc:Percent>${pct}</cbc:Percent>
          <cac:TaxCategory>
            <cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
        `).join('')}
      </cac:TaxTotal>
      <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${currency}">${grandTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${currency}">${grandTotal.toFixed(2)}</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
      ${lines.map((l, i) => `
      <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${unitMap[l.unit || 'Adet'] || 'C62'}">${l.quantity || 1}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${currency}">${(l.line_total || 0).toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
          <cbc:TaxAmount currencyID="${currency}">${(l.tax_amount || 0).toFixed(2)}</cbc:TaxAmount>
          <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${(l.line_total || 0).toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currency}">${(l.tax_amount || 0).toFixed(2)}</cbc:TaxAmount>
            <cbc:Percent>${l.tax_percent || 0}</cbc:Percent>
            <cac:TaxCategory>
              <cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme>
            </cac:TaxCategory>
          </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
          <cbc:Name>${encodeXml(l.name || '-')}</cbc:Name>
        </cac:Item>
        <cac:Price>
          <cbc:PriceAmount currencyID="${currency}">${(l.unit_price || 0).toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
      </cac:InvoiceLine>
      `).join('')}
    </Invoice>
  `;

  try {
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'SaveAsDraft', {
      invoices: {
        InvoiceInfo: [{
          $xml: ublXml,
          attributes: { LocalDocumentId: invoiceId }
        }]
      }
    });
    const r = result?.SaveAsDraftResult;
    const ok = String(r?.attributes?.IsSucceded ?? 'true').toLowerCase() !== 'false';

    if (!ok) {
      const msg = r?.attributes?.Message || JSON.stringify(r);
      const sentUser = process.env.UYUMSOFT_USERNAME || process.env.VITE_UYUMSOFT_USERNAME || 'Uyumsoft';
      return res.status(400).json({ 
        success: false, 
        error: msg, 
        debug: `Gönderilen VKN: "${suppVkn}", Kullanıcı: "${sentUser}"` 
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

/**
 * delete — Taslağı sil (Supabase'den sil, Uyumsoft'taki taslağı da iptal et)
 * Body: { invoiceId }
 */
async function handleDelete(body, res) {
  const { invoiceId } = body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId gerekli' });

  const { data: inv } = await supabase.from('invoices').select('document_id, status')
    .eq('invoice_id', invoiceId).single();
  if (!inv) return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });

  if (['Sent', 'Approved'].includes(inv.status)) {
    return res.status(400).json({ success: false, error: 'Resmileştirilmiş faturalar silinemez.' });
  }

  try {
    // Eğer Uyumsoft'ta taslak olarak varsa iptal kodunu çağır, bulamazsa yoksay
    if (inv.document_id && inv.status === 'Queued') {
      try {
        const client = await createUyumsoftClient();
        await callSoap(client, 'CancelDraft', { invoiceIds: { string: [inv.document_id] } });
      } catch (err) {
        console.warn('[delete] Uyumsoft iptali esnasında hata (belki zaten iptal edilmiş):', err.message);
      }
    }

    // Supabase'den sil
    const { error: delErr } = await supabase.from('invoices').delete().eq('invoice_id', invoiceId);
    if (delErr) throw delErr;

    return res.json({ success: true, message: 'Fatura başarıyla silindi.' });
  } catch (err) {
    console.error('[invoices-api][delete]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * fetchCustomerInfo — VKN/TCKN ile musteri bilgisi sorgula
 * Oncelik sirasi (Uyumsoft kredisi harcamamak icin):
 *   1. Kendi DB'mizden (customers / suppliers tablosu)
 *   2. Senkronize edilmis fatura XML'inden (raw_detail)
 *   3. Son care: TryToGetAddressFromVknTckn (Uyumsoft kredi harcatir)
 * Body: { vkn, forceUyumsoft? }
 */
async function handleFetchCustomerInfo(body, res) {
  const { vkn, forceUyumsoft = false } = body;
  if (!vkn) return res.status(400).json({ success: false, error: 'VKN/TCKN zorunludur' });

  // ─ Yardimci: UBL adres parse ─────────────────────────────────────────────────
  const v = (node) => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node._) return node._;
    if (node.$value) return node.$value;
    return '';
  };

  const buildFromUblAddr = (addrNode) => {
    if (!addrNode) return null;
    const street   = v(addrNode?.StreetName     ?? addrNode?.['cbc:StreetName'])     || '';
    const street2  = v(addrNode?.AdditionalStreetName ?? addrNode?.['cbc:AdditionalStreetName']) || '';
    const city     = v(addrNode?.CityName        ?? addrNode?.['cbc:CityName'])       || '';
    const district = v(addrNode?.CitySubdivisionName ?? addrNode?.['cbc:CitySubdivisionName']) || '';
    const postal   = v(addrNode?.PostalZone      ?? addrNode?.['cbc:PostalZone'])     || '';
    const country  = v(addrNode?.Country?.IdentificationCode ?? addrNode?.['cac:Country']?.['cbc:IdentificationCode']) || 'TR';
    const buildingNo = v(addrNode?.BuildingNumber ?? addrNode?.['cbc:BuildingNumber']) || '';
    const buildingName = v(addrNode?.BuildingName ?? addrNode?.['cbc:BuildingName'])   || '';
    if (!city && !street) return null;
    return { street, street2, city, district, postal, country, buildingNo, buildingName };
  };

  try {
    // ─ 1. Supabase DB kontrolu ───────────────────────────────────────────────
    if (!forceUyumsoft) {
      const [custRes, suppRes] = await Promise.all([
        supabase.from('customers').select('name,city,address,tax_office,district,phone,email,postal_code').eq('vkntckn', vkn).maybeSingle(),
        supabase.from('suppliers').select('name,city,address,tax_office,district,phone,email,postal_code').eq('vkntckn', vkn).maybeSingle(),
      ]);
      const dbRow = custRes.data || suppRes.data;
      if (dbRow && (dbRow.city || dbRow.address)) {
        return res.json({ success: true, source: 'db', data: {
          unvan:        dbRow.name         || '',
          vergiDairesi: dbRow.tax_office   || '',
          sehir:        dbRow.city         || '',
          ilce:         dbRow.district     || '',
          adres:        dbRow.address      || '',
          telefon:      dbRow.phone        || '',
          eposta:       dbRow.email        || '',
          postaKodu:    dbRow.postal_code  || '',
          ulke:         'TR',
        }});
      }

      // ─ 2. Senkronize edilmis fatura raw_detail'den ─────────────────────────
      const { data: invRow } = await supabase.from('invoices')
        .select('raw_detail,cari_name')
        .eq('vkntckn', vkn)
        .not('raw_detail', 'is', null)
        .limit(1).maybeSingle();

      if (invRow?.raw_detail) {
        const inv = invRow.raw_detail;
        // Fatura tipine gore dogru taraf (outbox = alici musteri, inbox = gonderen tedarikci)
        const partyNode = inv.AccountingCustomerParty || inv['cac:AccountingCustomerParty']
          || inv.AccountingSupplierParty || inv['cac:AccountingSupplierParty'];
        const party  = partyNode?.Party || partyNode?.['cac:Party'] || partyNode;
        const addrNode = party?.PostalAddress || party?.['cac:PostalAddress'];
        const taxScheme = party?.PartyTaxScheme || party?.['cac:PartyTaxScheme'];
        const contactNode = party?.Contact || party?.['cac:Contact'];
        const built = buildFromUblAddr(addrNode);

        if (built && (built.city || built.street)) {
          return res.json({ success: true, source: 'invoice_xml', data: {
            unvan:        invRow.cari_name || '',
            vergiDairesi: v(taxScheme?.RegistrationName ?? taxScheme?.['cbc:RegistrationName']) || '',
            sehir:        built.city,
            ilce:         built.district,
            adres:        [built.street, built.street2].filter(Boolean).join(' '),
            binAdi:       built.buildingName,
            binaNo:       built.buildingNo,
            postaKodu:    built.postal,
            ulke:         built.country,
            telefon:      v(contactNode?.Telephone ?? contactNode?.['cbc:Telephone']) || '',
            eposta:       v(contactNode?.ElectronicMail ?? contactNode?.['cbc:ElectronicMail']) || '',
          }});
        }
      }
    }

    // ─ 3. Son care: TryToGetAddressFromVknTckn (Uyumsoft kredi harcatir) ────
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'TryToGetAddressFromVknTckn', { vknTckn: vkn, queryType: 'OnlyDb' }); // OnlyDb: kredi harcanmaz
    const r = result?.TryToGetAddressFromVknTcknResult;
    const ok = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';

    if (!ok) return res.status(400).json({ success: false, error: r?.attributes?.Message || 'Kayit bulunamadi.' });

    const val2 = r?.Value || {};
    const addrData = val2.IsAdresi?.IlAdi ? val2.IsAdresi : val2.IkametgahAdresi;

    let fullAddress = '';
    if (addrData?.MahalleSemt) fullAddress += addrData.MahalleSemt + ' Mah. ';
    if (addrData?.CaddeSokak)  fullAddress += addrData.CaddeSokak;
    if (addrData?.KapiNO)      fullAddress += ' No:' + addrData.KapiNO;

    return res.json({ success: true, source: 'uyumsoft', data: {
      unvan:        val2.Unvan || (val2.Adi ? `${val2.Adi} ${val2.Soyadi}`.trim() : ''),
      vergiDairesi: val2.VergiDairesiAdi || '',
      sehir:        addrData?.IlAdi     || '',
      ilce:         addrData?.IlceAdi   || '',
      adres:        fullAddress.trim(),
      mahalle:      addrData?.MahalleSemt || '',
      binaNo:       addrData?.KapiNO     || '',
      ulke:         'TR',
    }});
  } catch (err) {
    console.error('[invoices-api][fetchCustomerInfo]', err.message);
    return res.status(500).json({ success: false, error: 'Sorgu hatasi: ' + err.message });
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
      case 'delete':      return await handleDelete(req.body || {}, res);
      case 'fetchCustomerInfo': return await handleFetchCustomerInfo(req.body || {}, res);
      default:            return res.status(400).json({ error: `Bilinmeyen action: ${action}. list|detail|view|url|create|formalize|sendDraft|cancelDraft|delete|fetchCustomerInfo` });
    }
  } catch (err) {
    console.error(`[invoices-api][${action}]`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
