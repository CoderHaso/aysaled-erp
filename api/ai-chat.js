/**
 * /api/ai-chat.js
 * A-ERP AI Asistan — Vercel Serverless Function
 * Groq Cloud + Tool Use + Supabase veritabanı sorguları
 */
import { Groq } from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

// ── Supabase server-side client ──────────────────────────────────────────────
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ── Model Registry ───────────────────────────────────────────────────────────
const MODEL_REGISTRY = {
  // ── Tool-capable models (veritabanı sorgulayabilir) ──
  'openai/gpt-oss-120b':   { label: 'GPT-OSS 120B',   tier: 1, toolUse: true,  speed: '~500 tps',  desc: 'En güçlü, tool use + reasoning' },
  'llama-3.3-70b-versatile': { label: 'Llama 3.3 70B', tier: 2, toolUse: true,  speed: '~275 tps',  desc: 'Dengeli, güçlü tool use' },
  'qwen/qwen3-32b':        { label: 'Qwen3 32B',      tier: 3, toolUse: true,  speed: '~400 tps',  desc: 'Hızlı, iyi tool use (preview)' },
  'meta-llama/llama-4-scout-17b-16e-instruct': { label: 'Llama 4 Scout', tier: 4, toolUse: true, speed: '~580 tps', desc: 'Çok hızlı, hafif tool use (preview)' },
  // ── Chat-only models (tool kullanamaz, sadece sohbet) ──
  'openai/gpt-oss-20b':    { label: 'GPT-OSS 20B',    tier: 5, toolUse: false, speed: '~1050 tps', desc: 'Hızlı sohbet, tool use yok' },
  'llama-3.1-8b-instant':  { label: 'Llama 3.1 8B',   tier: 6, toolUse: false, speed: '~1300 tps', desc: 'En hızlı, basit sohbet' },
};

// Auto mod sıralaması: tool gerektirende en iyiden en kötüye tool modeli dene
const AUTO_TOOL_ORDER = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
const AUTO_CHAT_ORDER = ['llama-3.1-8b-instant', 'openai/gpt-oss-20b'];

// ── Basit intent sınıflandırma (LLM çağırmadan, heuristic) ───────────────────
const DATA_KEYWORDS = [
  'stok', 'ürün', 'hammadde', 'mamül', 'fatura', 'sipariş', 'teklif', 'müşteri',
  'cari', 'tedarikçi', 'reçete', 'maliyet', 'ödeme', 'çek', 'senet', 'iş emri',
  'rapor', 'özet', 'analiz', 'listele', 'göster', 'getir', 'sorgula', 'kaç tane',
  'kaç adet', 'toplam', 'kritik', 'borç', 'alacak', 'bakiye', 'fiyat', 'kdv',
  'satış', 'alış', 'gelen', 'giden', 'hareket', 'nisan', 'mart', 'şubat', 'ocak',
  'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık',
  'bu ay', 'geçen ay', 'bu hafta', 'bugün', 'dün', 'ay için', 'aylık',
];

function classifyIntent(text) {
  const lower = (text || '').toLowerCase();
  // Herhangi bir veri anahtar kelimesi varsa → tool gerekli
  for (const kw of DATA_KEYWORDS) {
    if (lower.includes(kw)) return 'data';
  }
  return 'chat';
}

// ── Tool tanımları ───────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_customers',
      description: 'Cari müşterileri arar veya listeler. Müşteri adı, vergi no, telefon ile arama yapabilir.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Aranacak metin (ad, vergi no, telefon)' },
          limit:  { type: 'integer', description: 'Sonuç limiti (varsayılan 20)', default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_suppliers',
      description: 'Tedarikçileri arar veya listeler.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Aranacak metin' },
          limit:  { type: 'integer', description: 'Sonuç limiti', default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_items',
      description: 'Ürün veya hammadde arar. Stok durumu, fiyat bilgisi içerir.',
      parameters: {
        type: 'object',
        properties: {
          search:     { type: 'string', description: 'Ürün adı veya SKU ile ara' },
          type:       { type: 'string', enum: ['product', 'raw', 'all'], description: 'product=mamül, raw=hammadde, all=tümü', default: 'all' },
          limit:      { type: 'integer', description: 'Sonuç limiti', default: 30 },
          critical_only: { type: 'boolean', description: 'Sadece kritik stok altındakileri getir' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_invoices',
      description: 'Faturaları sorgular. Gelen (alış) veya giden (satış) faturalarını filtreler.',
      parameters: {
        type: 'object',
        properties: {
          direction:   { type: 'string', enum: ['inbound', 'outbound', 'all'], description: 'inbound=gelen/alış, outbound=giden/satış', default: 'all' },
          date_from:   { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:     { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
          customer_id: { type: 'string', description: 'Cari ID filtresi' },
          search:      { type: 'string', description: 'Fatura numarası veya cari adı ile ara' },
          limit:       { type: 'integer', description: 'Sonuç limiti', default: 50 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_orders',
      description: 'Siparişleri sorgular.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Cari ID' },
          status:      { type: 'string', description: 'Sipariş durumu filtresi' },
          date_from:   { type: 'string', description: 'Başlangıç tarihi' },
          date_to:     { type: 'string', description: 'Bitiş tarihi' },
          limit:       { type: 'integer', default: 30 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_quotes',
      description: 'Teklifleri sorgular.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Cari ID' },
          status:      { type: 'string', description: 'Teklif durumu' },
          search:      { type: 'string', description: 'Teklif numarası veya cari adı' },
          limit:       { type: 'integer', default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_payments',
      description: 'Ödemeleri sorgular (cari veya tedarikçi bazlı).',
      parameters: {
        type: 'object',
        properties: {
          customer_id:  { type: 'string', description: 'Cari ID' },
          supplier_id:  { type: 'string', description: 'Tedarikçi ID' },
          date_from:    { type: 'string' },
          date_to:      { type: 'string' },
          limit:        { type: 'integer', default: 30 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_work_orders',
      description: 'İş emirlerini sorgular.',
      parameters: {
        type: 'object',
        properties: {
          status:     { type: 'string', description: 'İş emri durumu' },
          product_id: { type: 'string', description: 'Ürün ID' },
          limit:      { type: 'integer', default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_recipes',
      description: 'Bir ürüne ait reçeteleri ve malzeme listesini getirir.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'Ürün ID' },
          search:     { type: 'string', description: 'Ürün adı ile ara' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_stock_movements',
      description: 'Stok hareketlerini sorgular (giriş/çıkış logları).',
      parameters: {
        type: 'object',
        properties: {
          item_id:   { type: 'string', description: 'Ürün/hammadde ID' },
          date_from: { type: 'string' },
          date_to:   { type: 'string' },
          limit:     { type: 'integer', default: 30 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_cheques',
      description: 'Çek/senet bilgilerini sorgular.',
      parameters: {
        type: 'object',
        properties: {
          status:    { type: 'string', description: 'Çek durumu' },
          date_from: { type: 'string' },
          date_to:   { type: 'string' },
          limit:     { type: 'integer', default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_summary_stats',
      description: 'Genel özet istatistikleri getirir: toplam ürün, hammadde, müşteri, tedarikçi, sipariş, fatura sayıları ve toplam stok değeri.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ── Argüman tip dönüştürme (Groq bazen integer'ları string gönderir) ──────────
function sanitizeArgs(args) {
  const cleaned = { ...args };
  if (cleaned.limit !== undefined) cleaned.limit = parseInt(cleaned.limit, 10) || 20;
  if (cleaned.critical_only !== undefined) cleaned.critical_only = cleaned.critical_only === true || cleaned.critical_only === 'true';
  return cleaned;
}

// ── Tool çalıştırıcılar ──────────────────────────────────────────────────────
async function executeTool(name, rawArgs) {
  const args = sanitizeArgs(rawArgs);
  try {
    switch (name) {
      case 'query_customers': {
        let q = supabase.from('customers').select('id,name,vkntckn,phone,email,city,balance,total_sales').order('name').limit(args.limit || 20);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_suppliers': {
        let q = supabase.from('suppliers').select('id,name,vkntckn,phone,email,city').order('name').limit(args.limit || 20);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_items': {
        let q = supabase.from('items').select('id,name,sku,unit,item_type,stock_count,critical_limit,purchase_price,sale_price,base_currency,sale_currency,location,supplier_name').eq('is_draft', false).order('name').limit(args.limit || 30);
        if (args.type === 'product') q = q.eq('item_type', 'product');
        else if (args.type === 'raw') q = q.neq('item_type', 'product');
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        let items = data || [];
        if (args.critical_only) items = items.filter(i => i.critical_limit > 0 && i.stock_count <= i.critical_limit);
        return { count: items.length, data: items };
      }

      case 'query_invoices': {
        let q = supabase.from('invoices').select('id,invoice_number,direction,total_amount,vat_amount,currency,customer_name,customer_vkn,invoice_date,status,source').order('invoice_date', { ascending: false }).limit(args.limit || 50);
        if (args.direction === 'inbound') q = q.eq('direction', 'inbound');
        else if (args.direction === 'outbound') q = q.eq('direction', 'outbound');
        if (args.date_from) q = q.gte('invoice_date', args.date_from);
        if (args.date_to) q = q.lte('invoice_date', args.date_to);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.search) q = q.or(`invoice_number.ilike.%${args.search}%,customer_name.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_orders': {
        let q = supabase.from('orders').select('id,order_number,customer_name,customer_vkn,status,total,vat_total,grand_total,currency,order_date,delivery_date,notes').order('order_date', { ascending: false }).limit(args.limit || 30);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.status) q = q.eq('status', args.status);
        if (args.date_from) q = q.gte('order_date', args.date_from);
        if (args.date_to) q = q.lte('order_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_quotes': {
        let q = supabase.from('quotes').select('id,quote_number,customer_name,status,total,currency,created_at,valid_until').order('created_at', { ascending: false }).limit(args.limit || 20);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.status) q = q.eq('status', args.status);
        if (args.search) q = q.or(`quote_number.ilike.%${args.search}%,customer_name.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_payments': {
        let q = supabase.from('payments').select('*').order('payment_date', { ascending: false }).limit(args.limit || 30);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.supplier_id) q = q.eq('supplier_id', args.supplier_id);
        if (args.date_from) q = q.gte('payment_date', args.date_from);
        if (args.date_to) q = q.lte('payment_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_work_orders': {
        let q = supabase.from('work_orders').select('*').order('created_at', { ascending: false }).limit(args.limit || 20);
        if (args.status) q = q.eq('status', args.status);
        if (args.product_id) q = q.eq('product_id', args.product_id);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_recipes': {
        let productId = args.product_id;
        if (!productId && args.search) {
          const { data: items } = await supabase.from('items').select('id').eq('item_type', 'product').ilike('name', `%${args.search}%`).limit(1);
          productId = items?.[0]?.id;
        }
        if (!productId) return { error: 'Ürün bulunamadı', data: [] };
        const { data, error } = await supabase.from('product_recipes')
          .select('*, recipe_items(*, item:item_id(id,name,unit,purchase_price,base_currency))')
          .eq('product_id', productId).order('created_at');
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_stock_movements': {
        let q = supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(args.limit || 30);
        if (args.item_id) q = q.eq('item_id', args.item_id);
        if (args.date_from) q = q.gte('created_at', args.date_from);
        if (args.date_to) q = q.lte('created_at', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_cheques': {
        let q = supabase.from('cheques').select('*').order('due_date', { ascending: true }).limit(args.limit || 20);
        if (args.status) q = q.eq('status', args.status);
        if (args.date_from) q = q.gte('due_date', args.date_from);
        if (args.date_to) q = q.lte('due_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'get_summary_stats': {
        const [
          { count: itemCount },
          { count: productCount },
          { count: customerCount },
          { count: supplierCount },
          { count: orderCount },
          { count: invoiceCount },
        ] = await Promise.all([
          supabase.from('items').select('id', { count: 'exact', head: true }).eq('is_draft', false),
          supabase.from('items').select('id', { count: 'exact', head: true }).eq('item_type', 'product').eq('is_draft', false),
          supabase.from('customers').select('id', { count: 'exact', head: true }),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase.from('invoices').select('id', { count: 'exact', head: true }),
        ]);
        return {
          total_items: itemCount || 0,
          total_products: productCount || 0,
          total_raw_materials: (itemCount || 0) - (productCount || 0),
          total_customers: customerCount || 0,
          total_suppliers: supplierCount || 0,
          total_orders: orderCount || 0,
          total_invoices: invoiceCount || 0,
        };
      }

      default:
        return { error: `Bilinmeyen fonksiyon: ${name}` };
    }
  } catch (err) {
    console.error(`[ai-chat] Tool error (${name}):`, err.message);
    return { error: err.message };
  }
}

// ── Sistem prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sen A-ERP sisteminin yapay zeka asistanısın. Adın "A-ERP Asistan".
Görevin: Kullanıcının ERP verilerini SORGULAYARAK, analiz etmesine ve anlamasına yardımcı olmak.

KRİTİK KURALLAR:
1. Her zaman Türkçe yanıt ver. Profesyonel ama samimi bir üslup kullan.
2. KESİNLİKLE VERİ UYDURMA. Sadece ve sadece tool fonksiyonlarından aldığın gerçek verileri kullan.
3. Eğer bir bilgiyi sorgulayamıyorsan veya tool çağıramadıysan, açıkça "Şu anda bu bilgiye erişemiyorum" de. ASLA tahmin veya örnek veri gösterme.
4. Okuma işlemlerini direkt yap — onay gerektirmez.
5. Yazma/güncelleme isteklerinde KESİNLİKLE direkt DB'ye yazma. Bunun yerine kullanıcıya ne yapması gerektiğini açıkla ve hangi sayfaya gitmesi gerektiğini söyle.
6. Sayısal verilerde para birimi (₺, $, €) ve birim kullan.
7. Belirsiz durumlarda kullanıcıya sor — tahmin etme.
8. Hangi araçları kullandığını kısa açıkla.
9. Veri bulunamazsa alternatif öneri sun.
10. Tabloları markdown formatında göster.
11. Büyük veri setlerinde özet ver, en önemli kalemlerden bahset.
12. Kullanıcı mevcut sayfası hakkında bilgi verirse bağlamı kullan.

TEKRAR: HİÇBİR KOŞULDA sahte, örnek veya uydurma veri gösterme. Sadece veritabanından gelen gerçek verileri kullan. Eğer veritabanına erişemiyorsan bunu açıkça söyle.

VERİTABANI TABLOLARI:
- customers: Cariler (müşteriler) — name, vkntckn, phone, email, balance
- suppliers: Tedarikçiler — name, vkntckn, phone, email
- items: Ürünler ve hammaddeler — name, sku, item_type (product/rawmaterial), stock_count, purchase_price, sale_price, base_currency, critical_limit
- invoices: Faturalar — direction (inbound=gelen/alış, outbound=giden/satış), total_amount, vat_amount, customer_name
- orders: Siparişler — order_number, customer_name, status, grand_total, currency
- quotes: Teklifler — quote_number, customer_name, status, total
- payments: Ödemeler — amount, payment_date, customer_id, supplier_id
- work_orders: İş emirleri — product_id, status, quantity
- product_recipes: Reçeteler — product_id, name, tags
- recipe_items: Reçete kalemleri — recipe_id, item_id, quantity, unit
- stock_movements: Stok hareketleri — item_id, delta, source, note
- cheques: Çekler/senetler — due_date, amount, status

PARA BİRİMLERİ: TRY (₺), USD ($), EUR (€), GBP (£)

ÖNEMLİ:
- "Giden fatura" = Satış faturası (biz keseriz, müşteriye gider) → direction: outbound
- "Gelen fatura" = Alış faturası (tedarikçiden gelir) → direction: inbound
- Hammadde: item_type != 'product'
- Mamül/Ürün: item_type == 'product'`;

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // GET /api/ai-chat?models=1 → model listesi döndür
  if (req.query?.models) {
    return res.json({ models: MODEL_REGISTRY });
  }

  const { messages, conversationId, pageContext, modelMode } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });

  const groq = new Groq({ apiKey });

  // Sistem prompt
  let systemPrompt = SYSTEM_PROMPT;
  if (pageContext) {
    systemPrompt += `\n\nKullanıcı şu anda "${pageContext}" sayfasında bulunuyor. Soruları bu bağlamda değerlendir.`;
  }

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-20),
  ];

  // ── Model seçimi ─────────────────────────────────────────────────────────
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const intent = classifyIntent(lastUserMsg);
  const needsTools = intent === 'data';

  let selectedModel;
  let useTools = false;

  if (!modelMode || modelMode === 'auto') {
    // AUTO: veri sorgusu → tool modeli, sohbet → chat modeli
    if (needsTools) {
      selectedModel = AUTO_TOOL_ORDER[0]; // En iyi tool model ile başla
      useTools = true;
    } else {
      selectedModel = AUTO_CHAT_ORDER[0]; // En ucuz chat model
      useTools = false;
    }
  } else if (MODEL_REGISTRY[modelMode]) {
    selectedModel = modelMode;
    useTools = MODEL_REGISTRY[modelMode].toolUse;
  } else {
    selectedModel = 'llama-3.3-70b-versatile';
    useTools = true;
  }

  let model = selectedModel;
  let toolsUsed = [];
  const MAX_TOOL_ROUNDS = 5;

  // Chat-only model kullanıyorsak: NO TOOLS, ama sahte veri uyduramaz
  if (!useTools) {
    const chatPrompt = SYSTEM_PROMPT + '\n\nÖNEMLİ: Şu anda veritabanı araçlarına erişimin yok. Sadece genel sorulara yanıt verebilirsin. Eğer kullanıcı veri ile ilgili bir soru sorarsa (stok, fatura, müşteri vb.), ona "Bu soruyu yanıtlamak için veritabanına erişmem gerekiyor. Lütfen model olarak tool destekleyen bir model seçin veya Auto modunu kullanın." de. KESİNLİKLE veri uydurup gösterme.';
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: 'system', content: chatPrompt }, ...messages.slice(-20)],
        temperature: 0.7,
        max_completion_tokens: 1024,
        stream: false,
      });
      if (conversationId) {
        await saveConversation(conversationId, messages, completion.choices[0]?.message?.content, [], pageContext);
      }
      return res.json({
        message: completion.choices[0]?.message?.content || '',
        toolsUsed: [],
        model,
        intent,
      });
    } catch (err) {
      // Chat model de rate limit'e takılırsa
      return res.json({
        message: '⚠️ AI servisi şu an yoğun. Lütfen birkaç saniye bekleyip tekrar deneyin.',
        toolsUsed: [], model, rateLimited: true,
      });
    }
  }

  // ── Tool-capable model ile çağrı ────────────────────────────────────────
  try {
    let currentMessages = [...fullMessages];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await groq.chat.completions.create({
        model,
        messages: currentMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.5,
        max_completion_tokens: 2048,
        stream: false,
      });

      const msg = completion.choices[0].message;

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        if (conversationId) {
          await saveConversation(conversationId, messages, msg.content, toolsUsed, pageContext);
        }
        return res.json({ message: msg.content, toolsUsed, model, intent });
      }

      currentMessages.push(msg);

      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch (_) {}
        toolsUsed.push({ name: fnName, args: fnArgs });
        const result = await executeTool(fnName, fnArgs);
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    return res.json({
      message: 'Çok fazla araç çağrısı yapıldı, lütfen sorunuzu daraltın.',
      toolsUsed, model, intent,
    });

  } catch (err) {
    console.error('[ai-chat] Error:', err.message);

    // Rate limit → Auto modda sıradaki modeli dene
    if (err.status === 429 || err.message?.includes('rate_limit')) {
      if (!modelMode || modelMode === 'auto') {
        const currentIdx = AUTO_TOOL_ORDER.indexOf(model);
        const nextModel = AUTO_TOOL_ORDER[currentIdx + 1];
        if (nextModel) {
          // Sıradaki tool modeli ile recursive dene
          req.body.modelMode = nextModel;
          return handler(req, res);
        }
      }
      return res.json({
        message: '⚠️ AI servisi şu an yoğun. Lütfen birkaç saniye bekleyip tekrar deneyin.',
        toolsUsed: [], model, rateLimited: true,
      });
    }

    return res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
  }
}

// ── Konuşma kaydetme ─────────────────────────────────────────────────────────
async function saveConversation(conversationId, userMessages, aiResponse, toolsUsed, pageContext) {
  try {
    // Son kullanıcı mesajını al
    const lastUserMsg = [...userMessages].reverse().find(m => m.role === 'user');

    await supabase.from('ai_conversations').upsert({
      id: conversationId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true });

    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserMsg?.content || '',
      page_context: pageContext || null,
      created_at: new Date(Date.now() - 1000).toISOString(), // 1 saniye önce
    });

    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: aiResponse || '',
      tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      page_context: pageContext || null,
    });
  } catch (err) {
    console.error('[ai-chat] Save conversation error:', err.message);
    // Kaydetme hatası ana akışı bozmasın
  }
}
