import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Search, AlertTriangle, QrCode,
  Edit2, Trash2, ChevronUp, ChevronDown, RefreshCcw,
  TrendingUp, TrendingDown, Boxes, AlertCircle, SlidersHorizontal
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useStock } from '../hooks/useStock';
import StockModal from '../components/stock/StockModal';
import QRModal from '../components/stock/QRModal';

const CURRENCY_SYMBOL = { TRY: '₺', USD: '$', EUR: '€' };
const UNITS = ['Tümü', 'pcs', 'kg', 'm', 'lt', 'm²', 'm³', 'adet', 'kutu', 'rulo'];
const CATS  = ['Tümü', 'Hammadde', 'Mamül', 'Yarı Mamül', 'Sarf Malzeme', 'Ambalaj', 'Diğer'];

function stockColor(count, limit) {
  if (!limit || limit <= 0) return '#10b981';
  if (count <= 0)           return '#ef4444';
  if (count <= limit)       return '#f59e0b';
  return '#10b981';
}

export default function Stock() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const { items, loading, error, saving, addItem, updateItem, deleteItem, criticalItems, totalValue, refetch } = useStock();

  // Modals
  const [modalItem,  setModalItem]  = useState(null);   // null=kapalı | {}=yeni | item=düzenle
  const [qrItem,     setQrItem]     = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filtreler
  const [search,     setSearch]     = useState('');
  const [unitFilter, setUnitFilter] = useState('Tümü');
  const [catFilter,  setCatFilter]  = useState('Tümü');
  const [onlyCrit,   setOnlyCrit]   = useState(false);
  const [sortKey,    setSortKey]    = useState('name');
  const [sortDir,    setSortDir]    = useState('asc');
  const [toast,      setToast]      = useState(null);

  const c = {
    bg:       isDark ? '#0f172a' : '#f8fafc',
    card:     isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.9)',
    border:   isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#64748b',
    inputBg:  isDark ? 'rgba(30,41,59,0.8)' : 'rgba(241,245,249,0.9)',
    rowHover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    critBg:   isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
    critBorder: isDark ? 'rgba(245,158,11,0.25)' : '#fde68a',
  };

  // Sıralama
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filtrelenmiş + sıralanmış liste
  const filtered = useMemo(() => {
    let list = [...items];
    if (search)               list = list.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase()));
    if (unitFilter !== 'Tümü') list = list.filter(i => i.unit === unitFilter);
    if (catFilter  !== 'Tümü') list = list.filter(i => i.category === catFilter);
    if (onlyCrit)             list = list.filter(i => i.stock_count <= i.critical_limit);

    list.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va?.toLowerCase() ?? '';
      if (typeof vb === 'string') vb = vb?.toLowerCase() ?? '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1  : -1;
      return 0;
    });
    return list;
  }, [items, search, unitFilter, catFilter, onlyCrit, sortKey, sortDir]);

  // Toast
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // CRUD handlers
  const handleSave = async (formData) => {
    try {
      if (modalItem?.id) await updateItem(modalItem.id, formData);
      else               await addItem(formData);
      setModalItem(null);
      showToast(modalItem?.id ? 'Ürün güncellendi ✓' : 'Ürün eklendi ✓');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteItem(item.id);
      setDeleteConfirm(null);
      showToast('Ürün silindi ✓');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const SortIcon = ({ col }) => (
    sortKey === col
      ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
      : <ChevronUp size={13} className="opacity-20" />
  );

  // ── İstatistik Kartları ───────────────────────────────────────────────────
  const stats = [
    {
      label: 'Toplam Ürün',
      value: items.length,
      icon: Boxes,
      color: '#3b82f6',
      sub: `${filtered.length} gösteriliyor`,
    },
    {
      label: 'Kritik Seviye',
      value: criticalItems.length,
      icon: AlertTriangle,
      color: criticalItems.length > 0 ? '#f59e0b' : '#10b981',
      sub: criticalItems.length > 0 ? 'Acil sipariş gerekiyor' : 'Stok sağlıklı',
    },
    {
      label: 'Toplam Stok Değeri',
      value: `₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: '#10b981',
      sub: 'Alış fiyatı bazlı',
    },
    {
      label: 'Aktif Ürün',
      value: items.filter(i => i.is_active !== false).length,
      icon: Package,
      color: currentColor,
      sub: `${items.filter(i => i.is_active === false).length} pasif`,
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Başlık ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: c.text }}>
            Stok Merkezi
          </h1>
          <p className="text-sm mt-1" style={{ color: c.muted }}>
            {items.length} ürün · {criticalItems.length > 0 && `⚠ ${criticalItems.length} kritik`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch}
            className="p-2 rounded-xl border transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModalItem({})}
            className="btn-primary">
            <Plus size={17} />
            Yeni Ürün
          </button>
        </div>
      </div>

      {/* ── İstatistikler ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl text-white" style={{ background: s.color }}>
                <s.icon size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: c.text }}>{s.value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: c.muted }}>{s.label}</p>
            <p className="text-[10px] mt-1" style={{ color: s.color }}>{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Kritik Stok Uyarısı ────────────────────────────────────────── */}
      <AnimatePresence>
        {criticalItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: c.critBg, border: `1px solid ${c.critBorder}` }}>
            <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: '#d97706' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                {criticalItems.length} ürün kritik stok seviyesinde!
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {criticalItems.slice(0, 6).map(i => (
                  <span key={i.id}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: isDark ? 'rgba(245,158,11,0.2)' : '#fde68a', color: '#92400e' }}>
                    {i.name} ({i.stock_count} {i.unit})
                  </span>
                ))}
                {criticalItems.length > 6 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#fde68a', color: '#92400e' }}>
                    +{criticalItems.length - 6} daha
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => setOnlyCrit(true)}
              className="text-xs font-bold shrink-0 px-3 py-1.5 rounded-lg"
              style={{ background: '#d97706', color: 'white' }}>
              Hepsini Gör
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filtre Toolbar ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
        style={{ background: c.card, border: `1px solid ${c.border}` }}>

        {/* Arama */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] px-3 py-2 rounded-xl border"
          style={{ background: c.inputBg, borderColor: c.border }}>
          <Search size={15} style={{ color: c.muted }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ürün adı veya SKU ara..."
            className="bg-transparent border-none outline-none text-sm flex-1"
            style={{ color: c.text }} />
        </div>

        {/* Birim */}
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border text-sm font-medium"
          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>

        {/* Kategori */}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border text-sm font-medium"
          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
          {CATS.map(u => <option key={u}>{u}</option>)}
        </select>

        {/* Kritik toggle */}
        <button onClick={() => setOnlyCrit(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all"
          style={{
            background:  onlyCrit ? '#f59e0b20' : c.inputBg,
            borderColor: onlyCrit ? '#f59e0b'   : c.border,
            color:       onlyCrit ? '#d97706'    : c.muted,
          }}>
          <AlertTriangle size={14} />
          Sadece Kritik
        </button>

        {/* Temizle */}
        {(search || unitFilter !== 'Tümü' || catFilter !== 'Tümü' || onlyCrit) && (
          <button onClick={() => { setSearch(''); setUnitFilter('Tümü'); setCatFilter('Tümü'); setOnlyCrit(false); }}
            className="text-xs font-bold px-3 py-2 rounded-xl"
            style={{ color: c.muted, background: c.inputBg }}>
            Temizle
          </button>
        )}
      </div>

      {/* ── Tablo ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: c.card, border: `1px solid ${c.border}` }}>

        {/* Tablo Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                {[
                  { key: null,          label: '',            w: '40px' },
                  { key: 'sku',         label: 'SKU',         w: '110px' },
                  { key: 'name',        label: 'Ürün Adı' },
                  { key: 'category',    label: 'Kategori',    w: '110px' },
                  { key: 'unit',        label: 'Birim',       w: '70px' },
                  { key: 'stock_count', label: 'Stok',        w: '160px' },
                  { key: 'sale_price',  label: 'Satış Fiyatı',w: '120px' },
                  { key: null,          label: 'İşlemler',    w: '100px' },
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

            <tbody className="divide-y" style={{ '--tw-divide-color': c.border }}>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-16" style={{ color: c.muted }}>
                    <RefreshCcw size={24} className="animate-spin mx-auto mb-2" style={{ color: currentColor }} />
                    <p className="text-sm">Stok verisi yükleniyor...</p>
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <AlertCircle size={28} className="mx-auto mb-2" style={{ color: '#ef4444' }} />
                    <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{error}</p>
                    <p className="text-xs mt-1" style={{ color: c.muted }}>Supabase bağlantısını ve .env.local dosyasını kontrol et</p>
                  </td>
                </tr>
              )}

              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16" style={{ color: c.muted }}>
                    <Package size={36} strokeWidth={1} className="mx-auto mb-3 opacity-40" />
                    <p className="font-semibold">Ürün bulunamadı</p>
                    <p className="text-xs mt-1">Filtreleri değiştirin veya yeni ürün ekleyin</p>
                  </td>
                </tr>
              )}

              {!loading && filtered.map((item, idx) => {
                const color = stockColor(item.stock_count, item.critical_limit);
                const pct   = item.critical_limit > 0
                  ? Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100)
                  : 100;
                const sym   = CURRENCY_SYMBOL[item.base_currency] || item.base_currency;

                return (
                  <motion.tr key={item.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                    style={{ borderBottom: `1px solid ${c.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* Status dot */}
                    <td className="px-4 py-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    </td>

                    {/* SKU */}
                    <td className="px-4 py-3">
                      {item.sku
                        ? <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: `${currentColor}20`, color: currentColor }}>
                            {item.sku}
                          </span>
                        : <span style={{ color: c.muted }}>—</span>
                      }
                    </td>

                    {/* İsim + açıklama */}
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: c.text }}>{item.name}</p>
                      {item.description && (
                        <p className="text-xs truncate max-w-xs" style={{ color: c.muted }}>{item.description}</p>
                      )}
                    </td>

                    {/* Kategori */}
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: c.muted }}>{item.category || '—'}</span>
                    </td>

                    {/* Birim */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold" style={{ color: c.text }}>{item.unit}</span>
                    </td>

                    {/* Stok + Progress */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color }}>
                          {item.stock_count}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: c.border, minWidth: '60px' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        {item.critical_limit > 0 && (
                          <span className="text-[10px]" style={{ color: c.muted }}>/{item.critical_limit}</span>
                        )}
                      </div>
                    </td>

                    {/* Fiyat */}
                    <td className="px-4 py-3">
                      <span className="font-bold text-sm" style={{ color: c.text }}>
                        {item.sale_price > 0 ? `${sym}${item.sale_price}` : '—'}
                      </span>
                    </td>

                    {/* Aksiyonlar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn icon={QrCode}  title="QR Kod"   color={currentColor}           onClick={() => setQrItem(item)} />
                        <ActionBtn icon={Edit2}    title="Düzenle"  color={currentColor}           onClick={() => setModalItem(item)} />
                        <ActionBtn icon={Trash2}   title="Sil"      color="#ef4444"                onClick={() => setDeleteConfirm(item)} />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tablo footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between border-t"
            style={{ borderColor: c.border }}>
            <span className="text-xs" style={{ color: c.muted }}>
              {filtered.length} ürün listelendi
            </span>
            <span className="text-xs font-semibold" style={{ color: c.muted }}>
              Toplam stok değeri: <span style={{ color: currentColor }}>
                ₺{totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {modalItem !== null && (
        <StockModal
          item={modalItem?.id ? modalItem : null}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {qrItem && <QRModal item={qrItem} onClose={() => setQrItem(null)} />}

      {/* Silme onay dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setDeleteConfirm(null)}>
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <Trash2 size={28} className="mb-3" style={{ color: '#ef4444' }} />
              <h3 className="font-bold text-base mb-1" style={{ color: c.text }}>
                "{deleteConfirm.name}" silinsin mi?
              </h3>
              <p className="text-sm mb-5" style={{ color: c.muted }}>
                Bu işlem geri alınamaz. Stok hareketleri korunacak.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-xl border font-semibold text-sm"
                  style={{ borderColor: c.border, color: c.muted }}>
                  İptal
                </button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-sm"
                  style={{ background: '#ef4444' }}>
                  Sil
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-white font-semibold text-sm"
            style={{ background: toast.type === 'error' ? '#ef4444' : currentColor }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`.divide-y > tr { border-bottom: 1px solid var(--border); }`}</style>
    </div>
  );
}

// ─── Küçük aksiyon butonu ─────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, title, color, onClick }) {
  return (
    <button title={title} onClick={onClick}
      className="p-1.5 rounded-lg transition-all"
      style={{ color }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon size={15} />
    </button>
  );
}
