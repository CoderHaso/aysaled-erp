import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useCategories(itemType = 'all') {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('item_categories').select('*').order('name');
    if (itemType !== 'all') q = q.in('item_type', ['all', itemType]);
    const { data } = await q;
    setCategories(data || []);
    setLoading(false);
  }, [itemType]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name, type = itemType) => {
    const newCat = { id: Date.now().toString(), name, item_type: type };
    setCategories(prev => [...prev, newCat]); // Optimistic
    const { data, error } = await supabase.from('item_categories').insert({ name, item_type: type }).select().single();
    if (error) { fetch(); throw new Error(error.message); }
    setCategories(prev => prev.map(c => c.id === newCat.id ? data : c));
    return data;
  };

  const remove = async (id) => {
    setCategories(prev => prev.filter(c => c.id !== id)); // Optimistic
    const { error } = await supabase.from('item_categories').delete().eq('id', id);
    if (error) { fetch(); throw new Error(error.message); }
  };

  return { categories, loading, add, remove, refetch: fetch };
}
