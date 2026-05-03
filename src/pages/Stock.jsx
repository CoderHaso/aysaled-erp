import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Plus, Search, AlertTriangle, RefreshCcw, AlertCircle,
  Zap, TrendingUp, TrendingDown, Boxes, Package, ChevronUp, ChevronDown,
  Edit2, Trash2, Upload, Download, FileJson, FileSpreadsheet,
  X, CheckCircle2, AlertOctagon, FolderDown, Eye, Save,
  Layers, ArrowRight, DollarSign, Hash, MapPin, Ruler, Tag,
  Clock, ArrowUpCircle, ArrowDownCircle, Wrench, ShoppingCart, FileText,
  FlaskConical, Pencil, Check, Minus, Printer,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useStock } from '../hooks/useStock';
import { trNorm } from '../lib/trNorm';
import { useFxRates } from '../hooks/useFxRates';
import { supabase } from '../lib/supabaseClient';
import { pageCache } from '../lib/pageCache';
import ItemDrawer from '../components/stock/ItemDrawer';
import QuickAddModal from '../components/stock/QuickAddModal';
import MediaPickerModal from '../components/MediaPickerModal';
import { printDocument } from '../lib/printService';
import { Image as ImageIcon } from 'lucide-react';

const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€' };

function stockColor(c, l) {
  if (c <= 0)          return '#ef4444';
  if (l > 0 && c <= l) return '#f59e0b';
  return '#10b981';
}

export default function Stock() {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('aerp_activeTab') || 'all');

  useEffect(() => {
    sessionStorage.setItem('aerp_view', view);
    sessionStorage.setItem('aerp_editing', JSON.stringify(editing));
    sessionStorage.setItem('aerp_formType', formType);
    sessionStorage.setItem('aerp_activeTab', activeTab);
  }, [view, editing, formType, activeTab]);

  // (Eski ID açılış kodları silindi. Barkodlar bağımsız QRDetail sayfasına gider)

  const [quickAdd,      setQuickAdd]      = useState(false);

  // Dashboard "Stok Ekle" hızlı aksiyonu → QuickAdd modalını otomatik aç
  useEffect(() => {
    if (location.state?.openQuickAdd) {
      setQuickAdd(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const [showIOPanel,   setShowIOPanel]   = useState(false);
  const [toast,         setToast]         = useState(null);
  const [search,        setSearch]        = useState('');
  const [sortKey,       setSortKey]       = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);
  const [detailItem,    setDetailItem]    = useState(null);   // yan panel detay
  const [quickEditMode, setQuickEditMode] = useState(false);  // hızlı düzenle modu
  const [quickEdits,    setQuickEdits]    = useState({});      // {itemId: {field: val}}
  const [quickSaving,   setQuickSaving]   = useState(false);
  const [bulkModal,     setBulkModal]     = useState(false);  // toplu güncelle
  const { convert: fxConvert } = useFxRates();
  // Kategoriler
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    supabase.from('item_categories').select('id,name,item_scope').order('name').then(({ data }) => setCategories(data || []));
  }, []);

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

  const baseList = activeTab === 'all' ? [...rawItems, ...productItems] : activeTab === 'raw' ? rawItems : productItems;
  const filtered = useMemo(() => {
    let list = [...baseList];
    if (search) {
      const q = trNorm(search);
      list = list.filter(i =>
        trNorm(i.name).includes(q) ||
        trNorm(i.sku).includes(q) ||
        trNorm(i.supplier_name).includes(q)
      );
    }
    list.sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
      if (typeof va === 'string') { va = trNorm(va); vb = trNorm(vb); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return list;
  }, [baseList, search, sortKey, sortDir]);

  const handleSave = async () => {
    refetch();
    setView('list');
    showToast(editing?.id ? 'Kayıt güncellendi ✓' : 'Yeni kayıt eklendi ✓');
  };

  const handleDelete = async (id) => {
    try { await deleteItem(id); setView('list'); showToast('Kayıt silindi ✓'); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const handleQuickSave = async (formData) => {
    try { await addItem(formData); setQuickAdd(false); showToast('Hızlı kayıt eklendi ✓'); }
    catch (e) { showToast(e.message, 'error'); }
  };

  // ── Import/Export helpers ────────────────────────────────────────────────────

  /** JSON/XLSX dosyasını parse edip items dizisi döner */
  const parseImportFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(e.target.result);
          resolve(Array.isArray(data) ? data : [data]);
        } else {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws));
        }
      } catch (err) { reject(err); }
    };
    if (file.name.endsWith('.json')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  });

  /** Satırı Supabase items formatına dönüştür */
  const mapRowToItem = (row, forcedType) => {
    const tip = forcedType ||
      (trNorm(String(row['_A_ERP_Tip'] || row['Tip'] || '')).includes('mamül') ? 'product' : 'raw');
    return {
      name:           String(row['Stok Adı'] || row['name'] || '').trim(),
      unit:           String(row['Birim']    || row['unit'] || 'Adet').trim(),
      purchase_price: parseFloat(row['Alış Fiyatı'] || row['purchase_price'] || 0) || 0,
      item_type:      tip,
      stock_count:    parseFloat(row['Stok']        || row['stock_count']    || 0) || 0,
      sku:            String(row['SKU']             || row['sku']            || '').trim() || null,
      supplier_name:  String(row['Tedarikçi']       || row['supplier_name'] || '').trim() || null,
      location:       String(row['Konum']           || row['location']      || '').trim() || null,
      critical_limit: parseFloat(row['Kritik Limit']|| row['critical_limit'] || 0) || 0,
      is_active:      true,
    };
  };

  /** Dosyadan import et — tab'a göre tip override */
  const handleImportFile = async (file, typeOverride) => {
    setImporting(true); setImportResult(null);
    try {
      const rows = await parseImportFile(file);
      const items = rows
        .map(r => mapRowToItem(r, typeOverride))
        .filter(i => i.name.length > 0);

      let added = 0, skipped = 0, errors = [];
      // Batch insert 50'şer chunk
      const chunks = [];
      for (let i = 0; i < items.length; i += 50) chunks.push(items.slice(i, i + 50));
      for (const chunk of chunks) {
        const { error: err } = await supabase.from('items').insert(chunk);
        if (err) {
          // Tekil dene
          for (const item of chunk) {
            const { error: e2 } = await supabase.from('items').insert(item);
            if (e2) { skipped++; errors.push(`${item.name}: ${e2.message}`); }
            else added++;
          }
        } else { added += chunk.length; }
      }
      setImportResult({ added, skipped, errors: errors.slice(0, 10) });
      refetch();
      showToast(`${added} kayıt eklendi${skipped ? `, ${skipped} atlandı` : ''} ✓`);
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setImporting(false); }
  };

  /** Şablon XLSX indir */
  const downloadTemplate = (type) => {
    const headers = ['name','unit','purchase_price','stock_count','sku','supplier_name','location','critical_limit','item_type'];
    const example = [{
      name: type === 'raw' ? '5X3 LİNEER PROFİL' : 'DOWNLIGHT ARMATÜR',
      unit: type === 'raw' ? 'Metre' : 'Adet',
      purchase_price: 2.36, stock_count: 0, sku: '', supplier_name: '', location: '', critical_limit: 0,
      item_type: type === 'raw' ? 'raw' : 'product',
    }];
    const ws = XLSX.utils.json_to_sheet(example, { header: headers });
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, `AERP_Sablonu_${type === 'raw' ? 'Hammadde' : 'Mamul'}.xlsx`);
  };

  /** Mevcut listeyi export et */
  const handleExport = (format, type) => {
    const list = type === 'raw' ? rawItems : productItems;
    const mapped = list.map(i => ({
      'Stok Adı': i.name,
      'Birim': i.unit,
      'SKU': i.sku || '',
      'Alış Fiyatı': i.purchase_price,
      'Stok': i.stock_count,
      'Kritik Limit': i.critical_limit || 0,
      'Tedarikçi': i.supplier_name || '',
      'Konum': i.location || '',
    }));
    const label = type === 'raw' ? 'Hammadde' : 'Mamul';
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(mapped, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `AERP_${label}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.json_to_sheet(mapped);
      ws['!cols'] = Object.keys(mapped[0] || {}).map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, label);
      XLSX.writeFile(wb, `AERP_${label}.xlsx`);
    }
  };

  const SortIcon = ({ col }) => sortKey === col
    ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
    : <ChevronUp size={11} style={{ opacity: 0.2 }} />;

  const allItems = [...rawItems, ...productItems];
  const currentCritical = activeTab === 'all' ? [...criticalRaw, ...criticalProd] : activeTab === 'raw' ? criticalRaw : criticalProd;
  const currentItems    = activeTab === 'all' ? allItems : activeTab === 'raw' ? rawItems : productItems;
  const currentValue    = currentItems.reduce((s, i) => s + (i.purchase_price || 0) * (i.stock_count || 0), 0);

  const TABS = [
    { id: 'all',     label: '📦 Genel',     count: allItems.length,       critical: criticalRaw.length + criticalProd.length },
    { id: 'product', label: '⚡ Mamül',     count: productItems.length, critical: criticalProd.length },
    { id: 'raw',     label: '🔩 Hammadde', count: rawItems.length,     critical: criticalRaw.length },
    { id: 'summary', label: '📊 Özet' },
  ];

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <ItemDrawer
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
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
          <button onClick={refetch}
            className="p-2 rounded-xl border transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowIOPanel(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all"
            style={{ borderColor: showIOPanel ? currentColor : c.border, color: showIOPanel ? currentColor : c.muted, background: c.inputBg }}>
            <Upload size={13} />
            <span className="hidden sm:inline">İçe/Dışa</span>
          </button>
          <button onClick={() => { setQuickEditMode(v => !v); setQuickEdits({}); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all"
            style={{ borderColor: quickEditMode ? '#f59e0b' : c.border, color: quickEditMode ? '#f59e0b' : c.muted, background: quickEditMode ? 'rgba(245,158,11,0.08)' : c.inputBg }}>
            <Edit2 size={13} />
            <span className="hidden sm:inline">{quickEditMode ? 'Düzenleniyor...' : 'Hızlı Düzenle'}</span>
          </button>
          <button onClick={() => setBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <Layers size={13} style={{ color: '#3b82f6' }} />
            <span className="hidden sm:inline">Toplu Güncelle</span>
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

      {/* ── İMPORT / EXPORT PANELİ ────────────────────────────────────────── */}
      <AnimatePresence>
        {showIOPanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <ImportExportPanel
              c={c} currentColor={currentColor} isDark={isDark}
              activeTab={activeTab}
              importing={importing} importResult={importResult}
              onImportFile={handleImportFile}
              onExport={handleExport}
              onTemplate={downloadTemplate}
              onClose={() => { setShowIOPanel(false); setImportResult(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
      {(activeTab === 'all' || activeTab === 'raw' || activeTab === 'product') && (
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

          {/* Hızlı Düzenle Sticky Kaydet Barı */}
          <AnimatePresence>
            {quickEditMode && Object.keys(quickEdits).length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="sticky top-0 z-[50] px-4 py-2.5 flex items-center justify-between rounded-xl mb-2"
                style={{ background: isDark ? '#1a2744' : '#fffbeb', border: '1.5px solid rgba(245,158,11,0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
                  ✏️ {Object.keys(quickEdits).length} kayıt değiştirildi
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setQuickEdits({})}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ color: c.muted, border: `1px solid ${c.border}` }}>
                    İptal
                  </button>
                  <button
                    disabled={quickSaving}
                    onClick={async () => {
                      setQuickSaving(true);
                      try {
                        for (const [itemId, changes] of Object.entries(quickEdits)) {
                          const patch = {};
                          if (changes.name !== undefined) patch.name = changes.name.trim();
                          if (changes.unit !== undefined) patch.unit = changes.unit;
                          if (changes.stock_count !== undefined) patch.stock_count = Number(changes.stock_count);
                          if (changes.purchase_price !== undefined) patch.purchase_price = Number(changes.purchase_price);
                          if (changes.sale_price !== undefined) patch.sale_price = Number(changes.sale_price);
                          if (changes.critical_limit !== undefined) patch.critical_limit = Number(changes.critical_limit);
                          if (changes.base_currency !== undefined) patch.base_currency = changes.base_currency;
                          if (changes.sale_currency !== undefined) patch.sale_currency = changes.sale_currency;
                          if (changes.category_id !== undefined) patch.category_id = changes.category_id || null;
                          if (Object.keys(patch).length > 0) {
                            await supabase.from('items').update(patch).eq('id', itemId);
                          }
                        }
                        showToast(`${Object.keys(quickEdits).length} kayıt güncellendi ✓`);
                        setQuickEdits({});
                        refetch();
                      } catch (e) { showToast(e.message, 'error'); }
                      finally { setQuickSaving(false); }
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ background: '#f59e0b', opacity: quickSaving ? 0.7 : 1 }}>
                    {quickSaving ? <RefreshCcw size={12} className="animate-spin"/> : <Save size={12}/>}
                    {quickSaving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
                  </button>
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
                      { key: null,             label: '',         w: '28px'  },
                      ...(activeTab === 'all' ? [{ key: 'item_type', label: 'Tip', w: '50px' }] : []),
                      { key: 'sku',            label: 'SKU',      w: '80px' },
                      { key: 'name',           label: activeTab === 'raw' ? 'Hammadde' : activeTab === 'product' ? 'Mamül' : 'Ürün / Hammadde' },
                      { key: 'category_id',    label: 'Kategori', w: quickEditMode ? '120px' : '100px' },
                      { key: 'unit',           label: 'Birim',    w: quickEditMode ? '80px' : '55px'  },
                      { key: 'stock_count',    label: 'Stok',     w: quickEditMode ? '90px' : '90px' },
                      { key: 'purchase_price', label: 'Alış',    w: quickEditMode ? '90px' : '80px'  },
                      { key: 'sale_price',     label: 'Satış',   w: quickEditMode ? '90px' : '80px' },
                      ...(quickEditMode ? [
                        { key: 'critical_limit', label: 'Kritik', w: '70px' },
                        { key: 'base_currency', label: 'A.Döv', w: '60px' },
                        { key: 'sale_currency', label: 'S.Döv', w: '60px' },
                      ] : []),
                      { key: null,             label: '',         w: '60px'  },
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
                  {loading && filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-14" style={{ color: c.muted }}>
                      <RefreshCcw size={20} className="animate-spin mx-auto mb-2" style={{ color: currentColor }} />
                      <p className="text-sm">Yükleniyor...</p>
                    </td></tr>
                  )}
                  {error && (
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
                  {!error && filtered.length > 0 && filtered.map((item, idx) => {
                    const clr = stockColor(item.stock_count, item.critical_limit);
                    const pct = item.critical_limit > 0 ? Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100) : 80;
                    const sym = CURRENCY_SYM[item.base_currency] || '₺';
                    const saleSym = CURRENCY_SYM[item.sale_currency] || '₺';
                    const ed = quickEdits[item.id] || {};
                    const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'];
                    const itemCats = categories.filter(ct => ct.item_scope === (item.item_type === 'product' ? 'product' : 'rawmaterial'));
                    const catName = categories.find(ct => ct.id === item.category_id)?.name;
                    return (
                      <motion.tr key={item.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.01 }}
                        style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}
                        onClick={() => !quickEditMode && setDetailItem(item)}
                        onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-2 py-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: clr }} />
                        </td>
                        {/* Tip badge — sadece Genel sekmede */}
                        {activeTab === 'all' && (
                          <td className="px-2 py-2">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: item.item_type === 'product' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
                                       color: item.item_type === 'product' ? '#3b82f6' : '#f59e0b' }}>
                              {item.item_type === 'product' ? '⚡M' : '🔩H'}
                            </span>
                          </td>
                        )}
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          {item.sku
                            ? <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg"
                                style={{ background: `${currentColor}18`, color: currentColor }}>
                                {item.sku}
                              </span>
                            : <span style={{ color: c.muted }}>—</span>
                          }
                        </td>
                        <td className="px-2 py-2" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="text"
                              value={ed.name ?? item.name}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), name: e.target.value}}))}
                              className="w-full px-1.5 py-1 text-[12px] font-semibold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}/>
                          ) : (
                            <>
                              <p className="font-semibold text-sm" style={{ color: c.text }}>{item.name}</p>
                              {item.location && <p className="text-[10px] mt-0.5" style={{ color: c.muted }}>📍 {item.location}</p>}
                            </>
                          )}
                        </td>
                        {/* Kategori */}
                        <td className="px-2 py-2" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <select value={ed.category_id ?? item.category_id ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), category_id: e.target.value}}))}
                              className="w-full px-1 py-1 text-[11px] rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              <option value="">—</option>
                              {itemCats.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                            </select>
                          ) : (
                            catName
                              ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: `${currentColor}10`, color: currentColor }}>{catName}</span>
                              : <span className="text-[10px]" style={{ color: c.muted }}>—</span>
                          )}
                        </td>
                        {/* Birim */}
                        <td className="px-2 py-2" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <select value={ed.unit ?? item.unit} onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), unit: e.target.value}}))}
                              className="w-full px-1 py-1 text-[11px] rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          ) : (
                            <span className="text-[11px] font-bold" style={{ color: c.text }}>{item.unit}</span>
                          )}
                        </td>
                        {/* Stok — soldan hizalı */}
                        <td className="px-2 py-2" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="number" step="0.01"
                              value={ed.stock_count ?? item.stock_count}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), stock_count: e.target.value}}))}
                              className="w-full px-1 py-1 text-[11px] font-bold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: clr }}/>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold" style={{ color: clr }}>{item.stock_count}</span>
                              <span className="text-[10px]" style={{ color: c.muted }}>{item.unit}</span>
                              {item.critical_limit > 0 && <span className="text-[9px]" style={{ color: c.muted }}>/{item.critical_limit}</span>}
                            </div>
                          )}
                        </td>
                        {/* Alış Fiyatı */}
                        <td className="px-2 py-2" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="number" step="0.01"
                              value={ed.purchase_price ?? item.purchase_price ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), purchase_price: e.target.value}}))}
                              placeholder="0.00"
                              className="w-full px-1 py-1 text-[11px] font-bold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#10b981' }}/>
                          ) : (
                            <span className="text-[12px] font-semibold" style={{ color: c.text }}>
                              {item.purchase_price > 0 ? `${sym}${item.purchase_price}` : '—'}
                            </span>
                          )}
                        </td>
                        {/* Satış Fiyatı */}
                        <td className="px-2 py-2" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="number" step="0.01"
                              value={ed.sale_price ?? item.sale_price ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), sale_price: e.target.value}}))}
                              placeholder="0.00"
                              className="w-full px-1 py-1 text-[11px] font-bold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#3b82f6' }}/>
                          ) : (
                            <span className="text-[12px] font-semibold" style={{ color: c.text }}>
                              {item.sale_price > 0 ? `${saleSym}${item.sale_price}` : '—'}
                            </span>
                          )}
                        </td>
                        {/* Döviz + Kritik Limit (sadece quick edit) */}
                        {quickEditMode && (
                          <>
                            <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                              <input type="number" step="1" min="0"
                                value={ed.critical_limit ?? item.critical_limit ?? ''}
                                onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), critical_limit: e.target.value}}))}
                                placeholder="0"
                                className="w-full px-1 py-1 text-[11px] font-bold rounded-lg outline-none"
                                style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#f59e0b' }}/>
                            </td>
                            <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                              <select value={ed.base_currency ?? item.base_currency ?? 'TRY'}
                                onChange={e => {
                                  const newCur = e.target.value;
                                  const oldCur = ed.base_currency ?? item.base_currency ?? 'TRY';
                                  const oldPrice = parseFloat(ed.purchase_price ?? item.purchase_price) || 0;
                                  const converted = oldPrice > 0 ? fxConvert(oldPrice, oldCur, newCur) : 0;
                                  setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), base_currency: newCur, purchase_price: converted ? converted.toFixed(2) : '0'}}));
                                }}
                                className="w-full px-1 py-1 text-[11px] rounded-lg outline-none"
                                style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                                {['TRY','USD','EUR','GBP'].map(cu => <option key={cu} value={cu}>{cu}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                              <select value={ed.sale_currency ?? item.sale_currency ?? 'TRY'}
                                onChange={e => {
                                  const newCur = e.target.value;
                                  const oldCur = ed.sale_currency ?? item.sale_currency ?? 'TRY';
                                  const oldPrice = parseFloat(ed.sale_price ?? item.sale_price) || 0;
                                  const converted = oldPrice > 0 ? fxConvert(oldPrice, oldCur, newCur) : 0;
                                  setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), sale_currency: newCur, sale_price: converted ? converted.toFixed(2) : '0'}}));
                                }}
                                className="w-full px-1 py-1 text-[11px] rounded-lg outline-none"
                                style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                                {['TRY','USD','EUR','GBP'].map(cu => <option key={cu} value={cu}>{cu}</option>)}
                              </select>
                            </td>
                          </>
                        )}
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
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
              {loading && filtered.length === 0 && (
                <div className="text-center py-12" style={{ color: c.muted }}>
                  <RefreshCcw size={20} className="animate-spin mx-auto mb-2" style={{ color: currentColor }} />
                  <p className="text-sm">Yükleniyor...</p>
                </div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="text-center py-12" style={{ color: c.muted }}>
                  <Package size={32} strokeWidth={1} className="mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm">Kayıt bulunamadı</p>
                  <button onClick={() => openForm(null, activeTab === 'product' ? 'product' : 'raw')}
                    className="mt-3 btn-primary text-xs px-4 py-2">
                    + İlk Kaydı Ekle
                  </button>
                </div>
              )}
              {!error && filtered.length > 0 && filtered.map((item, idx) => {
                const clr = stockColor(item.stock_count, item.critical_limit);
                const pct = item.critical_limit > 0 ? Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100) : 80;
                const sym = CURRENCY_SYM[item.base_currency] || '₺';
                const saleSym = CURRENCY_SYM[item.sale_currency] || '₺';
                const ed = quickEdits[item.id] || {};
                return (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                    onClick={() => !quickEditMode && setDetailItem(item)}
                    className="px-4 py-3.5 active:opacity-70 transition-opacity"
                    style={{ borderBottom: `1px solid ${c.border}`, cursor: quickEditMode ? 'default' : 'pointer' }}>
                    {/* Üst satır: İsim + SKU + Buton */}
                    <div className="flex items-center gap-3">
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: clr }} />
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
                        {!quickEditMode && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="text-xs font-bold flex-shrink-0" style={{ color: clr }}>{item.stock_count}</span>
                              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: c.border }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                              </div>
                              <span className="text-[10px] flex-shrink-0" style={{ color: c.muted }}>{item.unit}</span>
                            </div>
                            {item.purchase_price > 0 && (
                              <span className="text-xs font-semibold flex-shrink-0" style={{ color: c.muted }}>
                                {sym}{item.purchase_price}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); openForm(item, item.item_type); }}
                        className="p-2 rounded-xl flex-shrink-0"
                        style={{ background: `${currentColor}15`, color: currentColor }}>
                        <Edit2 size={14} />
                      </button>
                    </div>
                    {/* Hızlı düzenle alanları */}
                    {quickEditMode && (
                      <div className="mt-2.5 pl-4 space-y-2" onClick={e => e.stopPropagation()}>
                        {/* Satır 1: Stok, Birim, Kritik */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>Stok</label>
                            <input type="number" step="0.01"
                              value={ed.stock_count ?? item.stock_count}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), stock_count: e.target.value}}))}
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: clr }} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>Birim</label>
                            <select value={ed.unit ?? item.unit}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), unit: e.target.value}}))}
                              className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              {['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>Kritik</label>
                            <input type="number" step="1" min="0"
                              value={ed.critical_limit ?? item.critical_limit ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), critical_limit: e.target.value}}))}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#f59e0b' }} />
                          </div>
                        </div>
                        {/* Satır 2: Alış, A.Döviz */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>Alış</label>
                            <input type="number" step="0.01"
                              value={ed.purchase_price ?? item.purchase_price ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), purchase_price: e.target.value}}))}
                              placeholder="0.00"
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#10b981' }} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>A.Döviz</label>
                            <select value={ed.base_currency ?? item.base_currency ?? 'TRY'}
                              onChange={e => {
                                const newCur = e.target.value;
                                const oldCur = ed.base_currency ?? item.base_currency ?? 'TRY';
                                const oldPrice = parseFloat(ed.purchase_price ?? item.purchase_price) || 0;
                                const converted = oldPrice > 0 ? fxConvert(oldPrice, oldCur, newCur) : 0;
                                setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), base_currency: newCur, purchase_price: converted ? converted.toFixed(2) : '0'}}));
                              }}
                              className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              {['TRY','USD','EUR','GBP'].map(cu => <option key={cu} value={cu}>{cu}</option>)}
                            </select>
                          </div>
                        </div>
                        {/* Satır 3: Satış, S.Döviz */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>Satış</label>
                            <input type="number" step="0.01"
                              value={ed.sale_price ?? item.sale_price ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), sale_price: e.target.value}}))}
                              placeholder="0.00"
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#3b82f6' }} />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase" style={{ color: c.muted }}>S.Döviz</label>
                            <select value={ed.sale_currency ?? item.sale_currency ?? 'TRY'}
                              onChange={e => {
                                const newCur = e.target.value;
                                const oldCur = ed.sale_currency ?? item.sale_currency ?? 'TRY';
                                const oldPrice = parseFloat(ed.sale_price ?? item.sale_price) || 0;
                                const converted = oldPrice > 0 ? fxConvert(oldPrice, oldCur, newCur) : 0;
                                setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), sale_currency: newCur, sale_price: converted ? converted.toFixed(2) : '0'}}));
                              }}
                              className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg outline-none mt-0.5"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              {['TRY','USD','EUR','GBP'].map(cu => <option key={cu} value={cu}>{cu}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Hızlı Düzenle: kaldırıldı, sticky bar üste taşındı */}

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

      {/* ── Detay Yan Paneli ── */}
      <AnimatePresence>
        {detailItem && (
          <ItemDetailPanel
            item={detailItem}
            allMaterials={rawItems}
            c={c}
            currentColor={currentColor}
            isDark={isDark}
            onClose={() => setDetailItem(null)}
            onEdit={(it) => { setDetailItem(null); openForm(it, it.item_type); }}
            onRefresh={(updated) => { setDetailItem(updated); pageCache.invalidate('stock_items'); refetch(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Toplu Güncelle Modalı ── */}
      <AnimatePresence>
        {bulkModal && (
          <BulkUpdateModal
            allItems={[...rawItems, ...productItems]}
            c={c}
            currentColor={currentColor}
            isDark={isDark}
            supabase={supabase}
            onClose={() => setBulkModal(false)}
            onDone={() => { setBulkModal(false); refetch(); showToast('Toplu güncelleme tamamlandı ✓'); }}
          />
        )}
      </AnimatePresence>

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

// ─── Detay Yan Paneli ─────────────────────────────────────────────────────────
function ItemDetailPanel({ item, allMaterials, c, currentColor, isDark, onClose, onEdit, onRefresh }) {
  const { convert } = useFxRates();
  const clr = stockColor(item.stock_count, item.critical_limit);
  const sym = CURRENCY_SYM[item.base_currency] || '₺';
  const saleSym = CURRENCY_SYM[item.sale_currency] || '₺';
  const [tab, setTab] = React.useState('detail');
  const [movements, setMovements] = React.useState([]);
  const [mvLoading, setMvLoading] = React.useState(false);
  const [saleOrderMap, setSaleOrderMap] = React.useState({});  // source_id -> { unit_price, quantity, order_number }
  const [recipes, setRecipes] = React.useState([]);
  const [recipeStocks, setRecipeStocks] = React.useState([]);
  const [customRecipeStocks, setCustomRecipeStocks] = React.useState([]); // özel reçeteden üretilenler
  const [rcpLoading, setRcpLoading] = React.useState(false);
  const isProduct = item.item_type === 'product';

  const [qe, setQe] = React.useState(false);
  const [qeForm, setQeForm] = React.useState({});
  const [qeSaving, setQeSaving] = React.useState(false);
  const [qeError, setQeError] = React.useState('');
  const [imgModalOpen, setImgModalOpen] = React.useState(false);
  const [fullImg, setFullImg] = React.useState(null);

  // Fiyat geçmişi
  const [priceHistory, setPriceHistory] = React.useState([]);
  const [phLoading, setPhLoading] = React.useState(false);

  const startQuickEdit = () => {
    setQeForm({
      stock_count: item.stock_count ?? 0,
      purchase_price: item.purchase_price ?? '',
      sale_price: item.sale_price ?? '',
      base_currency: item.base_currency || 'TRY',
      sale_currency: item.sale_currency || 'TRY',
      critical_limit: item.critical_limit ?? '',
      sku: item.sku || '',
      location: item.location || '',
      supplier_name: item.supplier_name || '',
      image_url: item.image_url || '',
    });
    setQe(true); setQeError('');
  };

  // Reçete toplam stok minimum hesapla
  const recipeMinStock = React.useMemo(() => {
    if (!isProduct) return 0;
    const baseSum = recipeStocks.reduce((s, rs) => s + (Number(rs.stock_count) || 0), 0);
    const customSum = customRecipeStocks.reduce((s, cs) => s + (Number(cs.count) || 0), 0);
    return baseSum + customSum;
  }, [recipeStocks, customRecipeStocks, isProduct]);

  const saveQuickEdit = async () => {
    setQeSaving(true); setQeError('');
    try {
      const oldStock = Number(item.stock_count) || 0;
      const newStock = Number(qeForm.stock_count) || 0;
      const delta = newStock - oldStock;

      // Reçeteli ürünlerde minimum stok kontrolü
      if (isProduct && recipeMinStock > 0 && newStock < recipeMinStock) {
        setQeError(`Minimum ${recipeMinStock} olabilir (reçete stokları toplamı). Reçeteler sekmesinden düşürebilirsiniz.`);
        setQeSaving(false); return;
      }

      const oldPurchase = Number(item.purchase_price) || 0;
      const newPurchase = Number(qeForm.purchase_price) || 0;
      const oldSale = Number(item.sale_price) || 0;
      const newSale = Number(qeForm.sale_price) || 0;

      const patch = {
        sale_price: newSale,
        critical_limit: Number(qeForm.critical_limit) || 0,
        sku: qeForm.sku?.trim() || null,
        location: qeForm.location?.trim() || null,
        supplier_name: qeForm.supplier_name?.trim() || null,
        base_currency: qeForm.base_currency || 'TRY',
        sale_currency: qeForm.sale_currency || 'TRY',
        image_url: qeForm.image_url || null,
      };
      // Reçeteli ürünlerde alış fiyatı değiştirilemez
      if (!isProduct || recipes.length === 0) {
        patch.purchase_price = newPurchase;
      }

      if (delta !== 0) {
        if (delta > 0) {
          const { error: rpcErr } = await supabase.rpc('increment_stock', { p_item_id: item.id, p_qty: delta, p_source: 'manual', p_note: 'Hızlı düzenleme', p_source_id: null, p_recipe_id: null, p_custom_recipe: null });
          if (rpcErr) throw new Error(`Stok artırılamadı: ${rpcErr.message}`);
        } else {
          const { error: rpcErr } = await supabase.rpc('decrement_stock', { p_item_id: item.id, p_qty: Math.abs(delta), p_source: 'manual', p_note: 'Hızlı düzenleme', p_source_id: null, p_recipe_id: null, p_custom_recipe: null });
          if (rpcErr) throw new Error(`Stok azaltılamadı: ${rpcErr.message}`);
        }
      }

      const { error: updErr } = await supabase.from('items').update(patch).eq('id', item.id);
      if (updErr) throw new Error(`Kayıt güncellenemedi: ${updErr.message}`);

      // Fiyat değişikliği varsa stock_movements'a kaydet
      if (oldPurchase !== newPurchase && (!isProduct || recipes.length === 0)) {
        await supabase.from('stock_movements').insert({
          item_id: item.id, delta: 0, quantity_before: oldStock, quantity_after: oldStock,
          source: 'manual', note: `Alış fiyatı: ${sym}${oldPurchase} → ${sym}${newPurchase}`,
          type: 'manual',
        });
      }
      if (oldSale !== newSale) {
        await supabase.from('stock_movements').insert({
          item_id: item.id, delta: 0, quantity_before: oldStock, quantity_after: oldStock,
          source: 'manual', note: `Satış fiyatı: ₺${oldSale} → ₺${newSale}`,
          type: 'manual',
        });
      }

      setQe(false); setQeSaving(false);
      pageCache.invalidate('stock_items');
      onRefresh?.({ ...item, ...patch, stock_count: newStock, purchase_price: patch.purchase_price ?? item.purchase_price });
    } catch (e) {
      console.error('[saveQuickEdit] Error:', e);
      setQeError(e.message || 'Kaydetme sırasında bir hata oluştu');
      setQeSaving(false);
    }
  };

  // ── Reçete stok düzenleme (sadece azaltma) ──
  const [editingRecipeStock, setEditingRecipeStock] = React.useState(null);
  const [rcpStockInput, setRcpStockInput] = React.useState('');
  const saveRecipeStock = async (type, id, oldCount, newCount) => {
    const diff = newCount - oldCount;
    if (diff === 0) { setEditingRecipeStock(null); return; }
    if (type === 'base') {
      await supabase.from('product_recipe_stock').update({ stock_count: newCount, updated_at: new Date().toISOString() }).eq('recipe_id', id);
    }
    // Toplam stok güncelle
    if (diff > 0) await supabase.rpc('increment_stock', { p_item_id: item.id, p_qty: diff, p_source: 'manual', p_note: 'Reçete stok düzenleme', p_source_id: null, p_recipe_id: null, p_custom_recipe: null });
    else await supabase.rpc('decrement_stock', { p_item_id: item.id, p_qty: Math.abs(diff), p_source: 'manual', p_note: 'Reçete stok düzenleme', p_source_id: null, p_recipe_id: null, p_custom_recipe: null });
    pageCache.invalidate('stock_items');
    setEditingRecipeStock(null);
    setTab(''); setTimeout(() => setTab('recipes'), 50);
  };
  const deleteCustomRecipeStock = async (cs) => {
    if (!confirm(`Bu özel reçete stoğunu silmek istediğinize emin misiniz? (${cs.count} adet)`)) return;
    if (cs.count > 0) await supabase.rpc('decrement_stock', { p_item_id: item.id, p_qty: cs.count, p_source: 'manual', p_note: 'Özel reçete stoğu silindi', p_source_id: null, p_recipe_id: null, p_custom_recipe: null });
    for (const mv of cs.movements) await supabase.from('stock_movements').delete().eq('id', mv.id);
    pageCache.invalidate('stock_items');
    setTab(''); setTimeout(() => setTab('recipes'), 50);
  };

  React.useEffect(() => {
    // Reçeteleri her zaman yükle (geçmişte de lazım)
    if (isProduct && recipes.length === 0) {
      supabase.from('product_recipes')
        .select('id, name, tags, other_costs, recipe_items(id, item_id, item_name, quantity, unit, item:item_id(base_currency, purchase_price))')
        .eq('product_id', item.id).order('name')
        .then(({ data }) => setRecipes(data || []));
    }
    if (tab === 'history') {
      setMvLoading(true);
      supabase
        .from('stock_movements')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false })
        .limit(60)
        .then(async ({ data }) => {
          const mvs = data || [];
          setMovements(mvs);
          // Satış hareketlerinin sipariş detaylarını çek
          const saleIds = [...new Set(mvs.filter(m => m.source === 'sale' && m.source_id).map(m => m.source_id))];
          if (saleIds.length > 0) {
            const map = {};
            // order_items'tan ilgili kalemin fiyatını çek
            const { data: oiData } = await supabase.from('order_items').select('order_id, item_id, unit_price, quantity').in('order_id', saleIds).eq('item_id', item.id);
            // orders'tan order_number çek
            const { data: ordData } = await supabase.from('orders').select('id, order_number, currency').in('id', saleIds);
            (oiData || []).forEach(oi => {
              const ord = (ordData || []).find(o => o.id === oi.order_id);
              map[oi.order_id] = { unit_price: oi.unit_price, quantity: oi.quantity, order_number: ord?.order_number, currency: ord?.currency };
            });
            setSaleOrderMap(map);
          }
          setMvLoading(false);
        });
    }
    if (tab === 'recipes' && isProduct) {
      setRcpLoading(true);
      Promise.all([
        supabase.from('product_recipe_stock').select('*').eq('product_id', item.id),
        // Özel reçete ile üretilenleri stock_movements'tan çek (tüm hareketler — net stok hesabı için)
        supabase.from('stock_movements')
          .select('*')
          .eq('item_id', item.id)
          .not('custom_recipe_data', 'is', null)
          .order('created_at', { ascending: false }),
      ]).then(([sRes, mvRes]) => {
        setRecipeStocks(sRes.data || []);
        // Özel reçeteleri grupla (custom_recipe_data JSON hash'ine göre)
        const customMap = {};
        (mvRes.data || []).forEach(mv => {
          let crd = mv.custom_recipe_data;
          if (typeof crd === 'string') try { crd = JSON.parse(crd); } catch(_) { crd = null; }
          if (!crd || !Array.isArray(crd) || crd.length === 0) return;
          const key = JSON.stringify(crd.map(c => `${c.item_name}:${c.quantity}`).sort());
          if (!customMap[key]) {
            customMap[key] = { items: crd, recipe_id: mv.recipe_id, count: 0, movements: [], created_at: mv.created_at };
          }
          // delta zaten işaretli: + üretim, - satış
          customMap[key].count += Number(mv.delta) || 0;
          customMap[key].movements.push(mv);
        });
        setCustomRecipeStocks(Object.values(customMap).filter(c => c.count > 0));
        setRcpLoading(false);
      });
    }
    if (tab === 'prices') {
      setPhLoading(true);
      supabase.from('stock_movements').select('*').eq('item_id', item.id)
        .or('delta.eq.0,note.ilike.%fiyat%')
        .order('created_at', { ascending: false }).limit(100)
        .then(({ data }) => {
          // Fiyat değişikliklerini filtrele
          const priceChanges = (data || []).filter(mv =>
            mv.note && (mv.note.includes('fiyat') || mv.note.includes('Fiyat'))
          );
          setPriceHistory(priceChanges);
          setPhLoading(false);
        });
    }
  }, [tab, item.id]);

  const srcIcon = (src) => {
    if (src === 'work_order' || src === 'production' || src === 'production_raw') return <Wrench size={11} />;
    if (src === 'sale')       return <ShoppingCart size={11} />;
    if (src?.startsWith('invoice')) return <FileText size={11} />;
    return <Package size={11} />;
  };
  const srcLabel = (src) => ({
    work_order: 'İş Emri', production: 'İş Emri (Üretim)', production_raw: 'İş Emri (Hammadde)',
    sale: 'Satış', invoice_in: 'Fatura Girişi', invoice_out: 'Fatura Çıkışı',
    invoice: 'Fatura', manual: 'Manuel', 'toplu güncelleme': 'Toplu Güncelleme',
  })[src] || src || 'Manuel';

  // Ortalama maliyet hesapla (reçeteli ürünlerde)
  const avgCost = React.useMemo(() => {
    if (!isProduct || recipes.length === 0) return null;
    let totalCostInBase = 0; let totalCount = 0;
    recipes.forEach(r => {
      const costInBase = (r.recipe_items || []).reduce((s, ri) => {
        const itemVal = Number(ri.item?.purchase_price || 0) * Number(ri.quantity || 1);
        const itemCur = ri.item?.base_currency || 'TRY';
        // Convert item cost to product's base_currency
        return s + convert(itemVal, itemCur, item.base_currency || 'TRY');
      }, 0);
      const rs = recipeStocks.find(rs2 => rs2.recipe_id === r.id);
      const stk = rs?.stock_count || 0;
      if (stk > 0) { totalCostInBase += costInBase * stk; totalCount += stk; }
      else { totalCostInBase += costInBase; totalCount += 1; } // Ağırlıksız (stok yoksa birim olarak al)
    });
    return totalCount > 0 ? (totalCostInBase / totalCount).toFixed(2) : null;
  }, [recipes, recipeStocks, isProduct, convert, item.base_currency]);

  const getMultiCurLabel = (val, cur) => {
    if (!val || val <= 0) return '—';
    const isUsd = cur === 'USD';
    const isTry = cur === 'TRY';
    const isEur = cur === 'EUR';
    const kurUsd = convert(1, 'USD', 'TRY').toFixed(2);
    const kurEur = convert(1, 'EUR', 'TRY').toFixed(2);
    if (isTry) {
      const usdVal = convert(val, 'TRY', 'USD').toFixed(2);
      return `₺${val} ($${usdVal} | Dolar:${kurUsd})`;
    } else if (isUsd) {
      const tryVal = convert(val, 'USD', 'TRY').toFixed(2);
      return `$${val} (₺${tryVal} | Kur:${kurUsd})`;
    } else if (isEur) {
      const tryVal = convert(val, 'EUR', 'TRY').toFixed(2);
      return `€${val} (₺${tryVal} | Kur:${kurEur})`;
    }
    return `${val} ${cur}`;
  };

  const hasRecipes = isProduct && recipes.length > 0;
  const rows = [
    { icon: Tag,           label: 'Tür',           value: item.item_type === 'product' ? 'Mamül Ürün' : 'Hammadde' },
    { icon: Hash,          label: 'SKU',            value: item.sku || '—', field: 'sku' },
    { icon: Ruler,         label: 'Birim',          value: item.unit },
    { icon: Boxes,         label: 'Stok',           value: `${item.stock_count} ${item.unit}`, color: clr, field: 'stock_count', suffix: item.unit, numField: true },
    { icon: AlertTriangle, label: 'Kritik Limit',   value: item.critical_limit > 0 ? `${item.critical_limit} ${item.unit}` : '—', field: 'critical_limit', suffix: item.unit, numField: true },
    hasRecipes ? { icon: DollarSign, label: 'Ort. Maliyet', value: avgCost ? getMultiCurLabel(avgCost, item.base_currency || 'TRY') : '—', color: '#94a3b8', disabled: true } : null,
    { icon: DollarSign, label: 'Alış Fiyatı',  value: item.purchase_price > 0 ? getMultiCurLabel(item.purchase_price, item.base_currency || 'TRY') : '—', color: '#10b981', field: 'purchase_price', prefix: sym, numField: true },
    { icon: DollarSign,    label: 'Satış Fiyatı',   value: item.sale_price > 0 ? getMultiCurLabel(item.sale_price, item.sale_currency || 'TRY') : '—', color: '#3b82f6', field: 'sale_price', prefix: saleSym, numField: true },
    { icon: MapPin,        label: 'Konum',          value: item.location || '—', field: 'location' },
    { icon: Package,       label: 'Tedarikçi',      value: item.supplier_name || '—', field: 'supplier_name' },
  ].filter(Boolean);
  const inputStyle = { background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`, color: c.text, borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600, textAlign: 'right', width: 110, outline: 'none' };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
        className="relative w-full max-w-sm h-full overflow-hidden flex flex-col shadow-2xl"
        style={{ background: isDark ? '#0b1729' : '#f8fafc', borderLeft: `1px solid ${c.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${c.border}`, background: `${currentColor}06` }}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
              {item.item_type === 'product' ? 'Mamül Detayı' : 'Hammadde Detayı'}
            </p>
            <h3 className="text-sm font-bold mt-0.5 truncate" style={{ color: c.text }}>{item.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onClose} className="p-2 rounded-xl" style={{ color: c.muted }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Stok durumu büyük gösterge */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div className="flex items-end gap-3">
            <div 
              onClick={() => item.image_url ? setFullImg(item.image_url) : null}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden ${item.image_url ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              title={item.image_url ? 'Tam boyutu gör' : ''}
              style={{ background: `${clr}15`, border: 'none' }}>
              {item.image_url ? (
                <img src={item.image_url} alt="Ürün" className="w-full h-full object-cover" />
              ) : (
                <Package size={22} style={{ color: clr }}/>
              )}
            </div>
            <div>
              <p className="text-2xl font-black" style={{ color: clr }}>{item.stock_count}</p>
              <p className="text-[10px] font-semibold" style={{ color: c.muted }}>{item.unit} stokta</p>
            </div>
          </div>
          {item.critical_limit > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span style={{ color: c.muted }}>Kapasite</span>
                <span style={{ color: clr }}>{item.stock_count} / {item.critical_limit * 3}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: c.border }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, (item.stock_count / (item.critical_limit * 3)) * 100)}%`,
                  background: clr,
                }}/>
              </div>
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
          {[
            { id: 'detail', label: 'Detay', icon: Package },
            ...(isProduct ? [{ id: 'recipes', label: 'Reçeteler', icon: FlaskConical }] : []),
            { id: 'history', label: 'Geçmiş', icon: Clock },
            { id: 'prices', label: 'Fiyat', icon: DollarSign },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: tab === t.id ? currentColor : 'transparent', color: tab === t.id ? '#fff' : c.muted }}>
              <t.icon size={11}/>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'detail' && (
            <>
              <div className="px-5 py-3 space-y-1">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 gap-2"
                    style={{ borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none' }}>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <r.icon size={12} style={{ color: c.muted, flexShrink: 0 }}/>
                      <span className="text-xs font-semibold whitespace-nowrap" style={{ color: c.muted }}>{r.label}</span>
                    </div>
                    <span className="text-xs font-bold text-right ml-2" style={{ color: r.color || c.text, maxWidth: '55%', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
              {(item.category || item.notes) && (
                <div className="px-5 py-3 space-y-2" style={{ borderTop: `1px solid ${c.border}` }}>
                  {item.category && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: c.muted }}>Kategori</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: `${currentColor}15`, color: currentColor }}>{item.category}</span>
                    </div>
                  )}
                  {item.notes && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: c.muted }}>Notlar</p>
                      <p className="text-xs leading-relaxed" style={{ color: c.text }}>{item.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'history' && (
            <div className="px-4 py-3 space-y-2">
              {mvLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCcw size={20} className="animate-spin" style={{ color: currentColor }}/>
                </div>
              )}
              {!mvLoading && movements.length === 0 && (
                <div className="text-center py-12">
                  <Clock size={32} className="mx-auto mb-2 opacity-20" style={{ color: c.muted }}/>
                  <p className="text-xs" style={{ color: c.muted }}>Henüz stok hareketi yok</p>
                </div>
              )}
              {!mvLoading && movements.map((mv, i) => {
                const isIn = mv.delta > 0;
                const dt = new Date(mv.created_at);
                const dateStr = dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
                const timeStr = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={mv.id || i} className="flex items-start gap-3 rounded-xl p-3"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(148,163,184,0.08)': '#e2e8f0'}` }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: isIn ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
                      {isIn
                        ? <ArrowUpCircle size={14} style={{ color: '#10b981' }}/>
                        : <ArrowDownCircle size={14} style={{ color: '#ef4444' }}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold" style={{ color: isIn ? '#10b981' : '#ef4444' }}>
                          {isIn ? '+' : ''}{mv.delta} {item.unit}
                        </span>
                        <span className="text-[10px] flex-shrink-0" style={{ color: c.muted }}>{dateStr} {timeStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span style={{ color: c.muted }}>{srcIcon(mv.source)}</span>
                        <span className="text-[10px] font-semibold" style={{ color: c.muted }}>{srcLabel(mv.source)}</span>
                        {/* Reçete bilgisi */}
                        {mv.recipe_id && (() => {
                          const rcp = recipes.find(r => r.id === mv.recipe_id);
                          const hasCustom = mv.custom_recipe_data;
                          return (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: hasCustom ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)', color: hasCustom ? '#f59e0b' : '#a78bfa' }}>
                              {hasCustom ? '🔧' : '📋'} {rcp?.name || 'Reçete'}
                            </span>
                          );
                        })()}
                        {mv.quantity_after != null && (
                          <span className="text-[10px] ml-auto" style={{ color: c.muted }}>→ {mv.quantity_after} {item.unit}</span>
                        )}
                      </div>
                      {mv.note && (
                        <p className="text-[10px] mt-1 truncate" style={{ color: c.muted }}>{mv.note}</p>
                      )}
                      {/* Satış hareketlerinde fiyat bilgisi */}
                      {mv.source === 'sale' && (() => {
                        const saleInfo = saleOrderMap[mv.source_id];
                        const unitPrice = saleInfo?.unit_price ?? item.sale_price;
                        const saleCurSym = CURRENCY_SYM[saleInfo?.currency] || '₺';
                        const absQty = Math.abs(mv.delta);
                        return (
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 px-2 py-1.5 rounded-lg" style={{ background: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)' }}>
                            {unitPrice > 0 && (
                              <span className="text-[9px] font-bold" style={{ color: '#3b82f6' }}>
                                💰 Satış: {saleCurSym}{(unitPrice * absQty).toFixed(2)} ({absQty}×{saleCurSym}{unitPrice})
                              </span>
                            )}
                            {saleInfo?.order_number && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                                #{saleInfo.order_number}
                              </span>
                            )}
                            {avgCost && (
                              <span className="text-[9px] font-bold" style={{ color: '#94a3b8' }}>
                                📦 Maliyet: {sym}{(Number(avgCost) * absQty).toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {mv.custom_recipe_data && (() => {
                        let crd = mv.custom_recipe_data;
                        if (typeof crd === 'string') try { crd = JSON.parse(crd); } catch(_) { crd = null; }
                        if (!Array.isArray(crd) || crd.length === 0) return null;
                        return (
                          <div className="mt-1.5 px-2 py-1.5 rounded-lg" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                            <p className="text-[9px] font-bold" style={{ color:'#f59e0b' }}>🔧 Özel Reçete ({crd.length} malzeme)</p>
                            {crd.map((ri,j) => (
                              <p key={j} className="text-[9px]" style={{ color: c.muted }}>• {ri.item_name} — {ri.quantity} {ri.unit}</p>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reçeteler tab — sadece mamül ürünlerde */}
          {tab === 'recipes' && isProduct && (
            <div className="px-4 py-3 space-y-3">
              {rcpLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCcw size={20} className="animate-spin" style={{ color: currentColor }}/>
                </div>
              )}
              {!rcpLoading && recipes.length === 0 && customRecipeStocks.length === 0 && (
                <div className="text-center py-12">
                  <FlaskConical size={32} className="mx-auto mb-2 opacity-20" style={{ color: c.muted }}/>
                  <p className="text-xs" style={{ color: c.muted }}>Henüz reçete tanımlanmamış</p>
                </div>
              )}
              {!rcpLoading && recipes.map(r => {
                const rs = recipeStocks.find(s => s.recipe_id === r.id);
                const stk = rs?.stock_count || 0;
                return (
                  <div key={r.id} className="rounded-xl overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.2)'}` }}>
                    {/* Reçete başlığı */}
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FlaskConical size={13} style={{ color: '#a78bfa', flexShrink: 0 }}/>
                        <span className="text-xs font-bold truncate" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: stk > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.06)', color: stk > 0 ? '#10b981' : c.muted }}>
                          {stk > 0 ? `${stk} stokta` : '0 stok'}
                        </span>
                        {r.tags && r.tags.length > 0 && r.tags.map((t, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full"
                            style={{ background: `${currentColor}15`, color: currentColor }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    {/* Malzemeler */}
                    <div className="px-3 pb-2.5 space-y-0.5" style={{ borderTop: '1px solid rgba(139,92,246,0.1)' }}>
                      {(r.recipe_items || []).map((ri, j) => {
                        const riSym = CURRENCY_SYM[ri.item?.base_currency || 'TRY'] || '₺';
                        return (
                          <div key={j} className="flex items-center justify-between text-[10px] py-0.5" style={{ color: c.muted }}>
                            <span className="flex-1 truncate pr-2">• {ri.item_name} <span className="opacity-50">({riSym}{ri.item?.purchase_price || 0})</span></span>
                            <span className="font-bold flex-shrink-0">{ri.quantity} {ri.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Giderler */}
                    {r.other_costs && r.other_costs.length > 0 && (
                      <div className="px-3 pb-2.5 space-y-0.5" style={{ borderTop: '1px solid rgba(245,158,11,0.1)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest pt-1" style={{ color: '#f59e0b' }}>Diğer Giderler</p>
                        {r.other_costs.map((oc, j) => (
                          <div key={'oc'+j} className="flex items-center justify-between text-[10px] py-0.5" style={{ color: '#f59e0b' }}>
                            <span className="flex-1 truncate pr-2">
                              • {oc.type || oc.item_name}
                              <span className="opacity-60 ml-1">
                                ({CURRENCY_SYM[oc.currency || 'TRY'] || '₺'}{oc.amount || 0})
                              </span>
                            </span>
                            <span className="font-bold flex-shrink-0">{oc.quantity || 1} {oc.unit || 'Adet'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      let costInBase = (r.recipe_items || []).reduce((s, ri) => {
                        const itemVal = Number(ri.item?.purchase_price || 0) * Number(ri.quantity || 1);
                        return s + convert(itemVal, ri.item?.base_currency || 'TRY', item.base_currency || 'TRY');
                      }, 0);
                      costInBase += (r.other_costs || []).reduce((s, oc) => {
                        return s + convert(Number(oc.amount) || 0, oc.currency || 'TRY', item.base_currency || 'TRY');
                      }, 0);
                      return costInBase > 0 ? (
                        <div className="px-3 pb-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(139,92,246,0.06)' }}>
                          <span className="text-[9px] font-bold" style={{ color: '#94a3b8' }}>Birim Maliyet ({sym})</span>
                          <span className="text-[10px] font-black flex items-center gap-1" style={{ color: '#a78bfa' }}>
                            {sym}{costInBase.toFixed(2)}
                            {r.other_costs?.length > 0 && <span className="text-[8px] opacity-70">(giderler dahil)</span>}
                          </span>
                        </div>
                      ) : null;
                    })()}
                    {/* Reçete Yazdır */}
                    <div className="px-3 pb-2.5 pt-1" style={{ borderTop: '1px solid rgba(139,92,246,0.06)' }}>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        const baseCur = item.base_currency || 'TRY';
                        const baseSym = CURRENCY_SYM[baseCur] || '₺';
                        const convertedIngredients = (r.recipe_items || []).map(ri => {
                          const rawCost = Number(ri.item?.purchase_price || 0);
                          const riCur = ri.item?.base_currency || 'TRY';
                          const convertedUnitCost = convert(rawCost, riCur, baseCur);
                          return {
                            item_name: ri.item_name,
                            quantity: ri.quantity,
                            unit: ri.unit || 'Adet',
                            unit_cost: convertedUnitCost,
                            total_cost: convertedUnitCost * Number(ri.quantity || 1),
                            currency_sym: baseSym,
                          };
                        });
                        
                        // Diğer Giderler varsa reçete yazdırmaya dahil et
                        (r.other_costs || []).forEach(oc => {
                           const costConverted = convert(Number(oc.amount) || 0, oc.currency || 'TRY', baseCur);
                           convertedIngredients.push({
                             item_name: oc.type,
                             quantity: 1,
                             unit: 'Adet',
                             unit_cost: costConverted,
                             total_cost: costConverted,
                             currency_sym: baseSym,
                           });
                        });
                        
                        const totalCost = convertedIngredients.reduce((s, ci) => s + ci.total_cost, 0);
                        printDocument('recipe', {
                          product_name: item.name,
                          recipe_name: r.name,
                          tags: (r.tags || []).join(', '),
                          currency_sym: baseSym,
                          ingredients: convertedIngredients,
                          total_cost: totalCost,
                        }, `Reçete - ${item.name} (${r.name})`);
                      }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        style={{ background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.15)' }}>
                        <Printer size={10}/> Reçete Yazdır
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Özel reçete stokları (stock_movements'tan hesaplanan) */}
              {!rcpLoading && customRecipeStocks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest px-1 pt-2" style={{ color: '#f59e0b' }}>
                    🔧 Özel Reçeteler (Geçici)
                  </p>
                  {customRecipeStocks.map((cs, idx) => {
                    const baseRecipe = recipes.find(r => r.id === cs.recipe_id);
                    return (
                      <div key={idx} className="rounded-xl overflow-hidden"
                        style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <FlaskConical size={13} style={{ color: '#f59e0b', flexShrink: 0 }}/>
                            <span className="text-xs font-bold truncate" style={{ color: '#f59e0b' }}>
                              {baseRecipe ? `${baseRecipe.name} (Özel)` : 'Özel Reçete'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                              {cs.count} stokta
                            </span>
                            <button onClick={() => deleteCustomRecipeStock(cs)}
                              className="p-1 rounded-lg transition-all hover:scale-110"
                              style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                              title="Özel reçete stoğunu sil">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        </div>
                        <div className="px-3 pb-2.5 space-y-0.5" style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}>
                          {/* Malzemeler */}
                          {(cs.items || []).map((ri, j) => {
                            if (ri._isOtherCost) return null;
                            return (
                              <div key={j} className="flex items-center justify-between text-[10px] py-0.5" style={{ color: c.muted }}>
                                <span className="flex-1 truncate pr-2">
                                  • {ri.item_name}
                                  <span className="opacity-50 ml-1">
                                    ({CURRENCY_SYM[ri.base_currency || 'TRY'] || '₺'}{ri.purchase_price || 0})
                                  </span>
                                </span>
                                <span className="font-bold flex-shrink-0">{ri.quantity} {ri.unit}</span>
                              </div>
                            );
                          })}
                          {/* Giderler */}
                          {(cs.items || []).some(ri => ri._isOtherCost) && (
                            <>
                              <div className="pt-2 pb-1 mt-2 border-t border-amber-500/20">
                                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Diğer Giderler</p>
                              </div>
                              {(cs.items || []).filter(ri => ri._isOtherCost).map((oc, j) => (
                                <div key={'occ'+j} className="flex items-center justify-between text-[10px] py-0.5" style={{ color: '#f59e0b' }}>
                                  <span className="flex-1 truncate pr-2 font-bold">
                                    • {oc.item_name}
                                    <span className="opacity-60 ml-1">
                                      ({CURRENCY_SYM[oc.base_currency || 'TRY'] || '₺'}{oc.purchase_price || 0})
                                    </span>
                                  </span>
                                  <span className="font-bold flex-shrink-0">{oc.quantity || 1} {oc.unit || 'Adet'}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Bağımsız reçeteler (product_recipe_stock'ta recipe_id product_recipes'ta yok) */}
              {!rcpLoading && recipeStocks.filter(s => s.stock_count > 0 && !recipes.find(r => r.id === s.recipe_id)).map(s => (
                <div key={s.id} className="rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlaskConical size={12} style={{ color: '#f59e0b' }}/>
                      <span className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>Bilinmeyen Reçete</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                      {s.stock_count} stokta
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fiyat Geçmişi tab */}
          {tab === 'prices' && (
            <div className="px-4 py-3 space-y-2">
              {phLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCcw size={20} className="animate-spin" style={{ color: currentColor }}/>
                </div>
              )}
              {!phLoading && priceHistory.length === 0 && (
                <div className="text-center py-12">
                  <DollarSign size={32} className="mx-auto mb-2 opacity-20" style={{ color: c.muted }}/>
                  <p className="text-xs" style={{ color: c.muted }}>Henüz fiyat değişikliği yok</p>
                </div>
              )}
              {!phLoading && priceHistory.map((ph, i) => {
                const dt = new Date(ph.created_at);
                const dateStr = dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
                const timeStr = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                const isAlis = ph.note?.includes('Alış');
                return (
                  <div key={ph.id || i} className="flex items-start gap-3 rounded-xl p-3"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}` }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: isAlis ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)' }}>
                      <DollarSign size={14} style={{ color: isAlis ? '#10b981' : '#3b82f6' }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold" style={{ color: isAlis ? '#10b981' : '#3b82f6' }}>
                          {isAlis ? 'Alış Fiyatı' : 'Satış Fiyatı'}
                        </span>
                        <span className="text-[10px] flex-shrink-0" style={{ color: c.muted }}>{dateStr} {timeStr}</span>
                      </div>
                      <p className="text-[11px] font-semibold mt-1" style={{ color: c.text }}>{ph.note}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span style={{ color: c.muted }}>{srcIcon(ph.source)}</span>
                        <span className="text-[10px] font-semibold" style={{ color: c.muted }}>{srcLabel(ph.source)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Edit Error */}
        {qeError && (
          <div className="px-5 py-2 flex-shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <p className="text-[11px] font-semibold text-center" style={{ color: '#ef4444' }}>⚠️ {qeError}</p>
          </div>
        )}

        {/* Alt butonlar */}
        <div className="px-5 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
          <button onClick={() => onEdit(item)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: currentColor }}>
            <Edit2 size={14}/> Düzenle
          </button>
        </div>

        {imgModalOpen && (
          <MediaPickerModal
            isOpen={true}
            onClose={() => setImgModalOpen(false)}
            onSelect={(mediaItem) => { setQeForm(f => ({ ...f, image_url: mediaItem.url || mediaItem.file_url })); setImgModalOpen(false); }}
            multiple={false}
          />
        )}

        {fullImg && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80" onClick={() => setFullImg(null)}>
            <img src={fullImg} alt="Original" className="max-w-full max-h-full rounded-lg object-contain shadow-2xl" />
            <button className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full hover:bg-black/70">
              <X size={24}/>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Toplu Güncelle Modalı ────────────────────────────────────────────────────
function BulkUpdateModal({ allItems, c, currentColor, isDark, supabase, onClose, onDone }) {
  const EMPTY = () => ({ _key: Date.now() + Math.random(), itemId: '', stock_count: '', purchase_price: '', sale_price: '', unit: '' });
  const [rows, setRows] = useState([EMPTY()]);
  const [saving, setSaving] = useState(false);
  const [searchStates, setSearchStates] = useState({});

  const addRow = () => setRows(prev => [...prev, EMPTY()]);
  const removeRow = (key) => setRows(prev => prev.filter(r => r._key !== key));

  const updateRow = (key, field, val) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));

  const selectItem = (rowKey, item) => {
    updateRow(rowKey, 'itemId', item.id);
    updateRow(rowKey, 'stock_count', String(item.stock_count ?? ''));
    updateRow(rowKey, 'purchase_price', String(item.purchase_price ?? ''));
    updateRow(rowKey, 'sale_price', String(item.sale_price ?? ''));
    updateRow(rowKey, 'unit', item.unit || 'Adet');
    updateRow(rowKey, 'base_currency', item.base_currency || 'TRY');
    updateRow(rowKey, 'sale_currency', item.sale_currency || 'TRY');
    updateRow(rowKey, '_name', item.name);
    setSearchStates(p => ({ ...p, [rowKey]: '' }));
  };

  const handleSave = async () => {
    const valid = rows.filter(r => r.itemId);
    if (!valid.length) return;
    setSaving(true);
    try {
      for (const r of valid) {
        const patch = {};
        if (r.stock_count !== '') patch.stock_count = Number(r.stock_count);
        if (r.purchase_price !== '') patch.purchase_price = Number(r.purchase_price);
        if (r.sale_price !== '') patch.sale_price = Number(r.sale_price);
        if (r.unit) patch.unit = r.unit;
        if (r.base_currency) patch.base_currency = r.base_currency;
        if (r.sale_currency) patch.sale_currency = r.sale_currency;
        if (Object.keys(patch).length > 0) {
          await supabase.from('items').update(patch).eq('id', r.itemId);
        }
      }
      onDone();
    } catch (e) {
      alert(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        style={{ background: isDark ? '#0b1729' : '#fff', border: `1px solid ${currentColor}30`, maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${c.border}`, background: `${currentColor}06` }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
              Toplu Stok Güncelleme
            </p>
            <p className="text-xs mt-0.5" style={{ color: c.muted }}>
              Birden fazla ürünü tek seferde güncelleyin
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addRow}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: `${currentColor}15`, color: currentColor }}>
              <Plus size={12}/> Satır Ekle
            </button>
            <button onClick={onClose} className="p-2 rounded-xl" style={{ color: c.muted }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Tablo */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3" style={{ overflowX: 'visible' }}>
          {rows.map((row, idx) => {
            const selectedItem = allItems.find(i => i.id === row.itemId);
            const sq = trNorm(searchStates[row._key] || '');
            const results = sq ? allItems.filter(i =>
              trNorm(i.name).includes(sq) || trNorm(i.sku || '').includes(sq)
            ).slice(0, 8) : [];

            return (
              <div key={row._key} className="rounded-xl p-3 space-y-2" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${c.border}`, overflow: 'visible', position: 'relative', zIndex: rows.length - idx }}>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    style={{ background: `${currentColor}20`, color: currentColor }}>{idx + 1}</span>

                  {/* Ürün seçimi */}
                  <div className="flex-1 relative">
                    {selectedItem ? (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: `${currentColor}10`, border: `1px solid ${currentColor}30` }}>
                        <Package size={11} style={{ color: currentColor }}/>
                        <span className="text-xs font-bold truncate" style={{ color: c.text }}>{selectedItem.name}</span>
                        <button onClick={() => updateRow(row._key, 'itemId', '')}
                          className="ml-auto p-0.5 rounded" style={{ color: c.muted }}>
                          <X size={10}/>
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          value={searchStates[row._key] || ''}
                          onChange={e => setSearchStates(p => ({ ...p, [row._key]: e.target.value }))}
                          placeholder="Ürün / hammadde ara..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                          style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}/>
                        {results.length > 0 && (() => {
                          // Dropdown'u portal ile body'e render et (overflow clip sorunu)
                          const inputEl = document.activeElement;
                          const rect = inputEl?.getBoundingClientRect?.() || {};
                          return createPortal(
                            <div
                              style={{
                                position: 'fixed',
                                top: (rect.bottom || 0) + 4,
                                left: rect.left || 0,
                                width: rect.width || 280,
                                zIndex: 9999,
                                background: isDark ? '#0f1e36' : '#fff',
                                border: `1px solid ${c.border}`,
                                borderRadius: 12,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                                maxHeight: 220,
                                overflowY: 'auto',
                              }}
                            >
                              {results.map(item => (
                                <button key={item.id} onClick={() => selectItem(row._key, item)}
                                  className="w-full text-left px-3 py-2.5 text-xs transition-colors"
                                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  style={{ borderBottom: `1px solid ${c.border}`, color: c.text }}>
                                  <span className="font-semibold">{item.name}</span>
                                  <span className="ml-2 text-[10px]" style={{ color: c.muted }}>{item.unit} · Stok: {item.stock_count ?? '—'}</span>
                                </button>
                              ))}
                            </div>,
                            document.body
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row._key)}
                      className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}>
                      <Trash2 size={12}/>
                    </button>
                  )}
                </div>

                {/* Alanlar */}
                {row.itemId && (
                  <div className="grid grid-cols-6 gap-2 pl-7">
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>Stok</p>
                      <input type="number" step="0.01" value={row.stock_count}
                        onChange={e => updateRow(row._key, 'stock_count', e.target.value)}
                        className="w-full px-2 py-1 text-xs font-bold rounded-lg outline-none"
                        style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#10b981' }}/>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>Alış</p>
                      <input type="number" step="0.01" value={row.purchase_price}
                        onChange={e => updateRow(row._key, 'purchase_price', e.target.value)}
                        className="w-full px-2 py-1 text-xs font-bold rounded-lg outline-none"
                        style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#f59e0b' }}/>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>Satış</p>
                      <input type="number" step="0.01" value={row.sale_price}
                        onChange={e => updateRow(row._key, 'sale_price', e.target.value)}
                        className="w-full px-2 py-1 text-xs font-bold rounded-lg outline-none"
                        style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#3b82f6' }}/>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>Birim</p>
                      <select value={row.unit}
                        onChange={e => updateRow(row._key, 'unit', e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded-lg outline-none"
                        style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                        {['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'].map(u =>
                          <option key={u} value={u}>{u}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>A. Döviz</p>
                      <select value={row.base_currency || 'TRY'}
                        onChange={e => updateRow(row._key, 'base_currency', e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded-lg outline-none"
                        style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                        {['TRY','USD','EUR','GBP'].map(cu =>
                          <option key={cu} value={cu}>{cu}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>S. Döviz</p>
                      <select value={row.sale_currency || 'TRY'}
                        onChange={e => updateRow(row._key, 'sale_currency', e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded-lg outline-none"
                        style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                        {['TRY','USD','EUR','GBP'].map(cu =>
                          <option key={cu} value={cu}>{cu}</option>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-shrink-0"
          style={{ borderTop: `1px solid ${c.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
          <p className="text-xs" style={{ color: c.muted }}>
            {rows.filter(r => r.itemId).length} / {rows.length} satır seçili
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ color: c.muted, border: `1px solid ${c.border}` }}>
              İptal
            </button>
            <button onClick={handleSave} disabled={saving || !rows.some(r => r.itemId)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: currentColor, opacity: saving ? 0.7 : 1 }}>
              {saving ? <RefreshCcw size={14} className="animate-spin"/> : <Save size={14}/>}
              {saving ? 'Kaydediliyor...' : 'Güncelle'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Import / Export Panel ────────────────────────────────────────────────────
function ImportExportPanel({ c, currentColor, isDark, activeTab, importing, importResult, onImportFile, onExport, onTemplate, onClose }) {
  const rawRef  = React.useRef();
  const prodRef = React.useRef();

  const typeLabel = (t) => t === 'raw' ? 'Hammadde' : 'Mamül';

  const handleFile = (e, typeOverride) => {
    const file = e.target.files?.[0];
    if (file) onImportFile(file, typeOverride);
    e.target.value = '';
  };

  return (
    <div className="rounded-2xl p-5 space-y-5" style={{ background: c.card, border: `1.5px solid ${currentColor}30` }}>
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: c.text }}>İçe / Dışa Aktarım</h3>
          <p className="text-xs mt-0.5" style={{ color: c.muted }}>
            JSON ve XLSX formatlarında import/export. Şablonu indirip düzenleyerek de aktarım yapabilirsiniz.
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: c.muted }}>
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── İÇE AKTAR ── */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>
            İçe Aktar (Import)
          </p>

          {/* Hammadde import */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(245,158,11,0.15)' }}>🔩</div>
              <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>Hammadde</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => rawRef.current?.click()}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                {importing ? <RefreshCcw size={12} className="animate-spin" /> : <FileJson size={12} />}
                JSON
              </button>
              <button onClick={() => { rawRef.current.accept = '.xlsx,.xls'; rawRef.current?.click(); }}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                {importing ? <RefreshCcw size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                XLSX
              </button>
              <input ref={rawRef} type="file" accept=".json,.xlsx,.xls" className="hidden"
                onChange={e => handleFile(e, 'raw')} />
            </div>
            <button onClick={() => onTemplate('raw')}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
              style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.06)', border: '1px dashed rgba(245,158,11,0.3)' }}>
              <FolderDown size={11} />Şablon İndir (Hammadde)
            </button>
          </div>

          {/* Mamül import */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(59,130,246,0.15)' }}>⚡</div>
              <span className="text-xs font-bold" style={{ color: '#60a5fa' }}>Mamül</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => prodRef.current?.click()}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                {importing ? <RefreshCcw size={12} className="animate-spin" /> : <FileJson size={12} />}
                JSON
              </button>
              <button onClick={() => { prodRef.current.accept = '.xlsx,.xls'; prodRef.current?.click(); }}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                {importing ? <RefreshCcw size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                XLSX
              </button>
              <input ref={prodRef} type="file" accept=".json,.xlsx,.xls" className="hidden"
                onChange={e => handleFile(e, 'product')} />
            </div>
            <button onClick={() => onTemplate('product')}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
              style={{ color: '#60a5fa', background: 'rgba(59,130,246,0.06)', border: '1px dashed rgba(59,130,246,0.3)' }}>
              <FolderDown size={11} />Şablon İndir (Mamül)
            </button>
          </div>
        </div>

        {/* ── DIŞA AKTAR ── */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>
            Dışa Aktar (Export)
          </p>
          {['raw', 'product'].map(type => (
            <div key={type} className="rounded-xl p-4 space-y-2"
              style={{
                background: type === 'raw' ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)',
                border: `1px solid ${type === 'raw' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`,
              }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{type === 'raw' ? '🔩' : '⚡'}</span>
                <span className="text-xs font-bold" style={{ color: type === 'raw' ? '#f59e0b' : '#60a5fa' }}>
                  {typeLabel(type)} Dışa Aktar
                </span>
              </div>
              <div className="flex gap-2">
                {['json', 'xlsx'].map(fmt => (
                  <button key={fmt} onClick={() => onExport(fmt, type)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: type === 'raw' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
                      color: type === 'raw' ? '#f59e0b' : '#60a5fa',
                      border: `1px solid ${type === 'raw' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.25)'}`,
                    }}>
                    {fmt === 'json' ? <FileJson size={12} /> : <FileSpreadsheet size={12} />}
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Import sonucu */}
          {importResult && (
            <div className="rounded-xl p-4 space-y-2"
              style={{ background: importResult.skipped > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${importResult.skipped > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
              <div className="flex items-center gap-2">
                {importResult.skipped > 0 ? <AlertOctagon size={14} style={{ color: '#f59e0b' }} /> : <CheckCircle2 size={14} style={{ color: '#10b981' }} />}
                <span className="text-xs font-bold" style={{ color: importResult.skipped > 0 ? '#f59e0b' : '#10b981' }}>
                  Import Sonucu
                </span>
              </div>
              <p className="text-xs" style={{ color: c.muted }}>
                ✅ {importResult.added} eklendi
                {importResult.skipped > 0 && <span> · ⚠ {importResult.skipped} atlandı</span>}
              </p>
              {importResult.errors?.length > 0 && (
                <div className="space-y-1">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-[10px] text-red-400 truncate">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {importing && (
        <div className="flex items-center justify-center gap-2 py-2" style={{ color: currentColor }}>
          <RefreshCcw size={16} className="animate-spin" />
          <span className="text-xs font-semibold">İçe aktarılıyor, lütfen bekleyin...</span>
        </div>
      )}
    </div>
  );
}
