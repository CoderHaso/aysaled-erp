import { createClient } from '@supabase/supabase-js';
import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

// ─── UBL XML'den değer çekme yardımcısı ────────────────────────────────────
function val(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  if (node._ !== undefined) return String(node._).trim();
  if (node.$value !== undefined) return String(node.$value).trim();
  if (node['#text'] !== undefined) return String(node['#text']).trim();
  return '';
}

// ─── UBL Party node'undan adres/iletişim çekme ─────────────────────────────
// AccountingCustomerParty veya AccountingSupplierParty için kullanılır
function extractFromParty(party) {
  if (!party) return {};

  // Firma adı
  const rawName = party?.PartyName?.Name ?? party?.PartyName
    ?? party?.['cac:PartyName']?.['cbc:Name'] ?? party?.['cac:PartyName'];
  const name = val(rawName) || '';

  // VKN ve vergi dairesi
  let vkn = '', taxOffice = '';
  const taxScheme = party?.PartyTaxScheme ?? party?.['cac:PartyTaxScheme'];
  const taxSchemes = Array.isArray(taxScheme) ? taxScheme : (taxScheme ? [taxScheme] : []);
  for (const ts of taxSchemes) {
    const cid = val(ts?.CompanyID ?? ts?.['cbc:CompanyID']);
    if (cid && cid.length >= 10) vkn = cid;
    const rn = val(ts?.RegistrationName ?? ts?.['cbc:RegistrationName']);
    if (rn) taxOffice = rn;
  }

  // PostalAddress — hem standart hem cac: prefix'li dene
  const addrNode = party?.PostalAddress ?? party?.['cac:PostalAddress']
    ?? party?.Address ?? party?.['cac:Address'];

  const streetName    = val(addrNode?.StreetName ?? addrNode?.['cbc:StreetName']);
  const streetName2   = val(addrNode?.AdditionalStreetName ?? addrNode?.['cbc:AdditionalStreetName']);
  const buildingNum   = val(addrNode?.BuildingNumber ?? addrNode?.['cbc:BuildingNumber']);
  const buildingName  = val(addrNode?.BuildingName ?? addrNode?.['cbc:BuildingName']);
  const cityName      = val(addrNode?.CityName ?? addrNode?.['cbc:CityName']);
  const citySubDiv    = val(addrNode?.CitySubdivisionName ?? addrNode?.['cbc:CitySubdivisionName']);
  const region        = val(addrNode?.CountrySubentity ?? addrNode?.['cbc:CountrySubentity']);
  const postalZone    = val(addrNode?.PostalZone ?? addrNode?.['cbc:PostalZone']
    ?? addrNode?.PostalCode ?? addrNode?.['cbc:PostalCode']);

  // Ülke
  const countryNode   = addrNode?.Country ?? addrNode?.['cac:Country'];
  const country       = val(countryNode?.IdentificationCode ?? countryNode?.['cbc:IdentificationCode']
    ?? countryNode?.Name ?? countryNode?.['cbc:Name']) || 'TR';

  // Cadde/Sokak birleştir
  const addressParts = [streetName, streetName2, buildingNum, buildingName].filter(Boolean);
  const address = addressParts.join(' ').trim() || null;

  // Şehir: önce cityName, yoksa region, yoksa citySubDiv
  const city     = cityName || region || null;
  const district = citySubDiv || null;

  // İletişim
  const contactNode = party?.Contact ?? party?.['cac:Contact'];
  const phone = val(contactNode?.Telephone ?? contactNode?.['cbc:Telephone']
    ?? contactNode?.Telefax ?? contactNode?.['cbc:Telefax']) || null;
  const email = val(contactNode?.ElectronicMail ?? contactNode?.['cbc:ElectronicMail']) || null;

  return { name, vkn, taxOffice, address, city, district, country, postalZone, phone, email };
}

// ─── GİB sorgulaması (TryToGetAddressFromVknTckn, OnlyDb = ücretsiz) ────────
async function tryGibAddress(client, vkn) {
  try {
    const result = await callSoap(client, 'TryToGetAddressFromVknTckn', {
      vknTckn: vkn,
      queryType: 'OnlyDb', // Ücretsiz: sadece Uyumsoft DB'den sorgular, kredi harcamaz
    });
    const r = result?.TryToGetAddressFromVknTcknResult;
    const ok = String(r?.attributes?.IsSucceded ?? r?.IsSucceded ?? 'false').toLowerCase() === 'true';
    if (!ok) return null;

    const v = r?.Value ?? r;
    if (!v) return null;

    // İş adresi
    const isAdr = v.IsAdresi;
    // İkametgah adresi (fallback, gerçek kişiler için)
    const ikAdr = v.IkametgahAdresi;
    const adr = isAdr || ikAdr;

    if (!adr) return null;

    const mahalle  = val(adr.MahalleSemt);
    const cadde    = val(adr.CaddeSokak);
    const kapiNo   = val(adr.KapiNO);
    const daireNo  = val(adr.DaireNO);
    const ilce     = val(adr.IlceAdi);
    const il       = val(adr.IlAdi);

    const addressParts = [mahalle, cadde, kapiNo ? `No:${kapiNo}` : '', daireNo ? `D:${daireNo}` : ''].filter(Boolean);
    return {
      name:       val(v.Unvan) || `${val(v.Adi)} ${val(v.Soyadi)}`.trim() || null,
      taxOffice:  val(v.VergiDairesiAdi) || null,
      address:    addressParts.join(' ').trim() || null,
      city:       il || null,
      district:   ilce || null,
    };
  } catch (e) {
    console.warn('[enrich] GİB sorgu hatası:', e.message?.slice(0, 80));
    return null;
  }
}

/**
 * POST /api/enrich-contacts
 *
 * Strateji (öncelik sırasıyla):
 * 1. raw_detail içindeki UBL XML'den AccountingCustomerParty / AccountingSupplierParty
 * 2. Uyumsoft'tan fatura detayı çek (GetOutboxInvoice / GetInboxInvoice)
 * 3. GİB sorgusu (TryToGetAddressFromVknTckn, OnlyDb = ücretsiz)
 *
 * Body: { limit: 10, type: 'customers'|'suppliers'|'both' }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { limit = 10, type = 'customers', forceRe = false } = req.body || {};
  console.log(`[enrich-contacts] Start: type=${type}, limit=${limit}, forceRe=${forceRe}`);
  const results = { processed: 0, enriched: 0, errors: [], skipped: 0 };

  try {
    const client = await createUyumsoftClient();

    const jobs = [];
    if (type === 'customers' || type === 'both') jobs.push({
      table: 'customers', invoiceType: 'outbox',
      partyKey: 'AccountingCustomerParty',
      method: 'GetOutboxInvoice', resKey: 'GetOutboxInvoiceResult',
    });
    if (type === 'suppliers' || type === 'both') jobs.push({
      table: 'suppliers', invoiceType: 'inbox',
      partyKey: 'AccountingSupplierParty',
      method: 'GetInboxInvoice', resKey: 'GetInboxInvoiceResult',
    });

    for (const job of jobs) {
      // Zenginleştirme yapılmamış (veya forceRe ile tümü) kayıtları çek
      let q = supabase.from(job.table)
        .select('id, vkntckn, name, phone, email, address, city, district, tax_office, postal_code, enrich_attempted_at')
        .not('vkntckn', 'is', null)
        .neq('vkntckn', '')
        .limit(limit);

      if (!forceRe) {
        q = q.is('enrich_attempted_at', null);
      }

      const { data: contacts, error: cErr } = await q;
      if (cErr) {
        // enrich_attempted_at kolonu yoksa: adres boş olanları işle
        console.warn('[enrich] enrich_attempted_at NA, fallback to missing phone');
        const { data: fallback } = await supabase.from(job.table)
          .select('id, vkntckn, name, phone, email, address, city, district, tax_office, postal_code')
          .not('vkntckn', 'is', null).neq('vkntckn', '').is('phone', null).limit(limit);
        if (!fallback?.length) continue;
        await processJob(client, job, fallback, results, true);
        continue;
      }
      if (!contacts?.length) { console.log(`[enrich] ${job.table}: tümü işlendi.`); continue; }
      await processJob(client, job, contacts, results, false);
    }

    // Kalan sayısı
    let remaining = 0;
    for (const job of jobs) {
      try {
        const { count } = await supabase.from(job.table)
          .select('id', { count: 'exact', head: true })
          .not('vkntckn', 'is', null).neq('vkntckn', '').is('enrich_attempted_at', null);
        remaining += count || 0;
      } catch { /* ignore */ }
    }

    return res.json({ success: true, results, remaining });

  } catch (err) {
    console.error('[enrich-contacts]', err.message);
    return res.status(500).json({ success: false, error: err.message, results, remaining: -1 });
  }
}

async function processJob(client, job, contacts, results, isFallback) {
  for (const contact of contacts) {
    results.processed++;
    const now = new Date().toISOString();

    if (!isFallback) {
      // Hemen işaretliyoruz — crash olsa bile tekrar işlenmez
      await supabase.from(job.table).update({ enrich_attempted_at: now }).eq('id', contact.id);
    }

    let extracted = {};

    // ════ KATMAN 1: raw_detail içindeki UBL XML ══════════════════════════════
    const { data: invWithDetail } = await supabase
      .from('invoices')
      .select('invoice_id, document_id, raw_detail, raw_data')
      .eq('type', job.invoiceType)
      .eq('vkntckn', contact.vkntckn)
      .not('raw_detail', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invWithDetail?.raw_detail) {
      const invoice = invWithDetail.raw_detail;
      const partyNode = invoice[job.partyKey] ?? invoice[`cac:${job.partyKey}`];
      const party = partyNode?.Party ?? partyNode?.['cac:Party'] ?? partyNode;
      extracted = extractFromParty(party);
      if (extracted.address || extracted.city) {
        console.log(`[enrich] ✓ raw_detail: ${contact.vkntckn}`);
      }
    }

    // ════ KATMAN 2: Uyumsoft SOAP'tan fatura detayı çek ═════════════════════
    if (!extracted.address && !extracted.city) {
      // En son faturayı bul (raw_detail olmasa bile)
      const { data: invAny } = await supabase
        .from('invoices')
        .select('invoice_id, document_id')
        .eq('type', job.invoiceType)
        .eq('vkntckn', contact.vkntckn)
        .order('issue_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invAny) {
        try {
          const uyumsoftId = invAny.document_id || invAny.invoice_id;
          const result = await callSoap(client, job.method, { invoiceId: uyumsoftId });
          const r = result?.[job.resKey];
          const ok = String(r?.attributes?.IsSucceded ?? r?.IsSucceded ?? 'false').toLowerCase() === 'true';

          if (ok) {
            const invoice = r?.Value?.Invoice ?? r?.Value?.invoice ?? r?.Value;
            if (invoice) {
              // raw_detail'i sakla (sonraki seferde Katman 1 çalışsın)
              await supabase.from('invoices')
                .update({ raw_detail: invoice, updated_at: now })
                .eq('invoice_id', invAny.invoice_id).eq('type', job.invoiceType);

              const partyNode = invoice[job.partyKey] ?? invoice[`cac:${job.partyKey}`];
              const party = partyNode?.Party ?? partyNode?.['cac:Party'] ?? partyNode;
              extracted = extractFromParty(party);
              if (extracted.address || extracted.city) {
                console.log(`[enrich] ✓ SOAP: ${contact.vkntckn}`);
              }
            }
          }
          await new Promise(r => setTimeout(r, 150)); // Rate limit
        } catch (e) {
          console.warn(`[enrich] SOAP ${contact.vkntckn}:`, e.message?.slice(0, 60));
        }
      }
    }

    // ════ KATMAN 3: GİB OnlyDb sorgusu (ücretsiz) ════════════════════════════
    if (!extracted.address && !extracted.city && contact.vkntckn) {
      const gib = await tryGibAddress(client, contact.vkntckn);
      if (gib) {
        // GİB'den geleni extracted ile birleştir (hem adres hem vergi dairesi)
        extracted = {
          ...extracted,
          name:      extracted.name      || gib.name,
          taxOffice: extracted.taxOffice || gib.taxOffice,
          address:   extracted.address   || gib.address,
          city:      extracted.city      || gib.city,
          district:  extracted.district  || gib.district,
        };
        if (gib.address || gib.city) {
          console.log(`[enrich] ✓ GİB: ${contact.vkntckn} → ${gib.city || ''}`);
        }
      }
    }

    // ════ Patch: sadece boş alanları doldur ══════════════════════════════════
    const patch = { updated_at: now };
    if (extracted.phone     && !contact.phone)       patch.phone       = extracted.phone;
    if (extracted.email     && !contact.email)       patch.email       = extracted.email;
    if (extracted.address   && !contact.address)     patch.address     = extracted.address;
    if (extracted.city      && !contact.city)        patch.city        = extracted.city;
    if (extracted.district  && !contact.district)    patch.district    = extracted.district;
    if (extracted.postalZone && !contact.postal_code) patch.postal_code = extracted.postalZone;
    if (extracted.taxOffice  && !contact.tax_office)  patch.tax_office  = extracted.taxOffice;
    // Firma adını da güncelle ama eskini silme
    if (extracted.name && extracted.name !== contact.name && !contact.name) {
      patch.name = extracted.name;
    }

    if (Object.keys(patch).length <= 1) {
      results.skipped++;
      console.log(`[enrich] ⊘ zaten tam: ${contact.vkntckn}`);
      continue;
    }

    const { error: upErr } = await supabase.from(job.table).update(patch).eq('id', contact.id);
    if (upErr) {
      results.errors.push(`Update ${contact.vkntckn}: ${upErr.message}`);
    } else {
      results.enriched++;
    }
  }
}
