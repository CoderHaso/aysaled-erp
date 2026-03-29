import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * GET  /api/quotes          → teklif listesi
 * POST /api/quotes          → yeni teklif oluştur
 * PUT  /api/quotes?id=..    → teklif güncelle
 * DELETE /api/quotes?id=..  → teklif sil
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, quotes: data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    // Teklif numarası oluştur: TKL-2025-001
    const year = new Date().getFullYear();
    const { data: last } = await supabase
      .from('quotes')
      .select('quote_no')
      .ilike('quote_no', `TKL-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (last?.quote_no) {
      const parts = last.quote_no.split('-');
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    const quoteNo = `TKL-${year}-${String(seq).padStart(3, '0')}`;

    const { data, error } = await supabase.from('quotes').insert({
      ...body,
      quote_no: body.quote_no || quoteNo,
      status: body.status || 'draft',
    }).select().single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, quote: data });
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id gerekli' });
    const { data, error } = await supabase
      .from('quotes')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, quote: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id gerekli' });
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
