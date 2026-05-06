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
    const startTime = Date.now();

    for (let round = 0; round < 15; round++) {
      if (Date.now() - startTime > 115000) break;

      const apiOptions: any = {
        model,
        messages: currentMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_completion_tokens: 4000,
        stream: false,
      }
      
      if (model === 'deepseek-v4-pro') {
        apiOptions.thinking = { type: 'enabled', budget_tokens: 3000 }
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
    
    return new Response(JSON.stringify({ message: "⚠️ İşlem çok uzun sürdü veya çok fazla adım gerektirdi.", toolsUsed, model }), { headers: corsHeaders })
    
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
  return name.replace(/[\u2010-\u2015]/g, '-').replace(/\//g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
};

async function executeTool(supabase: any, name: string, args: any) {
  try {
    switch (name) {
      case 'query_items': {
        let q = supabase.from('items').select('*').eq('is_draft', false).order('name').limit(args.limit || 50);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }
      
      case 'query_customers': {
        let q = supabase.from('customers').select('*').order('name').limit(args.limit || 20);
        if (args.search) q = q.ilike('name', `%${args.search}%`);
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
          const items = (r.recipe_items || []).map((ri: any) => {
            const currentName = ri.item?.name || ri.item_name;
            materialCost += (Number(ri.item?.purchase_price) || 0) * (Number(ri.quantity) || 1);
            return { ...ri, item_name: currentName, current_price: ri.item?.purchase_price || 0 };
          });
          let otherCost = 0;
          (r.other_costs || []).forEach((oc: any) => { otherCost += Number(oc.amount) || 0; });
          return { ...r, recipe_items: items, calculated_total_cost: (materialCost + otherCost).toFixed(2) };
        });
        return { count: enriched.length, data: enriched };
      }

      case 'update_item': {
        if (!args.item_id) return { error: 'item_id gereklidir' };
        const patch: any = {};
        const fields = ['name', 'sku', 'purchase_price', 'sale_price', 'base_currency', 'sale_currency', 'unit', 'stock_count', 'critical_limit', 'category', 'location'];
        fields.forEach(f => { if (args[f] !== undefined) patch[f] = f.includes('price') || f.includes('count') ? evalMath(args[f]) : args[f]; });
        const { data, error } = await supabase.from('items').update(patch).eq('id', args.item_id).select('*').single();
        if (error) throw error;
        return { success: true, message: `✅ "${data.name}" güncellendi.`, data };
      }

      case 'update_recipe': {
        if (!args.recipe_id) return { error: 'recipe_id gereklidir' };
        const patch: any = {};
        if (args.name) patch.name = args.name;
        if (args.tags) patch.tags = args.tags;
        if (args.other_costs) patch.other_costs = args.other_costs.map((oc: any) => ({ ...oc, amount: evalMath(oc.amount) }));
        
        const { data, error } = await supabase.from('product_recipes').update(patch).eq('id', args.recipe_id).select('*').single();
        if (error) throw error;
        
        // Reçete kalemlerini güncelleme (opsiyonel)
        if (args.items && Array.isArray(args.items)) {
          await supabase.from('recipe_items').delete().eq('recipe_id', args.recipe_id);
          const newItems = args.items.map((ri: any, idx: number) => ({
            recipe_id: args.recipe_id,
            item_id: ri.item_id || null,
            item_name: ri.item_name,
            quantity: evalMath(ri.quantity),
            unit: ri.unit || 'Adet',
            order_index: idx + 1
          }));
          await supabase.from('recipe_items').insert(newItems);
        }
        return { success: true, message: `✅ Reçete güncellendi.`, data };
      }

      case 'batch_create_products': {
        if (!args.products || !Array.isArray(args.products)) return { error: 'products array required' };
        const results = [];
        const missingNames = new Set();
        args.products.forEach((p: any) => p.recipe?.items?.forEach((i: any) => { if (!i.item_id && i.item_name) missingNames.add(i.item_name) }));

        const nameToIdMap: Record<string, string> = {};
        if (missingNames.size > 0) {
          const searchNames = Array.from(missingNames) as string[];
          const variations = [...searchNames, ...searchNames.map(n => n.replace(/-/g, '‑')), ...searchNames.map(n => n.replace(/\//g, '-'))];
          const { data: foundItems } = await supabase.from('items').select('id, name').in('name', variations);
          (foundItems || []).forEach((fi: any) => { nameToIdMap[fi.name] = fi.id; nameToIdMap[normalizeName(fi.name)] = fi.id; });
        }

        for (const product of args.products) {
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
              sale_currency: product.sale_currency || product.base_currency || 'TRY',
              stock_count: evalMath(product.stock_count) || 0 
            };
            const { data: itemData, error: itemErr } = await supabase.from('items').insert(itemPayload).select('id').single();
            if (itemErr) throw itemErr;
            if (product.recipe) {
              const recipePayload: any = { product_id: itemData.id, name: product.recipe.name || `${product.name} Reçete`, tags: product.recipe.tags || [], other_costs: product.recipe.other_costs?.map((oc: any) => ({ ...oc, amount: evalMath(oc.amount) })) };
              const { data: recipeData, error: recErr } = await supabase.from('product_recipes').insert(recipePayload).select('id').single();
              if (recErr) throw recErr;
              if (product.recipe.items) {
                const recipeItems = product.recipe.items.map((ri: any, idx: number) => ({ recipe_id: recipeData.id, item_id: ri.item_id || nameToIdMap[normalizeName(ri.item_name)] || nameToIdMap[ri.item_name] || null, item_name: ri.item_name, quantity: evalMath(ri.quantity), unit: ri.unit || 'Adet', order_index: idx + 1 }));
                await supabase.from('recipe_items').insert(recipeItems);
              }
            }
            results.push({ name: product.name, success: true, item_id: itemData.id });
          } catch (e: any) { results.push({ name: product.name, success: false, error: e.message }); }
        }
        return { results };
      }

      case 'create_stock_movement': {
        if (!args.item_id || args.delta == null) return { error: 'item_id ve delta gereklidir' };
        const { error: smErr } = await supabase.from('stock_movements').insert({ item_id: args.item_id, delta: args.delta, source: 'AI Asistan', note: args.note || '' });
        if (smErr) throw smErr;
        const { data: item } = await supabase.from('items').select('stock_count').eq('id', args.item_id).single();
        const newStock = (item?.stock_count || 0) + args.delta;
        await supabase.from('items').update({ stock_count: newStock }).eq('id', args.item_id);
        return { success: true, new_stock: newStock };
      }

      case 'get_summary_stats': {
        const [ { count: itemCount }, { count: productCount }, { count: orderCount }, { count: invoiceCount } ] = await Promise.all([
          supabase.from('items').select('id', { count: 'exact', head: true }).eq('is_draft', false),
          supabase.from('items').select('id', { count: 'exact', head: true }).eq('item_type', 'product').eq('is_draft', false),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase.from('invoices').select('id', { count: 'exact', head: true }),
        ]);
        return { total_items: itemCount, total_products: productCount, total_orders: orderCount, total_invoices: invoiceCount };
      }

      case 'create_quote': {
        const { customer_name, products, currency = 'TRY', notes = '', vat_rate = 20 } = args;
        if (!customer_name || !products || !Array.isArray(products)) return { error: 'Müşteri adı ve ürünler gereklidir.' };

        // 1. Müşteri Ara
        const { data: customer } = await supabase.from('customers').select('id, name, address, phone, email').ilike('name', `%${customer_name}%`).limit(1).maybeSingle();

        // 2. Ürünleri Çöz ve Kalemleri Hazırla
        const line_items = [];
        let subtotal = 0;
        for (const p of products) {
          const { data: item } = await supabase.from('items').select('*').ilike('name', `%${p.name}%`).limit(1).maybeSingle();
          const qty = evalMath(p.quantity) || 1;
          const price = evalMath(p.price) || (item?.sale_price || 0);
          const total = qty * price;
          subtotal += total;
          line_items.push({
            id: Math.random().toString(36).slice(2),
            item_id: item?.id || null,
            item_code: item?.sku || item?.item_code || '',
            name: item?.name || p.name,
            description: p.description || item?.description || '',
            quantity: qty,
            unit: item?.unit || 'Adet',
            unit_price: price,
            total: total,
            image_url: item?.image_url || ''
          });
        }

        const vat_amount = subtotal * (evalMath(vat_rate) / 100);
        const grand_total = subtotal + vat_amount;

        // 3. Teklif No Üret (TKL-YYYY-SEQ)
        const year = new Date().getFullYear();
        const { data: lastQuote } = await supabase.from('quotes').select('quote_no').ilike('quote_no', `TKL-${year}-%`).order('created_at', { ascending: false }).limit(1).maybeSingle();
        let seq = 1;
        if (lastQuote?.quote_no) {
          const parts = lastQuote.quote_no.split('-');
          seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
        }
        const quote_no = `TKL-${year}-${String(seq).padStart(3, '0')}`;

        // 4. Kaydet
        const payload = {
          quote_no,
          status: 'draft',
          company_name: customer?.name || customer_name,
          customer_id: customer?.id || null,
          address: customer?.address || '',
          phone: customer?.phone || '',
          email: customer?.email || '',
          issue_date: new Date().toISOString().slice(0, 10),
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency,
          vat_rate: evalMath(vat_rate),
          subtotal,
          vat_amount,
          grand_total,
          notes,
          line_items
        };

        const { data, error } = await supabase.from('quotes').insert(payload).select('id, quote_no').single();
        if (error) throw error;
        return { success: true, message: `✅ ${data.quote_no} numaralı teklif oluşturuldu.`, quote_id: data.id };
      }

      case 'convert_quote_to_order': {
        const { quote_id, due_date } = args;
        if (!quote_id) return { error: 'quote_id gereklidir.' };

        // 1. Teklifi Oku
        const { data: quote, error: qErr } = await supabase.from('quotes').select('*').eq('id', quote_id).single();
        if (qErr) throw qErr;

        // 2. Sipariş No Üret (AYS-FIRSTWORD-SEQ)
        const firstWord = (quote.company_name || 'MUS').split(/\s+/)[0].replace(/[^A-Za-zİÇŞĞÜÖıçşğüö0-9]/g, '').toUpperCase().slice(0, 6);
        const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true });
        const order_number = `AYS-${firstWord}-${String((count || 0) + 1).padStart(3, '0')}`;

        // 3. Sipariş Başlığını Kaydet
        const orderData = {
          order_number,
          customer_id: quote.customer_id,
          customer_name: quote.company_name,
          status: 'pending',
          currency: quote.currency,
          due_date: due_date ? new Date(due_date).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          billing_address: quote.address,
          delivery_address: quote.address,
          notes: quote.notes,
          subtotal: quote.subtotal,
          tax_total: quote.vat_amount,
          grand_total: quote.grand_total,
          is_invoiced: false,
          quote_id: quote.id
        };

        const { data: order, error: oErr } = await supabase.from('orders').insert(orderData).select('id, order_number').single();
        if (oErr) throw oErr;

        // 4. Sipariş Kalemlerini Kaydet
        const orderItems = [];
        for (const li of (quote.line_items || [])) {
          // Reçete bilgilerini bul (varsa varsayılan reçeteyi al)
          let recipe_id = null;
          let recipe_key = null;
          if (li.item_id) {
            const { data: rec } = await supabase.from('product_recipes').select('id, name').eq('product_id', li.item_id).eq('is_default', true).maybeSingle();
            if (rec) {
              recipe_id = rec.id;
              recipe_key = rec.name;
            }
          }

          orderItems.push({
            order_id: order.id,
            item_id: li.item_id,
            item_name: li.name,
            item_type: 'product', // Varsayılan olarak product
            quantity: li.quantity,
            unit: li.unit,
            unit_price: li.unit_price,
            tax_rate: quote.vat_rate,
            notes: li.description,
            recipe_id,
            recipe_key,
            skip_work_order: false
          });
        }
        const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
        if (itemsErr) console.warn('Order items error:', itemsErr.message);

        // 5. Teklifi Kabul Edildi Yap
        await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quote_id);

        return { success: true, message: `✅ ${order.order_number} numaralı sipariş oluşturuldu.`, order_id: order.id };
      }

      case 'create_work_orders_from_order': {
        const { order_id } = args;
        if (!order_id) return { error: 'order_id gereklidir.' };

        // 1. Sipariş Kalemlerini Oku
        const { data: items, error: iErr } = await supabase.from('order_items').select('*').eq('order_id', order_id);
        if (iErr) throw iErr;

        // 2. Reçeteli Ürünleri Filtrele (Mamül olan ve skip_work_order olmayan)
        const productsToProduce = items.filter(i => i.item_type === 'product' && !i.skip_work_order);
        if (productsToProduce.length === 0) return { success: true, message: 'Üretilecek reçeteli ürün bulunamadı.' };

        // 3. İş Emirlerini Oluştur
        const workOrders = [];
        for (const p of productsToProduce) {
          workOrders.push({
            order_id: order_id,
            item_id: p.item_id,
            quantity: p.quantity,
            status: 'pending',
            recipe_id: p.recipe_id,
            notes: p.recipe_note || '',
            custom_recipe_items: p.custom_recipe_items
          });
        }

        const { data: wos, error: wErr } = await supabase.from('work_orders').insert(workOrders).select('id');
        if (wErr) throw wErr;

        return { success: true, message: `✅ ${wos.length} adet iş emri oluşturuldu.`, work_order_ids: wos.map(w => w.id) };
      }

      case 'verify_recipe_materials': {
        const { materials } = args;
        if (!materials || !Array.isArray(materials)) return { error: 'Malzeme listesi gereklidir.' };

        const results = [];
        for (const m of materials) {
          const name = typeof m === 'string' ? m : m.name;
          
          // 1. Tam Eşleşme
          const { data: exact } = await supabase.from('items').select('id, name, unit, purchase_price, base_currency').ilike('name', name).limit(1).maybeSingle();
          
          if (exact) {
            results.push({ requested: name, status: 'found', item: exact });
            continue;
          }

          // 2. Benzer Eşleşme (Fuzzy/Partial)
          const searchName = name.split(' ')[0]; // İlk kelimeye göre ara
          const { data: similar } = await supabase.from('items').select('id, name, unit, purchase_price, base_currency').ilike('name', `%${searchName}%`).limit(3);

          if (similar && similar.length > 0) {
            results.push({ requested: name, status: 'suggested', suggestions: similar });
          } else {
            results.push({ requested: name, status: 'missing' });
          }
        }

        const missingCount = results.filter(r => r.status === 'missing').length;
        const suggestedCount = results.filter(r => r.status === 'suggested').length;

        return { 
          results, 
          can_proceed: missingCount === 0 && suggestedCount === 0,
          summary: `${results.length} malzemeden ${missingCount} tanesi bulunamadı, ${suggestedCount} tanesi için öneri var.`
        };
      }

      case 'create_raw_material': {
        const { name, unit = 'Adet', purchase_price = 0, base_currency = 'TRY', category = 'Hammadde' } = args;
        if (!name) return { error: 'Malzeme adı gereklidir.' };

        const payload = {
          name,
          item_type: 'rawmaterial',
          unit,
          purchase_price: evalMath(purchase_price),
          base_currency,
          category,
          is_draft: false,
          is_active: true
        };

        const { data, error } = await supabase.from('items').insert(payload).select('id, name').single();
        if (error) throw error;

        return { success: true, message: `✅ "${data.name}" hammaddesi oluşturuldu.`, item_id: data.id };
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
Görevin: Ürünleri, reçeteleri, stokları ve maliyetleri yönetmek.

🚀 KRİTİK YETENEKLER:
1. 'batch_create_products' ile Ürün + Reçete oluşturabilirsin.
2. 'update_item' ve 'update_recipe' ile mevcut verileri güncelleyebilirsin.
3. 'create_quote' -> 'convert_quote_to_order' -> 'create_work_orders_from_order' akışını yönetebilirsin.

⚠️ REÇETE OLUŞTURMA KURALLARI:
- Bir reçete (BOM) oluşturmadan veya güncellemeden önce MUTLAKA 'verify_recipe_materials' kullanarak malzemelerin sistemde varlığını kontrol etmelisiniz.
- Eğer bir malzeme eksikse (status: 'missing'), kullanıcıya "Bu malzeme sistemde yok, oluşturmamı ister misiniz?" diye sormalısınız.
- Eğer benzer isimli malzemeler varsa (status: 'suggested'), kullanıcıya bunları önerin: "Şu isimde benzer ürünler var, bunlardan birini mi demek istediniz?"
- Kullanıcı onay vermeden asla hayali veya ID'siz malzemelerle reçete oluşturmayın. Eksik malzemeleri 'create_raw_material' ile oluşturduktan sonra reçeteye geçin.

4. Para birimi USD ise 'sale_currency' ve 'base_currency' alanlarını 'USD' yap.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_items',
      description: 'Ürün/Hammadde arar.',
      parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'integer' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_item',
      description: 'Ürün bilgilerini (fiyat, para birimi vb.) günceller.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          name: { type: 'string' },
          sale_price: { type: ['number', 'string'] },
          sale_currency: { type: 'string', enum: ['TRY', 'USD', 'EUR'] },
          base_currency: { type: 'string', enum: ['TRY', 'USD', 'EUR'] },
          unit: { type: 'string' }
        },
        required: ['item_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_recipes',
      description: 'Reçete/BOM detaylarını sorgular.',
      parameters: { type: 'object', properties: { product_id: { type: 'string' }, search: { type: 'string' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_recipe',
      description: 'Mevcut bir reçeteyi günceller (gider ekler veya kalemleri değiştirir).',
      parameters: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string' },
          name: { type: 'string' },
          other_costs: {
            type: 'array',
            items: { type: 'object', properties: { type: { type: 'string' }, amount: { type: ['number', 'string'] }, currency: { type: 'string' } } }
          },
          items: {
            type: 'array',
            items: { type: 'object', properties: { item_name: { type: 'string' }, quantity: { type: ['number', 'string'] } } }
          }
        },
        required: ['recipe_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'batch_create_products',
      description: 'Toplu ürün, fiyat ve reçete oluşturur.',
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sale_price: { type: ['number', 'string'] },
                sale_currency: { type: 'string' },
                recipe: {
                  type: 'object',
                  properties: {
                    other_costs: {
                      type: 'array',
                      items: { type: 'object', properties: { type: { type: 'string' }, amount: { type: ['number', 'string'] }, currency: { type: 'string' } } }
                    },
                    items: {
                      type: 'array',
                      items: { type: 'object', properties: { item_name: { type: 'string' }, quantity: { type: ['number', 'string'] } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_stock_movement',
      description: 'Stok girişi/çıkışı yapar.',
      parameters: {
        type: 'object',
        properties: { item_id: { type: 'string' }, delta: { type: 'number' }, note: { type: 'string' } },
        required: ['item_id', 'delta']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_summary_stats',
      description: 'Genel özet istatistikleri.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_customers',
      description: 'Müşteri (Cari) arar.',
      parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'integer' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_quote',
      description: 'Yeni bir satış teklifi oluşturur.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Müşteri adı' },
          currency: { type: 'string', enum: ['TRY', 'USD', 'EUR'] },
          vat_rate: { type: 'number', description: 'KDV oranı (örn: 20)' },
          notes: { type: 'string' },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: ['number', 'string'] },
                price: { type: ['number', 'string'] },
                description: { type: 'string' }
              },
              required: ['name', 'quantity']
            }
          }
        },
        required: ['customer_name', 'products']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'convert_quote_to_order',
      description: 'Bir teklifi satış siparişine dönüştürür.',
      parameters: {
        type: 'object',
        properties: {
          quote_id: { type: 'string', description: 'Teklif ID' },
          due_date: { type: 'string', description: 'Termin tarihi (YYYY-MM-DD)' }
        },
        required: ['quote_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_work_orders_from_order',
      description: 'Siparişteki reçeteli ürünler için iş emirleri oluşturur.',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'string', description: 'Sipariş ID' }
        },
        required: ['order_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verify_recipe_materials',
      description: 'Reçete malzemelerinin sistemde varlığını kontrol eder ve öneriler sunar.',
      parameters: {
        type: 'object',
        properties: {
          materials: {
            type: 'array',
            items: { type: 'string', description: 'Malzeme adı' }
          }
        },
        required: ['materials']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_raw_material',
      description: 'Yeni bir hammadde kaydı oluşturur.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unit: { type: 'string' },
          purchase_price: { type: ['number', 'string'] },
          base_currency: { type: 'string' },
          category: { type: 'string' }
        },
        required: ['name']
      }
    }
  }
]
