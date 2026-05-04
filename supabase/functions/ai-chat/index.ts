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

    for (let round = 0; round < 15; round++) {
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

const evalMath = (val: any) => {
  if (val == null) return val;
  if (typeof val === 'number') return parseFloat(val.toFixed(10));
  if (typeof val === 'string') {
    const str = val.replace(/,/g, '.').replace(/[^0-9.\-*\/+() ]/g, ''); 
    try {
      let res = Number(Function(`"use strict"; return (${str})`)());
      res = parseFloat(res.toFixed(10));
      return isNaN(res) ? 0 : res;
    } catch {
      const p = parseFloat(str);
      return isNaN(p) ? 0 : parseFloat(p.toFixed(10));
    }
  }
  return 0;
};

const normalizeName = (name: string) => {
  if (!name) return '';
  return name
    .replace(/[\u2010-\u2015]/g, '-') 
    .replace(/\//g, '-')             
    .replace(/\s+/g, ' ')            
    .trim()
    .toLowerCase();
};

async function executeTool(supabase: any, name: string, args: any) {
  try {
    switch (name) {
      case 'query_customers': {
        let q = supabase.from('customers').select('*').order('name').limit(args.limit || 20);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_suppliers': {
        let q = supabase.from('suppliers').select('*').order('name').limit(args.limit || 20);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,vkntckn.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
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
        // Kolon hatası riskine karşı '*' kullanarak tümünü çekiyoruz
        let q = supabase.from('invoices').select('*').order('invoice_date', { ascending: false }).limit(args.limit || 200);
        if (args.direction && args.direction !== 'all') q = q.eq('direction', args.direction);
        if (args.date_from) q = q.gte('invoice_date', args.date_from);
        if (args.date_to) q = q.lte('invoice_date', args.date_to);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.search) q = q.or(`invoice_number.ilike.%${args.search}%,customer_name.ilike.%${args.search}%`);
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

      case 'query_orders': {
        let q = supabase.from('orders').select('*').order('order_date', { ascending: false }).limit(args.limit || 200);
        if (args.customer_id) q = q.eq('customer_id', args.customer_id);
        if (args.status) q = q.eq('status', args.status);
        if (args.date_from) q = q.gte('order_date', args.date_from);
        if (args.date_to) q = q.lte('order_date', args.date_to);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_order_items': {
        // İlişkisel sorguyu daha garanti hale getiriyoruz
        let q = supabase.from('order_items').select('*, orders(*)');
        if (args.item_id) q = q.eq('item_id', args.item_id);
        if (args.date_from) q = q.gte('orders.order_date', args.date_from);
        if (args.date_to) q = q.lte('orders.order_date', args.date_to);
        const { data, error } = await q.limit(args.limit || 500);
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
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
          const items = (r.recipe_items || []).map((ri: any) => {
            const currentName = ri.item?.name || ri.item_name;
            const currentUnit = ri.item?.unit || ri.unit;
            materialCost += (Number(ri.item?.purchase_price) || 0) * (Number(ri.quantity) || 1);
            return { ...ri, item_name: currentName, unit: currentUnit };
          });
          let otherCost = 0;
          (r.other_costs || []).forEach((oc: any) => { otherCost += Number(oc.amount) || 0; });
          return { ...r, recipe_items: items, calculated_total_cost: (materialCost + otherCost).toFixed(2) };
        });
        return { count: enriched.length, data: enriched };
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

      case 'batch_create_products': {
        if (!args.products || !Array.isArray(args.products)) return { error: 'products array required' };
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        const missingNames = new Set();
        args.products.forEach((p: any) => {
          if (p.recipe && p.recipe.items) {
            p.recipe.items.forEach((i: any) => {
              if (!i.item_id && i.item_name) missingNames.add(i.item_name);
            });
          }
        });

        const nameToIdMap: Record<string, string> = {};
        if (missingNames.size > 0) {
          const searchNames = Array.from(missingNames) as string[];
          const variations = [...searchNames, ...searchNames.map(n => n.replace(/-/g, '‑')), ...searchNames.map(n => n.replace(/\//g, '-'))];
          const { data: foundItems } = await supabase.from('items').select('id, name').in('name', variations);
          (foundItems || []).forEach((fi: any) => {
            nameToIdMap[fi.name] = fi.id;
            nameToIdMap[normalizeName(fi.name)] = fi.id;
          });
        }

        for (const product of args.products) {
          const productResult: any = { name: product.name, steps: [] };
          try {
            const itemPayload: any = { name: product.name, item_type: 'product', unit: product.unit || 'Adet', is_draft: false, sku: product.sku, purchase_price: evalMath(product.purchase_price), sale_price: evalMath(product.sale_price), base_currency: product.base_currency || 'TRY', stock_count: evalMath(product.stock_count) || 0 };
            const { data: itemData, error: itemErr } = await supabase.from('items').insert(itemPayload).select('id').single();
            if (itemErr) throw itemErr;
            if (product.recipe) {
              const recipePayload: any = { product_id: itemData.id, name: product.recipe.name || `${product.name} Reçete`, tags: product.recipe.tags || [] };
              if (product.recipe.other_costs) recipePayload.other_costs = product.recipe.other_costs.map((oc: any) => ({ ...oc, amount: evalMath(oc.amount) }));
              const { data: recipeData, error: recErr } = await supabase.from('product_recipes').insert(recipePayload).select('id').single();
              if (recErr) throw recErr;
              if (product.recipe.items) {
                const recipeItems = product.recipe.items.map((ri: any, idx: number) => ({ recipe_id: recipeData.id, item_id: ri.item_id || nameToIdMap[normalizeName(ri.item_name)] || nameToIdMap[ri.item_name] || null, item_name: ri.item_name, quantity: evalMath(ri.quantity), unit: ri.unit || 'Adet', order_index: idx + 1 }));
                await supabase.from('recipe_items').insert(recipeItems);
              }
            }
            productResult.success = true;
            successCount++;
          } catch (e: any) { productResult.success = false; productResult.error = e.message; errorCount++; }
          results.push(productResult);
        }
        return { success: errorCount === 0, results, successCount, errorCount };
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

BUGÜNÜN TARİHİ: {{TODAY_DATE}}`

const TOOLS = [
  { type: 'function', function: { name: 'query_items', description: 'Ürün veya hammadde arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, type: { type: 'string', enum: ['product', 'raw', 'all'], default: 'all' }, limit: { type: 'integer', default: 50 }, critical_only: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'query_customers', description: 'Müşterileri (carileri) arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'integer', default: 20 } } } } },
  { type: 'function', function: { name: 'query_suppliers', description: 'Tedarikçileri arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'integer', default: 20 } } } } },
  { type: 'function', function: { name: 'query_invoices', description: 'Faturaları sorgular.', parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['inbound', 'outbound', 'all'], default: 'all' }, date_from: { type: 'string' }, date_to: { type: 'string' }, limit: { type: 'integer', default: 100 } } } } },
  { type: 'function', function: { name: 'query_orders', description: 'Siparişleri sorgular.', parameters: { type: 'object', properties: { date_from: { type: 'string' }, date_to: { type: 'string' }, status: { type: 'string' } } } } },
  { type: 'function', function: { name: 'query_order_items', description: 'Sipariş satırlarını sorgular.', parameters: { type: 'object', properties: { date_from: { type: 'string' }, date_to: { type: 'string' } } } } },
  { type: 'function', function: { name: 'query_recipes', description: 'Reçeteleri sorgular.', parameters: { type: 'object', properties: { product_id: { type: 'string' }, search: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_summary_stats', description: 'Genel özet istatistikleri getirir.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'batch_create_products', description: 'Toplu ürün ve reçete oluşturur.', parameters: { type: 'object', properties: { products: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, recipe: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { item_name: { type: 'string' }, quantity: { type: ['number', 'string'] } } } } } } } } } } } } }
]
