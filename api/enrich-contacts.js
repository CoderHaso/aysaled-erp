import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

/**
 * val() - soap.js node'dan değer çıkar
 */
function val(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node._ !== undefined) return String(node._);
  if (node.$value !== undefined) return String(node.$value);
  return '';
}

/**
 * Bir UBL invoice objesinden contact bilgisi çıkar
 * party: AccountingCustomerParty.Party veya AccountingSupplierParty.Party
 */
function extractContact(party, fallbackName, fallbackVkn) {
  if (!party) return null;

  // İsim
  const rawName = party?.PartyName?.Name ?? party?.PartyName;
  const name = val(rawName) || fallbackName || '';

  // VKN - birden fazla olası path
  const taxScheme = party?.PartyTaxScheme;
  const taxSchemes = Array.isArray(taxScheme) ? taxScheme : (taxScheme ? [taxScheme] : []);
  let vkn = '';
  let taxOffice = '';
  for (const ts of taxSchemes) {
    const cid = val(ts?.CompanyID);
    if (cid && cid.length >= 10) { vkn = cid; }
    const rn = val(ts?.RegistrationName);
    if (rn) taxOffice = rn;
  }
  if (!vkn) vkn = fallbackVkn || '';

  // PostalAddress
  const addrNode = party?.PostalAddress ?? party?.Address;
  const street   = val(addrNode?.StreetName);
  const bnum     = val(addrNode?.BuildingNumber);
  const bname    = val(addrNode?.BuildingName);
  const cityName = val(addrNode?.CityName) || val(addrNode?.CitySubdivisionName);
  const postal   = val(addrNode?.PostalZone) || val(addrNode?.PostalCode);

  const address = [street, bnum, bname].filter(Boolean).join(' ').trim() || null;
  const city    = cityName || null;

  // Contact
  const contactNode = party?.Contact;
  const phone = val(contactNode?.Telephone) || val(contactNode?.Telefax);
  const email = val(contactNode?.ElectronicMail);

  // MERSIS
  const partyLegal = party?.PartyLegalEntity;
  const mersis = val(partyLegal?.CompanyID) || '';

  return { name, vkn, taxOffice, address, city, postal, phone, email, mersis };
}

/**
 * POST /api/enrich-contacts
 *
 * Tüm faturalar (veya limit kadar) için Uyumsoft'tan GetInboxInvoice / GetOutboxInvoice
 * çekerek contacts tablosunu zenginleştirir.
 *
 * Body: { limit: 50, type: 'both'|'inbox'|'outbox', onlyMissing: true }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { limit = 10, type = 'both', onlyMissing = true } = req.body || {};

  console.log(`[enrich-contacts] Başlıyor: type=${type}, limit=${limit}, onlyMissing=${onlyMissing}`);

  const results = { processed: 0, enriched: 0, errors: [], skipped: 0 };

  try {
    const client = await createUyumsoftClient();

    // Hangi type'ları işleyeceğiz?
    const types = type === 'both' ? ['inbox', 'outbox'] : [type];

    for (const t of types) {
      const table   = t === 'inbox' ? 'customers' : 'suppliers';
      const method  = t === 'inbox' ? 'GetInboxInvoice' : 'GetOutboxInvoice';
      const resKey  = t === 'inbox' ? 'GetInboxInvoiceResult' : 'GetOutboxInvoiceResult';

      // Supabase'den fatura listesi çek
      let query = supabase
        .from('invoices')
        .select('invoice_id, document_id, vkntckn, cari_name, raw_detail')
        .eq('type', t)
        .not('vkntckn', 'is', null)
        .neq('vkntckn', '')
        .limit(limit);

      // Sadece raw_detail eksik olanlar
      if (onlyMissing) {
        query = query.is('raw_detail', null);
      }

      const { data: invoices, error: fetchErr } = await query;
      if (fetchErr) {
        results.errors.push(`DB fetch (${t}): ${fetchErr.message}`);
        continue;
      }

      console.log(`[enrich-contacts] ${t}: ${invoices?.length || 0} fatura işlenecek`);

      for (const inv of (invoices || [])) {
        results.processed++;
        const uyumsoftId = inv.document_id || inv.invoice_id;

        try {
          // Uyumsoft'tan tam fatura çek
          const result = await callSoap(client, method, { invoiceId: uyumsoftId });
          const r      = result?.[resKey];
          const ok     = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';

          if (!ok) {
            results.errors.push(`${inv.invoice_id}: ${r?.attributes?.Message}`);
            results.skipped++;
            continue;
          }

          const invoice = r?.Value?.Invoice || r?.Value?.invoice || r?.Value;
          if (!invoice) { results.skipped++; continue; }

          // Contact çıkar
          const partyNode = t === 'inbox'
            ? (invoice.AccountingSupplierParty ?? invoice['cac:AccountingSupplierParty'])
            : (invoice.AccountingCustomerParty ?? invoice['cac:AccountingCustomerParty']);
          const party = partyNode?.Party ?? partyNode?.['cac:Party'] ?? partyNode;

          const contact = extractContact(party, inv.cari_name, inv.vkntckn);

          if (!contact?.vkn) {
            results.skipped++;
            continue;
          }

          // raw_detail kaydet (cache için)
          await supabase
            .from('invoices')
            .update({ raw_detail: invoice, updated_at: new Date().toISOString() })
            .eq('invoice_id', inv.invoice_id)
            .eq('type', t);

          // Contact upsert
          const record = {
            vkntckn:    contact.vkn,
            name:       contact.name || 'Bilinmiyor',
            source:     'invoice_sync',
            updated_at: new Date().toISOString(),
          };
          if (contact.phone)     record.phone      = contact.phone;
          if (contact.email)     record.email      = contact.email;
          if (contact.address)   record.address    = contact.address;
          if (contact.city)      record.city       = contact.city;
          if (contact.postal)    record.postal_code = contact.postal;
          if (contact.taxOffice) record.tax_office  = contact.taxOffice;

          const { error: upsertErr } = await supabase
            .from(table)
            .upsert(record, { onConflict: 'vkntckn', ignoreDuplicates: false });

          if (upsertErr) {
            results.errors.push(`Upsert ${contact.vkn}: ${upsertErr.message}`);
          } else {
            results.enriched++;
            console.log(`[enrich-contacts] ✓ ${table} ${contact.vkn}: ${contact.name}`);
          }

          // Rate-limit koruması: 200ms bekle
          await new Promise(r => setTimeout(r, 200));

        } catch (e) {
          results.errors.push(`${inv.invoice_id}: ${e.message}`);
          results.skipped++;
        }
      }
    }

    return res.json({
      success: true,
      results,
      message: `${results.enriched}/${results.processed} contact zenginleştirildi.`,
    });

  } catch (err) {
    console.error('[enrich-contacts]', err.message);
    return res.status(500).json({ success: false, error: err.message, results });
  }
}
