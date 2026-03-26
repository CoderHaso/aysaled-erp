import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Bill of Materials (Reçete) hook.
 * Bir mamülün tüm hammadde bileşenlerini yönetir.
 */
export function useBOM(parentId) {
  const [recipes,  setRecipes]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const fetchRecipes = useCallback(async () => {
    if (!parentId) { setRecipes([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('bom_recipes')
      .select(`
        *,
        component:component_id (
          id, name, sku, unit,
          purchase_price, base_currency,
          stock_count, critical_limit,
          supplier_name, location
        )
      `)
      .eq('parent_id', parentId)
      .order('created_at');

    if (!error) setRecipes(data ?? []);
    setLoading(false);
  }, [parentId]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const addLine = async ({ componentId, quantity, unit, notes }) => {
    setSaving(true);
    const { error } = await supabase.from('bom_recipes').insert({
      parent_id:         parentId,
      component_id:      componentId,
      quantity_required: parseFloat(quantity) || 1,
      unit:              unit || null,
      notes:             notes || null,
    });
    setSaving(false);
    if (error) throw new Error(error.message);
    await fetchRecipes();
  };

  const updateLine = async (id, data) => {
    setSaving(true);
    const { error } = await supabase.from('bom_recipes').update({
      quantity_required: parseFloat(data.quantity) || 1,
      unit: data.unit || null,
      notes: data.notes || null,
    }).eq('id', id);
    setSaving(false);
    if (error) throw new Error(error.message);
    await fetchRecipes();
  };

  const removeLine = async (id) => {
    const { error } = await supabase.from('bom_recipes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await fetchRecipes();
  };

  // Toplam maliyet (alış fiyatı × miktar — TRY bazlı, kur entegrasyonu gelince güncellenecek)
  const totalCost = recipes.reduce((sum, r) => {
    const price = r.component?.purchase_price || 0;
    return sum + r.quantity_required * price;
  }, 0);

  const currency = recipes[0]?.component?.base_currency || 'TRY';

  return {
    recipes, loading, saving,
    addLine, updateLine, removeLine,
    totalCost, currency,
    refetch: fetchRecipes,
  };
}
