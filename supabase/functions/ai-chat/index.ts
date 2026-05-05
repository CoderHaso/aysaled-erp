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

    // Zaman takibi (Supabase Edge Function limiti 60-150s arasıdır)
    const startTime = Date.now();

    for (let round = 0; round < 10; round++) {
      // 50 saniyeyi geçerse işlemi durdur ve eldekini dön (504'ü önlemek için)
      if (Date.now() - startTime > 50000) {
        break;
      }

      const apiOptions: any = {
        model,
        messages: currentMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.3, // Raporlar için daha stabil sonuç
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
    
    // Zaman aşımı veya döngü bitimi durumu
    const finalMsg = "⚠️ Rapor çok kapsamlı olduğu için işlem süresi yetmedi. Lütfen soruyu 'sadece faturalar' veya 'sadece siparişler' şeklinde bölerek sorar mısın?";
    return new Response(JSON.stringify({ message: finalMsg, toolsUsed, model }), { headers: corsHeaders })
    
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

// --- HELPERS ---

async function executeTool(supabase: any, name: string, args: any) {
  try {
    switch (name) {
      case 'query_invoices': {
        // PERFORMANS: 'raw_detail' gibi ağır kolonları asla çekme!
        const selectFields = 'id,invoice_number,direction,total_amount,vat_amount,currency,customer_name,invoice_date,status,invoice_type';
        let q = supabase.from('invoices').select(selectFields).order('invoice_date', { ascending: false }).limit(args.limit || 100);
        
        if (args.date_from) q = q.gte('invoice_date', args.date_from);
        if (args.date_to) q = q.lte('invoice_date', args.date_to);
        if (args.direction && args.direction !== 'all') q = q.eq('direction', args.direction);
        
        const { data, error } = await q;
        if (error) throw error;
        
        // Özet hesapla (AI'ya yardımcı)
        const total = (data || []).reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);
        return { count: data?.length || 0, summary: { total_amount: total.toFixed(2) }, data: data || [] };
      }

      case 'query_orders': {
        const selectFields = 'id,order_number,customer_name,status,total,vat_total,grand_total,currency,order_date,is_work_order';
        let q = supabase.from('orders').select(selectFields).order('order_date', { ascending: false }).limit(args.limit || 100);
        
        if (args.date_from) q = q.gte('order_date', args.date_from);
        if (args.date_to) q = q.lte('order_date', args.date_to);
        
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'query_items': {
        let q = supabase.from('items').select('id,name,sku,unit,item_type,stock_count,purchase_price,sale_price,base_currency,category').eq('is_draft', false).order('name').limit(args.limit || 50);
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { count: data?.length || 0, data: data || [] };
      }

      case 'get_summary_stats': {
        const [
          { count: itemCount },
          { count: productCount },
          { count: orderCount },
          { count: invoiceCount },
        ] = await Promise.all([
          supabase.from('items').select('id', { count: 'exact', head: true }).eq('is_draft', false),
          supabase.from('items').select('id', { count: 'exact', head: true }).eq('item_type', 'product').eq('is_draft', false),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase.from('invoices').select('id', { count: 'exact', head: true }),
        ]);
        return { total_items: itemCount, total_products: productCount, total_orders: orderCount, total_invoices: invoiceCount };
      }

      case 'query_customers': {
        const { data, error } = await supabase.from('customers').select('id,name,balance').limit(20);
        if (error) throw error;
        return { data };
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

const SYSTEM_PROMPT = `Sen A-ERP sisteminin yapay zeka asistanısın.
Görevin: ERP verilerini analiz edip raporlamak.

📊 RAPORLAMA KURALLARI:
1. Faturaları sorgularken 'query_invoices' kullan. 'invoice_type' alanı 'official' ise faturalı, 'draft' veya boş ise faturasız kabul et.
2. Siparişlerde 'is_work_order' true ise 'İş Emirli', false ise 'İş Emirsiz' olarak grupla.
3. Raporları her zaman Markdown tabloları kullanarak sun.
4. Veri çok fazlaysa (örneğin 100+ fatura), en önemli 10 tanesini listele ve kalanı özetle.

BUGÜNÜN TARİHİ: {{TODAY_DATE}}`

const TOOLS = [
  { type: 'function', function: { name: 'query_items', description: 'Ürün/Hammadde arar.', parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'query_invoices', description: 'Faturaları sorgular.', parameters: { type: 'object', properties: { date_from: { type: 'string' }, date_to: { type: 'string' }, direction: { type: 'string' } } } } },
  { type: 'function', function: { name: 'query_orders', description: 'Siparişleri sorgular.', parameters: { type: 'object', properties: { date_from: { type: 'string' }, date_to: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_summary_stats', description: 'Genel özet istatistikleri.', parameters: { type: 'object', properties: {} } } }
]
