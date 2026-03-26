import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle, RefreshCcw, AlertCircle,
  Zap, TrendingUp, Boxes, Package, ChevronUp, ChevronDown,
  Edit2, Trash2,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useStock } from '../hooks/useStock';
import { supabase } from '../lib/supabaseClient';
import StockForm from '../components/stock/StockForm';
import QuickAddModal from '../components/stock/QuickAddModal';

const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€' };

function stockColor(c, l) {
  if (c <= 0)          return '#ef4444';
  if (l > 0 && c <= l) return '#f59e0b';
  return '#10b981';
}

export default function Stock() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const {
    rawItems, productItems, loading, error, saving,
    addItem, updateItem, deleteItem,
    criticalRaw, criticalProd, totalValue, refetch,
  } = useStock();

  const [view, setView] = useState(() => sessionStorage.getItem('aerp_view') || 'list');
  const [editing, setEditing] = useState(() => {
    const s = sessionStorage.getItem('aerp_editing');
    try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
  });
  const [formType, setFormType] = useState(() => sessionStorage.getItem('aerp_formType') || 'raw');
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('aerp_activeTab') || 'raw');

  useEffect(() => {
    sessionStorage.setItem('aerp_view', view);
    sessionStorage.setItem('aerp_editing', JSON.stringify(editing));
    sessionStorage.setItem('aerp_formType', formType);
    sessionStorage.setItem('aerp_activeTab', activeTab);
  }, [view, editing, formType, activeTab]);

  // URL'den gelen QR ID açılışı
  useEffect(() => {
    if (id && !loading) {
      const item = [...rawItems, ...productItems].find(x => x.id === id);
      if (item) {
        setEditing(item);
        setFormType(item.item_type);
        setActiveTab(item.item_type);
      } else {
        // ID veritabanında yoksa URL'i temizle
        navigate('/stock', { replace: true });
      }
    }
  }, [id, loading, rawItems, productItems, navigate]);

  const [quickAdd,  setQuickAdd]  = useState(false);
  const [toast,     setToast]     = useState(null);
  const [search,    setSearch]    = useState('');
  const [sortKey,   setSortKey]   = useState('name');
  const [sortDir,   setSortDir]   = useState('asc');

  const c = {
    bg:       isDark ? '#0f172a' : '#f8fafc',
    card:     isDark ? 'rgba(30,41,59,0.9)' : '#ffffff',
    border:   isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#64748b',
    inputBg:  isDark ? 'rgba(30,41,59,0.8)' : '#f1f5f9',
    rowHover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.018)',
    critBg:   isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
    critBdr:  isDark ? 'rgba(245,158,11,0.25)' : '#fde68a',
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const openForm = (item = null, type = 'raw') => {
    setEditing(item);
    setFormType(item?.item_type || type);
    setView('form');
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const baseList = activeTab === 'raw' ? rawItems : productItems;
  const filtered = useMemo(() => {
    let list = [...baseList];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.supplier_name?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return list;
  }, [baseList, search, sortKey, sortDir]);

  const handleSave = async (formData, pendingBOM = []) => {
    try {
      let itemId;
      if (editing?.id) {
        await updateItem(editing.id, formData);
        itemId = editing.id;
      } else {
        const { data, error: e } = await supabase.from('items').insert([formData]).select().single();
        if (e) throw new Error(e.message);
        itemId = data?.id;
        refetch();
      }
      if (!editing?.id && pendingBOM.length > 0 && itemId) {
        await supabase.from('bom_recipes').insert(
          pendingBOM.map(line => ({
            parent_id: itemId, component_id: line.component_id,
            quantity_required: line.quantity_required, unit: line.unit,
          }))
        );
      }
      setView('list');
      showToast(editing?.id ? 'Kayıt güncellendi ✓' : 'Yeni kayıt eklendi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try { await deleteItem(id); setView('list'); showToast('Kayıt silindi ✓'); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const handleQuickSave = async (formData) => {
    try { await addItem(formData); setQuickAdd(false); showToast('Hızlı kayıt eklendi ✓'); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const SortIcon = ({ col }) => sortKey === col
    ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
    : <ChevronUp size={11} style={{ opacity: 0.2 }} />;

  const currentCritical = activeTab === 'raw' ? criticalRaw : criticalProd;
  const currentItems    = activeTab === 'raw' ? rawItems    : productItems;
  const currentValue    = currentItems.reduce((s, i) => s + (i.purchase_price || 0) * (i.stock_count || 0), 0);

  const TABS = [
    { id: 'raw',     label: '🔩 Hammadde', count: rawItems.length,     critical: criticalRaw.length },
    { id: 'product', label: '⚡ Mamül',     count: productItems.length, critical: criticalProd.length },
    { id: 'summary', label: '📊 Özet' },
  ];

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <StockForm
        item={editing}
        defaultType={formType}
        onBack={() => setView('list')}
        onSave={handleSave}
        onDelete={handleDelete}
        saving={saving}
      />
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-5 lg:p-7 space-y-4 sm:space-y-5 max-w-[1400px] mx-auto">

      {/* Başlık */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate" style={{ color: c.text }}>
            Üretim & Stok
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: c.muted }}>
            {rawItems.length} hammadde · {productItems.length} mamül
            {(criticalRaw.length + criticalProd.length) > 0 && ` · ⚠ ${criticalRaw.length + criticalProd.length} kritik`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button onClick={refetch}
            className="p-2 rounded-xl border transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setQuickAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <Zap size={13} style={{ color: currentColor }} />
            <span className="hidden sm:inline">Hızlı Ekle</span>
          </button>
          <button
            onClick={() => openForm(null, activeTab === 'product' ? 'product' : 'raw')}
            className="btn-primary text-xs sm:text-sm px-3 sm:px-4">
            <Plus size={14} />
            <span className="hidden xs:inline">Yeni</span>
            <span className="hidden sm:inline"> Kayıt</span>
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0 border-b overflow-x-auto" style={{ borderColor: c.border }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all"
            style={{
              color:        activeTab === t.id ? currentColor : c.muted,
              borderBottom: activeTab === t.id ? `2px solid ${currentColor}` : '2px solid transparent',
            }}>
            {t.label}
            {t.count != null && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: activeTab === t.id ? `${currentColor}20` : c.inputBg, color: activeTab === t.id ? currentColor : c.muted }}>
                {t.count}
              </span>
            )}
            {t.critical > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: '#f59e0b20', color: '#d97706' }}>
                ⚠{t.critical}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ÖZET ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
          {[
            { label: 'Toplam Hammadde', value: rawItems.length,     color: '#f59e0b',   icon: '🔩' },
            { label: 'Toplam Mamül',    value: productItems.length, color: '#3b82f6',   icon: '⚡' },
            { label: 'Kritik Hammadde', value: criticalRaw.length,  color: '#ef4444',   icon: '⚠'  },
            { label: 'Kritik Mamül',    value: criticalProd.length, color: '#ef4444',   icon: '⚠'  },
            { label: 'Toplam Değer',    value: `₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, color: '#10b981', icon: '💰' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 sm:p-5 flex items-center gap-3"
              style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="text-2xl sm:text-3xl">{s.icon}</div>
              <div>
                <p className="text-lg sm:text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] sm:text-xs font-semibold" style={{ color: c.muted }}>{s.label}</p>
              </div>
            </motion.div>
          ))}
          {[...criticalRaw, ...criticalProd].length > 0 && (
            <div className="col-span-2 sm:col-span-3 rounded-2xl p-4"
              style={{ background: c.critBg, border: `1px solid ${c.critBdr}` }}>
              <p className="text-xs sm:text-sm font-bold mb-2" style={{ color: '#d97706' }}>⚠ Kritik Stok</p>
              <div className="flex flex-wrap gap-2">
                {[...criticalRaw, ...criticalProd].map(i => (
                  <button key={i.id}
                    onClick={() => { setActiveTab(i.item_type === 'product' ? 'product' : 'raw'); openForm(i, i.item_type); }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#f59e0b25', color: '#92400e' }}>
                    {i.name} — {i.stock_count} {i.unit}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANA LİSTE (Hammadde / Mamül) ─────────────────────────────────── */}
      {(activeTab === 'raw' || activeTab === 'product') && (
        <>
          {/* İstatistik kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: activeTab === 'raw' ? 'Ham.' : 'Mamül', value: currentItems.length, icon: Boxes, color: '#3b82f6', sub: `${filtered.length} görün.` },
              { label: '⚠ Kritik', value: currentCritical.length, icon: AlertTriangle, color: currentCritical.length > 0 ? '#f59e0b' : '#10b981', sub: currentCritical.length > 0 ? 'Sipariş!' : 'Sağlıklı' },
              { label: 'Stok Değeri', value: `₺${currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: '#10b981', sub: 'Alış bazlı' },
              { label: 'Aktif', value: currentItems.filter(i => i.is_active !== false).length, icon: Package, color: currentColor, sub: `${currentItems.filter(i => i.is_active === false).length} pasif` },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-3 sm:p-4" style={{ background: c.card, border: `1px solid ${c.border}` }}>
                <div className="w-8 h-8 rounded-xl text-white mb-2 flex items-center justify-center" style={{ background: s.color }}>
                  <s.icon size={15} />
                </div>
                <p className="text-base sm:text-xl font-bold" style={{ color: c.text }}>{s.value}</p>
                <p className="text-[10px] sm:text-xs font-semibold truncate" style={{ color: c.muted }}>{s.label}</p>
                <p className="text-[9px] sm:text-[10px] mt-0.5" style={{ color: s.color }}>{s.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Kritik uyarı */}
          <AnimatePresence>
            {currentCritical.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3"
                style={{ background: c.critBg, border: `1px solid ${c.critBdr}` }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: '#d97706' }} />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                    {currentCritical.length} kalem kritik
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {currentCritical.slice(0, 4).map(i => (
                      <button key={i.id} onClick={() => openForm(i, i.item_type)}
                        className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#f59e0b25', color: '#92400e' }}>
                        {i.name} ({i.stock_count} {i.unit})
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Arama barı */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
            style={{ background: c.card, borderColor: c.border }}>
            <Search size={14} style={{ color: c.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ad, SKU veya tedarikçi ara..."
              className="bg-transparent border-none outline-none text-sm flex-1 min-w-0"
              style={{ color: c.text }} />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs px-2 py-1 rounded-lg flex-shrink-0 font-semibold"
                style={{ color: c.muted, background: c.inputBg }}>✕</button>
            )}
          </div>

          {/* ── DESKTOP TABLO (sm+) ────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                    {[
                      { key: null,             label: '',         w: '32px'  },
                      { key: 'sku',            label: 'SKU',      w: '110px' },
                      { key: 'name',           label: activeTab === 'raw' ? 'Hammadde' : 'Mamül' },
                      { key: 'supplier_name',  label: activeTab === 'raw' ? 'Tedarikçi' : 'Seri', w: '120px' },
                      { key: 'unit',           label: 'Birim',    w: '65px'  },
                      { key: 'stock_count',    label: 'Stok',     w: '150px' },
                      { key: 'purchase_price', label: 'Alış',     w: '90px'  },
                      { key: null,             label: '',         w: '72px'  },
                    ].map((col, i) => (
                      <th key={i}
                        className="px-3 py-3 text-left font-bold text-[10px] uppercase tracking-widest"
                        style={{ color: c.muted, width: col.w, cursor: col.key ? 'pointer' : 'default' }}
                        onClick={() => col.key && toggleSort(col.key)}>
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.key && <SortIcon col={col.key} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="text-center py-14" style={{ color: c.muted }}>
                      <RefreshCcw size={20} className="animate-spin mx-auto mb-2" style={{ color: currentColor }} />
                      <p className="text-sm">Yükleniyor...</p>
                    </td></tr>
                  )}
                  {!loading && error && (
                    <tr><td colSpan={8} className="text-center py-14">
                      <AlertCircle size={24} className="mx-auto mb-2" style={{ color: '#ef4444' }} />
                      <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{error}</p>
                    </td></tr>
                  )}
                  {!loading && !error && filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-14" style={{ color: c.muted }}>
                      <Package size={32} strokeWidth={1} className="mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">Kayıt bulunamadı</p>
                      <button onClick={() => openForm(null, activeTab === 'product' ? 'product' : 'raw')}
                        className="mt-3 btn-primary text-xs px-4 py-2">
                        + İlk Kaydı Ekle
                      </button>
                    </td></tr>
                  )}
                  {!loading && filtered.map((item, idx) => {
                    const clr = stockColor(item.stock_count, item.critical_limit);
                    const pct = item.critical_limit > 0 ? Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100) : 80;
                    const sym = CURRENCY_SYM[item.base_currency] || '';
                    const secondCol = activeTab === 'product' ? (item.specs?.series || '—') : (item.supplier_name || '—');
                    return (
                      <motion.tr key={item.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.01 }}
                        style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}
                        onClick={() => openForm(item, item.item_type)}
                        onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-3 py-3.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: clr }} />
                        </td>
                        <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                          {item.sku
                            ? <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: `${currentColor}18`, color: currentColor }}>
                                {item.sku}
                              </span>
                            : <span style={{ color: c.muted }}>—</span>
                          }
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="font-semibold text-sm" style={{ color: c.text }}>{item.name}</p>
                          {item.location && <p className="text-[10px] mt-0.5" style={{ color: c.muted }}>📍 {item.location}</p>}
                        </td>
                        <td className="px-3 py-3.5"><span className="text-xs" style={{ color: c.muted }}>{secondCol}</span></td>
                        <td className="px-3 py-3.5"><span className="text-xs font-bold" style={{ color: c.text }}>{item.unit}</span></td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold w-7 text-right" style={{ color: clr }}>{item.stock_count}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[40px]" style={{ background: c.border }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                            </div>
                            {item.critical_limit > 0 && <span className="text-[10px]" style={{ color: c.muted }}>/{item.critical_limit}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-sm font-semibold" style={{ color: c.text }}>
                            {item.purchase_price > 0 ? `${sym}${item.purchase_price}` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <ABtn icon={Edit2}  color={currentColor} onClick={() => openForm(item, item.item_type)} />
                            <ABtn icon={Trash2} color="#ef4444"      onClick={async () => { if (window.confirm(`"${item.name}" silinsin mi?`)) await handleDelete(item.id); }} />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── MOBİL KART LİSTESİ (< sm) ─────────────────────────────── */}
            <div className="sm:hidden">
              {loading && (
                <div className="text-center py-12" style={{ color: c.muted }}>
                  <RefreshCcw size={20} className="animate-spin mx-auto mb-2" style={{ color: currentColor }} />
                  <p className="text-sm">Yükleniyor...</p>
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="text-center py-12" style={{ color: c.muted }}>
                  <Package size={32} strokeWidth={1} className="mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm">Kayıt bulunamadı</p>
                  <button onClick={() => openForm(null, activeTab === 'product' ? 'product' : 'raw')}
                    className="mt-3 btn-primary text-xs px-4 py-2">
                    + İlk Kaydı Ekle
                  </button>
                </div>
              )}
              {!loading && filtered.map((item, idx) => {
                const clr = stockColor(item.stock_count, item.critical_limit);
                const pct = item.critical_limit > 0 ? Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100) : 80;
                const sym = CURRENCY_SYM[item.base_currency] || '';
                return (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                    onClick={() => openForm(item, item.item_type)}
                    className="flex items-center gap-3 px-4 py-3.5 active:opacity-70 transition-opacity"
                    style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}>
                    {/* Renk indikatörü */}
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: clr }} />

                    {/* Bilgi */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm truncate" style={{ color: c.text }}>{item.name}</p>
                        {item.sku && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: `${currentColor}18`, color: currentColor }}>
                            {item.sku}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Stok bar */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: clr }}>{item.stock_count}</span>
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: c.border }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                          </div>
                          <span className="text-[10px] flex-shrink-0" style={{ color: c.muted }}>{item.unit}</span>
                        </div>
                        {/* Fiyat */}
                        {item.purchase_price > 0 && (
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: c.muted }}>
                            {sym}{item.purchase_price}
                          </span>
                        )}
                      </div>
                      {item.supplier_name && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: c.muted }}>
                          🏢 {item.supplier_name}
                        </p>
                      )}
                    </div>

                    {/* Aksiyon */}
                    <button
                      onClick={e => { e.stopPropagation(); openForm(item, item.item_type); }}
                      className="p-2 rounded-xl flex-shrink-0"
                      style={{ background: `${currentColor}15`, color: currentColor }}>
                      <Edit2 size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-2.5 flex items-center justify-between border-t text-xs" style={{ borderColor: c.border }}>
                <span style={{ color: c.muted }}>{filtered.length}/{currentItems.length} kayıt</span>
                <span style={{ color: c.muted }}>
                  Değer: <span style={{ color: currentColor }}>₺{currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {quickAdd && (
        <QuickAddModal onClose={() => setQuickAdd(false)} onSave={handleQuickSave} saving={saving} />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[300] px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-xl text-white font-semibold text-xs sm:text-sm max-w-[calc(100vw-2rem)]"
            style={{ background: toast.type === 'error' ? '#ef4444' : currentColor }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ABtn({ icon: Icon, color, onClick }) {
  return (
    <button onClick={onClick} className="p-1.5 rounded-lg transition-all" style={{ color }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon size={13} />
    </button>
  );
}
