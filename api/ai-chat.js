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
  // Yazma / oluşturma / güncelleme anahtar kelimeleri
  'ekle', 'oluştur', 'ekleme', 'yarat', 'güncelle', 'düzenle', 'değiştir',
  'stoğa ekle', 'stok gir', 'reçete oluştur', 'ürün ekle', 'kaydet',
  'yeni ürün', 'yeni müşteri', 'yeni tedarikçi', 'yeni reçete',
  'evet', 'onay', 'tamam', 'onayla', 'başla', 'yap',
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
      description: 'Ürün veya hammadde arar. Stok durumu, fiyat bilgisi içerir. has_recipe alanı reçetesi olup olmadığını gösterir.',
      parameters: {
        type: 'object',
        properties: {
          search:     { type: 'string', description: 'Ürün adı veya SKU ile ara' },
          type:       { type: 'string', enum: ['product', 'raw', 'all'], description: 'product=mamül, raw=hammadde, all=tümü', default: 'all' },
          limit:      { type: 'integer', description: 'Sonuç limiti', default: 50 },
          critical_only: { type: 'boolean', description: 'Sadece kritik stok altındakileri getir' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_invoices',
      description: 'Faturaları sorgular ve özet istatistiklerle birlikte döner. TEK ÇAĞRI ile hem fatura listesini hem de toplam/adet/kdv özetini alırsın. Nisan ayı gibi dönem sorularında date_from ve date_to kullan.',
      parameters: {
        type: 'object',
        properties: {
          direction:   { type: 'string', enum: ['inbound', 'outbound', 'all'], description: 'inbound=gelen/alış, outbound=giden/satış, all=tümü', default: 'all' },
          date_from:   { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:     { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
          customer_id: { type: 'string', description: 'Cari ID filtresi' },
          search:      { type: 'string', description: 'Fatura numarası veya cari adı ile ara' },
          limit:       { type: 'integer', description: 'Sonuç limiti', default: 200 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_orders',
      description: 'Siparişleri sorgular ve özet istatistiklerle birlikte döner. TEK ÇAĞRI ile hem sipariş listesini hem de toplam/adet özetini alırsın.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Cari ID' },
          status:      { type: 'string', description: 'Sipariş durumu filtresi' },
          date_from:   { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:     { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
          limit:       { type: 'integer', default: 200 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_order_items',
      description: 'Sipariş satır kalemlerini sorgular. Hangi üründen kaç adet satıldığını, ürün bazlı toplam ciroyu verir. En çok satılan ürünleri bulmak için kullan.',
      parameters: {
        type: 'object',
        properties: {
          date_from:   { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:     { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
          item_id:     { type: 'string', description: 'Ürün ID filtresi' },
          limit:       { type: 'integer', default: 500 },
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
          date_from:    { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:      { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
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
      description: 'Reçeteleri sorgular. Tek bir ürünün reçetesini veya TÜM reçeteleri toplam maliyetleriyle birlikte döner. Her reçetenin kalem detayları (hammadde adı, miktar, birim fiyat) ve hesaplanmış maliyet toplamı dahildir. En pahalı reçeteler, maliyet analizi vb. için kullan.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'Belirli bir ürünün reçeteleri için ürün ID' },
          search:     { type: 'string', description: 'Ürün adı ile ara (tek ürün)' },
          list_all:   { type: 'boolean', description: 'true ise TÜM reçeteleri maliyetleriyle birlikte listeler', default: false },
          limit:      { type: 'integer', description: 'list_all modunda sonuç limiti', default: 50 },
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
          date_from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:   { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
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
          date_from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to:   { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
          limit:     { type: 'integer', default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_summary_stats',
      description: 'Genel özet istatistikleri getirir: toplam ürün, hammadde, müşteri, tedarikçi, sipariş, fatura sayıları.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // ── YAZMA ARAÇLARI (Write Tools) ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'create_item',
      description: 'Yeni ürün (mamül) veya hammadde oluşturur. Kullanıcıdan ONAY aldıktan sonra çağır.',
      parameters: {
        type: 'object',
        properties: {
          name:           { type: 'string', description: 'Ürün/hammadde adı' },
          sku:            { type: 'string', description: 'Stok kodu (SKU)' },
          item_type:      { type: 'string', enum: ['product', 'rawmaterial'], description: 'product=mamül, rawmaterial=hammadde' },
          unit:           { type: 'string', description: 'Birim: Adet, Metre, Kg, vb.', default: 'Adet' },
          purchase_price: { type: 'number', description: 'Alış fiyatı' },
          sale_price:     { type: 'number', description: 'Satış fiyatı' },
          base_currency:  { type: 'string', description: 'Para birimi: TRY, USD, EUR', default: 'TRY' },
          sale_currency:  { type: 'string', description: 'Satış para birimi', default: 'TRY' },
          stock_count:    { type: 'number', description: 'Başlangıç stok miktarı', default: 0 },
          critical_limit: { type: 'number', description: 'Kritik stok limiti', default: 0 },
          vat_rate:       { type: 'number', description: 'KDV oranı (%)', default: 20 },
          category:       { type: 'string', description: 'Kategori' },
          location:       { type: 'string', description: 'Depo/konum' },
        },
        required: ['name', 'item_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_recipe',
      description: 'Bir ürün (mamül) için yeni reçete oluşturur. product_id gereklidir. Kullanıcıdan ONAY aldıktan sonra çağır.',
      parameters: {
        type: 'object',
        properties: {
          product_id:  { type: 'string', description: 'Ürün ID (items tablosundaki mamül ID)' },
          name:        { type: 'string', description: 'Reçete adı' },
          tags:        { type: 'array', items: { type: 'string' }, description: 'Etiketler' },
          other_costs: { type: 'array', items: { type: 'object' }, description: 'Diğer giderler [{type, amount, currency}]' },
        },
        required: ['product_id', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_recipe_items',
      description: 'Bir reçeteye toplu olarak hammadde/malzeme kalemleri ekler. recipe_id gereklidir. Kullanıcıdan ONAY aldıktan sonra çağır. Maksimum 30 kalem.',
      parameters: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string', description: 'Reçete ID (product_recipes tablosundaki ID)' },
          items: {
            type: 'array',
            description: 'Eklenecek kalemler listesi',
            items: {
              type: 'object',
              properties: {
                item_id:   { type: 'string', description: 'Hammadde ID (items tablosu). Null ise item_name kullanılır.' },
                item_name: { type: 'string', description: 'Malzeme adı' },
                quantity:  { type: 'number', description: 'Miktar' },
                unit:      { type: 'string', description: 'Birim', default: 'Adet' },
              },
              required: ['item_name', 'quantity'],
            },
          },
        },
        required: ['recipe_id', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_stock_movement',
      description: 'Stok hareketi (giriş/çıkış) kaydı oluşturur ve items tablosundaki stock_count değerini günceller. Kullanıcıdan ONAY aldıktan sonra çağır.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'Ürün/hammadde ID' },
          delta:   { type: 'number', description: 'Miktar değişimi (+giriş, -çıkış)' },
          source:  { type: 'string', description: 'Kaynak/sebep (ör: Reçeteli üretim, Manuel giriş)' },
          note:    { type: 'string', description: 'Açıklama notu' },
        },
        required: ['item_id', 'delta', 'source'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item',
      description: 'Mevcut bir ürün/hammaddenin bilgilerini günceller. Kullanıcıdan ONAY aldıktan sonra çağır.',
      parameters: {
        type: 'object',
        properties: {
          item_id:        { type: 'string', description: 'Güncellenecek ürün ID' },
          name:           { type: 'string', description: 'Yeni ad' },
          sku:            { type: 'string', description: 'Yeni SKU' },
          purchase_price: { type: 'number', description: 'Yeni alış fiyatı' },
          sale_price:     { type: 'number', description: 'Yeni satış fiyatı' },
          stock_count:    { type: 'number', description: 'Yeni stok miktarı' },
          critical_limit: { type: 'number', description: 'Yeni kritik limit' },
          base_currency:  { type: 'string' },
          sale_currency:  { type: 'string' },
          unit:           { type: 'string' },
          vat_rate:       { type: 'number' },
          category:       { type: 'string' },
          location:       { type: 'string' },
        },
        required: ['item_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'Yeni müşteri/cari oluşturur. Kullanıcıdan ONAY aldıktan sonra çağır.',
      parameters: {
        type: 'object',
        properties: {
          name:       { type: 'string', description: 'Müşteri adı / ünvanı' },
          vkntckn:    { type: 'string', description: 'VKN veya TCKN' },
          phone:      { type: 'string' },
          email:      { type: 'string' },
          city:       { type: 'string' },
          address:    { type: 'string' },
          tax_office: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_supplier',
      description: 'Yeni tedarikçi oluşturur. Kullanıcıdan ONAY aldıktan sonra çağır.',
      parameters: {
        type: 'object',
        properties: {
          name:       { type: 'string', description: 'Tedarikçi adı / ünvanı' },
          vkntckn:    { type: 'string', description: 'VKN veya TCKN' },
          phone:      { type: 'string' },
          email:      { type: 'string' },
          city:       { type: 'string' },
          address:    { type: 'string' },
          tax_office: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batch_create_products',
      description: `Birden fazla ürünü reçeteleriyle birlikte TEK SEFERDE toplu olarak oluşturur. 
Bu fonksiyon TÜM işlemleri (ürün oluşturma → reçete oluşturma → reçete kalemleri ekleme) otomatik olarak sırayla yapar.
AI sadece 1 kez bu fonksiyonu çağırır, gerisini backend halleder. Rate limit riski SIFIR.
Kullanıcıdan ONAY aldıktan sonra çağır. Planı göster, onay al, sonra bu fonksiyonu TEK SEFERDE çağır.`,
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            description: 'Oluşturulacak ürün listesi (her biri reçetesiyle birlikte)',
            items: {
              type: 'object',
              properties: {
                name:           { type: 'string', description: 'Ürün adı' },
                sku:            { type: 'string', description: 'Stok kodu' },
                unit:           { type: 'string', default: 'Adet' },
                purchase_price: { type: 'number' },
                sale_price:     { type: 'number' },
                base_currency:  { type: 'string', default: 'USD' },
                sale_currency:  { type: 'string', default: 'USD' },
                stock_count:    { type: 'number', default: 0 },
                critical_limit: { type: 'number', default: 0 },
                vat_rate:       { type: 'number', default: 20 },
                category:       { type: 'string' },
                location:       { type: 'string' },
                recipe: {
                  type: 'object',
                  description: 'Ürünün reçetesi',
                  properties: {
                    name: { type: 'string', description: 'Reçete adı' },
                    tags: { type: 'array', items: { type: 'string' } },
                    other_costs: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', default: 'USD' } } } },
                    items: {
                      type: 'array',
                      description: 'Reçete kalemleri',
                      items: {
                        type: 'object',
                        properties: {
                          item_id:   { type: 'string', description: 'Hammadde ID (opsiyonel)' },
                          item_name: { type: 'string', description: 'Malzeme adı' },
                          quantity:  { type: 'number' },
                          unit:      { type: 'string', default: 'Adet' },
                        },
                        required: ['item_name', 'quantity'],
                      },
                    },
                  },
                  required: ['name', 'items'],
                },
              },
              required: ['name'],
            },
          },
        },
        required: ['products'],
      },
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
        let q = supabase.from('items').select('id,name,sku,unit,item_type,stock_count,critical_limit,purchase_price,sale_price,base_currency,sale_currency,location,supplier_name,vat_rate,category').eq('is_draft', false).order('name').limit(args.limit || 50);
        if (args.type === 'product') q = q.eq('item_type', 'product');
        else if (args.type === 'raw') q = q.neq('item_type', 'product');
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        let items = data || [];
        if (args.critical_only) items = items.filter(i => i.critical_limit > 0 && i.stock_count <= i.critical_limit);

        // Reçetesi olan ürünleri işaretle
        if (items.length > 0) {
          const productIds = items.filter(i => i.item_type === 'product').map(i => i.id);
          if (productIds.length > 0) {
            const { data: recipes } = await supabase.from('product_recipes').select('product_id').in('product_id', productIds);
            const recipeProductIds = new Set((recipes || []).map(r => r.product_id));
            items = items.map(i => ({ ...i, has_recipe: recipeProductIds.has(i.id) }));
          }
        }
        return { count: items.length, data: items };
      }

      case 'query_invoices': {
        // Sadece gerekli sütunları seç — raw_detail, items vs. gibi ağır alanları ALMA
        let q = supabase.from('invoices').select('id,invoice_number,direction,total_amount,vat_amount,currency,customer_name,invoice_date,status').order('invoice_date', { ascending: false }).limit(args.limit || 200);
        if (args.direction && args.direction !== 'all') q = q.eq('direction', args.direction);
        if (args.date_from) q = q.gte('invoice_date', args.date_from);
        if (args.date_to) q = q.lte('invoice_date', args.date_to);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.search) q = q.or(`invoice_number.ilike.%${args.search}%,customer_name.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        const invoices = data || [];

        // ── Otomatik özet hesapla (AI'ın tekrar çağırmasına gerek kalmaz) ──
        const inbound = invoices.filter(i => i.direction === 'inbound');
        const outbound = invoices.filter(i => i.direction === 'outbound');
        const sumAmount = (arr) => arr.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
        const sumVat = (arr) => arr.reduce((s, i) => s + (Number(i.vat_amount) || 0), 0);

        return {
          count: invoices.length,
          summary: {
            total_invoices: invoices.length,
            inbound_count: inbound.length,
            outbound_count: outbound.length,
            inbound_total: sumAmount(inbound).toFixed(2),
            inbound_vat: sumVat(inbound).toFixed(2),
            outbound_total: sumAmount(outbound).toFixed(2),
            outbound_vat: sumVat(outbound).toFixed(2),
            grand_total: sumAmount(invoices).toFixed(2),
            grand_vat: sumVat(invoices).toFixed(2),
          },
          data: invoices,
        };
      }

      case 'query_orders': {
        let q = supabase.from('orders').select('id,order_number,customer_name,status,total,vat_total,grand_total,currency,order_date').order('order_date', { ascending: false }).limit(args.limit || 200);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.status) q = q.eq('status', args.status);
        if (args.date_from) q = q.gte('order_date', args.date_from);
        if (args.date_to) q = q.lte('order_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        const orders = data || [];

        // ── Otomatik özet hesapla ──
        const byStatus = {};
        orders.forEach(o => {
          const s = o.status || 'unknown';
          if (!byStatus[s]) byStatus[s] = { count: 0, total: 0 };
          byStatus[s].count++;
          byStatus[s].total += Number(o.grand_total) || 0;
        });
        const grandTotal = orders.reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
        const vatTotal = orders.reduce((s, o) => s + (Number(o.vat_total) || 0), 0);

        return {
          count: orders.length,
          summary: {
            total_orders: orders.length,
            grand_total: grandTotal.toFixed(2),
            vat_total: vatTotal.toFixed(2),
            by_status: byStatus,
          },
          data: orders,
        };
      }

      case 'query_order_items': {
        // Sipariş satırları (order_items) ve ilgili sipariş tarihi
        let q = supabase.from('order_items').select('id, order_id, item_id, item_name, quantity, unit, unit_price, line_total, orders!inner(order_date, status, order_number)');
        if (args.item_id) q = q.eq('item_id', args.item_id);
        if (args.date_from) q = q.gte('orders.order_date', args.date_from);
        if (args.date_to) q = q.lte('orders.order_date', args.date_to);
        q = q.limit(args.limit || 500);
        const { data, error } = await q;
        if (error) throw error;
        const items = data || [];

        // ── Ürün bazlı toplama (en çok satılanlar) ──
        const byProduct = {};
        items.forEach(oi => {
          const key = oi.item_name || oi.item_id || 'Bilinmeyen';
          if (!byProduct[key]) byProduct[key] = { item_id: oi.item_id, item_name: key, total_qty: 0, total_revenue: 0, order_count: 0 };
          byProduct[key].total_qty += Number(oi.quantity) || 0;
          byProduct[key].total_revenue += Number(oi.line_total) || 0;
          byProduct[key].order_count++;
        });
        const topProducts = Object.values(byProduct).sort((a, b) => b.total_revenue - a.total_revenue);

        return {
          count: items.length,
          summary: {
            unique_products: topProducts.length,
            total_revenue: topProducts.reduce((s, p) => s + p.total_revenue, 0).toFixed(2),
          },
          top_products: topProducts.slice(0, 20),
          data: items,
        };
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
        let q = supabase.from('payments').select('id,amount,currency,payment_type,payment_date,description,customer_id,supplier_id').order('payment_date', { ascending: false }).limit(args.limit || 30);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.supplier_id) q = q.eq('supplier_id', args.supplier_id);
        if (args.date_from) q = q.gte('payment_date', args.date_from);
        if (args.date_to) q = q.lte('payment_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_work_orders': {
        let q = supabase.from('work_orders').select('id,product_id,status,quantity,notes,created_at').order('created_at', { ascending: false }).limit(args.limit || 20);
        if (args.status) q = q.eq('status', args.status);
        if (args.product_id) q = q.eq('product_id', args.product_id);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_recipes': {
        // ── list_all modu: TÜM reçeteleri maliyetleriyle listele ──
        if (args.list_all) {
          const { data: allRecipes, error } = await supabase.from('product_recipes')
            .select('id, product_id, name, tags, other_costs, recipe_items(id, item_name, quantity, unit, item:item_id(purchase_price, base_currency))')
            .order('created_at', { ascending: false })
            .limit(args.limit || 50);
          if (error) throw error;

          // Her reçetenin toplam maliyetini hesapla
          const recipesWithCost = (allRecipes || []).map(r => {
            let materialCost = 0;
            (r.recipe_items || []).forEach(ri => {
              materialCost += (Number(ri.item?.purchase_price) || 0) * (Number(ri.quantity) || 1);
            });
            let otherCost = 0;
            (r.other_costs || []).forEach(oc => { otherCost += Number(oc.amount) || 0; });
            return {
              id: r.id,
              product_id: r.product_id,
              name: r.name,
              tags: r.tags,
              item_count: (r.recipe_items || []).length,
              material_cost: materialCost.toFixed(2),
              other_cost: otherCost.toFixed(2),
              total_cost: (materialCost + otherCost).toFixed(2),
              items: (r.recipe_items || []).map(ri => ({
                item_name: ri.item_name,
                quantity: ri.quantity,
                unit: ri.unit,
                unit_price: ri.item?.purchase_price || 0,
                currency: ri.item?.base_currency || 'TRY',
                subtotal: ((Number(ri.item?.purchase_price) || 0) * (Number(ri.quantity) || 1)).toFixed(2),
              })),
              other_costs: r.other_costs || [],
            };
          });

          // Maliyete göre sırala (en pahalı önce)
          recipesWithCost.sort((a, b) => Number(b.total_cost) - Number(a.total_cost));

          // Ürün adlarını getir
          const productIds = [...new Set(recipesWithCost.map(r => r.product_id).filter(Boolean))];
          let productNames = {};
          if (productIds.length > 0) {
            const { data: products } = await supabase.from('items').select('id, name').in('id', productIds);
            (products || []).forEach(p => { productNames[p.id] = p.name; });
          }
          recipesWithCost.forEach(r => { r.product_name = productNames[r.product_id] || 'Bilinmeyen'; });

          return { count: recipesWithCost.length, data: recipesWithCost };
        }

        // ── Tek ürün modu (mevcut davranış) ──
        let productId = args.product_id;
        if (!productId && args.search) {
          const { data: items } = await supabase.from('items').select('id').eq('item_type', 'product').ilike('name', `%${args.search}%`).limit(1);
          productId = items?.[0]?.id;
        }
        if (!productId) return { error: 'Ürün bulunamadı. Lütfen ürün adını veya ID\'sini belirtin.', data: [] };
        const { data, error } = await supabase.from('product_recipes')
          .select('*, recipe_items(*, item:item_id(id,name,unit,purchase_price,base_currency))')
          .eq('product_id', productId).order('created_at');
        if (error) throw error;

        // Maliyet hesapla
        const enriched = (data || []).map(r => {
          let materialCost = 0;
          (r.recipe_items || []).forEach(ri => {
            materialCost += (Number(ri.item?.purchase_price) || 0) * (Number(ri.quantity) || 1);
          });
          let otherCost = 0;
          (r.other_costs || []).forEach(oc => { otherCost += Number(oc.amount) || 0; });
          return { ...r, calculated_material_cost: materialCost.toFixed(2), calculated_other_cost: otherCost.toFixed(2), calculated_total_cost: (materialCost + otherCost).toFixed(2) };
        });

        return { count: enriched.length, data: enriched };
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

      // ═══════════════════════════════════════════════════════════════════════
      // ── YAZMA ARAÇLARI (Write Tool Implementations) ──────────────────────
      // ═══════════════════════════════════════════════════════════════════════

      case 'create_item': {
        const payload = {
          name: args.name,
          item_type: args.item_type || 'product',
          unit: args.unit || 'Adet',
          is_draft: false,
        };
        if (args.sku) payload.sku = args.sku;
        if (args.purchase_price != null) payload.purchase_price = args.purchase_price;
        if (args.sale_price != null) payload.sale_price = args.sale_price;
        if (args.base_currency) payload.base_currency = args.base_currency;
        if (args.sale_currency) payload.sale_currency = args.sale_currency;
        if (args.stock_count != null) payload.stock_count = args.stock_count;
        if (args.critical_limit != null) payload.critical_limit = args.critical_limit;
        if (args.vat_rate != null) payload.vat_rate = args.vat_rate;
        if (args.category) payload.category = args.category;
        if (args.location) payload.location = args.location;

        const { data, error } = await supabase.from('items').insert(payload).select('id, name, item_type, sku, unit, stock_count').single();
        if (error) throw error;
        return { success: true, message: `✅ "${data.name}" başarıyla oluşturuldu.`, data };
      }

      case 'create_recipe': {
        if (!args.product_id) return { error: 'product_id gereklidir' };
        const payload = {
          product_id: args.product_id,
          name: args.name,
          tags: args.tags || [],
        };
        if (args.other_costs) payload.other_costs = args.other_costs;
        const { data, error } = await supabase.from('product_recipes').insert(payload).select('id, product_id, name').single();
        if (error) throw error;
        return { success: true, message: `✅ Reçete "${data.name}" oluşturuldu.`, data };
      }

      case 'create_recipe_items': {
        if (!args.recipe_id) return { error: 'recipe_id gereklidir' };
        if (!args.items || !Array.isArray(args.items)) return { error: 'items array gereklidir' };
        if (args.items.length > 30) return { error: 'Maksimum 30 kalem eklenebilir. Lütfen daha küçük gruplar halinde ekleyin.' };

        const insertItems = args.items.map((item, idx) => ({
          recipe_id: args.recipe_id,
          item_id: item.item_id || null,
          item_name: item.item_name,
          quantity: item.quantity || 1,
          unit: item.unit || 'Adet',
          order_index: idx + 1,
        }));

        const { data, error } = await supabase.from('recipe_items').insert(insertItems).select('id, item_name, quantity, unit');
        if (error) throw error;
        return { success: true, message: `✅ ${data.length} kalem reçeteye eklendi.`, count: data.length, data };
      }

      case 'create_stock_movement': {
        if (!args.item_id) return { error: 'item_id gereklidir' };
        if (args.delta == null || args.delta === 0) return { error: 'delta (miktar değişimi) gereklidir ve 0 olamaz' };

        // 1) Stok hareketi kaydı oluştur
        const { error: smErr } = await supabase.from('stock_movements').insert({
          item_id: args.item_id,
          delta: args.delta,
          source: args.source || 'AI Asistan',
          note: args.note || '',
        });
        if (smErr) throw smErr;

        // 2) items tablosundaki stock_count'u güncelle
        const { data: itemData } = await supabase.from('items').select('stock_count, name').eq('id', args.item_id).single();
        const currentStock = itemData?.stock_count || 0;
        const newStock = currentStock + args.delta;
        await supabase.from('items').update({ stock_count: newStock }).eq('id', args.item_id);

        return {
          success: true,
          message: `✅ "${itemData?.name}" stok hareketi: ${args.delta > 0 ? '+' : ''}${args.delta}. Yeni stok: ${newStock}`,
          item_name: itemData?.name,
          previous_stock: currentStock,
          delta: args.delta,
          new_stock: newStock,
        };
      }

      case 'update_item': {
        if (!args.item_id) return { error: 'item_id gereklidir' };
        const patch = {};
        const allowedFields = ['name', 'sku', 'purchase_price', 'sale_price', 'stock_count', 'critical_limit', 'base_currency', 'sale_currency', 'unit', 'vat_rate', 'category', 'location'];
        for (const f of allowedFields) {
          if (args[f] !== undefined) patch[f] = args[f];
        }
        if (Object.keys(patch).length === 0) return { error: 'Güncellenecek alan belirtilmedi' };

        const { data, error } = await supabase.from('items').update(patch).eq('id', args.item_id).select('id, name, sku, stock_count').single();
        if (error) throw error;
        return { success: true, message: `✅ "${data.name}" güncellendi.`, data, updated_fields: Object.keys(patch) };
      }

      case 'create_customer': {
        const payload = { name: args.name };
        if (args.vkntckn)    payload.vkntckn = args.vkntckn;
        if (args.phone)      payload.phone = args.phone;
        if (args.email)      payload.email = args.email;
        if (args.city)       payload.city = args.city;
        if (args.address)    payload.address = args.address;
        if (args.tax_office) payload.tax_office = args.tax_office;
        payload.company_name = args.name;

        const { data, error } = await supabase.from('customers').insert(payload).select('id, name, vkntckn').single();
        if (error) throw error;
        return { success: true, message: `✅ Müşteri "${data.name}" oluşturuldu.`, data };
      }

      case 'create_supplier': {
        const payload = { name: args.name };
        if (args.vkntckn)    payload.vkntckn = args.vkntckn;
        if (args.phone)      payload.phone = args.phone;
        if (args.email)      payload.email = args.email;
        if (args.city)       payload.city = args.city;
        if (args.address)    payload.address = args.address;
        if (args.tax_office) payload.tax_office = args.tax_office;

        const { data, error } = await supabase.from('suppliers').insert(payload).select('id, name, vkntckn').single();
        if (error) throw error;
        return { success: true, message: `✅ Tedarikçi "${data.name}" oluşturuldu.`, data };
      }

      case 'batch_create_products': {
        if (!args.products || !Array.isArray(args.products) || args.products.length === 0) {
          return { error: 'products array gereklidir ve boş olamaz.' };
        }
        if (args.products.length > 20) {
          return { error: 'Tek seferde maksimum 20 ürün oluşturulabilir.' };
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const product of args.products) {
          const productResult = { name: product.name, steps: [] };

          try {
            // ── ADIM 1: Ürün oluştur ──
            const itemPayload = {
              name: product.name,
              item_type: 'product',
              unit: product.unit || 'Adet',
              is_draft: false,
            };
            if (product.sku) itemPayload.sku = product.sku;
            if (product.purchase_price != null) itemPayload.purchase_price = product.purchase_price;
            if (product.sale_price != null) itemPayload.sale_price = product.sale_price;
            if (product.base_currency) itemPayload.base_currency = product.base_currency;
            if (product.sale_currency) itemPayload.sale_currency = product.sale_currency;
            if (product.stock_count != null) itemPayload.stock_count = product.stock_count;
            if (product.critical_limit != null) itemPayload.critical_limit = product.critical_limit;
            if (product.vat_rate != null) itemPayload.vat_rate = product.vat_rate;
            if (product.category) itemPayload.category = product.category;
            if (product.location) itemPayload.location = product.location;

            const { data: itemData, error: itemErr } = await supabase
              .from('items').insert(itemPayload).select('id, name, sku').single();
            if (itemErr) throw new Error(`Ürün oluşturma hatası: ${itemErr.message}`);
            productResult.item_id = itemData.id;
            productResult.steps.push(`✅ Ürün oluşturuldu (ID: ${itemData.id})`);

            // ── ADIM 2: Reçete oluştur (varsa) ──
            if (product.recipe) {
              const recipePayload = {
                product_id: itemData.id,
                name: product.recipe.name || `${product.name} - Reçete`,
                tags: product.recipe.tags || [],
              };
              if (product.recipe.other_costs) recipePayload.other_costs = product.recipe.other_costs;

              const { data: recipeData, error: recipeErr } = await supabase
                .from('product_recipes').insert(recipePayload).select('id, name').single();
              if (recipeErr) throw new Error(`Reçete oluşturma hatası: ${recipeErr.message}`);
              productResult.recipe_id = recipeData.id;
              productResult.steps.push(`✅ Reçete oluşturuldu (ID: ${recipeData.id})`);

              // ── ADIM 3: Reçete kalemlerini ekle ──
              if (product.recipe.items && product.recipe.items.length > 0) {
                const insertItems = product.recipe.items.map((item, idx) => ({
                  recipe_id: recipeData.id,
                  item_id: item.item_id || null,
                  item_name: item.item_name,
                  quantity: item.quantity || 1,
                  unit: item.unit || 'Adet',
                  order_index: idx + 1,
                }));

                const { data: riData, error: riErr } = await supabase
                  .from('recipe_items').insert(insertItems).select('id');
                if (riErr) throw new Error(`Reçete kalemleri hatası: ${riErr.message}`);
                productResult.steps.push(`✅ ${riData.length} reçete kalemi eklendi`);
                productResult.recipe_item_count = riData.length;
              }
            }

            productResult.success = true;
            successCount++;
          } catch (err) {
            productResult.success = false;
            productResult.error = err.message;
            productResult.steps.push(`❌ Hata: ${err.message}`);
            errorCount++;
          }

          results.push(productResult);
        }

        return {
          success: errorCount === 0,
          message: errorCount === 0
            ? `✅ Tüm ${successCount} ürün başarıyla oluşturuldu (reçeteleriyle birlikte).`
            : `⚠️ ${successCount} ürün başarılı, ${errorCount} ürün hatalı.`,
          total: args.products.length,
          success_count: successCount,
          error_count: errorCount,
          results,
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
Görevin: Kullanıcının ERP verilerini sorgulamasına, analiz etmesine ve VERİTABANINA YAZMASINA yardımcı olmak.

BUGÜNÜN TARİHİ: {{TODAY_DATE}}

KRİTİK KURALLAR:
1. Her zaman Türkçe yanıt ver. Profesyonel ama samimi bir üslup kullan.
2. KESİNLİKLE VERİ UYDURMA. Sadece tool fonksiyonlarından aldığın gerçek verileri kullan.
3. Eğer bir bilgiyi sorgulayamıyorsan, açıkça "Bu bilgiye erişemiyorum" de. ASLA tahmin etme.
4. Okuma işlemlerini direkt yap — onay gerektirmez.
5. Sayısal verilerde para birimi (₺, $, €) ve birim kullan.
6. Belirsiz durumlarda kullanıcıya sor — tahmin etme.
7. Tabloları markdown formatında göster.
8. Büyük veri setlerinde özet ver, en önemli kalemlerden bahset.

══════════════════════════════════════════════════════════════════
YAZMA İŞLEMLERİ KURALLARI (ÇOK ÖNEMLİ):
══════════════════════════════════════════════════════════════════

✅ YAPABİLECEKLERİN:
- Yeni ürün/hammadde oluşturma (create_item)
- Yeni reçete oluşturma (create_recipe)
- Reçeteye kalem ekleme (create_recipe_items)
- Stok hareketi kaydetme (create_stock_movement)
- Ürün bilgilerini güncelleme (update_item)
- Yeni müşteri/tedarikçi oluşturma (create_customer, create_supplier)

🚫 ASLA YAPAMADIĞIN İŞLEMLER:
- SİLME işlemi (DELETE) — hiçbir koşulda, hiçbir tabloda, asla silme yapma
- Fatura oluşturma/güncelleme (invoices) — sadece okuyabilirsin
- Sipariş oluşturma/güncelleme (orders) — sadece okuyabilirsin
- Ödeme oluşturma (payments) — sadece okuyabilirsin

📋 YAZMA ADIMI İÇİN ZORUNLU AKIŞ:
1. Kullanıcı bir yazma isteğinde bulunduğunda, ÖNCE yapacağın TÜM işlemleri detaylı bir tablo/liste olarak açıkla:
   - Hangi tabloya ne yazılacak
   - Her kalem için: ad, miktar, birim, fiyat, para birimi vb.
   - Toplam kaç kayıt oluşturulacak
2. Planı gösterdikten sonra kullanıcıdan AÇIKÇA ONAY iste: "Bu işlemleri gerçekleştirmemi ister misiniz?"
3. Kullanıcı "evet", "onay", "tamam", "yap", "başla", "devam et" gibi olumlu yanıt verene KADAR yazma tool'larını ÇAĞIRMA.
4. Onay aldıktan sonra tool'u çağır. Tek seferde.

⚠️ GÜVENLİK SINIRLARI:
- Tek seferde maksimum 30 reçete kalemi eklenebilir (create_recipe_items limiti)
- Tek seferde maksimum 20 ürün oluşturulabilir (batch_create_products limiti)
- Hata alırsan dur, kullanıcıya bildir, devam etme

🚀 TOPLU ÜRÜN + REÇETE OLUŞTURMA (KRİTİK — HER ZAMAN BU YÖNTEMİ KULLAN):
Birden fazla ürün oluşturulacaksa veya ürün + reçete birlikte oluşturulacaksa:
→ HER ZAMAN "batch_create_products" fonksiyonunu TEK SEFERDE çağır.
→ create_item, create_recipe, create_recipe_items'ı TEK TEK ÇAĞIRMA.
→ batch_create_products tüm adımları (ürün → reçete → kalemler) backend'de sırayla yapar.
→ AI sadece 1 kez fonksiyon çağırır, rate limit riski sıfır, işlem çok hızlı.

Örnek akış:
1. Kullanıcı: "L100, L120, L150, L200 ürünlerini reçeteleriyle ekle"
2. AI: Planı tablo olarak gösterir, onay ister
3. Kullanıcı: "onay" / "yap" / "devam et"
4. AI: batch_create_products({ products: [...] }) → TEK ÇAĞRI
5. Backend: 4 ürün + 4 reçete + tüm kalemleri otomatik oluşturur
6. AI: Sonucu raporlar

Tek ürün oluşturmak için de batch_create_products kullanabilirsin (products: [tek ürün]).
create_item/create_recipe/create_recipe_items sadece spesifik tek bir işlem gerektiğinde kullan.

TEKRAR: HİÇBİR KOŞULDA sahte veya uydurma veri gösterme. Sadece veritabanından gelen gerçek verileri kullan.

VERİTABANI TABLOLARI:
- customers: Cariler (müşteriler) — name, vkntckn, phone, email, balance
- suppliers: Tedarikçiler — name, vkntckn, phone, email
- items: Ürünler ve hammaddeler — name, sku, item_type (product/rawmaterial), stock_count, purchase_price, sale_price, base_currency, sale_currency, critical_limit, vat_rate, category, unit, location
- invoices: Faturalar — direction (inbound/outbound), total_amount, vat_amount, customer_name, invoice_date
- orders: Siparişler — order_number, customer_name, status, grand_total, currency, order_date
- order_items: Sipariş satırları — order_id, item_id, item_name, quantity, unit_price, line_total
- quotes: Teklifler — quote_number, customer_name, status, total
- payments: Ödemeler — amount, payment_date, customer_id, supplier_id
- work_orders: İş emirleri — product_id, status, quantity
- product_recipes: Reçeteler — product_id, name, tags, other_costs (JSON array: [{type, amount, currency}])
- recipe_items: Reçete kalemleri — recipe_id, item_id, item_name, quantity, unit, order_index
- stock_movements: Stok hareketleri — item_id, delta, source, note
- cheques: Çekler/senetler — due_date, amount, status

PARA BİRİMLERİ: TRY (₺), USD ($), EUR (€), GBP (£)

ÖNEMLİ:
- "Giden fatura" = Satış faturası → direction: outbound
- "Gelen fatura" = Alış faturası → direction: inbound
- Hammadde: item_type != 'product'
- Mamül/Ürün: item_type == 'product'
- Tarih filtresi: date_from/date_to argümanlarını YYYY-MM-DD formatında kullan`;

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

  // Sistem prompt — bugünün tarihini enjekte et (Türkiye saat dilimi)
  const today = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD
  let systemPrompt = SYSTEM_PROMPT.replace('{{TODAY_DATE}}', `${today} (${todayISO})`);
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
  const MAX_TOOL_ROUNDS = 12; // Yazma işlemleri için yükseltildi (ürün+reçete+kalemler = çok adım)

  // Chat-only model kullanıyorsak: NO TOOLS, ama sahte veri uyduramaz
  if (!useTools) {
    const chatPrompt = systemPrompt + '\n\nÖNEMLİ: Şu anda veritabanı araçlarına erişimin yok. Sadece genel sorulara yanıt verebilirsin. Eğer kullanıcı veri ile ilgili bir soru sorarsa veya yazma/ekleme isterse (stok, fatura, müşteri, reçete, ürün ekle vb.), ona "Bu işlem için veritabanına erişmem gerekiyor. Lütfen tool destekleyen bir model seçin veya Auto modunu kullanın." de. KESİNLİKLE veri uydurup gösterme.';
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: 'system', content: chatPrompt }, ...messages.slice(-20)],
        temperature: 0.7,
        max_completion_tokens: 2048,
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
    // Auto modda kullanılabilecek modeller listesi (mevcut modelden başlayarak)
    const fallbackModels = (!modelMode || modelMode === 'auto')
      ? AUTO_TOOL_ORDER.slice(AUTO_TOOL_ORDER.indexOf(model))
      : [model];
    let currentModelIdx = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let completion;
      let retried = false;

      // Rate limit'e takılırsa sıradaki modelle dene
      for (let modelAttempt = currentModelIdx; modelAttempt < fallbackModels.length; modelAttempt++) {
        const activeModel = fallbackModels[modelAttempt];
        try {
          completion = await groq.chat.completions.create({
            model: activeModel,
            messages: currentMessages,
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.5,
            max_completion_tokens: 4096,
            stream: false,
          });
          // Başarılı — bu modeli kullanmaya devam et
          model = activeModel;
          currentModelIdx = modelAttempt;
          break;
        } catch (rateLimitErr) {
          if ((rateLimitErr.status === 429 || rateLimitErr.message?.includes('rate_limit')) && modelAttempt < fallbackModels.length - 1) {
            console.log(`[ai-chat] Rate limit on ${activeModel}, switching to ${fallbackModels[modelAttempt + 1]}`);
            retried = true;
            // Kısa bekleme — rate limit penceresinin geçmesi için
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw rateLimitErr; // Başka hata veya son model — yukarı fırlat
        }
      }

      if (!completion) {
        // Tüm modeller rate limit'e takıldı
        return res.json({
          message: '⚠️ Tüm AI modelleri şu an yoğun. ' + (toolsUsed.length > 0 ? `Şu ana kadar ${toolsUsed.length} işlem yapıldı. Lütfen birkaç saniye bekleyip "devam et" yazın.` : 'Lütfen birkaç saniye bekleyip tekrar deneyin.'),
          toolsUsed, model, rateLimited: true,
        });
      }

      const msg = completion.choices[0].message;
      const finishReason = completion.choices[0].finish_reason;

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        let content = msg.content || '';

        // Boş yanıt kontrolü
        if (!content.trim()) {
          content = '⏳ İşleniyor... Lütfen mesajınızı tekrar gönderebilir misiniz?';
        }

        const isTruncated = finishReason === 'length';

        // Model değişimi olduysa bildir
        if (retried && content) {
          content = content; // Sessizce devam — kullanıcıyı rahatsız etme
        }

        if (conversationId) {
          await saveConversation(conversationId, messages, content, toolsUsed, pageContext);
        }
        return res.json({ message: content, toolsUsed, model, intent, truncated: isTruncated });
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

    // Max rounds aşıldı ama bir miktar iş yapıldı
    const partialMsg = toolsUsed.length > 0
      ? `⚠️ Çok fazla adım gerekti (${toolsUsed.length} araç çağrısı yapıldı). Lütfen kalan işlemler için tekrar isteyin.`
      : 'Çok fazla araç çağrısı yapıldı, lütfen sorunuzu daraltın.';

    return res.json({
      message: partialMsg,
      toolsUsed, model, intent,
    });

  } catch (err) {
    console.error('[ai-chat] Error:', err.message);

    // Rate limit → Auto modda sıradaki modeli dene (ilk çağrıda rate limit gelirse)
    if (err.status === 429 || err.message?.includes('rate_limit')) {
      if (!modelMode || modelMode === 'auto') {
        const currentIdx = AUTO_TOOL_ORDER.indexOf(model);
        const nextModel = AUTO_TOOL_ORDER[currentIdx + 1];
        if (nextModel) {
          req.body.modelMode = nextModel;
          return handler(req, res);
        }
      }
      return res.json({
        message: '⚠️ AI servisi şu an yoğun. Lütfen birkaç saniye bekleyip tekrar deneyin.',
        toolsUsed: toolsUsed || [], model, rateLimited: true,
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
