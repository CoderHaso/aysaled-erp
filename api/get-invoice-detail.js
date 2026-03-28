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

  // İskonto — InvoiceLine içindeki AllowanceCharge (ChargeIndicator=false → iskonto)
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
    id:              val(line.ID) || null,
    name,
    item_code:       itemCode,
    quantity:        qty || null,
    unit,
    unit_price:      unitPrice || null,
    line_total:      lineTotal || null,
    tax_percent:     taxPercent,
    tax_amount:      taxAmount || null,
    discount_rate:   discountRate,
    discount_amount: discountAmount,
    note:            note || null,
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
    }

    // 5) Contact zenginleştirme: UBL'den adres/telefon/e-posta çek
    try {
      // inbox=gelen fatura: biz alıcıyız, karşı taraf AccountingSupplierParty (tedarikçi)
      // outbox=giden fatura: biz satıcıyız, karşı taraf AccountingCustomerParty (müşteri)
      const partyNode = type === 'inbox'
        ? (invoice.AccountingSupplierParty || invoice['cac:AccountingSupplierParty'])
        : (invoice.AccountingCustomerParty || invoice['cac:AccountingCustomerParty']);

      const party = partyNode?.Party || partyNode?.['cac:Party'] || partyNode;

      // İsim
      const partyName = val(party?.PartyName?.Name ?? party?.['cac:PartyName']?.['cbc:Name']) || '';

      // VKN
      const taxScheme = party?.PartyTaxScheme || party?.['cac:PartyTaxScheme'];
      const vkn = val(taxScheme?.CompanyID ?? taxScheme?.['cbc:CompanyID']) || '';

      // Adres
      const addrNode = party?.PostalAddress || party?.['cac:PostalAddress']
                    || party?.Address       || party?.['cac:Address'];
      const street    = val(addrNode?.StreetName           ?? addrNode?.['cbc:StreetName']) || '';
      const buildingN = val(addrNode?.BuildingNumber       ?? addrNode?.['cbc:BuildingNumber']) || '';
      const buildingNm= val(addrNode?.BuildingName         ?? addrNode?.['cbc:BuildingName']) || '';
      const cityName  = val(addrNode?.CityName             ?? addrNode?.['cbc:CityName']) || '';
      const citySubdiv= val(addrNode?.CitySubdivisionName  ?? addrNode?.['cbc:CitySubdivisionName']) || '';
      const postal    = val(addrNode?.PostalZone           ?? addrNode?.['cbc:PostalZone']) || '';
      const country   = val(addrNode?.Country?.Name        ?? addrNode?.['cac:Country']?.['cbc:Name']) || 'Türkiye';

      const address = [street, buildingN, buildingNm].filter(Boolean).join(' ').trim() || null;
      const city    = cityName || citySubdiv || null;

      // Vergi dairesi
      const taxOfficeName = val(taxScheme?.RegistrationName ?? taxScheme?.['cbc:RegistrationName']) || '';

      // İletişim
      const contactNode = party?.Contact || party?.['cac:Contact'];
      const phone = val(contactNode?.Telephone       ?? contactNode?.['cbc:Telephone']) || '';
      const email = val(contactNode?.ElectronicMail  ?? contactNode?.['cbc:ElectronicMail']) || '';
      const fax   = val(contactNode?.Telefax         ?? contactNode?.['cbc:Telefax']) || '';

      // VKN yoksa sync yapma
      if (vkn) {
        const table       = type === 'inbox' ? 'suppliers' : 'customers';
        const contactData = {
          vkntckn:    vkn,
          name:       partyName || 'Bilinmiyor',
          source:     'invoice_sync',
          updated_at: new Date().toISOString(),
        };
        if (phone || fax)   contactData.phone       = phone || fax;
        if (email)          contactData.email        = email;
        if (address)        contactData.address      = address;
        if (city)           contactData.city         = city;
        if (postal)         contactData.postal_code  = postal;
        if (taxOfficeName)  contactData.tax_office   = taxOfficeName;

        const { error: ce } = await supabase
          .from(table)
          .upsert(contactData, { onConflict: 'vkntckn', ignoreDuplicates: false });

        if (ce) {
          console.warn(`[get-invoice-detail] ${table} contact upsert uyarısı:`, ce.message);
        } else {
          console.log(`[get-invoice-detail] ${table} contact zenginleştirildi: ${vkn}`);
        }
      }
    } catch (contactErr) {
      // Contact sync hatası ana akışı etkilemesin
      console.warn('[get-invoice-detail] Contact sync hatası:', contactErr.message);
    }

    res.json({ success: true, source: 'api', line_items, raw_detail: invoice });

  } catch (err) {
    console.error('[get-invoice-detail]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

