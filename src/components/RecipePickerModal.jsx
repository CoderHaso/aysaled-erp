import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Tag, Check, Package, BookOpen, Edit3, Save, FlaskConical } from 'lucide-react';

/**
 * RecipePickerModal
 *
 * product_recipes + recipe_items yapısını kullanır.
 *
 * Props:
 *  - productId:     items.id (mamul ürün)
 *  - productName:   display adı
 *  - allRecipes:    [{id, product_id, name, tags[], recipe_items:[{id, item_name, quantity, unit}]}]
 *  - onSelect:      (recipeData) => void
 *  - onClose:       () => void
 *  - currentColor:  tema rengi
 */
export default function RecipePickerModal({ productId, productName, allRecipes, onSelect, onClose, currentColor }) {
  const [search,    setSearch]    = useState('');
  const [activeTag, setActiveTag] = useState('Tümü');
  const [selected,  setSelected]  = useState(null);
  const [editMode,  setEditMode]  = useState(false);
  const [editQtys,  setEditQtys]  = useState({});  // recipeItemId -> qty override

  // Bu ürüne ait reçeteler
  const productRecipes = useMemo(
    () => (allRecipes || []).filter(r => r.product_id === productId),
    [allRecipes, productId]
  );

  // Tüm etiketler
  const allTags = useMemo(() => {
    const tags = new Set(['Tümü']);
    productRecipes.forEach(r => (r.tags || []).forEach(t => tags.add(t)));
    return [...tags];
  }, [productRecipes]);

  // Tag filtreli reçeteler
  const filteredRecipes = useMemo(() => {
    return productRecipes.filter(r =>
      activeTag === 'Tümü' || (r.tags || []).includes(activeTag)
    );
  }, [productRecipes, activeTag]);

  const activeRecipe = selected
    ? productRecipes.find(r => r.id === selected) || filteredRecipes[0]
    : filteredRecipes[0];

  // Hammadde arama filtresi
  const filteredItems = useMemo(() => {
    if (!activeRecipe) return [];
    return (activeRecipe.recipe_items || []).filter(ri =>
      !search || ri.item_name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeRecipe, search]);

  const handleConfirm = () => {
    if (!activeRecipe) return;
    const components = (activeRecipe.recipe_items || []).map(ri => ({
      recipe_item_id: ri.id,
      item_id:        ri.item_id || null,
      item_name:      ri.item_name || '—',
      quantity:       editMode && editQtys[ri.id] != null
        ? Number(editQtys[ri.id])
        : Number(ri.quantity || 1),
      unit: ri.unit || 'Adet',
    }));

    onSelect({
      recipe_id:    activeRecipe.id,
      recipe_key:   activeRecipe.name,
      recipe_note:  `${activeRecipe.name}: ${components.map(c => `${c.quantity}x ${c.item_name}`).join(', ')}`,
      components,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0e1c34', border: '1px solid rgba(148,163,184,0.12)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Reçete Seçici</p>
            <h3 className="text-base font-bold text-white mt-0.5 truncate">{productName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} className="text-slate-500"/>
          </button>
        </div>

        {/* No recipe state */}
        {productRecipes.length === 0 && (
          <div className="px-8 py-16 text-center flex-1">
            <Package size={40} className="mx-auto mb-3 text-slate-700"/>
            <p className="text-sm text-slate-500">Bu ürün için reçete tanımlanmamış.</p>
            <p className="text-[11px] text-slate-600 mt-1">Stok → Mamül → Reçeteler sekmesinden ekleyebilirsiniz.</p>
          </div>
        )}

        {productRecipes.length > 0 && (
          <>
            {/* Tag filter bar */}
            {allTags.length > 1 && (
              <div className="px-5 py-3 flex gap-2 overflow-x-auto flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                {allTags.map(tag => (
                  <button key={tag} onClick={() => setActiveTag(tag)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all"
                    style={{
                      background: activeTag === tag ? `${currentColor}22` : 'rgba(255,255,255,0.04)',
                      color:      activeTag === tag ? currentColor          : '#64748b',
                      border:     `1px solid ${activeTag === tag ? currentColor + '50' : 'rgba(148,163,184,0.1)'}`,
                    }}>
                    <Tag size={9}/>{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Scroll body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">

                {/* Reçete seçici (birden fazla reçete varsa) */}
                {filteredRecipes.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {filteredRecipes.map(r => (
                      <button key={r.id} onClick={() => setSelected(r.id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: (activeRecipe?.id === r.id) ? `${currentColor}20` : 'rgba(255,255,255,0.04)',
                          color:      (activeRecipe?.id === r.id) ? currentColor          : '#64748b',
                          border:     `1px solid ${(activeRecipe?.id === r.id) ? currentColor + '40' : 'rgba(148,163,184,0.1)'}`,
                        }}>
                        {r.name}
                        <span className="ml-1.5 opacity-60">({(r.recipe_items || []).length})</span>
                      </button>
                    ))}
                  </div>
                )}

                {filteredRecipes.length === 0 && (
                  <p className="text-center text-sm text-slate-600 py-6">Bu etiketle eşleşen reçete yok</p>
                )}

                {activeRecipe && (
                  <>
                    {/* Reçete başlık + etiketler */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <FlaskConical size={14} style={{ color: '#a78bfa' }}/>
                      <p className="text-sm font-bold text-purple-300">{activeRecipe.name}</p>
                      {(activeRecipe.tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${currentColor}20`, color: currentColor }}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                      <Search size={12} className="text-slate-500 shrink-0"/>
                      <input className="flex-1 bg-transparent text-sm outline-none placeholder-slate-600"
                        placeholder="Hammadde ara…" value={search} onChange={e => setSearch(e.target.value)}/>
                    </div>

                    {/* Hammadde albüm */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredItems.map(ri => (
                        <div key={ri.id}
                          className="rounded-xl p-3 space-y-2"
                          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}>
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(139,92,246,0.15)' }}>
                              <Package size={12} style={{ color: '#a78bfa' }}/>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">
                                {ri.item_name || '—'}
                              </p>
                              <p className="text-[10px] text-slate-500">{ri.unit || 'Adet'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Miktar</span>
                            {editMode ? (
                              <input type="number" step="0.01" min="0"
                                className="flex-1 px-2 py-1 rounded-lg text-xs outline-none text-right font-bold"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                                value={editQtys[ri.id] ?? ri.quantity}
                                onChange={e => setEditQtys(q => ({ ...q, [ri.id]: e.target.value }))}/>
                            ) : (
                              <span className="ml-auto text-xs font-bold" style={{ color: '#a78bfa' }}>
                                {ri.quantity} {ri.unit || ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="col-span-3 py-8 text-center text-sm text-slate-600">
                          Eşleşen hammadde yok
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
              <button onClick={() => setEditMode(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: editMode ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                  color: editMode ? '#f59e0b' : '#64748b',
                  border: `1px solid ${editMode ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.1)'}`,
                }}>
                {editMode ? <Save size={13}/> : <Edit3 size={13}/>}
                {editMode ? 'Düzenleme Modunda' : 'Miktarları Düzenle'}
              </button>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                  İptal
                </button>
                <button onClick={handleConfirm} disabled={!activeRecipe}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: activeRecipe ? currentColor : '#475569' }}>
                  <Check size={14}/> Bu Reçeteyi Seç
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
