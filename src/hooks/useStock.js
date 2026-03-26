import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Stok yönetimi için Supabase CRUD + Realtime hook.
 * Gerçek zamanlı güncellemeler için Supabase Realtime kullanır.
 */
export function useStock() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name', { ascending: true });

    if (error) setError(error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, []);

  // İlk yükleme + Realtime subscription
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

  /** Yeni ürün ekle */
  const addItem = async (formData) => {
    setSaving(true);
    const { error } = await supabase.from('items').insert([formData]);
    setSaving(false);
    if (error) throw new Error(error.message);
  };

  /** Ürün güncelle */
  const updateItem = async (id, formData) => {
    setSaving(true);
    const { error } = await supabase.from('items').update(formData).eq('id', id);
    setSaving(false);
    if (error) throw new Error(error.message);
  };

  /** Ürün sil */
  const deleteItem = async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  };

  /** Anlık stok sayısı güncelle (hızlı +/- işlem) */
  const adjustStock = async (id, delta) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newCount = Math.max(0, (item.stock_count || 0) + delta);
    const { error } = await supabase
      .from('items')
      .update({ stock_count: newCount })
      .eq('id', id);
    if (error) throw new Error(error.message);
  };

  // Türev değerler
  const criticalItems = items.filter(
    i => i.critical_limit > 0 && i.stock_count <= i.critical_limit
  );
  const totalValue = items.reduce((sum, i) => {
    const price = i.purchase_price || 0;
    const stock = i.stock_count || 0;
    return sum + price * stock;
  }, 0);

  return {
    items, loading, error, saving,
    addItem, updateItem, deleteItem, adjustStock,
    refetch: fetchItems,
    criticalItems,
    totalValue,
  };
}
