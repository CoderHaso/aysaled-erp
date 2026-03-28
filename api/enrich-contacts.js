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
 * ÖNEMLİ:
 * - Yeni kayıt OLUŞTURMAZ — sadece mevcut kayıtları günceller
 * - "enrich_attempted_at" timestamp'i set ederek aynı kaydı tekrar işlemez
 * - Bu yüzden customers/suppliers tablosunda enrich_attempted_at kolonu gerekli
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
  console.log(`[enrich-contacts] Start: type=${type}, limit=${limit}`);

  const results = { processed: 0, enriched: 0, errors: [], skipped: 0 };

  try {
    const client = await createUyumsoftClient();

    const jobs = [];
    if (type === 'customers' || type === 'both') jobs.push({
      table: 'customers', invoiceType: 'outbox',
      partyKey: 'AccountingCustomerParty',
      method: 'GetOutboxInvoice', resKey: 'GetOutboxInvoiceResult'
    });
    if (type === 'suppliers' || type === 'both') jobs.push({
      table: 'suppliers', invoiceType: 'inbox',
      partyKey: 'AccountingSupplierParty',
      method: 'GetInboxInvoice', resKey: 'GetInboxInvoiceResult'
    });

    for (const job of jobs) {
      // HENÜz denenmeyen (enrich_attempted_at IS NULL) kayıtları al
      // Bu sayede aynı kayıt bir sonraki batch'te tekrar işlenmez
      const { data: contacts, error: cErr } = await supabase
        .from(job.table)
        .select('id, vkntckn, name, phone, email, address, city, tax_office, postal_code')
        .not('vkntckn', 'is', null)
        .neq('vkntckn', '')
        .is('enrich_attempted_at', null)   // ← sadece hiç denenmemişler
        .limit(limit);

      if (cErr) {
        // Kolon yoksa (migration yapılmamış) fallback: phone IS NULL olanlar + MAX 1 round
        console.warn('[enrich-contacts] enrich_attempted_at kolonu yok, fallback modu');
        const { data: fallback } = await supabase
          .from(job.table)
          .select('id, vkntckn, name, phone, email, address, city, tax_office, postal_code')
          .not('vkntckn', 'is', null).neq('vkntckn', '')
          .is('phone', null)
          .limit(limit);

        if (!fallback?.length) continue;
        await processContacts(client, job, fallback, results, true);
        continue;
      }

      if (!contacts?.length) {
        console.log(`[enrich-contacts] ${job.table}: tüm kayıtlar işlendi.`);
        continue;
      }

      console.log(`[enrich-contacts] ${job.table}: ${contacts.length} kayıt işlenecek`);
      await processContacts(client, job, contacts, results, false);
    }

    // Kalan: henüz denenmeyen kayıt sayısı
    let remaining = 0;
    for (const job of jobs) {
      try {
        const { count } = await supabase
          .from(job.table)
          .select('id', { count: 'exact', head: true })
          .not('vkntckn', 'is', null).neq('vkntckn', '')
          .is('enrich_attempted_at', null);
        remaining += count || 0;
      } catch { /* kolon yoksa 0 */ }
    }

    return res.json({
      success: true, results, remaining,
      message: `${results.enriched}/${results.processed} zenginleştirildi. Kalan: ${remaining}`,
    });

  } catch (err) {
    console.error('[enrich-contacts]', err.message);
    return res.status(500).json({ success: false, error: err.message, results, remaining: -1 });
  }
}

async function processContacts(client, job, contacts, results, isFallback) {
  for (const contact of contacts) {
    results.processed++;
    const now = new Date().toISOString();

    // En başta "denendi" diye işaretle — ne olursa olsun tekrar işlenmeyecek
    if (!isFallback) {
      await supabase.from(job.table)
        .update({ enrich_attempted_at: now })
        .eq('id', contact.id);
    }

    // Bu VKN'ye ait bir fatura bul (önce raw_detail olana bak)
    const { data: invRow } = await supabase
      .from('invoices')
      .select('invoice_id, document_id, raw_detail')
      .eq('type', job.invoiceType)
      .eq('vkntckn', contact.vkntckn)
      .not('raw_detail', 'is', null)   // önce detayı olan faturayı tercih et
      .limit(1)
      .maybeSingle();

    // raw_detail'li fatura yoksa raw_detail'siz olanı bul
    const { data: invRowAny } = invRow ? { data: invRow } : await supabase
      .from('invoices')
      .select('invoice_id, document_id, raw_detail')
      .eq('type', job.invoiceType)
      .eq('vkntckn', contact.vkntckn)
      .limit(1)
      .maybeSingle();

    const inv = invRow || invRowAny;
    if (!inv) { results.skipped++; continue; }

    let invoice = inv.raw_detail;

    if (!invoice) {
      try {
        const uyumsoftId = inv.document_id || inv.invoice_id;
        const result = await callSoap(client, job.method, { invoiceId: uyumsoftId });
        const r      = result?.[job.resKey];
        const ok     = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';
        if (!ok) { results.skipped++; continue; }
        invoice = r?.Value?.Invoice || r?.Value?.invoice || r?.Value;
        if (!invoice) { results.skipped++; continue; }

        await supabase.from('invoices')
          .update({ raw_detail: invoice, updated_at: now })
          .eq('invoice_id', inv.invoice_id).eq('type', job.invoiceType);

        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        results.errors.push(`SOAP ${contact.vkntckn}: ${e.message.slice(0, 60)}`);
        results.skipped++;
        continue;
      }
    }

    const partyNode = invoice[job.partyKey] ?? invoice[`cac:${job.partyKey}`];
    const party = partyNode?.Party ?? partyNode?.['cac:Party'] ?? partyNode;
    const extracted = extractContact(party, contact.name, contact.vkntckn);

    if (!extracted) { results.skipped++; continue; }

    // Sadece boş alanları güncelle
    const patch = { updated_at: now };
    if (extracted.phone     && !contact.phone)      patch.phone       = extracted.phone;
    if (extracted.email     && !contact.email)      patch.email       = extracted.email;
    if (extracted.address   && !contact.address)    patch.address     = extracted.address;
    if (extracted.city      && !contact.city)       patch.city        = extracted.city;
    if (extracted.postal    && !contact.postal_code) patch.postal_code = extracted.postal;
    if (extracted.taxOffice && !contact.tax_office)  patch.tax_office  = extracted.taxOffice;

    if (Object.keys(patch).length === 1) { results.skipped++; continue; }

    const { error: upErr } = await supabase
      .from(job.table).update(patch).eq('id', contact.id);

    if (upErr) {
      results.errors.push(`Update ${contact.vkntckn}: ${upErr.message}`);
    } else {
      results.enriched++;
      console.log(`[enrich-contacts] ✓ ${job.table}[${contact.vkntckn}]`);
    }
  }
}
