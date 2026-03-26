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
    const { error } = await supabase.from('item_categories').insert({ name, item_type: type });
    if (error) throw new Error(error.message);
    await fetch();
  };

  const remove = async (id) => {
    const { error } = await supabase.from('item_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await fetch();
  };

  return { categories, loading, add, remove, refetch: fetch };
}
