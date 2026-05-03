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
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const str = val.replace(/,/g, '.').replace(/[^0-9.\-*\/+() ]/g, ''); 
    try {
      // Deno evaluates this in a sandbox, but be careful.
      const res = Number(Function(`"use strict"; return (${str})`)());
      return isNaN(res) ? 0 : res;
    } catch {
      return parseFloat(str) || 0;
    }
  }
  return 0;
};

const normalizeName = (name: string) => {
  if (!name) return '';
  return name.replace(/[\u2010-\u2015]/g, '-').trim().toLowerCase();
};

async function executeTool(supabase: any, name: string, args: any) {
  try {
    switch (name) {
      case 'query_items': {
        let q = supabase.from('items').select('*').eq('is_draft', false).order('name').limit(args.limit || 50);
        if (args.type === 'product') q = q.eq('item_type', 'product');
        else if (args.type === 'raw') q = q.neq('item_type', 'product');
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
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
        if (!args.products || !Array.isArray(args.products)) return { error: 'products array required' };
        
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // 1. Find missing item_ids by name
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
          const { data: foundItems } = await supabase.from('items')
            .select('id, name')
            .in('name', [...searchNames, ...searchNames.map(n => n.replace(/-/g, '‑'))]);
          
          (foundItems || []).forEach((fi: any) => {
            nameToIdMap[fi.name] = fi.id;
            nameToIdMap[normalizeName(fi.name)] = fi.id;
          });
        }

        // 2. Create products one by one
        for (const product of args.products) {
          const productResult: any = { name: product.name, steps: [] };
          try {
            const itemPayload: any = {
              name: product.name,
              item_type: 'product',
              unit: product.unit || 'Adet',
              is_draft: false,
              sku: product.sku,
              purchase_price: evalMath(product.purchase_price),
              sale_price: evalMath(product.sale_price),
              base_currency: product.base_currency || 'TRY',
              stock_count: evalMath(product.stock_count) || 0,
              critical_limit: evalMath(product.critical_limit),
              vat_rate: product.vat_rate,
              category: product.category,
              location: product.location
            };

            const { data: itemData, error: itemErr } = await supabase.from('items').insert(itemPayload).select('id').single();
            if (itemErr) throw itemErr;
            productResult.item_id = itemData.id;
            productResult.steps.push(`✅ Ürün oluşturuldu`);

            if (product.recipe) {
              const recipePayload: any = {
                product_id: itemData.id,
                name: product.recipe.name || `${product.name} Reçete`,
                tags: product.recipe.tags || []
              };
              if (product.recipe.other_costs) {
                recipePayload.other_costs = product.recipe.other_costs.map((oc: any) => ({
                  ...oc,
                  amount: evalMath(oc.amount)
                }));
              }

              const { data: recipeData, error: recErr } = await supabase.from('product_recipes').insert(recipePayload).select('id').single();
              if (recErr) throw recErr;
              productResult.steps.push(`✅ Reçete oluşturuldu`);

              if (product.recipe.items) {
                const recipeItems = product.recipe.items.map((ri: any, idx: number) => ({
                  recipe_id: recipeData.id,
                  item_id: ri.item_id || nameToIdMap[normalizeName(ri.item_name)] || nameToIdMap[ri.item_name] || null,
                  item_name: ri.item_name,
                  quantity: evalMath(ri.quantity),
                  unit: ri.unit || 'Adet',
                  order_index: idx + 1
                }));
                await supabase.from('recipe_items').insert(recipeItems);
                productResult.steps.push(`✅ ${recipeItems.length} kalem eklendi`);
              }
            }
            productResult.success = true;
            successCount++;
          } catch (e: any) {
            productResult.success = false;
            productResult.error = e.message;
            errorCount++;
          }
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

BUGÜNÜN TARİHİ: {{TODAY_DATE}}

🚀 TOPLU ÜRÜN + REÇETE OLUŞTURMA:
HER ZAMAN "batch_create_products" fonksiyonunu TEK SEFERDE çağır.
Hammaddeleri eşleştirmek için "item_name" alanını tam ve doğru yaz.
Giderleri "recipe.other_costs" içine {type, amount, currency} formatında ekle.
Miktarları (quantity) ve tutarları (amount) hesaplarken matematiksel ifadeler (örn: "1.2 * 2") kullanabilirsin, sistem bunları hesaplayacaktır.`

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
          limit: { type: 'integer', default: 50 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_recipes',
      description: 'Reçeteleri sorgular.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          search: { type: 'string' }
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
                purchase_price: { type: ['number', 'string'] },
                sale_price: { type: ['number', 'string'] },
                recipe: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    other_costs: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, amount: { type: ['number', 'string'] }, currency: { type: 'string' } } } },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          item_name: { type: 'string' },
                          quantity: { type: ['number', 'string'] }
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
  }
]
