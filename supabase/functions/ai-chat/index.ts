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

    for (let round = 0; round < 15; round++) { // Increased rounds for complex tool sequences
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

// --- HELPERS ---

function sanitizeArgs(args: any) {
  const cleaned = { ...args }
  if (cleaned.limit !== undefined) cleaned.limit = parseInt(cleaned.limit, 10) || 20
  if (cleaned.critical_only !== undefined) cleaned.critical_only = cleaned.critical_only === true || cleaned.critical_only === 'true'
  return cleaned
}

const evalMath = (val: any) => {
  if (val == null) return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const str = val.replace(/,/g, '.').replace(/[^0-9.\-*\/+() ]/g, ''); 
    try {
      const res = Number(Function(`"use strict"; return (${str})`)());
      return isNaN(res) ? 0 : res;
    } catch {
      return parseFloat(str) || 0;
    }
  }
  return 0;
};

async function executeTool(supabase: any, name: string, rawArgs: any) {
  const args = sanitizeArgs(rawArgs)
  try {
    switch (name) {
      case 'query_customers': {
        let q = supabase.from('customers').select('id,name,vkntckn,phone,email,city,balance,total_sales').order('name').limit(args.limit || 20);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
        const { data, error } = await q;
        return error ? { error: error.message } : { count: data?.length || 0, data: data || [] };
      }
      case 'query_suppliers': {
        let q = supabase.from('suppliers').select('id,name,vkntckn,phone,email,city').order('name').limit(args.limit || 20);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%`);
        const { data, error } = await q;
        return error ? { error: error.message } : { count: data?.length || 0, data: data || [] };
      }
      case 'query_items': {
        let q = supabase.from('items').select('*').eq('is_draft', false).order('name').limit(args.limit || 50);
        if (args.type === 'product') q = q.eq('item_type', 'product');
        else if (args.type === 'raw') q = q.neq('item_type', 'product');
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        let items = data || [];
        if (args.critical_only) items = items.filter((i: any) => i.critical_limit > 0 && i.stock_count <= i.critical_limit);
        return { count: items.length, data: items };
      }
      case 'query_invoices': {
        let q = supabase.from('invoices').select('*').order('invoice_date', { ascending: false }).limit(args.limit || 100);
        if (args.direction && args.direction !== 'all') q = q.eq('direction', args.direction);
        if (args.date_from) q = q.gte('invoice_date', args.date_from);
        if (args.date_to) q = q.lte('invoice_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        const invoices = data || [];
        const inbound = invoices.filter((i: any) => i.direction === 'inbound');
        const outbound = invoices.filter((i: any) => i.direction === 'outbound');
        const sumAmount = (arr: any[]) => arr.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
        return {
          count: invoices.length,
          summary: {
            total_invoices: invoices.length,
            inbound_total: sumAmount(inbound).toFixed(2),
            outbound_total: sumAmount(outbound).toFixed(2),
          },
          data: invoices,
        };
      }
      case 'query_recipes': {
        let productId = args.product_id;
        if (!productId && args.search) {
          const { data: items } = await supabase.from('items').select('id').eq('item_type', 'product').ilike('name', `%${args.search}%`).limit(1);
          productId = items?.[0]?.id;
        }
        if (!productId) return { error: 'Ürün bulunamadı.' };
        const { data, error } = await supabase.from('product_recipes')
          .select('*, recipe_items(*, item:item_id(id,name,unit,purchase_price,base_currency))')
          .eq('product_id', productId).order('created_at');
        if (error) throw error;
        const enriched = (data || []).map((r: any) => {
          let materialCost = 0;
          (r.recipe_items || []).forEach((ri: any) => {
            materialCost += (Number(ri.item?.purchase_price) || 0) * (Number(ri.quantity) || 1);
          });
          let otherCost = 0;
          (r.other_costs || []).forEach((oc: any) => { otherCost += Number(oc.amount) || 0; });
          return { ...r, calculated_total_cost: (materialCost + otherCost).toFixed(2) };
        });
        return { count: enriched.length, data: enriched };
      }
      case 'batch_create_products': {
        const results = []
        for (const product of args.products) {
          try {
            const { data: item, error: itemErr } = await supabase.from('items').insert({
              name: product.name,
              sku: product.sku,
              item_type: 'product',
              unit: product.unit || 'Adet',
              purchase_price: evalMath(product.purchase_price),
              sale_price: evalMath(product.sale_price),
              base_currency: product.base_currency || 'TRY',
              stock_count: evalMath(product.stock_count) || 0,
              is_draft: false
            }).select('id').single()
            if (itemErr) throw itemErr
            
            if (product.recipe) {
              const { data: recipe, error: recErr } = await supabase.from('product_recipes').insert({
                product_id: item.id,
                name: product.recipe.name || `${product.name} Reçete`
              }).select('id').single()
              if (recErr) throw recErr
              
              if (product.recipe.items) {
                const recipeItems = product.recipe.items.map((ri: any, idx: number) => ({
                  recipe_id: recipe.id,
                  item_id: ri.item_id || null,
                  item_name: ri.item_name,
                  quantity: evalMath(ri.quantity),
                  unit: ri.unit || 'Adet',
                  order_index: idx + 1
                }))
                await supabase.from('recipe_items').insert(recipeItems)
              }
            }
            results.push({ name: product.name, success: true, id: item.id })
          } catch (e: any) {
            results.push({ name: product.name, success: false, error: e.message })
          }
        }
        return { results }
      }
      case 'create_stock_movement': {
        const { error } = await supabase.from('stock_movements').insert({
          item_id: args.item_id,
          delta: args.delta,
          source: args.source || 'AI Asistan',
          note: args.note || ''
        })
        if (error) throw error
        const { data: item } = await supabase.from('items').select('stock_count').eq('id', args.item_id).single()
        const newStock = (item?.stock_count || 0) + args.delta
        await supabase.from('items').update({ stock_count: newStock }).eq('id', args.item_id)
        return { success: true, new_stock: newStock }
      }
      default: return { error: `Bilinmeyen fonksiyon: ${name}` }
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
- Toplu ürün+reçete oluşturma (batch_create_products)

🚫 ASLA YAPAMADIĞIN İŞLEMLER:
- SİLME işlemi (DELETE) — hiçbir tabloyu silme

📋 YAZMA ADIMI İÇİN ZORUNLU AKIŞ:
1. Önce yapacağın işlemleri detaylı bir tablo olarak açıkla.
2. Kullanıcıdan ONAY iste.
3. Onay aldıktan sonra tool'u çağır.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_items',
      description: 'Ürün veya hammadde arar.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          type: { type: 'string', enum: ['product', 'raw', 'all'], default: 'all' },
          limit: { type: 'integer', default: 50 },
          critical_only: { type: 'boolean' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_customers',
      description: 'Müşterileri (carileri) arar.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          limit: { type: 'integer', default: 20 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_suppliers',
      description: 'Tedarikçileri arar.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          limit: { type: 'integer', default: 20 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_invoices',
      description: 'Faturaları sorgular.',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['inbound', 'outbound', 'all'], default: 'all' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          limit: { type: 'integer', default: 100 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_recipes',
      description: 'Reçeteleri sorgular. Ürün reçetelerini ve kalemlerini maliyetleriyle listeler.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'integer', default: 50 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'batch_create_products',
      description: 'Toplu ürün ve reçete oluşturur.',
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sku: { type: 'string' },
                unit: { type: 'string' },
                purchase_price: { type: 'number' },
                sale_price: { type: 'number' },
                recipe: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          item_name: { type: 'string' },
                          quantity: { type: 'number' }
                        },
                        required: ['item_name', 'quantity']
                      }
                    }
                  }
                }
              },
              required: ['name']
            }
          }
        },
        required: ['products']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_stock_movement',
      description: 'Stok hareketi kaydı oluşturur.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          delta: { type: 'number' },
          source: { type: 'string' },
          note: { type: 'string' }
        },
        required: ['item_id', 'delta']
      }
    }
  }
]
