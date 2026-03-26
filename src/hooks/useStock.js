import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useStock() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name');

    if (error) setError(error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel('items-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => fetchItems()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchItems]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addItem = async (payload) => {
    setSaving(true);
    const { error } = await supabase.from('items').insert([payload]);
    setSaving(false);
    if (error) throw new Error(error.message);
  };

  const updateItem = async (id, payload) => {
    setSaving(true);
    const { error } = await supabase.from('items').update(payload).eq('id', id);
    setSaving(false);
    if (error) throw new Error(error.message);
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  };

  const adjustStock = async (id, delta) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newCount = Math.max(0, (item.stock_count || 0) + delta);
    const { error } = await supabase.from('items').update({ stock_count: newCount }).eq('id', id);
    if (error) throw new Error(error.message);
  };

  // ── Türev değerler ──────────────────────────────────────────────────────
  const rawItems     = items.filter(i => i.item_type !== 'product');
  const productItems = items.filter(i => i.item_type === 'product');

  const criticalItems = items.filter(
    i => i.critical_limit > 0 && i.stock_count <= i.critical_limit
  );
  const criticalRaw  = criticalItems.filter(i => i.item_type !== 'product');
  const criticalProd = criticalItems.filter(i => i.item_type === 'product');

  const totalValue = items.reduce((sum, i) =>
    sum + (i.purchase_price || 0) * (i.stock_count || 0), 0
  );

  return {
    items, rawItems, productItems,
    loading, error, saving,
    addItem, updateItem, deleteItem, adjustStock,
    refetch: fetchItems,
    criticalItems, criticalRaw, criticalProd,
    totalValue,
  };
}
