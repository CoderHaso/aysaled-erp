import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Package, FlaskConical, Plus, Trash2, ChevronRight,
} from 'lucide-react';

/**
 * RecipePickerModal — Sadeleştirilmiş
 *
 * Sol: reçete listesi  |  Sağ: seçili reçetenin malzemeleri (sipariş için düzenlenebilir)
 *
 * Props:
 *  - productId, productName
 *  - allRecipes: [{id, product_id, name, tags[], recipe_items:[{id, item_id, item_name, quantity, unit}]}]
 *  - onSelect: ({recipe_id, recipe_key, recipe_note, components}) => void
 *  - onClose
 *  - currentColor
 */

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'];

export default function RecipePickerModal({
  productId, productName, allRecipes, onSelect, onClose, currentColor,
}) {
  // Bu ürüne ait reçeteler
  const productRecipes = useMemo(
    () => (allRecipes || []).filter(r => r.product_id === productId),
    [allRecipes, productId]
  );

  const [selectedId, setSelectedId] = useState(productRecipes[0]?.id || null);

  // Seçili reçetenin malzemeleri — LOCAL kopyası (sipariş için, orijinal değişmez)
  const [localItems, setLocalItems] = useState(() => {
    const first = productRecipes[0];
    return first ? cloneItems(first.recipe_items || []) : [];
  });

  // Reçete seçilince local items güncelle
  const selectRecipe = (recipe) => {
    setSelectedId(recipe.id);
    setLocalItems(cloneItems(recipe.recipe_items || []));
  };

  const activeRecipe = productRecipes.find(r => r.id === selectedId) || productRecipes[0];

  // ── Malzeme CRUD (local only) ──────────────────────────────────────────
  const updateItem = (idx, key, val) =>
    setLocalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const removeItem = (idx) =>
    setLocalItems(prev => prev.filter((_, i) => i !== idx));

  const addItem = () =>
    setLocalItems(prev => [...prev, { _new: true, item_name: '', quantity: 1, unit: 'Adet' }]);

  // ── Onayla ──────────────────────────────────────────────────────────────
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
      }));

    onSelect({
      recipe_id:   activeRecipe.id,
      recipe_key:  activeRecipe.name,
      recipe_note: `${activeRecipe.name}: ${components.map(c => `${c.quantity}x ${c.item_name}`).join(', ')}`,
      components,
    });
  };

  const changed = JSON.stringify(localItems) !== JSON.stringify(cloneItems(activeRecipe?.recipe_items || []));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0e1c34', border: '1px solid rgba(148,163,184,0.12)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div className="flex items-center gap-2.5">
            <FlaskConical size={16} style={{ color: '#a78bfa' }}/>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Reçete Seç</p>
              <h3 className="text-sm font-bold text-white">{productName}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={15} className="text-slate-500"/>
          </button>
        </div>

        {/* Reçete yok */}
        {productRecipes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
            <Package size={38} className="mb-3 text-slate-700"/>
            <p className="text-sm font-semibold text-slate-400">Bu ürün için reçete tanımlanmamış</p>
            <p className="text-xs text-slate-600 mt-1">Stok → Mamül → Reçeteler sekmesinden ekleyin</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">

            {/* SOL: Reçete listesi */}
            {productRecipes.length > 1 && (
              <div className="w-44 flex-shrink-0 overflow-y-auto py-2"
                style={{ borderRight: '1px solid rgba(148,163,184,0.1)' }}>
                {productRecipes.map(r => (
                  <button key={r.id} onClick={() => selectRecipe(r)}
                    className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-all"
                    style={{
                      background: selectedId === r.id ? `${currentColor}18` : 'transparent',
                      borderLeft: `2px solid ${selectedId === r.id ? currentColor : 'transparent'}`,
                    }}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate"
                        style={{ color: selectedId === r.id ? currentColor : '#94a3b8' }}>
                        {r.name}
                      </p>
                      {(r.tags || []).length > 0 && (
                        <p className="text-[10px] text-slate-600 truncate">{r.tags.join(', ')}</p>
                      )}
                    </div>
                    {selectedId === r.id && <ChevronRight size={12} style={{ color: currentColor, flexShrink: 0 }}/>}
                  </button>
                ))}
              </div>
            )}

            {/* SAĞ: Malzeme listesi (düzenlenebilir) */}
            <div className="flex-1 flex flex-col min-w-0">

              {/* Reçete adı + değişti uyarısı */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs font-bold text-slate-300">{activeRecipe?.name}</p>
                  {changed && (
                    <p className="text-[10px] text-amber-400 mt-0.5">
                      ✎ Yalnızca bu sipariş için düzenlendi
                    </p>
                  )}
                </div>
                <button onClick={addItem}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: `${currentColor}18`, color: currentColor }}>
                  <Plus size={11}/> Ekle
                </button>
              </div>

              {/* Malzeme satırları */}
              <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
                {localItems.length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-600">
                    Malzeme yok — Ekle butonuyla hammadde ekleyin
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {localItems.map((it, idx) => (
                    <motion.div key={idx}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                      {/* Ad */}
                      <input
                        value={it.item_name || ''}
                        onChange={e => updateItem(idx, 'item_name', e.target.value)}
                        placeholder="Malzeme adı..."
                        className="flex-1 bg-transparent outline-none text-xs text-slate-200 placeholder-slate-600 min-w-0"/>
                      {/* Miktar */}
                      <input type="number" min="0" step="0.01"
                        value={it.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        className="w-16 bg-transparent outline-none text-xs text-right font-bold border-b text-slate-200"
                        style={{ borderColor: 'rgba(148,163,184,0.2)' }}/>
                      {/* Birim */}
                      <select value={it.unit || 'Adet'}
                        onChange={e => updateItem(idx, 'unit', e.target.value)}
                        className="bg-transparent outline-none text-[11px] text-slate-400"
                        style={{ maxWidth: 64 }}>
                        {UNITS.map(u => <option key={u} value={u} style={{ background: '#0e1c34' }}>{u}</option>)}
                      </select>
                      {/* Sil */}
                      <button onClick={() => removeItem(idx)}
                        className="p-1 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0">
                        <Trash2 size={12} className="text-red-400"/>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {productRecipes.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
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
        )}
      </motion.div>
    </div>
  );
}

function cloneItems(items) {
  return items.map(it => ({ ...it }));
}
