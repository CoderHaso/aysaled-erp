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
import {
  Plus, Trash2, Copy, ChevronDown, ChevronRight,
  Search, X, Check, AlertCircle, Loader2, Tag, Edit2
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','m³','Rulo','Paket','Kutu','Set','Takım'];

export default function RecipeEditor({ productId, productName, c, currentColor }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [recipes,  setRecipes]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [expanded, setExpanded] = useState(null); // recipe id
  const [rawItems, setRawItems] = useState([]);   // hammadde listesi (item seçici için)
  const [copyModal, setCopyModal] = useState(false); // recete kopyala modal
  const [allProducts, setAllProducts] = useState([]);

  // ── Veri çek ──────────────────────────────────────────────────────────────
  const loadRecipes = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const { data } = await supabase
      .from('product_recipes')
      .select('*, recipe_items(*, item:item_id(id,name,unit))')
      .eq('product_id', productId)
      .order('created_at');
    setRecipes(data || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  useEffect(() => {
    // Hammadde listesi
    supabase.from('items').select('id,name,unit,sku').neq('item_type','product').order('name')
      .then(({ data }) => setRawItems(data || []));
    // Kopyalama için tüm ürünler
    supabase.from('items').select('id,name').eq('item_type','product').neq('id', productId || 'none').order('name')
      .then(({ data }) => setAllProducts(data || []));
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
  const addItem = async (recipeId) => {
    const { data } = await supabase.from('recipe_items').insert({
      recipe_id: recipeId, item_name: '', quantity: 1, unit: 'Adet', order_index: 99,
    }).select().single();
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
    const { data: srcItems } = await supabase
      .from('recipe_items').select('*').eq('recipe_id', sourceRecipeId);
    // Kopyalanmış reçetenin adı: ProductName - Reçete N
    const nextNum = (recipes.length || 0) + 1;
    const autoName = `${productName || 'Ürün'} - Reçete ${nextNum}`;
    const { data: newRecipe } = await supabase.from('product_recipes').insert({
      product_id: productId,
      name: autoName,
      tags: [],
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
  rawItems, c, currentColor, isDark }) {

  const [tagInput, setTagInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(recipe.name);

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
            <span className="text-[10px]" style={{ color: c.muted }}>{totalItems} kalem</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
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
        <div className="border-t px-4 py-4 space-y-4 rounded-b-2xl" style={{ borderColor: c.border }}>
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
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>Kalemler</p>
              <button onClick={() => onAddItem(recipe.id)}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: `${currentColor}15`, color: currentColor }}>
                <Plus size={11} /> Kalem Ekle
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
                <p className="text-center text-xs py-4" style={{ color: c.muted }}>
                  Henüz kalem yok — Kalem Ekle ile malzeme ekleyin
                </p>
              )}
            </div>
          </div>

          {/* Toplam */}
          {(recipe.recipe_items || []).length > 0 && (
            <div className="rounded-xl px-3 py-2 flex items-center justify-between"
              style={{ background: `${currentColor}08`, border: `1px solid ${currentColor}25` }}>
              <span className="text-xs font-semibold" style={{ color: c.muted }}>Toplam Kalem</span>
              <span className="text-sm font-bold" style={{ color: currentColor }}>
                {(recipe.recipe_items || []).length} çeşit malzeme
              </span>
            </div>
          )}
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
        r.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (r.sku || '').toLowerCase().includes(itemSearch.toLowerCase())
      ).slice(0, 10)
    : rawItems.slice(0, 10);

  const selectRaw = (raw) => {
    const patch = { item_id: raw.id, item_name: raw.name, unit: raw.unit || 'Adet' };
    onChange(patch);
    onBlur(patch);
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

  return (
    <div className="grid gap-1.5 rounded-xl p-2"
      style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${c.border}`,
        gridTemplateColumns: '24px 1fr 70px 80px 28px' }}>
      <span className="text-[10px] font-bold flex items-center justify-center" style={{ color: c.muted }}>
        {index + 1}
      </span>
      {/* İsim / hammadde seçici */}
      <div className="relative">
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
                      <span style={{ color: c.muted }}>{r.unit}</span>
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
            className="w-full text-left px-2 py-1 text-xs rounded-lg border truncate"
            style={{ background: 'transparent', borderColor: c.border, color: item.item_name ? c.text : c.muted }}>
            {item.item_name || 'Malzeme seç...'}
          </button>
        )}
      </div>
      {/* Miktar */}
      <input type="number" min="0" step="0.01"
        value={item.quantity}
        onChange={e => onChange({ quantity: e.target.value })}
        onBlur={e => onBlur({ quantity: parseFloat(e.target.value) || 1 })}
        className="px-2 py-1 text-xs rounded-lg border outline-none text-center"
        style={{ background: 'transparent', borderColor: c.border, color: c.text }} />
      {/* Birim */}
      <select value={item.unit || 'Adet'}
        onChange={e => { onChange({ unit: e.target.value }); onBlur({ unit: e.target.value }); }}
        className="px-1 py-1 text-xs rounded-lg border outline-none"
        style={{ background: c.card, borderColor: c.border, color: c.text }}>
        {UNITS.map(u => <option key={u}>{u}</option>)}
      </select>
      {/* Sil */}
      <button onClick={onDelete}
        className="p-1 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
        style={{ color: '#ef4444' }}>
        <Trash2 size={12} />
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
    ? allProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : allProducts.slice(0, 10);

  const selectProduct = async (prod) => {
    setSelProd(prod);
    setLoading(true);
    const { data } = await supabase.from('product_recipes')
      .select('id,name,tags,recipe_items(id)').eq('product_id', prod.id);
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
                            {(r.recipe_items || []).length} kalem
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
