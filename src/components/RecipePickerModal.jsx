import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Package, FlaskConical, Plus, Trash2,
  ChevronRight, ArrowLeftRight, Search, AlertCircle,
  ShoppingBag, DollarSign, Tag,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * RecipePickerModal
 * 
 * Sol : Etiket filtresi + Reçete listesi
 * Sağ : Seçili reçetenin malzemeleri (tam CRUD, fiyat dahil)
 *       Swap/Ekle → ItemPickerModal (ayrı modal, scrollable tam liste)
 *
 * Props:
 *  productId, productName
 *  allRecipes  : [{id, product_id, name, tags[], recipe_items:[{id,item_id,item_name,quantity,unit}]}]
 *  allItems    : [{id, name, unit, purchase_price, item_type}]
 *  onSelect    : ({recipe_id, recipe_key, recipe_note, components}) => void
 *  onClose     : () => void
 *  currentColor
 */

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'];

export default function RecipePickerModal({
  productId, productName, allRecipes, allItems = [],
  onSelect, onClose, currentColor = '#8b5cf6',
}) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const productRecipes = useMemo(
    () => (allRecipes || []).filter(r => r.product_id === productId),
    [allRecipes, productId]
  );

  const [activeTag,  setActiveTag]  = useState('Tümü');
  const [selectedId, setSelectedId] = useState(() => productRecipes[0]?.id || null);
  const [localItems, setLocalItems] = useState(() => cloneItems(productRecipes[0]?.recipe_items || []));
  // ItemPickerModal: 'add' | idx (swap) | null
  const [pickerTarget, setPickerTarget] = useState(null);

  /* ── Etiketler ─────────────────────────────────────────────── */
  const allTags = useMemo(() => {
    const s = new Set(['Tümü']);
    productRecipes.forEach(r => (r.tags || []).forEach(t => s.add(t)));
    return [...s];
  }, [productRecipes]);

  const filteredRecipes = useMemo(() =>
    productRecipes.filter(r => activeTag === 'Tümü' || (r.tags || []).includes(activeTag)),
    [productRecipes, activeTag]
  );

  const activeRecipe = filteredRecipes.find(r => r.id === selectedId) || filteredRecipes[0];

  /* ── Maliyet ───────────────────────────────────────────────── */
  const totalCost = useMemo(() => localItems.reduce((sum, it) => {
    const item  = (allItems || []).find(i => i.id === it.item_id) || {};
    const price = it.purchase_price ?? item.purchase_price ?? 0;
    return sum + Number(price) * Number(it.quantity || 1);
  }, 0), [localItems, allItems]);

  /* ── Değişti mi? ───────────────────────────────────────────── */
  const changed = useMemo(() =>
    JSON.stringify(localItems.map(i => ({ n: i.item_name, q: String(i.quantity), u: i.unit }))) !==
    JSON.stringify((activeRecipe?.recipe_items || []).map(i => ({ n: i.item_name, q: String(i.quantity), u: i.unit }))),
    [localItems, activeRecipe]
  );

  /* ── Reçete seç ────────────────────────────────────────────── */
  const selectRecipe = useCallback(recipe => {
    setSelectedId(recipe.id);
    setLocalItems(cloneItems(recipe.recipe_items || []));
  }, []);

  /* ── CRUD ──────────────────────────────────────────────────── */
  const updateItem = (idx, key, val) =>
    setLocalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  const removeItem = idx =>
    setLocalItems(prev => prev.filter((_, i) => i !== idx));

  /* ── ItemPickerModal callback ──────────────────────────────── */
  const handleItemPick = useCallback(({ item, custom }) => {
    if (pickerTarget === 'add') {
      setLocalItems(prev => [...prev, {
        _new: true,
        item_id:   item?.id   || null,
        item_name: item?.name || custom || '',
        unit:      item?.unit || 'Adet',
        quantity:  1,
        purchase_price: item?.purchase_price ?? null,
      }]);
    } else if (pickerTarget != null) {
      setLocalItems(prev => prev.map((it, i) => i === pickerTarget ? {
        ...it,
        item_id:   item?.id   || null,
        item_name: item?.name || custom || it.item_name,
        unit:      item?.unit || it.unit,
        purchase_price: item?.purchase_price ?? it.purchase_price,
      } : it));
    }
    setPickerTarget(null);
  }, [pickerTarget]);

  /* ── Onayla ────────────────────────────────────────────────── */
  const handleConfirm = () => {
    if (!activeRecipe) return;
    const components = localItems
      .filter(it => it.item_name?.trim())
      .map(it => ({
        recipe_item_id: it.id || null,
        item_id:        it.item_id || null,
        item_name:      it.item_name || '—',
        quantity:       Number(it.quantity) || 1,
        unit:           it.unit || 'Adet',
        purchase_price: it.purchase_price ?? null,
      }));
    onSelect({
      recipe_id:   activeRecipe.id,
      recipe_key:  activeRecipe.name,
      recipe_note: `${activeRecipe.name}: ${components.map(c => `${c.quantity}x ${c.item_name}`).join(', ')}`,
      components,
    });
  };

  const hasSingleRecipe = productRecipes.length <= 1;

  return (
    <>
    <div className="fixed inset-0 z-[199] flex items-center justify-center p-3 sm:p-5">
      <motion.div
        className="absolute inset-0 bg-black/85 backdrop-blur-lg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={pickerTarget !== null ? undefined : onClose}
      />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full flex flex-col rounded-3xl overflow-hidden shadow-2xl"
        style={{
          maxWidth: 780, maxHeight: '92vh',
          background: isDark ? 'linear-gradient(145deg, #0d1b2e 0%, #0a1628 100%)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : '#e2e8f0'}`,
          boxShadow: `0 0 60px ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(0,0,0,0.1)'}, 0 25px 50px rgba(0,0,0,0.5)`,
        }}>

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, rgba(139,92,246,0.12) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(148,163,184,0.08)',
          }}>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <FlaskConical size={17} style={{ color: '#c4b5fd' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-400">Reçete Seç & Düzenle</p>
            <h3 className="text-sm font-bold truncate mt-0.5" style={{ color: isDark ? '#ffffff' : '#1e293b' }}>{productName}</h3>
          </div>
          {changed && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>
              <p className="text-[10px] font-bold text-amber-400">Siparişe özel</p>
            </div>
          )}
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"
            style={{ color: '#64748b' }}>
            <X size={15}/>
          </button>
        </div>

        {/* ═══ BODY ═══ */}
        {productRecipes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0'}` }}>
              <Package size={24} className="text-slate-500"/>
            </div>
            <p className="text-sm font-semibold" style={{ color: isDark ? '#94a3b8' : '#475569' }}>Bu ürün için reçete tanımlanmamış</p>
            <p className="text-[11px] mt-2" style={{ color: '#64748b' }}>Stok → Mamül → Reçeteler sekmesinden ekleyebilirsiniz</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">

            {/* ── SOL: Reçete listesi (birden fazla varsa) ── */}
            {!hasSingleRecipe && (
              <div className="w-48 flex-shrink-0 flex flex-col overflow-hidden"
                style={{ borderRight: '1px solid rgba(148,163,184,0.07)' }}>

                {/* Etiket filtresi */}
                {allTags.length > 1 && (
                  <div className="p-3 flex flex-wrap gap-1.5 flex-shrink-0"
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => setActiveTag(tag)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                        style={{
                          background: activeTag === tag ? `${currentColor}25` : 'rgba(255,255,255,0.03)',
                          color:      activeTag === tag ? currentColor : '#475569',
                          border:     `1px solid ${activeTag === tag ? currentColor + '45' : 'rgba(148,163,184,0.1)'}`,
                        }}>
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Liste */}
                <div className="flex-1 overflow-y-auto">
                  {filteredRecipes.map(r => {
                    const active = (activeRecipe?.id === r.id);
                    return (
                      <button key={r.id} onClick={() => selectRecipe(r)}
                        className="w-full text-left px-4 py-3 flex items-start gap-2 transition-all group"
                        style={{
                          background:  active ? `${currentColor}15` : 'transparent',
                          borderLeft: `2px solid ${active ? currentColor : 'transparent'}`,
                        }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate"
                            style={{ color: active ? (isDark ? '#c4b5fd' : '#8b5cf6') : (isDark ? '#94a3b8' : '#64748b') }}>
                            {r.name}
                          </p>
                          <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: isDark ? '#475569' : '#94a3b8'}}>
                            <Package size={8}/> {(r.recipe_items || []).length} malzeme
                          </p>
                        </div>
                        {active && <ChevronRight size={11} style={{ color: currentColor, marginTop: 2, flexShrink: 0 }}/>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SAĞ: Malzeme paneli ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

              {/* Reçete başlığı + Ekle */}
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>
                      {activeRecipe?.name}
                    </p>
                    {(activeRecipe?.tags || []).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                        style={{ background: `${currentColor}20`, color: currentColor }}>
                        <Tag size={8}/> {tag}
                      </span>
                    ))}
                  </div>
                  {changed && (
                    <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                      <AlertCircle size={9}/> Yalnızca bu sipariş için özelleştirildi
                    </p>
                  )}
                </div>
                <button onClick={() => setPickerTarget('add')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: `${currentColor}18`,
                    color: currentColor,
                    border: `1px solid ${currentColor}35`,
                  }}>
                  <Plus size={12}/> Malzeme Ekle
                </button>
              </div>

              {/* Tablo başlığı */}
              <div className="px-4 py-1.5 flex-shrink-0 grid text-[10px] font-bold uppercase tracking-widest text-slate-600"
                style={{ gridTemplateColumns: '1fr 64px 68px 80px 56px', borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                <span>Malzeme</span>
                <span className="text-center">Miktar</span>
                <span className="text-center">Birim</span>
                <span className="text-right">Birim Fiyat</span>
                <span/>
              </div>

              {/* Malzeme satırları */}
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {localItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                    <Package size={26} className="mb-2 opacity-30"/>
                    <p className="text-xs">Malzeme yok — Ekle ile başlayın</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {localItems.map((it, idx) => {
                    const stockItem = (allItems || []).find(i => i.id === it.item_id);
                    const linePrice = Number(it.purchase_price ?? stockItem?.purchase_price ?? 0);
                    const lineTotal = linePrice * Number(it.quantity || 1);
                    return (
                      <motion.div key={idx}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group">
                        <div className="grid items-center gap-2 px-3 py-2.5 rounded-2xl transition-colors"
                          style={{
                            gridTemplateColumns: '1fr 64px 68px 80px 56px',
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(148,163,184,0.07)',
                          }}>

                          {/* Ad + stock bilgisi */}
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: it.item_id ? `${currentColor}18` : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9') }}>
                              <ShoppingBag size={10}
                                style={{ color: it.item_id ? currentColor : '#475569' }}/>
                            </div>
                            <div className="flex-1 min-w-0">
                               <input
                                value={it.item_name || ''}
                                onChange={e => updateItem(idx, 'item_name', e.target.value)}
                                placeholder="Malzeme adı..."
                                className="w-full bg-transparent outline-none text-xs font-semibold"
                                style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}/>
                              {stockItem && (
                                <p className="text-[9px] truncate" style={{ color: '#64748b' }}>
                                  Stok: {stockItem.stock_count} {stockItem.unit}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Miktar */}
                          <input type="number" min="0" step="0.01"
                            value={it.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full bg-transparent outline-none text-xs text-center font-bold rounded-lg px-1 py-1"
                            style={{ color: isDark ? '#e2e8f0' : '#1e293b', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}` }}/>

                          {/* Birim */}
                          <select value={it.unit || 'Adet'}
                            onChange={e => updateItem(idx, 'unit', e.target.value)}
                            className="bg-transparent outline-none text-[11px] text-center rounded-lg px-1 py-1 w-full"
                            style={{ color: '#94a3b8', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`, background: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc' }}>
                            {UNITS.map(u => <option key={u} value={u} style={{ background: isDark ? '#0d1b2e' : '#ffffff' }}>{u}</option>)}
                          </select>

                          {/* Birim Fiyat */}
                          <div className="flex items-center justify-end gap-0.5">
                            <span className="text-[10px] text-slate-600">₺</span>
                            <input type="number" min="0" step="0.01"
                              value={it.purchase_price ?? (stockItem?.purchase_price ?? '')}
                              onChange={e => updateItem(idx, 'purchase_price', e.target.value === '' ? null : Number(e.target.value))}
                              placeholder={stockItem?.purchase_price ? String(stockItem.purchase_price) : '0'}
                              className="w-14 bg-transparent outline-none text-xs text-right font-bold text-emerald-400 placeholder-slate-700"/>
                          </div>

                          {/* Aksiyonlar */}
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setPickerTarget(idx)} title="Malzeme değiştir (stoktan)"
                              className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10">
                              <ArrowLeftRight size={10} className="text-blue-400"/>
                            </button>
                            <button onClick={() => removeItem(idx)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                              <Trash2 size={10} className="text-red-400"/>
                            </button>
                          </div>
                        </div>

                        {/* Satır toplam */}
                        {linePrice > 0 && (
                          <p className="text-right text-[10px] text-slate-600 pr-3 -mt-0.5 pb-0.5">
                            {Number(it.quantity || 1).toFixed(2)} × ₺{linePrice.toFixed(2)} = <span className="text-slate-400 font-semibold">₺{lineTotal.toFixed(2)}</span>
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Sipariş özel uyarı */}
              {changed && (
                <div className="mx-4 mb-2 flex-shrink-0 flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5"/>
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Bu değişiklikler <strong>yalnızca bu sipariş</strong> için geçerli — asıl reçete değişmez.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        {productRecipes.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(148,163,184,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Package size={12} className="text-slate-600"/>
                <span className="text-xs text-slate-500">{localItems.filter(i => i.item_name?.trim()).length} malzeme</span>
              </div>
              {totalCost > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <DollarSign size={11} className="text-emerald-400"/>
                  <span className="text-xs font-bold text-emerald-400">₺{totalCost.toFixed(2)}</span>
                  <span className="text-[10px] text-emerald-600">toplam maliyet</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 transition-all hover:text-slate-300"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                İptal
              </button>
              <button onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{
                  background: `linear-gradient(135deg, ${currentColor}, ${currentColor}cc)`,
                  boxShadow: `0 4px 15px ${currentColor}40`,
                }}>
                <Check size={14}/> Reçeteyi Uygula
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>

    {/* ═══ ITEM PICKER MODAL ═══ */}
    <AnimatePresence>
      {pickerTarget !== null && (
        <ItemPickerModal
          allItems={allItems}
          onPick={handleItemPick}
          onClose={() => setPickerTarget(null)}
          currentColor={currentColor}
          isSwap={pickerTarget !== 'add'}
        />
      )}
    </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ItemPickerModal — Ayrı tam modal: stok araması + kayıtsız seçim
═══════════════════════════════════════════════════════════════ */
function ItemPickerModal({ allItems, onPick, onClose, currentColor, isSwap }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return (allItems || []).slice(0, 40);
    return (allItems || []).filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q)
    ).slice(0, 40);
  }, [allItems, search]);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? '#0c1829' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : '#e2e8f0'}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          maxHeight: '80vh',
        }}>

        {/* Başlık */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <Search size={15} style={{ color: currentColor }}/>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
              {isSwap ? 'Malzeme Değiştir' : 'Malzeme Ekle'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        {/* Arama */}
        <div className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}` }}>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', border: `1px solid ${isDark ? `${currentColor}30` : '#e2e8f0'}` }}>
            <Search size={12} style={{ color: '#64748b' }}/>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ad veya SKU ile ara..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}/>
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300">
                <X size={12}/>
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {/* Kayıtsız devam et */}
          {search.trim() && (
            <button
              onClick={() => onPick({ custom: search.trim() })}
              className="w-full text-left px-4 py-3 flex items-center gap-3 transition-all hover:bg-white/5"
              style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <Plus size={14} className="text-amber-400"/>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-300">"{search.trim()}" — Kayıtsız olarak ekle</p>
                <p className="text-[10px] text-amber-600">Stok bağlantısı olmadan sadece isimle eklenir</p>
              </div>
            </button>
          )}

          {/* Stok listesi */}
          {filtered.length === 0 && !search.trim() && (
            <p className="text-center text-sm text-slate-700 py-8">Stok bulunamadı</p>
          )}
          {filtered.map(item => (
            <button key={item.id}
              onClick={() => onPick({ item })}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all hover:bg-white/4 group"
              style={{ borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${currentColor}12`, border: `1px solid ${currentColor}25` }}>
                <Package size={12} style={{ color: currentColor }}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate group-hover:text-amber-500 transition-colors"
                   style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px]" style={{ color: '#64748b' }}>{item.unit}</span>
                  {item.sku && <span className="text-[10px] text-slate-700">· #{item.sku}</span>}
                  {item.stock_count != null && (
                    <span className="text-[10px]"
                      style={{ color: item.stock_count > 0 ? '#64748b' : '#ef4444' }}>
                      Stok: {item.stock_count}
                    </span>
                  )}
                </div>
              </div>
              {item.purchase_price > 0 && (
                <span className="text-xs font-bold text-emerald-400 flex-shrink-0">
                  ₺{Number(item.purchase_price).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 flex-shrink-0 text-center"
          style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          <p className="text-[10px] text-slate-700">
            {filtered.length} sonuç · Kayıtsız eklemek için adı yazın ve ilk seçeneğe tıklayın
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function cloneItems(items) {
  return (items || []).map(it => ({ ...it }));
}
