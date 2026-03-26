import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('type', 'supplier')
      .order('name');
    setSuppliers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async ({ name, phone, email, address, notes, tax_id }) => {
    setSaving(true);
    const { error } = await supabase.from('contacts').insert({
      name, phone, email, address, notes, tax_id,
      type: 'supplier',
    });
    setSaving(false);
    if (error) throw new Error(error.message);
    await fetch();
  };

  const update = async (id, data) => {
    setSaving(true);
    const { error } = await supabase.from('contacts').update(data).eq('id', id);
    setSaving(false);
    if (error) throw new Error(error.message);
    await fetch();
  };

  const remove = async (id) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await fetch();
  };

  return { suppliers, loading, saving, add, update, remove, refetch: fetch };
}
