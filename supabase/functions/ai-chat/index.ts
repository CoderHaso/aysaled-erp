import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1"
import OpenAI from "https://esm.sh/openai@4.86.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, conversationId, pageContext, modelMode } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY missing' }), { status: 500, headers: corsHeaders })

    const openai = new OpenAI({ apiKey: deepseekApiKey, baseURL: 'https://api.deepseek.com' })

    const today = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
    const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
    
    let systemPrompt = SYSTEM_PROMPT.replace('{{TODAY_DATE}}', `${today} (${todayISO})`)
    if (pageContext) systemPrompt += `\n\nKullanıcı şu anda "${pageContext}" sayfasında bulunuyor.`

    const currentMessages = [{ role: 'system', content: systemPrompt }, ...messages.slice(-20)]
    const model = modelMode || 'deepseek-v4-pro'
    let toolsUsed = []

    for (let round = 0; round < 12; round++) {
      const apiOptions: any = {
        model,
        messages: currentMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.5,
        max_completion_tokens: 4096,
        stream: false,
      }
      if (model === 'deepseek-v4-pro') {
        apiOptions.thinking = { type: 'enabled', budget_tokens: 4096 }
        apiOptions.reasoning_effort = 'high'
      }

      const completion = await openai.chat.completions.create(apiOptions)
      const msg = completion.choices[0].message
      if (!msg.tool_calls) {
        const content = msg.content || ''
        if (conversationId) await saveConversation(supabase, conversationId, messages, content, toolsUsed, pageContext)
        return new Response(JSON.stringify({ message: content, toolsUsed, model }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      currentMessages.push(msg)
      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name
        let fnArgs = {}
        try { fnArgs = JSON.parse(toolCall.function.arguments) } catch (_) {}
        toolsUsed.push({ name: fnName, args: fnArgs })
        const result = await executeTool(supabase, fnName, fnArgs)
        currentMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
      }
    }
    return new Response(JSON.stringify({ message: '⚠️ Çok fazla işlem.', toolsUsed, model }), { headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

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
1. Kullanıcı bir yazma isteğinde bulunduğunda, ÖNCE yapacağın TÜM işlemleri detaylı bir tablo/liste olarak açıkla.
2. Planı gösterdikten sonra kullanıcıdan AÇIKÇA ONAY iste: "Bu işlemleri gerçekleştirmemi ister misiniz?"
3. Kullanıcı olumlu yanıt verene KADAR yazma tool'larını ÇAĞIRMA.
4. Onay aldıktan sonra tool'u çağır. Tek seferde.

🚀 TOPLU ÜRÜN + REÇETE OLUŞTURMA (KRİTİK):
HER ZAMAN "batch_create_products" fonksiyonunu TEK SEFERDE çağır.

VERİTABANI TABLOLARI:
- customers: Cariler (müşteriler) — name, vkntckn, phone, email, balance
- suppliers: Tedarikçiler — name, vkntckn, phone, email
- items: Ürünler ve hammaddeler — name, sku, item_type (product/rawmaterial), stock_count, purchase_price, sale_price, base_currency, sale_currency, critical_limit, vat_rate, category, unit, location
- invoices: Faturalar — direction (inbound/outbound), total_amount, vat_amount, customer_name, invoice_date
- orders: Siparişler — order_number, customer_name, status, grand_total, currency, order_date
- product_recipes: Reçeteler — product_id, name, tags, other_costs (JSON array: [{type, amount, currency}])
- recipe_items: Reçete kalemleri — recipe_id, item_id, item_name, quantity, unit, order_index
- stock_movements: Stok hareketleri — item_id, delta, source, note`

const TOOLS = [
  { type: 'function', function: { name: 'query_items', description: 'Stoktaki ürünleri ve hammaddeleri arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, type: { type: 'string', enum: ['product', 'raw', 'all'] }, limit: { type: 'number', default: 50 }, critical_only: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'query_customers', description: 'Müşterileri (carileri) arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number', default: 20 } } } } },
  { type: 'function', function: { name: 'query_suppliers', description: 'Tedarikçileri arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number', default: 20 } } } } },
  { type: 'function', function: { name: 'query_invoices', description: 'Faturaları sorgular.', parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['inbound', 'outbound', 'all'] }, date_from: { type: 'string' }, date_to: { type: 'string' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'batch_create_products', description: 'Toplu ürün ve reçete oluşturur.', parameters: { type: 'object', properties: { products: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, sku: { type: 'string' }, unit: { type: 'string' }, purchase_price: { type: 'number' }, sale_price: { type: 'number' }, stock_count: { type: 'number' }, recipe: { type: 'object', properties: { name: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { item_name: { type: 'string' }, quantity: { type: 'number' } }, required: ['item_name', 'quantity'] } } } } }, required: ['name'] } } }, required: ['products'] } } },
  { type: 'function', function: { name: 'create_stock_movement', description: 'Stok hareketi kaydı oluşturur.', parameters: { type: 'object', properties: { item_id: { type: 'string' }, delta: { type: 'number' }, source: { type: 'string' }, note: { type: 'string' } }, required: ['item_id', 'delta'] } } }
]

async function executeTool(supabase: any, name: string, args: any) {
  try {
    switch (name) {
      case 'query_items': {
        let q = supabase.from('items').select('*').eq('is_draft', false).limit(args.limit || 50)
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`)
        const { data, error } = await q
        return error ? { error: error.message } : { data }
      }
      case 'query_customers': {
        let q = supabase.from('customers').select('*').limit(args.limit || 20)
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%`)
        const { data, error } = await q
        return error ? { error: error.message } : { data }
      }
      case 'batch_create_products': {
        const results = []
        for (const p of args.products) {
          const { data: item, error: itemErr } = await supabase.from('items').insert({ name: p.name, item_type: 'product', stock_count: p.stock_count || 0, is_draft: false }).select('id').single()
          if (!itemErr && p.recipe) {
             const { data: rec } = await supabase.from('product_recipes').insert({ product_id: item.id, name: p.recipe.name }).select('id').single()
             if (rec && p.recipe.items) {
               await supabase.from('recipe_items').insert(p.recipe.items.map((ri: any) => ({ recipe_id: rec.id, item_name: ri.item_name, quantity: ri.quantity })))
             }
          }
          results.push({ name: p.name, success: !itemErr })
        }
        return { results }
      }
      default: return { error: 'Unknown tool' }
    }
  } catch (err: any) { return { error: err.message } }
}

async function saveConversation(supabase: any, conversationId: string, userMessages: any[], aiResponse: string, toolsUsed: any[], pageContext: string | null) {
  try {
    const lastUserMsg = [...userMessages].reverse().find(m => m.role === 'user')
    await supabase.from('ai_conversations').upsert({ id: conversationId, updated_at: new Date().toISOString() })
    await supabase.from('ai_messages').insert([
      { conversation_id: conversationId, role: 'user', content: lastUserMsg?.content || '', page_context: pageContext },
      { conversation_id: conversationId, role: 'assistant', content: aiResponse, tools_used: toolsUsed }
    ])
  } catch (e) { console.error('Save error:', e) }
}
