import React, { useState, useRef } from 'react';
import { Search, Plus, Trash2, Edit2, Check, X, Loader2, Package, AlertCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useBOM } from '../../hooks/useBOM';
import { supabase } from '../../lib/supabaseClient';

const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€' };

export default function BOMEditor({ parentId, isDark, currentColor }) {
  const { recipes, loading, saving, addLine, updateLine, removeLine, totalCost } = useBOM(parentId);

  const border = isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0';
  const text   = isDark ? '#f1f5f9' : '#0f172a';
  const muted  = isDark ? '#94a3b8' : '#64748b';
  const rowBg  = isDark ? 'rgba(255,255,255,0.03)' : '#fafafa';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';

  // Hammadde arama
  const [search,     setSearch]     = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [pending,    setPending]    = useState({ qty: 1, notes: '' });
  const [editId,     setEditId]     = useState(null);
  const [editData,   setEditData]   = useState({});
  const debounce = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('items')
      .select('id, name, sku, unit, purchase_price, base_currency, stock_count')
      .eq('item_type', 'raw')
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
      .limit(8);
    setResults(data || []);
    setSearching(false);
  };

  const handleSearchChange = (q) => {
    setSearch(q);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(q), 300);
  };

  const handleSelect = async (comp) => {
    try {
      await addLine({
        componentId: comp.id,
        quantity: pending.qty,
        unit: comp.unit,
        notes: pending.notes,
      });
      setShowSearch(false);
      setSearch('');
      setResults([]);
      setPending({ qty: 1, notes: '' });
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEdit = (r) => {
    setEditId(r.id);
    setEditData({ quantity: r.quantity_required, notes: r.notes || '' });
  };

  const handleEditSave = async (id) => {
    try {
      await updateLine(id, { quantity: editData.quantity, unit: null, notes: editData.notes });
      setEditId(null);
    } catch (e) { alert(e.message); }
  };

  // Toplam maliyet formatı
  const fmt = (n) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!parentId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: muted }}>
        <AlertCircle size={32} strokeWidth={1} style={{ opacity: 0.4 }} />
        <p className="text-sm font-medium">Önce ürünü kaydedin, ardından reçete ekleyebilirsiniz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Maliyet özeti */}
      <div className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', border: `1px solid ${border}` }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: muted }}>Toplam Reçete Maliyeti</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: currentColor }}>
            ₺{fmt(totalCost)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: muted }}>{recipes.length} bileşen</p>
          <p className="text-xs mt-0.5" style={{ color: muted }}>Ham maliyet (KDV hariç)</p>
        </div>
      </div>

      {/* Bileşen listesi */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: muted }}>
          <Loader2 size={18} className="animate-spin" style={{ color: currentColor }} />
          <span className="text-sm">Reçete yükleniyor...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.length === 0 && !showSearch && (
            <div className="text-center py-10" style={{ color: muted }}>
              <Package size={32} strokeWidth={1} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Reçete henüz boş.</p>
              <p className="text-xs mt-1">Hammadde ekleyerek maliyet hesabı yapabilirsiniz.</p>
            </div>
          )}

          {recipes.map(r => {
            const comp = r.component;
            const lineCost = r.quantity_required * (comp?.purchase_price || 0);
            const sym = CURRENCY_SYM[comp?.base_currency] || '₺';
            const isEditing = editId === r.id;
            const stockOk = comp ? comp.stock_count >= r.quantity_required : null;

            return (
              <div key={r.id}
                className="rounded-xl p-3 border transition-all"
                style={{ background: rowBg, borderColor: border }}>

                <div className="flex items-start gap-3">
                  {/* Stok durumu dot */}
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: stockOk === null ? '#94a3b8' : stockOk ? '#10b981' : '#ef4444' }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: text }}>
                        {comp?.name || 'Silinmiş Kalem'}
                      </span>
                      {comp?.sku && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: `${currentColor}20`, color: currentColor }}>
                          {comp.sku}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number" min="0.001" step="0.001"
                          className="modal-input"
                          style={{ width: '90px', padding: '4px 8px', fontSize: '13px' }}
                          value={editData.quantity}
                          onChange={e => setEditData(d => ({ ...d, quantity: e.target.value }))}
                        />
                        <span className="text-sm" style={{ color: muted }}>{comp?.unit}</span>
                        <input
                          placeholder="Not..."
                          className="modal-input flex-1"
                          style={{ padding: '4px 8px', fontSize: '13px' }}
                          value={editData.notes}
                          onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                        />
                        <button onClick={() => handleEditSave(r.id)} disabled={saving}
                          className="p-1.5 rounded-lg" style={{ color: '#10b981' }}>
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 rounded-lg" style={{ color: muted }}>
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs mt-0.5" style={{ color: muted }}>
                        {r.quantity_required} {comp?.unit}
                        {r.notes && ` · ${r.notes}`}
                        {comp?.purchase_price > 0 && (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>
                            {' '}· {sym}{lineCost.toFixed(2)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(r)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: currentColor }}
                        onMouseEnter={e => e.currentTarget.style.background = `${currentColor}20`}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => removeLine(r.id)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#ef444420'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Yeni bileşen ekle */}
      {showSearch ? (
        <div className="rounded-xl border p-4 space-y-3"
          style={{ background: rowBg, borderColor: currentColor, boxShadow: `0 0 0 2px ${currentColor}30` }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: inputBg, borderColor: border }}>
              <Search size={14} style={{ color: muted }} />
              <input
                autoFocus
                className="bg-transparent border-none outline-none text-sm flex-1"
                style={{ color: text }}
                placeholder="Hammadde adı veya SKU ara..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
              />
              {searching && <Loader2 size={13} className="animate-spin" style={{ color: currentColor }} />}
            </div>
            <input
              type="number" min="0.001" step="0.001"
              className="modal-input"
              style={{ width: '80px', padding: '8px 10px', fontSize: '13px' }}
              value={pending.qty}
              onChange={e => setPending(p => ({ ...p, qty: e.target.value }))}
              placeholder="Miktar"
            />
          </div>

          {/* Sonuçlar */}
          {results.length > 0 && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: border }}>
              {results.map(comp => {
                const sym = CURRENCY_SYM[comp.base_currency] || '₺';
                return (
                  <button key={comp.id} onClick={() => handleSelect(comp)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-left border-b transition-colors"
                    style={{ borderColor: border }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <span className="font-semibold" style={{ color: text }}>{comp.name}</span>
                      {comp.sku && <span className="ml-2 text-[10px] font-mono" style={{ color: muted }}>{comp.sku}</span>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="text-xs font-bold" style={{ color: currentColor }}>
                        {comp.purchase_price > 0 ? `${sym}${comp.purchase_price}/${comp.unit}` : comp.unit}
                      </span>
                      <span className="block text-[10px]" style={{ color: muted }}>
                        Stok: {comp.stock_count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {search && !searching && results.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: muted }}>
              "{search}" için sonuç bulunamadı
            </p>
          )}

          <div className="flex justify-end">
            <button onClick={() => { setShowSearch(false); setSearch(''); setResults([]); }}
              className="text-xs px-4 py-2 rounded-xl border font-semibold"
              style={{ color: muted, borderColor: border }}>
              İptal
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowSearch(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all"
          style={{ borderColor: isDark ? 'rgba(148,163,184,0.2)' : '#e2e8f0', color: muted }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = currentColor;
            e.currentTarget.style.color = currentColor;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = isDark ? 'rgba(148,163,184,0.2)' : '#e2e8f0';
            e.currentTarget.style.color = muted;
          }}>
          <Plus size={16} />
          Hammadde Ekle
        </button>
      )}
    </div>
  );
}
