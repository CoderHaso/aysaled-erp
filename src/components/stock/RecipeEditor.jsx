/**
 * RecipeEditor.jsx
 * Bir urun icin birden cok recete yonetimi.
 * - Recete ekle / duzenle / sil / kopyala
 * - Her recete: isim, etiketler, kalemler (hammadde + miktar + unit + not)
 * - Baska urunun recetesini kopyala
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Trash2, Copy, ChevronDown, ChevronRight, Search, X, Check, AlertCircle, Loader2, Tag, Edit2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useFxRates } from '../../hooks/useFxRates';
import { trNorm } from '../../lib/trNorm';

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','m³','Rulo','Paket','Kutu','Set','Takım'];
const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€' };

export default function RecipeEditor({ productId, productName, productCurrency, c, currentColor }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const { convert, fxRates } = useFxRates();

  const [recipes,  setRecipes]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [expanded, setExpanded] = useState(null); // recipe id
  const [rawItems, setRawItems] = useState([]);   // hammadde listesi (item seçici için)
  const [copyModal, setCopyModal] = useState(false); // recete kopyala modal
  const [allProducts, setAllProducts] = useState([]);
  const [costTypes, setCostTypes] = useState(['İşçilik', 'Boya', 'Genel gider', 'Kaynak', 'Ekstra']);

  // ── Veri çek ──────────────────────────────────────────────────────────────
  const loadRecipes = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const { data } = await supabase
      .from('product_recipes')
      .select('*, recipe_items(*, item:item_id(id,name,unit,purchase_price,base_currency))')
      .eq('product_id', productId)
      .order('created_at');
    setRecipes(data || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  useEffect(() => {
    // Hammadde listesi
    supabase.from('items').select('id,name,unit,sku,purchase_price,base_currency').neq('item_type','product').order('name')
      .then(({ data }) => setRawItems(data || []));
    // Kopyalama için tüm ürünler
    supabase.from('items').select('id,name').eq('item_type','product').neq('id', productId || 'none').order('name')
      .then(({ data }) => setAllProducts(data || []));
    // Ayarlardan gider tipleri
    supabase.from('app_settings').select('value').eq('id', 'recipe_costs').maybeSingle()
      .then(({ data }) => { if (data?.value && Array.isArray(data.value)) setCostTypes(data.value); });
  }, [productId]);

  // ── Yeni boş recete ───────────────────────────────────────────────────
  const addRecipe = async () => {
    if (!productId) return;
    setSaving(true);
    // Reçete numarası: mevcut reçete sayısı + 1
    const nextNum = (recipes.length || 0) + 1;
    const autoName = `${productName || 'Ürün'} - Reçete ${nextNum}`;
    const { data, error } = await supabase.from('product_recipes').insert({
      product_id: productId,
      name: autoName,
      tags: [],
    }).select().single();
    setSaving(false);
    if (!error) {
      setRecipes(prev => [...prev, { ...data, recipe_items: [] }]);
      setExpanded(data.id);
    }
  };

  // ── Recete güncelle (isim/etiket) ────────────────────────────────────────
  const updateRecipeMeta = async (recipeId, patch) => {
    setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, ...patch } : r));
    await supabase.from('product_recipes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', recipeId);
  };

  // ── Recete sil ────────────────────────────────────────────────────────────
  const deleteRecipe = async (recipeId) => {
    if (!window.confirm('Bu reçeteyi silmek istediğinize emin misiniz?')) return;
    await supabase.from('product_recipes').delete().eq('id', recipeId);
    setRecipes(prev => prev.filter(r => r.id !== recipeId));
    if (expanded === recipeId) setExpanded(null);
  };

  // ── Kalem ekle ────────────────────────────────────────────────────────────
  const addItem = async (recipeId, rawItem = null) => {
    const payload = rawItem ? {
      recipe_id: recipeId, item_id: rawItem.id, item_name: rawItem.name, quantity: 1, unit: rawItem.unit || 'Adet', order_index: 99
    } : {
      recipe_id: recipeId, item_name: '', quantity: 1, unit: 'Adet', order_index: 99,
    };
    const { data } = await supabase.from('recipe_items').insert(payload)
      .select('*, item:item_id(id,name,unit,purchase_price,base_currency)').single();
    setRecipes(prev => prev.map(r =>
      r.id === recipeId ? { ...r, recipe_items: [...(r.recipe_items||[]), data] } : r
    ));
  };

  // ── Kalem güncelle (local önce, DB sonra) ────────────────────────────────
  const updateItem = (recipeId, itemId, patch) => {
    setRecipes(prev => prev.map(r =>
      r.id === recipeId
        ? { ...r, recipe_items: r.recipe_items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
        : r
    ));
    // Debounce gibi çalışır - blur'da kaydetmek için ayrı handler kullanacağız
  };

  const saveItem = async (itemId, patch) => {
    await supabase.from('recipe_items').update(patch).eq('id', itemId);
  };

  // ── Kalem sil ─────────────────────────────────────────────────────────────
  const deleteItem = async (recipeId, itemId) => {
    await supabase.from('recipe_items').delete().eq('id', itemId);
    setRecipes(prev => prev.map(r =>
      r.id === recipeId ? { ...r, recipe_items: r.recipe_items.filter(i => i.id !== itemId) } : r
    ));
  };

  // ── Recete kopyala ────────────────────────────────────────────────────
  const copyRecipe = async (sourceRecipeId, sourceName, fromProductId) => {
    if (!productId) return;
    setSaving(true);
    const { data: srcRecipe } = await supabase
      .from('product_recipes').select('other_costs, tags').eq('id', sourceRecipeId).maybeSingle();
      
    const { data: srcItems } = await supabase
      .from('recipe_items').select('*').eq('recipe_id', sourceRecipeId);

    // Kopyalanmış reçetenin adı: ProductName - Reçete N
    const nextNum = (recipes.length || 0) + 1;
    const autoName = `${productName || 'Ürün'} - Reçete ${nextNum}`;
    const { data: newRecipe } = await supabase.from('product_recipes').insert({
      product_id: productId,
      name: autoName,
      tags: srcRecipe?.tags || [],
      other_costs: srcRecipe?.other_costs || [],
    }).select().single();

    if (srcItems?.length > 0 && newRecipe) {
      await supabase.from('recipe_items').insert(
        srcItems.map(({ id: _, recipe_id: __, created_at: ___, ...rest }) => ({
          ...rest, recipe_id: newRecipe.id,
        }))
      );
    }
    setSaving(false);
    setCopyModal(false);
    loadRecipes();
  };

  // ── Etiket yönetimi ───────────────────────────────────────────────────────
  const toggleTag = (recipe, tag) => {
    const tags = recipe.tags || [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    updateRecipeMeta(recipe.id, { tags: newTags });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={22} className="animate-spin" style={{ color: currentColor }} />
      <span className="ml-3 text-sm" style={{ color: c.muted }}>Reçeteler yükleniyor...</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Başlık barı */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: c.muted }}>
            {recipes.length} Reçete
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: c.muted }}>
            Her reçete farklı bir varyant içindir. Satışta seçilir, stoktan düşürülür.
          </p>
        </div>
        <div className="flex gap-2">
          {productId && (
            <button onClick={() => setCopyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={{ borderColor: c.border, color: c.muted }}>
              <Copy size={12} /> Kopyala
            </button>
          )}
          <button onClick={addRecipe} disabled={saving || !productId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"
            style={{ background: productId ? currentColor : '#64748b', opacity: saving ? 0.7 : 1 }}>
            <Plus size={12} /> Yeni Reçete
          </button>
        </div>
      </div>

      {!productId && (
        <div className="rounded-xl p-4 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertCircle size={16} style={{ color: '#f59e0b' }} />
          <p className="text-xs" style={{ color: '#f59e0b' }}>Önce ürünü kaydedin, sonra reçete ekleyebilirsiniz.</p>
        </div>
      )}

      {recipes.length === 0 && productId && (
        <div className="text-center py-10 rounded-xl" style={{ border: `1.5px dashed ${c.border}` }}>
          <p className="text-sm font-semibold" style={{ color: c.muted }}>Henüz reçete yok</p>
          <p className="text-xs mt-1" style={{ color: c.muted }}>Bu ürün için ilk reçeteyi ekleyin</p>
          <button onClick={addRecipe} className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: currentColor }}>
            + İlk Reçeteyi Ekle
          </button>
        </div>
      )}

      {/* Recete listesi */}
      {recipes.map((recipe, rIdx) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          index={rIdx}
          expanded={expanded === recipe.id}
          onToggle={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
          onUpdateMeta={updateRecipeMeta}
          onDelete={deleteRecipe}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onSaveItem={saveItem}
          onDeleteItem={deleteItem}
          onToggleTag={toggleTag}
          onCopyThisRecipe={(r) => copyRecipe(r.id, r.name, productId)}
          rawItems={rawItems}
          costTypes={costTypes}
          convert={convert}
          fxRates={fxRates}
          productCurrency={productCurrency}
          c={c} currentColor={currentColor} isDark={isDark}
        />
      ))}

      {/* Kopyala Modal (başka üründen) */}
      {copyModal && (
        <CopyFromProductModal
          allProducts={allProducts}
          onCopy={copyRecipe}
          onClose={() => setCopyModal(false)}
          c={c} currentColor={currentColor} isDark={isDark}
        />
      )}
    </div>
  );
}

// ═══════════════════════ RECIPE CARD ═══════════════════════
function RecipeCard({ recipe, index, expanded, onToggle, onUpdateMeta, onDelete,
  onAddItem, onUpdateItem, onSaveItem, onDeleteItem, onToggleTag, onCopyThisRecipe,
  rawItems, costTypes, convert, fxRates, productCurrency, c, currentColor, isDark }) {

  const [tagInput, setTagInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(recipe.name);
  const [rawSearch, setRawSearch] = useState('');

  const filteredRaw = rawSearch.trim()
    ? rawItems.filter(r => trNorm(r.name).includes(trNorm(rawSearch)) || trNorm(r.sku || '').includes(trNorm(rawSearch))).slice(0, 50)
    : rawItems.slice(0, 50);

  const [expenseDrop, setExpenseDrop] = useState(false);
  const expenseDropRef = React.useRef(null);
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (expenseDropRef.current && !expenseDropRef.current.contains(e.target)) {
        setExpenseDrop(false);
      }
    };
    if (expenseDrop) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expenseDrop]);

  const handleNameBlur = () => {
    setEditingName(false);
    if (nameVal !== recipe.name) onUpdateMeta(recipe.id, { name: nameVal });
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || (recipe.tags || []).includes(t)) return;
    onToggleTag(recipe, t);
    setTagInput('');
  };

  const totalItems = (recipe.recipe_items || []).length;
  const otherCosts = recipe.other_costs || [];

  // Maliyet hesapla
  let totalCost = (recipe.recipe_items || []).reduce((acc, ri) => {
    const cost = (Number(ri.item?.purchase_price) || 0) * Number(ri.quantity || 1);
    const cur = ri.item?.base_currency || 'TRY';
    return acc + convert(cost, cur, productCurrency || 'TRY');
  }, 0);
  otherCosts.forEach(oc => {
    totalCost += convert(Number(oc.amount) || 0, oc.currency || 'TRY', productCurrency || 'TRY');
  });

  const isForeign = productCurrency && productCurrency !== 'TRY';
  const tryEq = totalCost > 0 ? convert(totalCost, productCurrency, 'TRY').toFixed(2) : '0.00';
  const kur = fxRates && fxRates[productCurrency] ? fxRates[productCurrency].toFixed(2) : '1.00';

  const addOtherCost = (type) => {
    const newCost = { id: Math.random().toString(36).substr(2, 9), type, amount: 0, currency: 'TRY' };
    onUpdateMeta(recipe.id, { other_costs: [...otherCosts, newCost] });
  };

  const updateOtherCost = (id, patch) => {
    const next = otherCosts.map(x => x.id === id ? { ...x, ...patch } : x);
    onUpdateMeta(recipe.id, { other_costs: next });
  };

  const deleteOtherCost = (id) => {
    const next = otherCosts.filter(x => x.id !== id);
    onUpdateMeta(recipe.id, { other_costs: next });
  };

  return (
    <div className="rounded-2xl" style={{ border: `1px solid ${expanded ? currentColor + '60' : c.border}`, transition: 'border-color 0.2s', overflow: 'visible' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer rounded-t-2xl"
        style={{ background: expanded ? `${currentColor}08` : 'transparent' }}
        onClick={onToggle}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: currentColor }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
              onBlur={handleNameBlur} onKeyDown={e => e.key === 'Enter' && handleNameBlur()}
              onClick={e => e.stopPropagation()}
              className="bg-transparent outline-none font-semibold text-sm w-full"
              style={{ color: c.text, borderBottom: `1px solid ${currentColor}` }} />
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="font-semibold text-sm truncate" style={{ color: c.text }}>
                {recipe.name}
              </p>
              <button
                onClick={e => { e.stopPropagation(); setEditingName(true); }}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: c.muted }}
                title="Adı düzenle">
                <Edit2 size={11}/>
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(recipe.tags || []).map(tag => (
              <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${currentColor}20`, color: currentColor }}>
                {tag}
              </span>
            ))}
            <span className="text-[10px]" style={{ color: c.muted }}>
              {totalItems} kalem{otherCosts.length > 0 ? ` + ${otherCosts.length} gider` : ''}
            </span>
            {totalCost > 0 && (
              <span className="text-[10px] font-bold ml-2" style={{ color: currentColor }}>
                {CURRENCY_SYM[productCurrency || 'TRY'] || '₺'}{totalCost.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => {
            const html = `
              <div style="font-family:sans-serif;color:#1e293b;padding:20px;">
                <h2 style="margin-bottom:20px;font-size:24px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
                  ${recipe.name}
                </h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                  <thead>
                    <tr style="background:#f8fafc">
                      <th style="padding:10px;border:1px solid #e2e8f0;text-align:left;font-size:14px">#</th>
                      <th style="padding:10px;border:1px solid #e2e8f0;text-align:left;font-size:14px">Malzeme</th>
                      <th style="padding:10px;border:1px solid #e2e8f0;text-align:right;font-size:14px">Miktar</th>
                      <th style="padding:10px;border:1px solid #e2e8f0;text-align:left;font-size:14px">Birim</th>
                      <th style="padding:10px;border:1px solid #e2e8f0;text-align:right;font-size:14px">B. Maliyet</th>
                      <th style="padding:10px;border:1px solid #e2e8f0;text-align:right;font-size:14px">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(recipe.recipe_items || []).map((ri, i) => {
                      const qty = Number(ri.quantity || 1);
                      const price = Number(ri.item?.purchase_price || 0);
                      const sym = CURRENCY_SYM[ri.item?.base_currency || 'TRY'] || '₺';
                      return `<tr>
                        <td style="padding:10px;border:1px solid #e2e8f0;font-size:13px">${i+1}</td>
                        <td style="padding:10px;border:1px solid #e2e8f0;font-size:13px">${ri.item_name}</td>
                        <td style="padding:10px;border:1px solid #e2e8f0;font-size:13px;text-align:right">${qty}</td>
                        <td style="padding:10px;border:1px solid #e2e8f0;font-size:13px">${ri.unit}</td>
                        <td style="padding:10px;border:1px solid #e2e8f0;font-size:13px;text-align:right">${sym}${price.toFixed(2)}</td>
                        <td style="padding:10px;border:1px solid #e2e8f0;font-size:13px;text-align:right;font-weight:bold">${sym}${(qty*price).toFixed(2)}</td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
                <div style="text-align:right;font-size:18px;font-weight:bold;margin-top:20px;color:#10b981">
                  Maliyet Toplamı: ${CURRENCY_SYM[productCurrency || 'TRY'] || '₺'}${totalCost.toFixed(2)}
                </div>
              </div>
            `;
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Reçete Yazdır</title></head><body onload="window.print();window.close()">' + html + '</body></html>');
            printWindow.document.close();
          }}
            className="p-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
            title="Reçeteyi Yazdır" style={{ color: '#10b981' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
          <button onClick={() => onCopyThisRecipe(recipe)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Bu reçeteyi kopyala" style={{ color: c.muted }}>
            <Copy size={13} />
          </button>
          <button onClick={() => onDelete(recipe.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: '#ef4444' }}>
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronDown size={16} style={{ color: c.muted }} /> : <ChevronRight size={16} style={{ color: c.muted }} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t flex flex-col md:flex-row rounded-b-2xl" style={{ borderColor: c.border }}>
          {/* SOL: Hammadde Listesi */}
          <div className="md:w-[260px] lg:w-[320px] p-4 border-b md:border-b-0 md:border-r flex-shrink-0" style={{ borderColor: c.border, background: isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: c.muted }}>Malzeme Listesi</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
              <input value={rawSearch} onChange={e => setRawSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl outline-none border"
                placeholder="Hammadde ara..."
                style={{ background: c.card, borderColor: c.border, color: c.text }} />
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {filteredRaw.map(r => (
                <div key={r.id} onClick={() => onAddItem(recipe.id, r)}
                  className="flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-colors group"
                  style={{ background: c.card, borderColor: c.border }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = currentColor}
                  onMouseLeave={e => e.currentTarget.style.borderColor = c.border}>
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold truncate" style={{ color: c.text }}>{r.name}</p>
                    <p className="text-[9px]" style={{ color: c.muted }}>{r.sku || 'SKU Yok'} • Stok: {r.stock_count || 0}</p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <button className="w-5 h-5 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: currentColor }}>
                      <Plus size={10} />
                    </button>
                    {r.purchase_price > 0 && (
                      <span className="text-[9px] font-bold mt-1" style={{ color: currentColor }}>
                        {CURRENCY_SYM[r.base_currency || 'TRY'] || '₺'}{r.purchase_price}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filteredRaw.length === 0 && <p className="text-xs text-center py-4" style={{ color: c.muted }}>Sonuç bulunamadı</p>}
            </div>
          </div>

          {/* SAĞ: Reçete Detayları */}
          <div className="flex-1 min-w-0 p-4 space-y-4">
            {/* Etiketler */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: c.muted }}>
                <Tag size={10} className="inline mr-1" />Etiketler
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(recipe.tags || []).map(tag => (
                  <span key={tag}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer"
                    style={{ background: `${currentColor}20`, color: currentColor }}
                    onClick={() => onToggleTag(recipe, tag)}>
                    {tag} <X size={10} />
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="Etiket ekle (Örn: 3000K, Tavan Montaj)..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl outline-none border"
                  style={{ background: c.card, borderColor: c.border, color: c.text }} />
                <button onClick={addTag}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl"
                  style={{ background: `${currentColor}15`, color: currentColor }}>
                  + Ekle
                </button>
              </div>
            </div>

            {/* Kalemler */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>Reçete İçeriği</p>
                <button onClick={() => onAddItem(recipe.id)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                  style={{ background: `${currentColor}15`, color: currentColor }}>
                  <Plus size={10} /> Boş Satır Ekle
                </button>
              </div>
              <div className="space-y-1.5">
                {(recipe.recipe_items || [])
                  .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                  .map((ri, i) => (
                    <RecipeItemRow
                      key={ri.id}
                      item={ri}
                      index={i}
                      rawItems={rawItems}
                      onChange={patch => onUpdateItem(recipe.id, ri.id, patch)}
                      onBlur={patch => onSaveItem(ri.id, patch)}
                      onDelete={() => onDeleteItem(recipe.id, ri.id)}
                      c={c} currentColor={currentColor} isDark={isDark}
                    />
                  ))}
                {(recipe.recipe_items || []).length === 0 && (
                  <p className="text-center text-xs py-6 border border-dashed rounded-xl" style={{ color: c.muted, borderColor: c.border }}>
                    Soldaki listeden malzeme seçerek reçeteye ekleyin
                  </p>
                )}
              </div>
            </div>

          {/* Diğer Giderler */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>Diğer Giderler</p>
              <div className="relative" ref={expenseDropRef}>
                <button 
                  onClick={() => setExpenseDrop(!expenseDrop)}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: `${currentColor}15`, color: currentColor }}>
                  <Plus size={11} /> Gider Ekle
                </button>
                {expenseDrop && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl shadow-lg border z-10 overflow-hidden"
                    style={{ background: c.card, borderColor: c.border }}>
                    <div className="py-1">
                      {costTypes.map(ct => (
                        <button key={ct} onClick={() => { addOtherCost(ct); setExpenseDrop(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                          style={{ color: c.text, borderBottom: `1px solid ${c.border}` }}>
                          + {ct}
                        </button>
                      ))}
                      {costTypes.length === 0 && <span className="block px-3 py-2 text-[10px] text-center" style={{ color: c.muted }}>Ayarlardan tip ekleyin</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {otherCosts.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {otherCosts.map((oc, i) => (
                  <div key={oc.id} className="grid gap-1.5 rounded-xl p-2 items-center"
                    style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${c.border}`, gridTemplateColumns: 'minmax(80px,1fr) 90px 60px 28px' }}>
                    <span className="text-xs font-bold pl-1" style={{ color: c.text }}>{oc.type}</span>
                    <input type="number" min="0" step="0.01" value={oc.amount || ''} placeholder="Tutar"
                      onChange={e => updateOtherCost(oc.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="px-2 py-1 text-xs rounded-lg border outline-none text-right"
                      style={{ background: 'transparent', borderColor: c.border, color: c.text }} />
                    <select value={oc.currency || 'TRY'}
                      onChange={e => updateOtherCost(oc.id, { currency: e.target.value })}
                      className="px-1 py-1 text-xs font-bold rounded-lg border outline-none"
                      style={{ background: c.card, borderColor: c.border, color: currentColor }}>
                      {['TRY','USD','EUR','GBP'].map(cu => <option key={cu}>{cu}</option>)}
                    </select>
                    <button onClick={() => deleteOtherCost(oc.id)}
                      className="p-1 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
                      style={{ color: '#ef4444' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* Toplam */}
            {(recipe.recipe_items?.length > 0 || otherCosts.length > 0) && (
              <div className="rounded-xl px-3 py-2 flex items-center justify-between mt-2"
                style={{ background: `${currentColor}08`, border: `1px solid ${currentColor}25` }}>
                <span className="text-xs font-semibold" style={{ color: c.muted }}>Maliyet Toplamı ({CURRENCY_SYM[productCurrency || 'TRY'] || '₺'})</span>
                <div className="text-right">
                  <span className="text-[10px] mr-3" style={{ color: c.muted }}>
                    {totalItems} kalem{otherCosts.length > 0 ? ` + ${otherCosts.length} gider` : ''}
                  </span>
                  <span className="text-sm font-black" style={{ color: currentColor }}>
                    {CURRENCY_SYM[productCurrency || 'TRY'] || '₺'}{totalCost.toFixed(2)}
                  </span>
                  {totalCost > 0 && (
                    <div className="text-[9px] font-bold mt-0.5 flex items-center justify-end gap-2" style={{ color: c.muted }}>
                      <span className="flex items-center gap-1">
                        <span style={{ color: '#10b981' }}>₺{tryEq}</span>
                        {productCurrency !== 'TRY' && <span className="opacity-70">(Kur: {kur})</span>}
                      </span>
                      {productCurrency !== 'USD' && (
                        <span style={{ color: '#3b82f6' }}>${convert(totalCost, productCurrency || 'TRY', 'USD').toFixed(2)}</span>
                      )}
                      {productCurrency !== 'EUR' && (
                        <span style={{ color: '#f59e0b' }}>€{convert(totalCost, productCurrency || 'TRY', 'EUR').toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ RECIPE ITEM ROW ═══════════════════════
function RecipeItemRow({ item, index, rawItems, onChange, onBlur, onDelete, c, currentColor, isDark }) {
  const [itemSearch, setItemSearch] = React.useState('');
  const [dropOpen,   setDropOpen]   = React.useState(false);
  const [dropPos,    setDropPos]    = React.useState({ top: 0, left: 0, width: 0 });
  const btnRef = React.useRef(null);

  const filtered = itemSearch.trim()
      ? rawItems.filter(r =>
          trNorm(r.name).includes(trNorm(itemSearch)) ||
          trNorm(r.sku || '').includes(trNorm(itemSearch))
        ).slice(0, 10)
    : rawItems.slice(0, 10);

  const selectRaw = (raw) => {
    // Local patch fills item so UI updates immediately
    const localPatch = { 
      item_id: raw.id, item_name: raw.name, unit: raw.unit || 'Adet',
      item: { purchase_price: raw.purchase_price, base_currency: raw.base_currency } 
    };
    onChange(localPatch);
    // DB patch ignores 'item'
    onBlur({ item_id: raw.id, item_name: raw.name, unit: raw.unit || 'Adet' });
    setDropOpen(false);
    setItemSearch('');
  };

  const openDrop = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) });
    }
    setDropOpen(true);
  };

  const unitPrice = item.item?.purchase_price || 0;
  const qty = Number(item.quantity || 1);
  const subtotal = unitPrice * qty;
  const curSym = CURRENCY_SYM[item.item?.base_currency || 'TRY'] || '₺';

  return (
    <div className="flex flex-wrap sm:flex-nowrap gap-1.5 rounded-xl p-2 items-center"
      style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${c.border}` }}>
      <span className="text-[10px] font-bold w-5 flex-shrink-0 text-center" style={{ color: c.muted }}>
        {index + 1}
      </span>
      {/* İsim / hammadde seçici */}
      <div className="relative flex-1 min-w-[120px]">
        {dropOpen ? (
          <div>
            <input autoFocus value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              onBlur={() => setTimeout(() => setDropOpen(false), 200)}
              className="w-full px-2 py-1 text-xs rounded-lg outline-none border"
              style={{ background: c.card, borderColor: currentColor, color: c.text }}
              placeholder="Ara..." />
            {/* FIXED DROPDOWN — viewport üzerinde açılır, hiçbir overflow bunu kesmez */}
            {filtered.length > 0 && typeof document !== 'undefined' && (
              createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: dropPos.top,
                    left: dropPos.left,
                    width: dropPos.width,
                    zIndex: 9999,
                    background: isDark ? '#0f1f38' : '#fff',
                    border: `1px solid ${c.border}`,
                    borderRadius: '0.875rem',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}>
                  {filtered.map(r => (
                    <div key={r.id}
                      className="px-3 py-2 cursor-pointer flex items-center justify-between text-xs"
                      onMouseDown={() => selectRaw(r)}
                      style={{ borderBottom: `1px solid ${c.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span className="font-semibold" style={{ color: c.text }}>{r.name}</span>
                      <div className="text-right flex flex-col">
                        <span style={{ color: c.muted, fontSize: 10 }}>{r.unit}</span>
                        {r.purchase_price > 0 && (
                          <span style={{ color: currentColor, fontSize: 9, fontWeight: 'bold' }}>
                            {CURRENCY_SYM[r.base_currency || 'TRY'] || '₺'}{r.purchase_price}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {itemSearch && (
                    <div className="px-3 py-2 cursor-pointer text-xs font-semibold"
                      style={{ color: currentColor }}
                      onMouseDown={() => {
                        const patch = { item_id: null, item_name: itemSearch.trim(), unit: 'Adet' };
                        onChange(patch); onBlur(patch); setDropOpen(false); setItemSearch('');
                      }}>
                      "{itemSearch}" adını kullan (kayıtsız)
                    </div>
                  )}
                </div>,
                document.body
              )
            )}
          </div>
        ) : (
          <button ref={btnRef} onClick={openDrop}
            className="w-full h-full text-left px-2 py-1.5 flex items-center justify-between text-xs rounded-lg border min-w-0"
            style={{ background: 'transparent', borderColor: c.border, color: item.item_name ? c.text : c.muted }}>
            <span className="truncate pr-1">{item.item_name || 'Malzeme seç...'}</span>
            {item.item?.purchase_price > 0 && (
              <span className="text-[9px] font-bold flex-shrink-0" style={{ color: currentColor, opacity: 0.8 }}>
                {curSym}{item.item?.purchase_price}
              </span>
            )}
          </button>
        )}
      </div>
      {/* Miktar */}
      <input type="number" min="0" step="0.01"
        value={item.quantity}
        onChange={e => onChange({ quantity: e.target.value })}
        onBlur={e => onBlur({ quantity: parseFloat(e.target.value) || 1 })}
        className="w-16 px-2 py-1 text-xs rounded-lg border outline-none text-center flex-shrink-0"
        style={{ background: 'transparent', borderColor: c.border, color: c.text }} />
      {/* Birim */}
      <select value={item.unit || 'Adet'}
        onChange={e => { onChange({ unit: e.target.value }); onBlur({ unit: e.target.value }); }}
        className="w-20 px-1 py-1.5 text-xs rounded-lg border outline-none flex-shrink-0"
        style={{ background: c.card, borderColor: c.border, color: c.text }}>
        {UNITS.map(u => <option key={u}>{u}</option>)}
      </select>
      {/* Subtotal */}
      {unitPrice > 0 ? (
        <div className="w-16 text-right flex-shrink-0 text-[10px] font-bold" style={{ color: currentColor }}>
          {curSym}{subtotal.toFixed(2)}
        </div>
      ) : (
        <div className="w-16 flex-shrink-0"></div>
      )}
      {/* Sil */}
      <button onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
        style={{ color: '#ef4444' }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ═══════════════════════ COPY FROM PRODUCT MODAL ═══════════════════════
function CopyFromProductModal({ allProducts, onCopy, onClose, c, currentColor, isDark }) {
  const [search, setSearch]     = useState('');
  const [selProd, setSelProd]   = useState(null);
  const [recipes, setRecipes]   = useState([]);
  const [loading, setLoading]   = useState(false);

  const filtered = search
    ? allProducts.filter(p => trNorm(p.name).includes(trNorm(search)))
    : allProducts.slice(0, 10);

  const selectProduct = async (prod) => {
    setSelProd(prod);
    setLoading(true);
    const { data } = await supabase.from('product_recipes')
      .select('id,name,tags,other_costs,recipe_items(id)').eq('product_id', prod.id);
    setRecipes(data || []);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: isDark ? '#0c1526' : '#fff', border: `1px solid ${c.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: c.border }}>
          <h3 className="font-bold" style={{ color: c.text }}>Başka Üründen Reçete Kopyala</h3>
          <button onClick={onClose} style={{ color: c.muted }}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none border"
              placeholder="Ürün ara..."
              style={{ background: c.card, borderColor: c.border, color: c.text }} />
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {filtered.map(p => (
              <button key={p.id} onClick={() => selectProduct(p)}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  background: selProd?.id === p.id ? `${currentColor}15` : 'transparent',
                  color: selProd?.id === p.id ? currentColor : c.text,
                }}>
                {p.name}
              </button>
            ))}
          </div>
          {selProd && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: c.muted }}>
                {selProd.name} — Reçeteler
              </p>
              {loading ? (
                <div className="text-center py-4"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: currentColor }} /></div>
              ) : recipes.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: c.muted }}>Bu üründe reçete yok</p>
              ) : (
                <div className="space-y-1.5">
                  {recipes.map(r => (
                    <button key={r.id}
                      onClick={() => onCopy(r.id, r.name, selProd.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                      style={{ borderColor: c.border, color: c.text }}
                      onMouseEnter={e => e.currentTarget.style.background = `${currentColor}10`}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="text-left">
                        <p>{r.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {(r.tags || []).map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: `${currentColor}20`, color: currentColor }}>{t}</span>
                          ))}
                          <span className="text-[10px]" style={{ color: c.muted }}>
                            {(r.recipe_items || []).length} kalem{(r.other_costs || []).length > 0 ? ` + ${(r.other_costs || []).length} gider` : ''}
                          </span>
                        </div>
                      </div>
                      <Copy size={14} style={{ color: currentColor }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
