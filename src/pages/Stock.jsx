import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle, RefreshCcw,
  AlertCircle, Zap, TrendingUp, Boxes, Package,
  ChevronUp, ChevronDown, Edit2, QrCode, Trash2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useStock } from '../hooks/useStock';
import StockDrawer from '../components/stock/StockDrawer';
import QuickAddModal from '../components/stock/QuickAddModal';

const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€' };

function stockColor(count, limit) {
  if (count <= 0)     return '#ef4444';
  if (limit > 0 && count <= limit) return '#f59e0b';
  return '#10b981';
}

export default function Stock() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const {
    rawItems, productItems, loading, error, saving,
    addItem, updateItem, deleteItem,
    criticalRaw, criticalProd, totalValue,
    refetch,
  } = useStock();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('raw');   // 'raw' | 'product' | 'summary'
  const [drawer,       setDrawer]       = useState(null);    // null | { item, defaultType }
  const [quickAdd,     setQuickAdd]     = useState(false);
  const [toast,        setToast]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [sortKey,      setSortKey]      = useState('name');
  const [sortDir,      setSortDir]      = useState('asc');

  const isDarkStr = isDark;

  const c = {
    bg:       isDark ? '#0f172a' : '#f8fafc',
    card:     isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.9)',
    border:   isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#64748b',
    inputBg:  isDark ? 'rgba(30,41,59,0.8)' : 'rgba(241,245,249,0.9)',
    rowHover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    critBg:   isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
    critBdr:  isDark ? 'rgba(245,158,11,0.25)' : '#fde68a',
  };

  // ── Yardımcılar ───────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Filtreli + sıralı liste ──────────────────────────────────────────────
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
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return list;
  }, [baseList, search, sortKey, sortDir]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleSave = async (formData) => {
    try {
      if (drawer?.item?.id) await updateItem(drawer.item.id, formData);
      else                  await addItem(formData);
      setDrawer(null);
      showToast(drawer?.item?.id ? 'Kayıt güncellendi ✓' : 'Yeni kayıt eklendi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteItem(id);
      setDrawer(null);
      showToast('Kayıt silindi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleQuickSave = async (formData) => {
    try {
      await addItem(formData);
      setQuickAdd(false);
      showToast('Hızlı kayıt eklendi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  // ── Sıralama ikonu ────────────────────────────────────────────────────────
  const SortIcon = ({ col }) =>
    sortKey === col
      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <ChevronUp size={12} style={{ opacity: 0.2 }} />;

  // ── Sekme tanımları ───────────────────────────────────────────────────────
  const TABS = [
    { id: 'raw',     label: '🔩 Hammaddeler',   count: rawItems.length,     critical: criticalRaw.length },
    { id: 'product', label: '⚡ Mamüller',       count: productItems.length, critical: criticalProd.length },
    { id: 'summary', label: '📊 Özet',          count: null },
  ];

  // ── İstatistik kartları (`raw` veya `product` sekmesi için) ───────────────
  const currentCritical = activeTab === 'raw' ? criticalRaw : criticalProd;
  const currentItems    = activeTab === 'raw' ? rawItems    : productItems;
  const currentValue    = currentItems.reduce((sum, i) =>
    sum + (i.purchase_price || 0) * (i.stock_count || 0), 0
  );

  const stats = activeTab !== 'summary' ? [
    {
      label: activeTab === 'raw' ? 'Toplam Hammadde' : 'Toplam Mamül',
      value: currentItems.length,
      icon: Boxes,
      color: '#3b82f6',
      sub: `${filtered.length} gösteriliyor`,
    },
    {
      label: '⚠ Kritik Seviye',
      value: currentCritical.length,
      icon: AlertTriangle,
      color: currentCritical.length > 0 ? '#f59e0b' : '#10b981',
      sub: currentCritical.length > 0 ? 'Sipariş gerekiyor' : 'Stok sağlıklı',
    },
    {
      label: 'Stok Değeri',
      value: `₺${currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: '#10b981',
      sub: 'Alış fiyatı bazlı',
    },
    {
      label: 'Aktif Kayıt',
      value: currentItems.filter(i => i.is_active !== false).length,
      icon: Package,
      color: currentColor,
      sub: `${currentItems.filter(i => i.is_active === false).length} pasif`,
    },
  ] : [];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Başlık ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: c.text }}>
            Üretim & Stok Merkezi
          </h1>
          <p className="text-sm mt-1" style={{ color: c.muted }}>
            {rawItems.length} hammadde · {productItems.length} mamül
            {(criticalRaw.length + criticalProd.length) > 0 &&
              ` · ⚠ ${criticalRaw.length + criticalProd.length} kritik`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch}
            className="p-2 rounded-xl border transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setQuickAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <Zap size={15} style={{ color: currentColor }} />
            Hızlı Ekle
          </button>
          <button
            onClick={() => setDrawer({ item: null, defaultType: activeTab === 'product' ? 'product' : 'raw' })}
            className="btn-primary">
            <Plus size={16} />
            Detaylı Kayıt
          </button>
        </div>
      </div>

      {/* ── Tab Bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: c.border }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all"
            style={{
              color:        activeTab === t.id ? currentColor : c.muted,
              borderBottom: activeTab === t.id ? `2px solid ${currentColor}` : '2px solid transparent',
            }}>
            {t.label}
            {t.count !== null && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: activeTab === t.id ? `${currentColor}20` : c.inputBg,
                  color:      activeTab === t.id ? currentColor : c.muted,
                }}>
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

      {/* ── ÖZET SEKMESİ ─────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { label: 'Toplam Hammadde', value: rawItems.length,     color: '#f59e0b', icon: '🔩' },
            { label: 'Toplam Mamül',    value: productItems.length, color: '#3b82f6', icon: '⚡' },
            { label: 'Kritik Hammadde', value: criticalRaw.length,  color: '#ef4444', icon: '⚠' },
            { label: 'Kritik Mamül',    value: criticalProd.length, color: '#ef4444', icon: '⚠' },
            { label: 'Toplam Değer',    value: `₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, color: '#10b981', icon: '💰' },
            { label: 'Aktif Kayıt',     value: [...rawItems, ...productItems].filter(i => i.is_active !== false).length, color: currentColor, icon: '✓' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="text-3xl">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs font-semibold" style={{ color: c.muted }}>{s.label}</p>
              </div>
            </motion.div>
          ))}

          {/* Kritik kalemler */}
          {[...criticalRaw, ...criticalProd].length > 0 && (
            <div className="md:col-span-2 lg:col-span-3 rounded-2xl p-5"
              style={{ background: c.critBg, border: `1px solid ${c.critBdr}` }}>
              <p className="text-sm font-bold mb-3" style={{ color: '#d97706' }}>
                ⚠ Kritik Stok Kalemleri
              </p>
              <div className="flex flex-wrap gap-2">
                {[...criticalRaw, ...criticalProd].map(i => (
                  <button key={i.id}
                    onClick={() => { setActiveTab(i.item_type === 'product' ? 'product' : 'raw'); setDrawer({ item: i, defaultType: i.item_type }); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all"
                    style={{ background: '#f59e0b25', color: '#92400e' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f59e0b40'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f59e0b25'}>
                    {i.name} — {i.stock_count} {i.unit}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HAMMADDE / MAMÜL SEKMELERİ ───────────────────────────────────── */}
      {activeTab !== 'summary' && (
        <>
          {/* İstatistikler */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="rounded-2xl p-4"
                style={{ background: c.card, border: `1px solid ${c.border}` }}>
                <div className="p-2.5 w-9 h-9 rounded-xl text-white mb-3" style={{ background: s.color }}>
                  <s.icon size={16} />
                </div>
                <p className="text-xl font-bold" style={{ color: c.text }}>{s.value}</p>
                <p className="text-xs font-semibold" style={{ color: c.muted }}>{s.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: s.color }}>{s.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Kritik uyarı */}
          <AnimatePresence>
            {currentCritical.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{ background: c.critBg, border: `1px solid ${c.critBdr}` }}>
                <AlertTriangle size={17} className="mt-0.5 shrink-0" style={{ color: '#d97706' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                    {currentCritical.length} kalem kritik seviyede
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentCritical.slice(0, 5).map(i => (
                      <button key={i.id}
                        onClick={() => setDrawer({ item: i, defaultType: i.item_type })}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: '#f59e0b25', color: '#92400e' }}>
                        {i.name} ({i.stock_count} {i.unit})
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Arama toolbar */}
          <div className="flex items-center gap-3 flex-wrap"
            style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '1rem', padding: '12px 16px' }}>
            <div className="flex items-center gap-2 flex-1 min-w-[180px] px-3 py-2 rounded-xl border"
              style={{ background: c.inputBg, borderColor: c.border }}>
              <Search size={15} style={{ color: c.muted }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={activeTab === 'raw' ? 'Ad, SKU veya tedarikçi ara...' : 'Mamül adı veya SKU ara...'}
                className="bg-transparent border-none outline-none text-sm flex-1"
                style={{ color: c.text }}
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')}
                className="text-xs px-3 py-2 rounded-xl font-semibold"
                style={{ color: c.muted, background: c.inputBg }}>
                Temizle
              </button>
            )}
          </div>

          {/* Tablo */}
          <div className="rounded-2xl overflow-hidden" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                    {[
                      { key: null,          label: '',              w: '36px' },
                      { key: 'sku',         label: 'SKU',           w: '120px' },
                      { key: 'name',        label: activeTab === 'raw' ? 'Hammadde Adı' : 'Mamül Adı' },
                      { key: 'supplier_name', label: activeTab === 'raw' ? 'Tedarikçi' : 'Seri', w: '120px' },
                      { key: 'unit',        label: 'Birim',         w: '70px' },
                      { key: 'stock_count', label: 'Stok',          w: '160px' },
                      { key: 'purchase_price', label: 'Alış Fiyatı', w: '110px' },
                      { key: null,          label: 'İşlemler',      w: '100px' },
                    ].map((col, i) => (
                      <th key={i}
                        className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-widest"
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
                    <tr>
                      <td colSpan={8} className="text-center py-16" style={{ color: c.muted }}>
                        <RefreshCcw size={22} className="animate-spin mx-auto mb-2" style={{ color: currentColor }} />
                        <p className="text-sm">Yükleniyor...</p>
                      </td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={8} className="text-center py-16">
                        <AlertCircle size={28} className="mx-auto mb-2" style={{ color: '#ef4444' }} />
                        <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{error}</p>
                        <p className="text-xs mt-1" style={{ color: c.muted }}>
                          .env.local dosyasındaki Supabase ayarlarını kontrol edin.
                        </p>
                      </td>
                    </tr>
                  )}
                  {!loading && !error && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-16" style={{ color: c.muted }}>
                        <Package size={36} strokeWidth={1} className="mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">Kayıt bulunamadı</p>
                        <p className="text-xs mt-1">Arayı değiştirin veya yeni kayıt ekleyin.</p>
                        <button
                          onClick={() => setDrawer({ item: null, defaultType: activeTab === 'product' ? 'product' : 'raw' })}
                          className="mt-4 btn-primary text-xs px-4 py-2">
                          + İlk Kaydı Ekle
                        </button>
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.map((item, idx) => {
                    const clr  = stockColor(item.stock_count, item.critical_limit);
                    const pct  = item.critical_limit > 0
                      ? Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100)
                      : 80;
                    const sym  = CURRENCY_SYM[item.base_currency] || '';
                    const seriesOrSupplier = activeTab === 'product'
                      ? (item.specs?.series || '—')
                      : (item.supplier_name || '—');

                    return (
                      <motion.tr key={item.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.015 }}
                        style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}
                        onClick={() => setDrawer({ item, defaultType: item.item_type })}
                        onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                        {/* Status dot */}
                        <td className="px-4 py-3.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: clr }} />
                        </td>

                        {/* SKU */}
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          {item.sku
                            ? <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: `${currentColor}18`, color: currentColor }}>
                                {item.sku}
                              </span>
                            : <span style={{ color: c.muted }}>—</span>
                          }
                        </td>

                        {/* İsim */}
                        <td className="px-4 py-3.5">
                          <p className="font-semibold" style={{ color: c.text }}>{item.name}</p>
                          {item.location && (
                            <p className="text-[10px] mt-0.5" style={{ color: c.muted }}>📍 {item.location}</p>
                          )}
                        </td>

                        {/* Tedarikçi / Seri */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs" style={{ color: c.muted }}>{seriesOrSupplier}</span>
                        </td>

                        {/* Birim */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-bold" style={{ color: c.text }}>{item.unit}</span>
                        </td>

                        {/* Stok + progress */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold w-8 text-right" style={{ color: clr }}>
                              {item.stock_count}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[50px]"
                              style={{ background: c.border }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                            </div>
                            {item.critical_limit > 0 && (
                              <span className="text-[10px] text-right" style={{ color: c.muted }}>
                                /{item.critical_limit}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Alış fiyatı */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-semibold" style={{ color: c.text }}>
                            {item.purchase_price > 0 ? `${sym}${item.purchase_price}` : '—'}
                          </span>
                        </td>

                        {/* Aksiyonlar */}
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <ActionBtn icon={Edit2}  color={currentColor} title="Düzenle"
                              onClick={() => setDrawer({ item, defaultType: item.item_type })} />
                            <ActionBtn icon={Trash2} color="#ef4444" title="Sil"
                              onClick={async () => {
                                if (window.confirm(`"${item.name}" silinsin mi?`)) await handleDelete(item.id);
                              }} />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 flex items-center justify-between border-t"
                style={{ borderColor: c.border }}>
                <span className="text-xs" style={{ color: c.muted }}>
                  {filtered.length}/{currentItems.length} kayıt
                </span>
                <span className="text-xs font-semibold" style={{ color: c.muted }}>
                  Stok değeri: <span style={{ color: currentColor }}>
                    ₺{currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </span>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modeller ─────────────────────────────────────────────────────── */}
      {drawer !== null && (
        <StockDrawer
          item={drawer.item}
          defaultType={drawer.defaultType}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
        />
      )}

      {quickAdd && (
        <QuickAddModal
          onClose={() => setQuickAdd(false)}
          onSave={handleQuickSave}
          saving={saving}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[300] px-5 py-3 rounded-2xl shadow-xl text-white font-semibold text-sm"
            style={{ background: toast.type === 'error' ? '#ef4444' : currentColor }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({ icon: Icon, color, title, onClick }) {
  return (
    <button title={title} onClick={onClick}
      className="p-1.5 rounded-lg transition-all"
      style={{ color }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon size={14} />
    </button>
  );
}
