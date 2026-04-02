import { createClient } from '@supabase/supabase-js';
import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

// ─── UBL node'dan değer çekme ───────────────────────────────────────────────
function val(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  if (node._ !== undefined) return String(node._).trim();
  if (node.$value !== undefined) return String(node.$value).trim();
  if (node['#text'] !== undefined) return String(node['#text']).trim();
  return '';
}

// ─── UBL Party node'undan adres/iletişim parse ─────────────────────────────
function parseParty(party) {
  if (!party) return {};

  // VKN ve vergi dairesi
  let vkn = '', taxOffice = '';
  const ts = party?.PartyTaxScheme ?? party?.['cac:PartyTaxScheme'];
  const tsList = Array.isArray(ts) ? ts : (ts ? [ts] : []);
  for (const t of tsList) {
    const cid = val(t?.CompanyID ?? t?.['cbc:CompanyID']);
    if (cid && cid.length >= 10) vkn = cid;
    const rn = val(t?.RegistrationName ?? t?.['cbc:RegistrationName']);
    if (rn) taxOffice = rn;
  }

  // PostalAddress
  const addrNode = party?.PostalAddress   ?? party?.['cac:PostalAddress']
               ?? party?.Address          ?? party?.['cac:Address'];

  const street   = val(addrNode?.StreetName              ?? addrNode?.['cbc:StreetName']);
  const street2  = val(addrNode?.AdditionalStreetName    ?? addrNode?.['cbc:AdditionalStreetName']);
  const bldgNum  = val(addrNode?.BuildingNumber          ?? addrNode?.['cbc:BuildingNumber']);
  const bldgName = val(addrNode?.BuildingName            ?? addrNode?.['cbc:BuildingName']);
  const cityName = val(addrNode?.CityName                ?? addrNode?.['cbc:CityName']);
  const citySubD = val(addrNode?.CitySubdivisionName     ?? addrNode?.['cbc:CitySubdivisionName']);
  const region   = val(addrNode?.CountrySubentity        ?? addrNode?.['cbc:CountrySubentity']);
  const postal   = val(addrNode?.PostalZone ?? addrNode?.['cbc:PostalZone']
                     ?? addrNode?.PostalCode ?? addrNode?.['cbc:PostalCode']);

  const countryNode = addrNode?.Country ?? addrNode?.['cac:Country'];
  const country = val(countryNode?.IdentificationCode ?? countryNode?.['cbc:IdentificationCode']
                    ?? countryNode?.Name ?? countryNode?.['cbc:Name']) || null;

  const addressParts = [street, street2, bldgNum ? `No:${bldgNum}` : '', bldgName].filter(Boolean);
  const address  = addressParts.join(' ').trim() || null;
  const city     = cityName || region || null;
  const district = citySubD || null;

  // İletişim
  const c = party?.Contact ?? party?.['cac:Contact'];
  const phone = val(c?.Telephone ?? c?.['cbc:Telephone'] ?? c?.Telefax ?? c?.['cbc:Telefax']) || null;
  const email = val(c?.ElectronicMail ?? c?.['cbc:ElectronicMail']) || null;

  return {
    vkn,
    taxOffice: taxOffice || null,
    address,
    city,
    district,
    country,
    postal: postal || null,
    phone,
    email,
  };
}

// ─── Paralel işleme (concurrency limit) ────────────────────────────────────
async function pMap(items, fn, concurrency = 3) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type = 'inbox', forceAll = false, detailLimit = 50 } = req.body || {};
    const PAGE_SIZE = 100;

    // ── 1. Incremental: son kaydın tarihi ────────────────────────────────────
    let startDateStr = '2024-01-01T00:00:00';
    if (!forceAll) {
      const { data: latest } = await supabase
        .from('invoices')
        .select('create_date_utc, issue_date')
        .eq('type', type)
        .order('create_date_utc', { ascending: false })
        .not('create_date_utc', 'is', null)
        .limit(1)
        .maybeSingle();

      const lastDate = latest?.create_date_utc || latest?.issue_date;
      if (lastDate) {
        const sd = new Date(lastDate);
        sd.setDate(sd.getDate() - 3);
        startDateStr = sd.toISOString().split('.')[0];
      }
    }

    const edt = new Date();
    edt.setDate(edt.getDate() + 1);
    const endDateStr = edt.toISOString().split('.')[0];

    const client = await createUyumsoftClient();
    const listMethod = type === 'outbox' ? 'GetOutboxInvoiceList' : 'GetInboxInvoiceList';
    const listResKey = type === 'outbox' ? 'GetOutboxInvoiceListResult' : 'GetInboxInvoiceListResult';
    const detailMethod = type === 'outbox' ? 'GetOutboxInvoice' : 'GetInboxInvoice';
    const detailResKey = type === 'outbox' ? 'GetOutboxInvoiceResult' : 'GetInboxInvoiceResult';
    const partyKey = type === 'outbox' ? 'AccountingCustomerParty' : 'AccountingSupplierParty';

    // ── 2. Fatura listesini tüm sayfalarda çek ───────────────────────────────
    let allItems = [];
    let pageIndex = 0, totalPages = 1;
    do {
      const result = await callSoap(client, listMethod, {
        query: {
          attributes: { PageIndex: pageIndex, PageSize: PAGE_SIZE },
          CreateStartDate: startDateStr,
          CreateEndDate: endDateStr,
          IsArchived: false,
        },
      });
      const rd = result?.[listResKey];
      if (rd?.Value?.attributes) {
        totalPages = parseInt(rd.Value.attributes.TotalPages || '1', 10);
      }
      const raw = rd?.Value?.Items;
      if (Array.isArray(raw)) allItems = allItems.concat(raw);
      else if (raw && typeof raw === 'object') allItems.push(raw);
      console.log(`[sync] ${type} sayfa ${pageIndex + 1}/${totalPages}: ${Array.isArray(raw) ? raw.length : 1} fatura`);
      pageIndex++;
    } while (pageIndex < totalPages);

    // ── 3. Deduplicate ────────────────────────────────────────────────────────
    const seen = new Set();
    const list = allItems.filter(inv => {
      const id = inv.InvoiceId || inv.DocumentId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (list.length === 0) {
      return res.json({ success: true, message: 'Yeni fatura yok.', inserted: 0, detailFetched: 0 });
    }

    // ── 4. Temel fatura verisi upsert (adressiz, hızlı) ──────────────────────
    const basePayload = list.map(inv => {
      const invoiceId = inv.InvoiceId || inv.DocumentId;
      if (!invoiceId) return null;
      return {
        type,
        invoice_id:           invoiceId,
        document_id:          inv.DocumentId,
        vkntckn:              inv.TargetTcknVkn,
        cari_name:            inv.TargetTitle,
        invoice_type:         inv.Type,
        invoice_tip_type:     inv.InvoiceTipType,
        status:               inv.Status,
        envelope_status:      inv.EnvelopeStatus,
        issue_date:           inv.ExecutionDate || inv.CreateDateUtc,
        create_date_utc:      inv.CreateDateUtc,
        amount:               parseFloat(inv.PayableAmount || 0),
        tax_exclusive_amount: parseFloat(inv.TaxExclusiveAmount || 0),
        tax_total:            parseFloat(inv.TaxTotal || 0),
        currency:             inv.DocumentCurrencyCode || 'TRY',
        exchange_rate:        parseFloat(inv.ExchangeRate || 1),
        vat1:                 parseFloat(inv.Vat1 || 0),
        vat8:                 parseFloat(inv.Vat8 || 0),
        vat10:                parseFloat(inv.Vat10 || 0),
        vat18:                parseFloat(inv.Vat18 || 0),
        vat20:                parseFloat(inv.Vat20 || 0),
        vat1_taxable:         parseFloat(inv.Vat1TaxableAmount || 0),
        vat8_taxable:         parseFloat(inv.Vat8TaxableAmount || 0),
        vat10_taxable:        parseFloat(inv.Vat10TaxableAmount || 0),
        vat18_taxable:        parseFloat(inv.Vat18TaxableAmount || 0),
        vat20_taxable:        parseFloat(inv.Vat20TaxableAmount || 0),
        is_archived:          inv.IsArchived === true || inv.IsArchived === 'true',
        is_new:               inv.IsNew === true || inv.IsNew === 'true',
        is_seen:              inv.IsSeen === true || inv.IsSeen === 'true',
        envelope_identifier:  inv.EnvelopeIdentifier,
        order_document_id:    inv.OrderDocumentId,
        message:              inv.Message,
        raw_data:             inv,
        updated_at:           new Date().toISOString(),
      };
    }).filter(Boolean);

    // Batch upsert: 20'şerlik gruplar halinde — raw_data büyük olduğu için
    // tek seferde 100+ kayıt göndermek Supabase statement timeout'a yol açıyor
    const BATCH = 20;
    for (let b = 0; b < basePayload.length; b += BATCH) {
      const chunk = basePayload.slice(b, b + BATCH);
      const { error: upsertErr } = await supabase
        .from('invoices')
        .upsert(chunk, { onConflict: 'invoice_id,type' });
      if (upsertErr) throw new Error('Supabase upsert: ' + upsertErr.message);
    }
    console.log(`[sync] ${basePayload.length} fatura kaydedildi.`);


    // ── 5. UBL detayı çek → adres kolonlarını doldur ─────────────────────────
    // Sadece detail_fetched_at IS NULL olanları işle (daha önce çekilmemiş)
    const { data: needDetail } = await supabase
      .from('invoices')
      .select('invoice_id, document_id')
      .eq('type', type)
      .is('detail_fetched_at', null)
      .not('vkntckn', 'is', null)
      .limit(detailLimit);

    const detailItems = needDetail || [];
    console.log(`[sync] ${detailItems.length} fatura için UBL detayı çekilecek.`);
    let detailFetched = 0;

    // Paralel işleme (3 eşzamanlı SOAP isteği)
    await pMap(detailItems, async (row) => {
      const now = new Date().toISOString();
      const uyumsoftId = row.document_id || row.invoice_id;
      try {
        const result = await callSoap(client, detailMethod, { invoiceId: uyumsoftId });
        const r = result?.[detailResKey];
        const ok = String(r?.attributes?.IsSucceded ?? r?.IsSucceded ?? 'false').toLowerCase() === 'true';
        if (!ok) {
          // Başarısız olsa bile işaretliyoruz, sonsuz döngü olmasın
          await supabase.from('invoices')
            .update({ detail_fetched_at: now })
            .eq('invoice_id', row.invoice_id).eq('type', type);
          return;
        }

        const invoice = r?.Value?.Invoice ?? r?.Value?.invoice ?? r?.Value;
        if (!invoice) {
          await supabase.from('invoices')
            .update({ detail_fetched_at: now })
            .eq('invoice_id', row.invoice_id).eq('type', type);
          return;
        }

        // Party node'u parse et
        const partyNode = invoice[partyKey] ?? invoice[`cac:${partyKey}`];
        const party = partyNode?.Party ?? partyNode?.['cac:Party'] ?? partyNode;
        const addr = parseParty(party);

        // invoices tablosunu güncelle
        await supabase.from('invoices').update({
          raw_detail:        invoice,
          detail_fetched_at: now,
          cari_tax_office:   addr.taxOffice,
          cari_address:      addr.address,
          cari_city:         addr.city,
          cari_district:     addr.district,
          cari_country:      addr.country,
          cari_postal:       addr.postal,
          cari_phone:        addr.phone,
          cari_email:        addr.email,
          updated_at:        now,
        }).eq('invoice_id', row.invoice_id).eq('type', type);

        detailFetched++;
      } catch (e) {
        console.warn(`[sync] detay hatası ${row.invoice_id}:`, e.message?.slice(0, 60));
        // Hata da olsa işaretliyoruz (bir sonraki çalıştırmada yeniden denemesin)
        await supabase.from('invoices')
          .update({ detail_fetched_at: now })
          .eq('invoice_id', row.invoice_id).eq('type', type);
      }
    }, 3);

    console.log(`[sync] ${detailFetched} fatura için adres/iletişim çekildi.`);

    // ── 6. Kalan detaysız fatura sayısı ──────────────────────────────────────
    const { count: remaining } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
      .is('detail_fetched_at', null)
      .not('vkntckn', 'is', null);

    res.json({
      success: true,
      message: `${basePayload.length} fatura kaydedildi. ${detailFetched} adres çekildi. Kalan: ${remaining ?? 0}`,
      inserted: basePayload.length,
      detailFetched,
      remaining: remaining ?? 0,
    });

  } catch (err) {
    console.error('[sync-invoices]', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join(' | ')
    });
  }
}
