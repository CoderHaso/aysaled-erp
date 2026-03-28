import { createClient } from '@supabase/supabase-js';
import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

// Vercel'de process.env doğrudan çalışır; VITE_ prefiksi olmayan değişkenler API'ye iletilir
// Geçerli key'ler: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) console.error('[sync-invoices] KRITIK: SUPABASE_URL env degiskeni bulunamadi!');
if (!supabaseKey) console.error('[sync-invoices] KRITIK: SUPABASE_ANON_KEY env degiskeni bulunamadi!');
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type = 'inbox', forceAll = false } = req.body || {};
    const PAGE_SIZE = 100; // Vercel timeout için makul boyut

    // 1) Incremental fetch: en son kaydın tarihini bul
    let startDateStr = '2024-01-01T00:00:00';
    if (!forceAll) {
      const { data: latest } = await supabase
        .from('invoices')
        .select('issue_date')
        .eq('type', type)
        .order('issue_date', { ascending: false })
        .limit(1)
        .single();

      if (latest?.issue_date) {
        const sd = new Date(latest.issue_date);
        sd.setDate(sd.getDate() - 2); // 2 gün geçmişe git, kaçan olmasın
        startDateStr = sd.toISOString().split('.')[0];
      }
    }

    const endDateStr = new Date().toISOString().split('.')[0];
    const client = await createUyumsoftClient();
    const methodName = type === 'outbox' ? 'GetOutboxInvoiceList' : 'GetInboxInvoiceList';
    const resultKey  = type === 'outbox' ? 'GetOutboxInvoiceListResult' : 'GetInboxInvoiceListResult';

    // 2) Tüm sayfalarda döngü yap
    let allItems = [];
    let pageIndex = 0;
    let totalPages = 1; // ilk istekte gerçek deĞer gelir

    do {
      const args = {
        query: {
          attributes: { PageIndex: pageIndex, PageSize: PAGE_SIZE },
          CreateStartDate: startDateStr,
          CreateEndDate: endDateStr,
          IsArchived: false,
        },
      };

      const result     = await callSoap(client, methodName, args);
      const resultData = result?.[resultKey];

      // TotalPages bilgisi attributes içinden al
      if (resultData?.Value?.attributes) {
        totalPages = parseInt(resultData.Value.attributes.TotalPages || '1', 10);
      }

      // Items al
      const raw = resultData?.Value?.Items;
      if (Array.isArray(raw)) {
        allItems = allItems.concat(raw);
      } else if (raw && typeof raw === 'object') {
        allItems.push(raw);
      }

      console.log(`[sync-invoices] ${type} - Sayfa ${pageIndex + 1}/${totalPages}, bu sayfada ${Array.isArray(raw) ? raw.length : (raw ? 1 : 0)} fatura`);
      pageIndex++;
    } while (pageIndex < totalPages);

    console.log(`[sync-invoices] ${type} - Toplam: ${allItems.length} fatura Uyumsoft'tan alındı.`);

    // 3) DEDUPLICATE: Uyumsoft aynı fatura ID'sini bazen iki kez gönderebiliyor
    const seen = new Set();
    const list = allItems.filter(inv => {
      const id = inv.InvoiceId || inv.DocumentId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[sync-invoices] ${type} - Dedup sonrası: ${list.length} benzersiz fatura.`);

    if (list.length === 0) {
      return res.json({ success: true, message: 'Yeni fatura bulunamadı.', inserted: 0 });
    }

    // 4) Tüm alanları Supabase formatına dök
    const upsertPayload = list.map(inv => {
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
        updated_at:           new Date().toISOString()
      };
    }).filter(Boolean);

    if (upsertPayload.length === 0) {
      return res.json({ success: true, message: 'Geçerli formatta fatura bulunamadı (ID eksik).', inserted: 0 });
    }

    const { error: upsertErr } = await supabase
      .from('invoices')
      .upsert(upsertPayload, { onConflict: 'invoice_id,type' });

    if (upsertErr) {
      console.error('[sync-invoices] Supabase upsert hatası:', JSON.stringify(upsertErr));
      throw new Error('Supabase kayıt hatası: ' + upsertErr.message + ' | Code: ' + upsertErr.code);
    }

    console.log(`[sync-invoices] ${upsertPayload.length} fatura Supabase'e yazıldı.`);

    // ── Contact upsert: fatura listesindeki alanlardan zenginleştirilmiş veri ──
    // Uyumsoft InvoiceList'te TargetTcknVkn ve TargetTitle zaten var.
    // Detaylı adres için raw_data gerekli ama listelenmiş alanlarla en azından
    // isim + VKN güncelleniyor. Tam adres enrichment için trigger zaten çalışıyor.
    const contactsByVkn = {};
    list.forEach(inv => {
      const vkn = inv.TargetTcknVkn;
      if (!vkn || vkn === '') return;
      if (contactsByVkn[vkn]) return; // dedup
      contactsByVkn[vkn] = {
        name:       inv.TargetTitle  || 'Bilinmiyor',
        vkntckn:    vkn,
        source:     'invoice_sync',
        updated_at: new Date().toISOString(),
      };
    });

    const contactList = Object.values(contactsByVkn);
    if (contactList.length > 0) {
      const table = type === 'inbox' ? 'customers' : 'suppliers';
      const { error: contactErr } = await supabase
        .from(table)
        .upsert(contactList, {
          onConflict: 'vkntckn',
          ignoreDuplicates: false,
        });
      if (contactErr) {
        console.warn(`[sync-invoices] ${table} upsert uyarısı:`, contactErr.message);
      } else {
        console.log(`[sync-invoices] ${contactList.length} ${table} kaydı güncellendi/eklendi.`);
      }
    }

    res.json({
      success: true,
      message: `${upsertPayload.length} fatura başarıyla senkronize edildi.`,
      inserted: upsertPayload.length
    });


  } catch (err) {
    console.error('[sync-invoices]', err.message, err.stack);
    res.status(500).json({
      success: false,
      error: 'Senkronizasyon Başarısız',
      detail: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join(' | ')
    });
  }
}
