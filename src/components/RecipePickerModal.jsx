import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Package, FlaskConical, Plus, Trash2,
  ChevronRight, ArrowLeftRight, Search, AlertCircle,
} from 'lucide-react';

/**
 * RecipePickerModal — Gelişmiş
 *
 * Sol panel : Etiket filtresi + Reçete listesi + Önizleme
 * Sağ panel : Seçili reçetenin malzemeleri — CRUD (yalnızca bu sipariş için)
 *             · Sil · Değiştir (swap — canlı stok araması) · Ekle
 *
 * Props:
 *  - productId, productName
 *  - allRecipes : [{id, product_id, name, tags[], recipe_items:[{id, item_id, item_name, quantity, unit, purchase_price?}]}]
 *  - allItems   : [{id, name, unit, purchase_price, item_type}]  — swap live search için
 *  - onSelect   : ({recipe_id, recipe_key, recipe_note, components}) => void
 *  - onClose    : () => void
 *  - currentColor
 */

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'];

export default function RecipePickerModal({
  productId, productName, allRecipes, allItems = [], onSelect, onClose, currentColor = '#8b5cf6',
}) {
  // ── Bu ürüne ait reçeteler ───────────────────────────────────────────────────
  const productRecipes = useMemo(
    () => (allRecipes || []).filter(r => r.product_id === productId),
    [allRecipes, productId]
  );

  // ── State ────────────────────────────────────────────────────────────────────
  const [activeTag,   setActiveTag]   = useState('Tümü');
  const [selectedId,  setSelectedId]  = useState(() => productRecipes[0]?.id || null);
  const [localItems,  setLocalItems]  = useState(() => cloneItems(productRecipes[0]?.recipe_items || []));
  const [swapIdx,     setSwapIdx]     = useState(null);   // hangi satırın swap dropu açık
  const [swapSearch,  setSwapSearch]  = useState('');

  // ── Hesaplamalar reçete ──────────────────────────────────────────────────────
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

  // ── Maliyet hesabı ───────────────────────────────────────────────────────────
  const totalCost = useMemo(() => localItems.reduce((sum, it) => {
    const item  = (allItems || []).find(i => i.id === it.item_id) || {};
    const price = it.purchase_price ?? item.purchase_price ?? 0;
    return sum + Number(price) * Number(it.quantity || 1);
  }, 0), [localItems, allItems]);

  // ── Değişti mi? ──────────────────────────────────────────────────────────────
  const changed = useMemo(() =>
    JSON.stringify(localItems.map(i => ({ n: i.item_name, q: i.quantity, u: i.unit }))) !==
    JSON.stringify((activeRecipe?.recipe_items || []).map(i => ({ n: i.item_name, q: i.quantity, u: i.unit }))),
    [localItems, activeRecipe]
  );

  // ── Reçete seçimi ────────────────────────────────────────────────────────────
  const selectRecipe = useCallback(recipe => {
    setSelectedId(recipe.id);
    setLocalItems(cloneItems(recipe.recipe_items || []));
    setSwapIdx(null);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const updateItem = (idx, key, val) =>
    setLocalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const removeItem = (idx) => {
    setSwapIdx(null);
    setLocalItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => setLocalItems(prev => [
    ...prev, { _new: true, item_id: null, item_name: '', quantity: 1, unit: 'Adet' }
  ]);

  // Swap: bir stok kartını seç ve o satıra uygula
  const swapItem = (idx, rawItem) => {
    setLocalItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      item_id:  rawItem.id,
      item_name: rawItem.name,
      unit:     rawItem.unit || it.unit,
      purchase_price: rawItem.purchase_price || 0,
    } : it));
    setSwapIdx(null);
    setSwapSearch('');
  };

  // Swap search sonuçları
  const swapResults = useMemo(() => {
    const q = swapSearch.toLowerCase();
    return (allItems || [])
      .filter(i => !q || i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [allItems, swapSearch]);

  // ── Onayla ──────────────────────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        style={{ background: '#0b1729', border: '1px solid rgba(148,163,184,0.12)', maxHeight: '92vh' }}>

        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${currentColor}20` }}>
              <FlaskConical size={15} style={{ color: currentColor }}/>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>Reçete Seç</p>
              <h3 className="text-sm font-bold text-white">{productName}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={15} className="text-slate-500"/>
          </button>
        </div>

        {/* ─── Boş durum ────────────────────────────────────────────────────── */}
        {productRecipes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-14 px-8 text-center">
            <Package size={38} className="mb-3 text-slate-700"/>
            <p className="text-sm font-semibold text-slate-400">Bu ürün için reçete tanımlanmamış</p>
            <p className="text-[11px] text-slate-600 mt-1">Stok → Mamül → Reçeteler sekmesinden ekleyin</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">

            {/* ── SOL PANEL: Filtre + Liste ──────────────────────────────── */}
            <div className="w-52 flex-shrink-0 flex flex-col overflow-hidden"
              style={{ borderRight: '1px solid rgba(148,163,184,0.08)' }}>

              {/* Etiket filtresi */}
              {allTags.length > 1 && (
                <div className="px-3 pt-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0"
                  style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => setActiveTag(tag)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                      style={{
                        background: activeTag === tag ? `${currentColor}25` : 'rgba(255,255,255,0.04)',
                        color:      activeTag === tag ? currentColor          : '#64748b',
                        border:     `1px solid ${activeTag === tag ? currentColor + '50' : 'rgba(148,163,184,0.1)'}`,
                      }}>
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Reçete listesi */}
              <div className="flex-1 overflow-y-auto py-2">
                {filteredRecipes.length === 0 && (
                  <p className="text-[11px] text-slate-600 text-center py-4 px-3">Bu etiketle reçete yok</p>
                )}
                {filteredRecipes.map(r => {
                  const isActive = (activeRecipe?.id === r.id);
                  return (
                    <button key={r.id} onClick={() => selectRecipe(r)}
                      className="w-full text-left px-4 py-2.5 flex items-start justify-between gap-2 transition-all"
                      style={{
                        background:  isActive ? `${currentColor}15` : 'transparent',
                        borderLeft: `2px solid ${isActive ? currentColor : 'transparent'}`,
                      }}>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: isActive ? currentColor : '#94a3b8' }}>
                          {r.name}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {(r.recipe_items || []).length} malzeme
                          {(r.tags || []).length > 0 && <span className="ml-1 opacity-70">· {r.tags.join(', ')}</span>}
                        </p>
                      </div>
                      {isActive && <ChevronRight size={12} style={{ color: currentColor, flexShrink: 0, marginTop: 2 }}/>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── SAĞ PANEL: Malzeme Düzenleme ──────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">

              {/* Alt başlık + sipariş özel uyarısı */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Malzemeler</p>
                  {changed && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
                      <p className="text-[10px] text-amber-400 font-semibold">Yalnızca bu sipariş için özenleştirildi</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {totalCost > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400">
                      ₺{totalCost.toFixed(2)}
                    </span>
                  )}
                  <button onClick={addItem}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: `${currentColor}18`, color: currentColor }}>
                    <Plus size={10}/> Ekle
                  </button>
                </div>
              </div>

              {/* Malzeme satırları */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                {localItems.length === 0 && (
                  <p className="text-center text-sm text-slate-600 py-6">Malzeme yok</p>
                )}
                <AnimatePresence initial={false}>
                  {localItems.map((it, idx) => (
                    <motion.div key={idx}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>

                        {/* İsim */}
                        <input
                          value={it.item_name || ''}
                          onChange={e => updateItem(idx, 'item_name', e.target.value)}
                          placeholder="Malzeme adı..."
                          className="flex-1 bg-transparent outline-none text-xs text-slate-200 placeholder-slate-700 min-w-0"/>

                        {/* Miktar */}
                        <input type="number" min="0" step="0.01"
                          value={it.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          className="w-14 bg-transparent outline-none text-xs text-right font-bold border-b text-slate-200"
                          style={{ borderColor: 'rgba(148,163,184,0.2)' }}/>

                        {/* Birim */}
                        <select value={it.unit || 'Adet'}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="bg-transparent outline-none text-[11px] text-slate-400"
                          style={{ maxWidth: 60 }}>
                          {UNITS.map(u => <option key={u} value={u} style={{ background: '#0b1729' }}>{u}</option>)}
                        </select>

                        {/* Swap butonu */}
                        <div className="relative">
                          <button
                            onClick={() => { setSwapIdx(swapIdx === idx ? null : idx); setSwapSearch(''); }}
                            title="Malzeme değiştir (stoktan seç)"
                            className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10"
                            style={{ color: swapIdx === idx ? '#60a5fa' : '#475569' }}>
                            <ArrowLeftRight size={11}/>
                          </button>

                          {/* Swap dropdown */}
                          <AnimatePresence>
                            {swapIdx === idx && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-2xl"
                                style={{ width: 240, background: '#0f1e36', border: '1px solid rgba(96,165,250,0.3)' }}>
                                <div className="flex items-center gap-2 px-3 py-2"
                                  style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                  <Search size={11} className="text-slate-500 shrink-0"/>
                                  <input autoFocus value={swapSearch}
                                    onChange={e => setSwapSearch(e.target.value)}
                                    placeholder="Stokta ara..."
                                    className="bg-transparent outline-none text-xs text-slate-200 flex-1 placeholder-slate-600"/>
                                </div>
                                <div className="max-h-44 overflow-y-auto">
                                  {swapResults.length === 0 && (
                                    <p className="text-center text-[11px] text-slate-600 py-3">Bulunamadı</p>
                                  )}
                                  {swapResults.map(raw => (
                                    <button key={raw.id} onClick={() => swapItem(idx, raw)}
                                      className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5 flex items-center justify-between">
                                      <span className="font-semibold text-slate-200 truncate">{raw.name}</span>
                                      <span className="text-slate-500 text-[10px] ml-2 shrink-0">{raw.unit}</span>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Sil */}
                        <button onClick={() => removeItem(idx)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0">
                          <Trash2 size={11} className="text-red-400"/>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Değişti uyarısı — alt bannerı */}
              {changed && (
                <div className="mx-4 mb-3 flex-shrink-0 flex items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5"/>
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Bu değişiklikler <strong>yalnızca bu sipariş</strong> için geçerli. Asıl reçete etkilenmez.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Footer ───────────────────────────────────────────────────────── */}
        {productRecipes.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
            <div className="text-[11px] text-slate-500">
              {localItems.filter(i => i.item_name?.trim()).length} malzeme
              {totalCost > 0 && <span className="ml-2 text-emerald-500 font-bold">≈ ₺{totalCost.toFixed(2)}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                İptal
              </button>
              <button onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: currentColor }}>
                <Check size={14}/> Uygula
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function cloneItems(items) {
  return (items || []).map(it => ({ ...it }));
}
