import { createClient } from '@supabase/supabase-js';
import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';
import fs from 'fs';
import path from 'path';

let envLocal = {};
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        val = val.replace(/^['"]|['"]$/g, '');
        envLocal[match[1]] = val;
      }
    });
  }
} catch (e) {
  // Yoksay
}
const getEnv = (k) => process.env[k] || process.env[`VITE_${k}`] || envLocal[k] || envLocal[`VITE_${k}`];

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type = 'inbox', forceAll = false } = req.body || {};
    
    // 1) En son çekilen faturanın tarihini bul (incremental fetch)
    let startDateStr = '2026-01-01T00:00:00';
    if (!forceAll) {
      const { data: latestInvoice, error: fetchErr } = await supabase
        .from('invoices')
        .select('issue_date')
        .eq('type', type)
        .order('issue_date', { ascending: false })
        .limit(1)
        .single();
        
      if (!fetchErr && latestInvoice?.issue_date) {
        // En son veritabanına giren faturanın tarihinden 2 gün öncesini al ki aradaki kaçanlar çekilsin
        const sd = new Date(latestInvoice.issue_date);
        sd.setDate(sd.getDate() - 2);
        startDateStr = sd.toISOString().split('.')[0];
      }
    }

    // 2) Uyumsoft'a istek at
    const args = {
      query: {
        attributes: { PageIndex: 0, PageSize: 200 }, // Maksimum 200 sayfa varsaydık (pagination eklenebilir)
        CreateStartDate: startDateStr,
        CreateEndDate: new Date().toISOString().split('.')[0],
        Status: 'Approved',
        IsArchived: false,
      },
    };

    const client = await createUyumsoftClient();
    const methodName = type === 'outbox' ? 'GetOutboxInvoiceList' : 'GetInboxInvoiceList';
    const result = await callSoap(client, methodName, args);

    // 3) Yanıtı parçala
    const resultData = type === 'outbox' 
      ? result?.GetOutboxInvoiceListResult 
      : result?.GetInboxInvoiceListResult;
      
    let list = [];
    if (resultData?.Value) {
      const valueObj = resultData.Value;
      // WSDL'e göre Value.Items veya Value.Items.Item formatında geliyor
      const invoicesRaw = valueObj.Items?.Item || valueObj.Items || valueObj.InboxInvoice || valueObj.OutboxInvoice || [];
      list = Array.isArray(invoicesRaw) ? invoicesRaw : [invoicesRaw];
    } else {
       const recursiveFindArray = (obj) => {
         if (!obj) return null;
         if (Array.isArray(obj)) return obj;
         if (typeof obj === 'object') {
           for (let key in obj) {
             const res = recursiveFindArray(obj[key]);
             if (res) return res;
           }
         }
         return null;
       };
       list = recursiveFindArray(resultData) || [];
    }

    // Eğer boşsa direkt dön
    if (list.length === 0) {
      return res.json({ success: true, message: 'Yeni fatura bulunamadı.', inserted: 0 });
    }

    // 4) Supabase formatına dök ve Upsert yap
    const upsertPayload = list.map(inv => {
      // Uyumsoft WSDL'inden gelen net karşılıklar
      const date = inv.ExecutionDate || inv.CreateDateUtc || inv.IssueDate || new Date().toISOString();
      const invoiceId = inv.InvoiceId || inv.DocumentId || 'Bilinmiyor';
      const cariName = inv.TargetTitle || inv.SenderName || inv.CustomerName;
      const vkn = inv.TargetTcknVkn || inv.SenderVknTckn || inv.VknTckn;
      const amount = inv.PayableAmount || inv.TaxExclusiveAmount || 0;
      const currency = inv.DocumentCurrencyCode || 'TRY';

      return {
        type: type, // 'inbox' veya 'outbox'
        invoice_id: invoiceId,
        vkntckn: vkn,
        cari_name: cariName,
        amount: parseFloat(amount),
        currency: currency,
        issue_date: date,
        status: 'Approved', // Şimdilik approved listesinden çektik
        raw_data: inv,
        updated_at: new Date().toISOString()
      };
    }).filter(up => up.invoice_id); // Fatura numarası olanları kurtar sadece

    if (upsertPayload.length === 0) {
      return res.json({ success: true, message: 'Geçerli formatta fatura bulunamadı veya ID eksik.', inserted: 0 });
    }

    const { error: upsertErr } = await supabase
      .from('invoices')
      .upsert(upsertPayload, { onConflict: 'invoice_id, type' });

    if (upsertErr) {
      throw new Error('Supabase kayıt hatası: ' + upsertErr.message);
    }

    res.json({ success: true, message: `${upsertPayload.length} fatura başarıyla sekronize edildi.`, inserted: upsertPayload.length });

  } catch (err) {
    console.error('[sync-invoices]', err.message);
    res.status(500).json({ success: false, error: 'Senkronizasyon Başarısız', detail: err.message });
  }
}
