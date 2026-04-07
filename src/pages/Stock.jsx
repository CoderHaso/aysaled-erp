import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Plus, Search, AlertTriangle, RefreshCcw, AlertCircle,
  Zap, TrendingUp, Boxes, Package, ChevronUp, ChevronDown,
  Edit2, Trash2, Upload, Download, FileJson, FileSpreadsheet,
  X, CheckCircle2, AlertOctagon, FolderDown, Eye, Save,
  Layers, ArrowRight, DollarSign, Hash, MapPin, Ruler, Tag,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useStock } from '../hooks/useStock';
import { supabase } from '../lib/supabaseClient';
import ItemDrawer from '../components/stock/ItemDrawer';
import QuickAddModal from '../components/stock/QuickAddModal';

const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€' };

function stockColor(c, l) {
  if (c <= 0)          return '#ef4444';
  if (l > 0 && c <= l) return '#f59e0b';
  return '#10b981';
}

export default function Stock() {
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

  // (Eski ID açılış kodları silindi. Barkodlar bağımsız QRDetail sayfasına gider)

  const [quickAdd,      setQuickAdd]      = useState(false);
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
      (String(row['_A_ERP_Tip'] || row['Tip'] || '').toLowerCase().includes('mamül') ? 'product' : 'raw');
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
                          if (changes.unit !== undefined) patch.unit = changes.unit;
                          if (changes.stock_count !== undefined) patch.stock_count = Number(changes.stock_count);
                          if (changes.purchase_price !== undefined) patch.purchase_price = Number(changes.purchase_price);
                          if (changes.sale_price !== undefined) patch.sale_price = Number(changes.sale_price);
                          if (changes.base_currency !== undefined) patch.base_currency = changes.base_currency;
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
                      { key: null,             label: '',         w: '32px'  },
                      { key: 'sku',            label: 'SKU',      w: '90px' },
                      { key: 'name',           label: activeTab === 'raw' ? 'Hammadde' : 'Mamül' },
                      { key: 'unit',           label: 'Birim',    w: quickEditMode ? '85px' : '60px'  },
                      { key: 'stock_count',    label: 'Stok',     w: quickEditMode ? '100px' : '140px' },
                      { key: 'purchase_price', label: 'Alış',    w: quickEditMode ? '100px' : '85px'  },
                      { key: 'sale_price',     label: 'Satış',   w: quickEditMode ? '100px' : '85px' },
                      ...(quickEditMode ? [{ key: 'base_currency', label: 'Döviz', w: '75px' }] : []),
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
                    const ed = quickEdits[item.id] || {};
                    const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'];
                    return (
                      <motion.tr key={item.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.01 }}
                        style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}
                        onClick={() => !quickEditMode && setDetailItem(item)}
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
                        {/* Birim */}
                        <td className="px-3 py-3.5" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <select value={ed.unit ?? item.unit} onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), unit: e.target.value}}))}
                              className="w-full px-1.5 py-1 text-xs rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs font-bold" style={{ color: c.text }}>{item.unit}</span>
                          )}
                        </td>
                        {/* Stok */}
                        <td className="px-3 py-3.5" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="number" step="0.01"
                              value={ed.stock_count ?? item.stock_count}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), stock_count: e.target.value}}))}
                              className="w-full px-1.5 py-1 text-xs font-bold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: clr }}/>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold w-7 text-right" style={{ color: clr }}>{item.stock_count}</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[40px]" style={{ background: c.border }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                              </div>
                              {item.critical_limit > 0 && <span className="text-[10px]" style={{ color: c.muted }}>/{item.critical_limit}</span>}
                            </div>
                          )}
                        </td>
                        {/* Alış Fiyatı */}
                        <td className="px-3 py-3.5" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="number" step="0.01"
                              value={ed.purchase_price ?? item.purchase_price ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), purchase_price: e.target.value}}))}
                              placeholder="0.00"
                              className="w-full px-1.5 py-1 text-xs font-bold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#10b981' }}/>
                          ) : (
                            <span className="text-sm font-semibold" style={{ color: c.text }}>
                              {item.purchase_price > 0 ? `${sym}${item.purchase_price}` : '—'}
                            </span>
                          )}
                        </td>
                        {/* Satış Fiyatı */}
                        <td className="px-3 py-3.5" onClick={e => quickEditMode && e.stopPropagation()}>
                          {quickEditMode ? (
                            <input type="number" step="0.01"
                              value={ed.sale_price ?? item.sale_price ?? ''}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), sale_price: e.target.value}}))}
                              placeholder="0.00"
                              className="w-full px-1.5 py-1 text-xs font-bold rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: '#3b82f6' }}/>
                          ) : (
                            <span className="text-sm font-semibold" style={{ color: c.text }}>
                              {item.sale_price > 0 ? `₺${item.sale_price}` : '—'}
                            </span>
                          )}
                        </td>
                        {/* Döviz (sadece quick edit) */}
                        {quickEditMode && (
                          <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                            <select value={ed.base_currency ?? item.base_currency ?? 'TRY'}
                              onChange={e => setQuickEdits(p => ({...p, [item.id]: {...(p[item.id]||{}), base_currency: e.target.value}}))}
                              className="w-full px-1 py-1 text-xs rounded-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                              {['TRY','USD','EUR','GBP'].map(cu => <option key={cu} value={cu}>{cu}</option>)}
                            </select>
                          </td>
                        )}
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
                    onClick={() => setDetailItem(item)}
                    className="flex items-center gap-3 px-4 py-3.5 active:opacity-70 transition-opacity"
                    style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}>
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
                    </div>
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
            c={c}
            currentColor={currentColor}
            isDark={isDark}
            onClose={() => setDetailItem(null)}
            onEdit={(item) => { setDetailItem(null); openForm(item, item.item_type); }}
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
function ItemDetailPanel({ item, c, currentColor, isDark, onClose, onEdit }) {
  const clr = stockColor(item.stock_count, item.critical_limit);
  const sym = CURRENCY_SYM[item.base_currency] || '₺';

  const rows = [
    { icon: Tag,        label: 'Tür',            value: item.item_type === 'product' ? 'Mamül Ürün' : 'Hammadde' },
    { icon: Hash,       label: 'SKU',            value: item.sku || '—' },
    { icon: Ruler,      label: 'Birim',          value: item.unit },
    { icon: Boxes,      label: 'Stok',           value: `${item.stock_count} ${item.unit}`, color: clr },
    { icon: AlertTriangle, label: 'Kritik Limit', value: item.critical_limit > 0 ? `${item.critical_limit} ${item.unit}` : '—' },
    { icon: DollarSign, label: 'Alış Fiyatı',    value: item.purchase_price > 0 ? `${sym}${item.purchase_price}` : '—', color: '#10b981' },
    { icon: DollarSign, label: 'Satış Fiyatı',   value: item.sale_price > 0 ? `₺${item.sale_price}` : '—', color: '#3b82f6' },
    { icon: MapPin,     label: 'Konum',          value: item.location || '—' },
    { icon: Package,    label: 'Tedarikçi',      value: item.supplier_name || '—' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm h-full overflow-y-auto flex flex-col shadow-2xl"
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
          <button onClick={onClose} className="p-2 rounded-xl" style={{ color: c.muted }}>
            <X size={15}/>
          </button>
        </div>

        {/* Stok durumu büyük gösterge */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div className="flex items-end gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${clr}15` }}>
              <Package size={22} style={{ color: clr }}/>
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

        {/* Detay Satırları */}
        <div className="flex-1 px-5 py-3 space-y-1">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2"
              style={{ borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none' }}>
              <div className="flex items-center gap-2 min-w-0">
                <r.icon size={12} style={{ color: c.muted, flexShrink: 0 }}/>
                <span className="text-xs font-semibold" style={{ color: c.muted }}>{r.label}</span>
              </div>
              <span className="text-xs font-bold text-right truncate ml-2" style={{ color: r.color || c.text }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>

        {/* Kategori, notlar */}
        {(item.category || item.notes) && (
          <div className="px-5 py-3 space-y-2 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
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

        {/* Alt butonlar */}
        <div className="px-5 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
          <button onClick={() => onEdit(item)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: currentColor }}>
            <Edit2 size={14}/> Düzenle
          </button>
        </div>
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
            const sq = (searchStates[row._key] || '').toLowerCase();
            const results = sq ? allItems.filter(i =>
              i.name.toLowerCase().includes(sq) || (i.sku || '').toLowerCase().includes(sq)
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
                        {results.length > 0 && (
                          <div className="absolute left-0 right-0 z-[100] rounded-xl shadow-2xl"
                            style={{ background: isDark ? '#0f1e36' : '#fff', border: `1px solid ${c.border}`, maxHeight: 220, overflowY: 'auto', top: '100%', marginTop: 4 }}>
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
                          </div>
                        )}
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
                  <div className="grid grid-cols-5 gap-2 pl-7">
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
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: c.muted }}>Döviz</p>
                      <select value={row.base_currency || 'TRY'}
                        onChange={e => updateRow(row._key, 'base_currency', e.target.value)}
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
