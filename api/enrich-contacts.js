import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

function val(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node._ !== undefined) return String(node._);
  if (node.$value !== undefined) return String(node.$value);
  return '';
}

function extractContact(party, fallbackName, fallbackVkn) {
  if (!party) return null;

  const rawName = party?.PartyName?.Name ?? party?.PartyName;
  const name = val(rawName) || fallbackName || '';

  const taxScheme = party?.PartyTaxScheme;
  const taxSchemes = Array.isArray(taxScheme) ? taxScheme : (taxScheme ? [taxScheme] : []);
  let vkn = ''; let taxOffice = '';
  for (const ts of taxSchemes) {
    const cid = val(ts?.CompanyID);
    if (cid && cid.length >= 10) vkn = cid;
    const rn = val(ts?.RegistrationName);
    if (rn) taxOffice = rn;
  }
  if (!vkn) vkn = fallbackVkn || '';

  const addrNode = party?.PostalAddress ?? party?.Address;
  const street   = val(addrNode?.StreetName);
  const bnum     = val(addrNode?.BuildingNumber);
  const bname    = val(addrNode?.BuildingName);
  const cityName = val(addrNode?.CityName) || val(addrNode?.CitySubdivisionName);
  const postal   = val(addrNode?.PostalZone) || val(addrNode?.PostalCode);
  const address  = [street, bnum, bname].filter(Boolean).join(' ').trim() || null;
  const city     = cityName || null;

  const contactNode = party?.Contact;
  const phone = val(contactNode?.Telephone) || val(contactNode?.Telefax);
  const email = val(contactNode?.ElectronicMail);

  return { name, vkn, taxOffice, address, city, postal, phone, email };
}

/**
 * POST /api/enrich-contacts
 *
 * Mevcut customers/suppliers kayıtlarındaki boş alanları (adres, telefon, e-posta)
 * Uyumsoft'taki fatura detaylarından doldurur.
 *
 * ÖNEMLİ: Yeni kayıt OLUŞTURMAZ — sadece mevcut kayıtları günceller.
 *
 * Tablo:
 *   - customers → outbox faturalar (biz sattık, karşı taraf müşteri)
 *   - suppliers → inbox faturalar (biz aldık, karşı taraf tedarikçi)
 *
 * Body: { limit: 10, type: 'customers'|'suppliers'|'both' }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { limit = 10, type = 'customers' } = req.body || {};

  console.log(`[enrich-contacts] Başlıyor: type=${type}, limit=${limit}`);

  const results = { processed: 0, enriched: 0, errors: [], skipped: 0 };

  try {
    const client = await createUyumsoftClient();

    // ── customers: outbox faturalardan (biz sattık = müşteri)
    // ── suppliers: inbox faturalardan (biz aldık = tedarikçi)
    const jobs = [];
    if (type === 'customers' || type === 'both') jobs.push({ table: 'customers', invoiceType: 'outbox', partyKey: 'AccountingCustomerParty', method: 'GetOutboxInvoice', resKey: 'GetOutboxInvoiceResult' });
    if (type === 'suppliers' || type === 'both') jobs.push({ table: 'suppliers', invoiceType: 'inbox',  partyKey: 'AccountingSupplierParty', method: 'GetInboxInvoice',  resKey: 'GetInboxInvoiceResult'  });

    for (const job of jobs) {
      // 1) Adres/telefon bilgisi EKSİK olan mevcut kayıtları al
      const { data: contacts, error: cErr } = await supabase
        .from(job.table)
        .select('id, vkntckn, name')
        .not('vkntckn', 'is', null)
        .neq('vkntckn', '')
        .or('phone.is.null,address.is.null,city.is.null')  // boş alanı olanlar
        .limit(limit);

      if (cErr) { results.errors.push(`${job.table} fetch: ${cErr.message}`); continue; }
      if (!contacts?.length) {
        console.log(`[enrich-contacts] ${job.table}: tüm kayıtlar zaten dolu, işlem yok.`);
        continue;
      }

      console.log(`[enrich-contacts] ${job.table}: ${contacts.length} kayıt eksik bilgi içeriyor`);

      for (const contact of contacts) {
        results.processed++;

        // Bu VKN'ye ait bir fatura bul
        const { data: invRow } = await supabase
          .from('invoices')
          .select('invoice_id, document_id, raw_detail')
          .eq('type', job.invoiceType)
          .eq('vkntckn', contact.vkntckn)
          .limit(1)
          .single();

        if (!invRow) { results.skipped++; continue; }

        // raw_detail varsa direkt kullan (Uyumsoft'a gitme)
        let invoice = invRow.raw_detail;

        if (!invoice) {
          // raw_detail yok, Uyumsoft'tan çek
          try {
            const uyumsoftId = invRow.document_id || invRow.invoice_id;
            const result = await callSoap(client, job.method, { invoiceId: uyumsoftId });
            const r      = result?.[job.resKey];
            const ok     = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';
            if (!ok) { results.skipped++; continue; }
            invoice = r?.Value?.Invoice || r?.Value?.invoice || r?.Value;
            if (!invoice) { results.skipped++; continue; }

            // raw_detail'i kaydet (cache)
            await supabase.from('invoices')
              .update({ raw_detail: invoice, updated_at: new Date().toISOString() })
              .eq('invoice_id', invRow.invoice_id).eq('type', job.invoiceType);

            await new Promise(r => setTimeout(r, 150));
          } catch (e) {
            results.errors.push(`SOAP ${contact.vkntckn}: ${e.message.slice(0, 60)}`);
            results.skipped++;
            continue;
          }
        }

        // Contact bilgilerini çıkar
        const partyNode = invoice[job.partyKey] ?? invoice[`cac:${job.partyKey}`];
        const party = partyNode?.Party ?? partyNode?.['cac:Party'] ?? partyNode;
        const extracted = extractContact(party, contact.name, contact.vkntckn);

        if (!extracted) { results.skipped++; continue; }

        // Sadece boş alanları güncelle (dolu olanları üzerine yazma)
        const patch = { updated_at: new Date().toISOString() };
        if (extracted.phone     && !contact.phone)     patch.phone      = extracted.phone;
        if (extracted.email     && !contact.email)     patch.email      = extracted.email;
        if (extracted.address   && !contact.address)   patch.address    = extracted.address;
        if (extracted.city      && !contact.city)      patch.city       = extracted.city;
        if (extracted.postal    && !contact.postal_code) patch.postal_code = extracted.postal;
        if (extracted.taxOffice && !contact.tax_office)  patch.tax_office  = extracted.taxOffice;

        if (Object.keys(patch).length === 1) {
          // Sadece updated_at var, hiç boş alan yok aslında
          results.skipped++;
          continue;
        }

        // UPDATE (yeni kayıt oluşturmaz!)
        const { error: upErr } = await supabase
          .from(job.table)
          .update(patch)
          .eq('id', contact.id);

        if (upErr) {
          results.errors.push(`Update ${contact.vkntckn}: ${upErr.message}`);
        } else {
          results.enriched++;
          console.log(`[enrich-contacts] ✓ ${job.table}[${contact.vkntckn}] güncellendi`);
        }
      }
    }

    // Kalan eksik sayısını hesapla
    let remaining = 0;
    for (const job of jobs) {
      const { count } = await supabase.from(job.table)
        .select('id', { count: 'exact', head: true })
        .not('vkntckn', 'is', null).neq('vkntckn', '')
        .or('phone.is.null,address.is.null,city.is.null');
      remaining += count || 0;
    }

    return res.json({
      success: true,
      results,
      remaining,
      message: `${results.enriched}/${results.processed} kayıt zenginleştirildi. Kalan: ${remaining}`,
    });

  } catch (err) {
    console.error('[enrich-contacts]', err.message);
    return res.status(500).json({ success: false, error: err.message, results });
  }
}
