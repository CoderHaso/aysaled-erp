import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Tag, Check, Package, ChevronRight, Edit3, Save } from 'lucide-react';

/**
 * RecipePickerModal
 * Album-style modal to pick a recipe (BOM) for a product.
 *
 * Props:
 *  - itemId:     UUID of the product (parent_id in bom_recipes)
 *  - itemName:   display name
 *  - allBom:     all bom_recipes rows [{id, parent_id, component_id, quantity_required, unit, notes, component_name, component_unit}]
 *  - onSelect:   (recipeData: { note, components }) => void
 *  - onClose:    () => void
 *  - currentColor: theme color
 */
export default function RecipePickerModal({ itemId, itemName, allBom, onSelect, onClose, currentColor }) {
  const [search,       setSearch]       = useState('');
  const [activeTag,    setActiveTag]    = useState('Tümü');
  const [selected,     setSelected]     = useState(null);   // selected bom group key
  const [editMode,     setEditMode]     = useState(false);
  const [editQtys,     setEditQtys]     = useState({});     // componentId -> qty override

  // Group BOM rows by "recipe variant" - since our schema has one BOM per product,
  // we treat each component as a card within the single recipe
  // If notes field on bom row contains a "variant" tag (e.g. [Varyant:A]), group by that
  // Otherwise, show all as one recipe card

  // Build recipe groups: { key, label, components[] }
  const recipeGroups = useMemo(() => {
    const rows = allBom.filter(r => r.parent_id === itemId);
    if (!rows.length) return [];

    // Check if variant-tagged
    const variantMap = {};
    rows.forEach(r => {
      const m = (r.notes || '').match(/\[Varyant:([^\]]+)\]/i);
      const key = m ? m[1].trim() : 'Standart';
      if (!variantMap[key]) variantMap[key] = { key, label: key, components: [] };
      variantMap[key].components.push(r);
    });

    return Object.values(variantMap);
  }, [allBom, itemId]);

  // Extract unique tags from all components
  const allTags = useMemo(() => {
    const tags = new Set(['Tümü']);
    allBom.filter(r => r.parent_id === itemId).forEach(r => {
      if (r.component_category) tags.add(r.component_category);
      if (r.notes) {
        const tagMatches = r.notes.match(/\[Tag:([^\]]+)\]/gi) || [];
        tagMatches.forEach(t => {
          const tag = t.replace(/\[Tag:/i, '').replace(/\]/, '').trim();
          if (tag) tags.add(tag);
        });
      }
    });
    return [...tags];
  }, [allBom, itemId]);

  const selectedGroup = recipeGroups.find(g => g.key === selected) || recipeGroups[0];

  // Filter components by search + tag
  const filteredComponents = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.components.filter(c => {
      const matchSearch = !search || c.component_name?.toLowerCase().includes(search.toLowerCase());
      const matchTag = activeTag === 'Tümü' || c.component_category === activeTag;
      return matchSearch && matchTag;
    });
  }, [selectedGroup, search, activeTag]);

  const handleConfirm = () => {
    if (!selectedGroup) return;
    const components = selectedGroup.components.map(c => ({
      component_id:   c.component_id,
      component_name: c.component_name || c.component_id,
      quantity_required: editMode && editQtys[c.component_id] != null
        ? Number(editQtys[c.component_id])
        : Number(c.quantity_required),
      unit: c.unit || c.component_unit || 'Adet',
    }));
    onSelect({
      recipe_key:  selectedGroup.key,
      recipe_note: `[${selectedGroup.key}] ${components.map(c => `${c.quantity_required}x ${c.component_name}`).join(', ')}`,
      components,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0e1c34', border: '1px solid rgba(148,163,184,0.12)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Reçete Seçici</p>
            <h3 className="text-base font-bold text-white mt-0.5 truncate">{itemName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} className="text-slate-500"/>
          </button>
        </div>

        {/* Tag filter bar */}
        {allTags.length > 1 && (
          <div className="px-5 py-3 flex gap-2 overflow-x-auto flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(tag)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all"
                style={{
                  background: activeTag === tag ? `${currentColor}22` : 'rgba(255,255,255,0.04)',
                  color:      activeTag === tag ? currentColor : '#64748b',
                  border:     `1px solid ${activeTag === tag ? currentColor + '50' : 'rgba(148,163,184,0.1)'}`,
                }}>
                <Tag size={9}/>{tag}
              </button>
            ))}
          </div>
        )}

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto">
          {recipeGroups.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <Package size={40} className="mx-auto mb-3 text-slate-700"/>
              <p className="text-sm text-slate-500">Bu ürün için reçete tanımlanmamış.</p>
              <p className="text-[11px] text-slate-600 mt-1">Stok sayfasından BOM ekleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Recipe variant selector */}
              {recipeGroups.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {recipeGroups.map(g => (
                    <button key={g.key} onClick={() => setSelected(g.key)}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: (selected || recipeGroups[0].key) === g.key ? `${currentColor}20` : 'rgba(255,255,255,0.04)',
                        color:      (selected || recipeGroups[0].key) === g.key ? currentColor : '#64748b',
                        border:     `1px solid ${(selected || recipeGroups[0].key) === g.key ? currentColor + '40' : 'rgba(148,163,184,0.1)'}`,
                      }}>
                      {g.label} ({g.components.length} kalem)
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                <Search size={12} className="text-slate-500 shrink-0"/>
                <input className="flex-1 bg-transparent text-sm outline-none placeholder-slate-600"
                  placeholder="Hammadde ara…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>

              {/* Components album */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredComponents.map(c => (
                  <div key={c.component_id || c.id}
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background: 'rgba(139,92,246,0.06)',
                      border: '1px solid rgba(139,92,246,0.18)',
                    }}>
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(139,92,246,0.15)' }}>
                        <Package size={12} style={{ color: '#a78bfa' }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {c.component_name || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500">{c.component_unit || c.unit || 'Adet'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Miktar</span>
                      {editMode ? (
                        <input type="number" step="0.01" min="0"
                          className="flex-1 px-2 py-1 rounded-lg text-xs outline-none text-right font-bold"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                          value={editQtys[c.component_id] ?? c.quantity_required}
                          onChange={e => setEditQtys(q => ({ ...q, [c.component_id]: e.target.value }))}/>
                      ) : (
                        <span className="ml-auto text-xs font-bold" style={{ color: '#a78bfa' }}>
                          {c.quantity_required} {c.unit || ''}
                        </span>
                      )}
                    </div>
                    {c.notes && !c.notes.startsWith('[') && (
                      <p className="text-[10px] text-slate-600 italic truncate">{c.notes}</p>
                    )}
                  </div>
                ))}
                {filteredComponents.length === 0 && (
                  <div className="col-span-3 py-8 text-center text-sm text-slate-600">
                    Eşleşen hammadde yok
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {recipeGroups.length > 0 && (
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
              <button onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: currentColor }}>
                <Check size={14}/> Bu Reçeteyi Seç
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
