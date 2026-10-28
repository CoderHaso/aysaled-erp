import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useUnits() {
  const [units, setUnits] = useState([]);

  const fetchUnits = useCallback(async () => {
    const { data } = await supabase.from('item_units').select('*').order('name');
    if (data) setUnits(data);
  }, []);

  useEffect(() => {
    fetchUnits();
    // Realtime kapatıldı (Disk IO): yazma olayı ('ax:data') ve sekmeye dönüşte yenile
    const onData = (e) => { const t = e.detail?.table; if (t === 'item_units' || t === '*') fetchUnits(); };
    window.addEventListener('ax:data', onData);
    window.addEventListener('focus', fetchUnits);
    return () => { window.removeEventListener('ax:data', onData); window.removeEventListener('focus', fetchUnits); };
  }, [fetchUnits]);

  const addUnit = async (name) => {
    if (!name.trim()) return;
    const newU = { id: Date.now().toString(), name: name.trim() };
    setUnits(prev => [...prev, newU]); // Optimistic
    const { data, error } = await supabase.from('item_units').insert([{ name: name.trim() }]).select().single();
    if (error && error.code !== '23505') { fetchUnits(); throw new Error(error.message); }
    if (data) setUnits(prev => prev.map(u => u.id === newU.id ? data : u));
    return data || newU;
  };

  const removeUnit = async (id) => {
    setUnits(prev => prev.filter(u => u.id !== id)); // Optimistic
    const { error } = await supabase.from('item_units').delete().eq('id', id);
    if (error) { fetchUnits(); throw new Error(error.message); }
  };

  return { units, addUnit, removeUnit, refetch: fetchUnits };
}
