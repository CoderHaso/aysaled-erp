import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Building2, Phone, Mail, X, Loader2, RefreshCw,
  Receipt, TrendingDown, Truck, ChevronRight, Edit3, Trash2,
  CheckCircle2, Info
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

const fmt = (n) => n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-[400] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold"
      style={{ background: type === 'error' ? '#ef4444' : '#10b981' }}>
      {msg}
    </motion.div>
  );
}

function StatusDot({ status }) {
  const colors = { Approved: '#10b981', Canceled: '#ef4444', Error: '#ef4444', Processing: '#f59e0b' };
  const col = colors[status] || '#94a3b8';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-0.5" style={{ color: col }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: col }} />
      {status || '-'}
    </span>
  );
}

// ─── Supplier Detail Drawer ────────────────────────────────────────────────────
function SupplierDrawer({ supplier, onClose, onSaved }) {
  const { currentColor } = useTheme();
  const [invoices, setInvoices]     = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [tab, setTab]               = useState('info');
  const [editing, setEditing]       = useState(false);
  const [form, setForm]             = useState({ ...supplier });
  const [saving, setSaving]         = useState(false);

  const isNew = !supplier.id;

  useEffect(() => {
    if (!supplier.vkntckn || isNew) { setLoadingInv(false); return; }
    setLoadingInv(true);
    supabase.from('invoices').select('*').eq('vkntckn', supplier.vkntckn).eq('type', 'outbox')
      .order('issue_date', { ascending: false })
      .then(({ data }) => { setInvoices(data || []); setLoadingInv(false); });
  }, [supplier.vkntckn]);

  const totalAmount = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const lastInvoice = invoices[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await supabase.from('suppliers').insert({ ...form, source: 'manual' });
      } else {
        await supabase.from('suppliers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', supplier.id);
      }
      onSaved?.();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const ACCENT = '#f97316'; // Tedarikçi için turuncu ton
  const TABS = [
    { id: 'info',    label: 'Bilgiler',    icon: Info },
    { id: 'invoices',label: `Faturalar (${invoices.length})`, icon: Receipt },
  ];

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div className="relative w-full max-w-xl h-full overflow-y-auto"
          style={{ background: '#0c1526', borderLeft: '1px solid rgba(148,163,184,0.1)' }}
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 250 }}>

          {/* Header */}
          <div className="sticky top-0 z-10 px-5 py-4"
            style={{ background: 'rgba(12,21,38,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base"
                  style={{ background: ACCENT }}>
                  {(form.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tedarikçi</p>
                  <h2 className="text-sm font-bold text-slate-100 leading-tight max-w-[220px] truncate">
                    {form.name || 'Yeni Tedarikçi'}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isNew && (
                  <button onClick={() => setEditing(v => !v)}
                    className="p-2 rounded-xl transition-colors text-slate-400 hover:text-white"
                    style={{ background: editing ? `${ACCENT}20` : 'transparent' }}>
                    <Edit3 size={15} style={{ color: editing ? ACCENT : undefined }} />
                  </button>
                )}
                <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>

            {!isNew && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: 'Gider Faturası', value: invoices.length, color: ACCENT },
                  { label: 'Toplam Gider', value: `₺${(totalAmount/1000).toFixed(1)}K`, color: '#ef4444' },
                  { label: 'Son Fatura', value: fmtD(lastInvoice?.issue_date), color: '#f59e0b' },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-2.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                    <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {!isNew && (
              <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className="flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: tab === t.id ? ACCENT : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8' }}>
                    <t.icon size={11} />{t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 space-y-3">
            {/* ── Bilgiler ── */}
            {(tab === 'info' || isNew) && (
              <div className="space-y-3">
                {[
                  { k: 'name',       l: 'Tedarikçi Adı / Unvan *', ph: 'Firma A.Ş.' },
                  { k: 'vkntckn',    l: 'VKN / TCKN',              ph: '1234567890' },
                  { k: 'tax_id',     l: 'Vergi Dairesi',           ph: 'Kadıköy VD' },
                  { k: 'phone',      l: 'Telefon',                 ph: '0212 000 00 00' },
                  { k: 'email',      l: 'E-posta',                 ph: 'info@firma.com' },
                  { k: 'address',    l: 'Adres',                   ph: 'İstanbul, Türkiye' },
                  { k: 'city',       l: 'Şehir',                   ph: 'İstanbul' },
                  { k: 'notes',      l: 'Notlar',                  ph: 'Ek bilgiler...' },
                ].map(({ k, l, ph }) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{l}</p>
                    {(editing || isNew) ? (
                      k === 'notes' ? (
                        <textarea className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9' }}
                          rows={2} placeholder={ph}
                          value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                      ) : (
                        <input className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9' }}
                          placeholder={ph} value={form[k] || ''}
                          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                      )
                    ) : (
                      <p className={`text-sm px-3 py-2 rounded-xl ${k==='vkntckn' ? 'font-mono' : ''}`}
                        style={{ background: 'rgba(255,255,255,0.03)', color: form[k] ? '#f1f5f9' : '#475569' }}>
                        {form[k] || <span className="text-slate-600 italic">—</span>}
                      </p>
                    )}
                  </div>
                ))}

                {(editing || isNew) && (
                  <div className="flex gap-2 pt-2">
                    {!isNew && (
                      <button onClick={() => { setEditing(false); setForm({ ...supplier }); }}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)' }}>
                        İptal
                      </button>
                    )}
                    <button onClick={handleSave} disabled={saving || !form.name?.trim()}
                      className="flex-1 py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                      style={{ background: ACCENT, opacity: (!form.name?.trim() || saving) ? 0.6 : 1 }}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {isNew ? 'Kaydet' : 'Güncelle'}
                    </button>
                  </div>
                )}

                {!isNew && supplier.source === 'invoice_sync' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl"
                    style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                    <Receipt size={12} style={{ color: ACCENT }} />
                    <p className="text-xs" style={{ color: ACCENT }}>Bu tedarikçi, fatura senkronizasyonundan oluşturuldu.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Faturalar ── */}
            {tab === 'invoices' && !isNew && (
              <div className="space-y-3">
                {loadingInv && (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <Loader2 size={22} className="animate-spin" style={{ color: ACCENT }} />
                    <span className="text-sm text-slate-400">Yükleniyor...</span>
                  </div>
                )}
                {!loadingInv && invoices.length === 0 && (
                  <div className="text-center py-10">
                    <Receipt size={36} className="mx-auto mb-2 opacity-20 text-slate-400" />
                    <p className="text-sm text-slate-500">Bu tedarikçiden fatura bulunamadı.</p>
                  </div>
                )}
                {!loadingInv && invoices.map((inv, i) => (
                  <motion.div key={inv.id || i}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-mono font-bold" style={{ color: ACCENT }}>{inv.invoice_id}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{fmtD(inv.issue_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-100">{fmt(inv.amount)} <span className="text-[10px] text-slate-500">{inv.currency}</span></p>
                        <StatusDot status={inv.status} />
                      </div>
                    </div>
                    {inv.line_items?.length > 0 && (
                      <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                        {inv.line_items.slice(0, 3).map((item, j) => (
                          <div key={j} className="flex justify-between items-center py-0.5">
                            <span className="text-[10px] text-slate-400 flex-1 truncate">{item.name}</span>
                            <span className="text-[10px] font-semibold text-slate-300 ml-2 whitespace-nowrap">
                              {item.quantity ? `${item.quantity} ${item.unit}` : ''} — {fmt(item.line_total)}
                            </span>
                          </div>
                        ))}
                        {inv.line_items.length > 3 && (
                          <p className="text-[10px] text-slate-600 mt-1">+{inv.line_items.length - 3} kalem daha</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Suppliers() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [syncing, setSyncing]     = useState(false);
  const [enriching,  setEnriching]  = useState(false);
  const [enrichLog,  setEnrichLog]  = useState(null);

  const ACCENT = '#f97316';

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    hover:  isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const syncFromInvoices = async () => {
    setSyncing(true);
    try {
      const { data: invs } = await supabase
        .from('invoices').select('cari_name, vkntckn').eq('type', 'outbox').not('vkntckn', 'is', null);
      const uniq = {};
      (invs || []).forEach(r => { if (r.vkntckn) uniq[r.vkntckn] = r.cari_name; });
      const rows = Object.entries(uniq).map(([vkntckn, name]) => ({ name, vkntckn, source: 'invoice_sync' }));
      if (rows.length > 0) {
        await supabase.from('suppliers').upsert(rows, { onConflict: 'vkntckn', ignoreDuplicates: false });
      }
      await loadSuppliers();
      showToast(`${rows.length} tedarikçi senkronize edildi ✓`);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSyncing(false); }
  };

  // Uyumsoft'tan tam UBL çekerek adres/telefon/e-posta zenginleştir
  const enrichContacts = async () => {
    setEnriching(true); setEnrichLog(null);
    try {
      const r = await fetch('/api/enrich-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'outbox', limit: 10, onlyMissing: true }),
      });
      const data = await r.json();
      setEnrichLog(data.results);
      if (data.success) {
        await loadSuppliers();
        showToast(`${data.results?.enriched || 0} tedarikçi zenginleştirildi ✓`);
      } else {
        showToast(data.error || 'Zenginleştirme hatası', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setEnriching(false); }
  };

  const deleteSupplier = async (id, name) => {
    if (!window.confirm(`"${name}" silinsin mi?`)) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else { showToast('Tedarikçi silindi'); loadSuppliers(); }
  };

  const filtered = suppliers.filter(s => {
    const t = search.toLowerCase();
    return (s.name||'').toLowerCase().includes(t)
      || (s.vkntckn||'').includes(t)
      || (s.phone||'').includes(t)
      || (s.email||'').toLowerCase().includes(t);
  });

  const invoicedCount = suppliers.filter(s => s.vkntckn && s.source === 'invoice_sync').length;
  const manualCount   = suppliers.filter(s => s.source === 'manual').length;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${ACCENT}15`, color: ACCENT }}>
              <Truck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>Tedarikçiler</h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                {suppliers.length} kayıt · Tedarikçi Yönetimi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={syncFromInvoices} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(249,115,22,0.1)', color: ACCENT, border: `1px solid rgba(249,115,22,0.2)` }}>
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Faturalardan Senkronize Et
            </button>
            <button onClick={enrichContacts} disabled={enriching}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {enriching ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              {enriching ? 'Zenginleştiriliyor...' : 'Adres/İletişim Çek'}
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
              style={{ background: ACCENT }}>
              <Plus size={15} />Manuel Ekle
            </button>
          </div>
        </div>

        {/* Zenginleştirme log paneli */}
        {enrichLog && (
          <div className="mb-4 p-4 rounded-2xl text-xs" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-emerald-400">Zenginleştirme Sonucu</p>
              <button onClick={() => setEnrichLog(null)} className="text-slate-500 hover:text-white"><X size={13} /></button>
            </div>
            <div className="flex gap-4 text-slate-300 mb-2">
              <span>✅ Zenginleştirilen: <strong>{enrichLog.enriched}</strong></span>
              <span>🔄 İşlenen: <strong>{enrichLog.processed}</strong></span>
              <span>⏩ Atlanan: <strong>{enrichLog.skipped}</strong></span>
            </div>
            {enrichLog.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-amber-400 font-semibold mb-1">Hatalar:</p>
                {enrichLog.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-red-400 font-mono truncate">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { l:'Toplam',          v: suppliers.length,  color: ACCENT,    Ic: Truck },
            { l:'Fatura Bağlantılı',v: invoicedCount,   color: '#10b981', Ic: Receipt },
            { l:'Manuel Kayıt',   v: manualCount,        color: '#8b5cf6', Ic: Edit3 },
            { l:'Aktif',          v: suppliers.filter(s=>s.is_active).length, color:'#f59e0b', Ic: CheckCircle2 },
          ].map(({ l, v, color, Ic }, i) => (
            <div key={i} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
                <Ic size={18} style={{ color }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color }}>{v}</p>
                <p className="text-[10px] font-semibold" style={{ color: c.muted }}>{l}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Arama */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-4"
          style={{ background: c.card, borderColor: c.border }}>
          <Search size={15} style={{ color: c.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="İsim, VKN/TCKN, telefon veya e-posta ara..."
            className="bg-transparent border-none outline-none text-sm flex-1"
            style={{ color: c.text }} />
          {search && <button onClick={() => setSearch('')}><X size={14} style={{ color: c.muted }} /></button>}
        </div>

        {/* Liste */}
        <div className="rounded-3xl overflow-hidden border" style={{ background: c.card, borderColor: c.border }}>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: c.muted }}>
              <Loader2 size={22} className="animate-spin" style={{ color: ACCENT }} />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: c.muted }}>
              <Truck size={40} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold">{search ? 'Sonuç bulunamadı' : 'Henüz tedarikçi eklenmemiş'}</p>
              <p className="text-xs mt-1 opacity-70">Manuel ekle veya faturalardan senkronize et.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b" style={{ borderColor: c.border, background: c.hover }}>
                    {['Tedarikçi', 'VKN/TCKN', 'İletişim', 'Durum', 'Kaynak', ''].map(h => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: c.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sup, idx) => (
                    <motion.tr key={sup.id || idx}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                      className="border-b last:border-0 cursor-pointer transition-colors"
                      style={{ borderColor: c.border }}
                      onMouseEnter={e => e.currentTarget.style.background = c.hover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setSelected(sup)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ background: ACCENT }}>
                            {sup.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: c.text }}>{sup.name}</p>
                            {sup.city && <p className="text-xs" style={{ color: c.muted }}>{sup.city}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono" style={{ color: c.muted }}>{sup.vkntckn || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {sup.phone && <div className="flex items-center gap-1 text-xs" style={{ color: c.muted }}><Phone size={10}/>{sup.phone}</div>}
                        {sup.email && <div className="flex items-center gap-1 text-xs" style={{ color: c.muted }}><Mail size={10}/>{sup.email}</div>}
                        {!sup.phone && !sup.email && <span className="text-xs" style={{ color: c.muted }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                          style={{ background: sup.is_active ? '#10b98118' : '#94a3b818', color: sup.is_active ? '#10b981' : '#94a3b8' }}>
                          {sup.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-semibold"
                          style={{ color: sup.source === 'invoice_sync' ? ACCENT : '#8b5cf6' }}>
                          {sup.source === 'invoice_sync' ? '🔗 Faturadan' : '✏️ Manuel'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); setSelected(sup); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: ACCENT }}
                            onMouseEnter={e => e.currentTarget.style.background = `${ACCENT}15`}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ChevronRight size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteSupplier(sup.id, sup.name); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#ef4444' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#ef444415'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <SupplierDrawer
            supplier={selected}
            onClose={() => setSelected(null)}
            onSaved={() => { loadSuppliers(); showToast('Tedarikçi güncellendi ✓'); }}
          />
        )}
        {showNew && (
          <SupplierDrawer
            supplier={{ name: '', vkntckn: '', phone: '', email: '', address: '', city: '', notes: '', tax_id: '', is_active: true }}
            onClose={() => setShowNew(false)}
            onSaved={() => { loadSuppliers(); setShowNew(false); showToast('Yeni tedarikçi eklendi ✓'); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}
