import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, Trash2, Search, X, Loader2, CheckCircle2,
  ArrowDownLeft, ArrowUpRight, Filter, Users, Package,
  Coffee, Truck, ShoppingBag, Car, MoreHorizontal,
  CalendarDays, TrendingUp, TrendingDown, Check, Edit3,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import CustomDialog from '../components/CustomDialog';

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'maas',       label: 'Maaş',         icon: Users,       color: '#8b5cf6' },
  { id: 'avans',      label: 'Avans',         icon: Wallet,      color: '#3b82f6' },
  { id: 'kargo',      label: 'Kargo',         icon: Truck,       color: '#f97316' },
  { id: 'market',     label: 'Market / Pazar',icon: ShoppingBag, color: '#10b981' },
  { id: 'cay_kahve',  label: 'Çay / Kahve',   icon: Coffee,      color: '#f59e0b' },
  { id: 'akaryakit',  label: 'Akaryakıt',     icon: Car,         color: '#ef4444' },
  { id: 'diger',      label: 'Diğer',         icon: MoreHorizontal, color: '#64748b' },
];

const catById = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt  = (n) => n != null
  ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }) : '-';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
      className="fixed bottom-6 right-6 z-[400] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold"
      style={{ background: type === 'error' ? '#ef4444' : '#10b981' }}>
      {msg}
    </motion.div>
  );
}

// ─── Kategori Badge ───────────────────────────────────────────────────────────
function CatBadge({ catId }) {
  const cat = catById(catId);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
      style={{ background: `${cat.color}18`, color: cat.color }}>
      <cat.icon size={10} />{cat.label}
    </span>
  );
}

// ─── Form Drawer ──────────────────────────────────────────────────────────────
function TxForm({ tx, onSave, onClose, color }) {
  const initForm = () => ({
    direction:   tx?.direction   || 'out',
    amount:      tx?.amount      || '',
    category:    tx?.category    || 'diger',
    person:      tx?.person      || '',
    description: tx?.description || '',
    tx_date:     tx?.tx_date     || new Date().toISOString().split('T')[0],
    currency:    tx?.currency    || 'TRY',
    is_settled:  tx?.is_settled  || false,
  });
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inp = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 10, color: '#f1f5f9', padding: '8px 12px', fontSize: 13,
    outline: 'none', width: '100%',
  };

  const handleSave = async () => {
    if (!form.amount || !form.direction) return;
    setSaving(true);
    try {
      const payload = {
        direction:   form.direction,
        amount:      parseFloat(form.amount),
        currency:    form.currency || 'TRY',
        category:    form.category,
        person:      form.person?.trim() || null,
        description: form.description?.trim() || null,
        tx_date:     form.tx_date,
        is_settled:  form.is_settled,
      };
      let data;
      if (tx?.id) {
        const r = await supabase.from('cash_transactions').update(payload).eq('id', tx.id).select().single();
        data = r.data;
      } else {
        const r = await supabase.from('cash_transactions').insert(payload).select().single();
        data = r.data;
      }
      onSave(data);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
        className="w-full max-w-md rounded-3xl overflow-y-auto"
        style={{ background: '#0c1526', border: '1px solid rgba(148,163,184,0.12)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <h2 className="text-sm font-bold text-slate-100">
            {tx?.id ? 'Kaydı Düzenle' : 'Yeni Kasa Kaydı'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-500 hover:text-white"><X size={15} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Giriş / Çıkış */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">İşlem Türü</p>
            <div className="flex gap-2">
              {[
                { v:'out', l:'Gider (Çıkan)', icon: ArrowUpRight, c:'#ef4444' },
                { v:'in',  l:'Gelir (Giren)', icon: ArrowDownLeft, c:'#10b981' },
              ].map(opt => (
                <button key={opt.v} onClick={() => set('direction', opt.v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: form.direction === opt.v ? `${opt.c}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.direction === opt.v ? opt.c + '50' : 'rgba(148,163,184,0.1)'}`,
                    color: form.direction === opt.v ? opt.c : '#64748b',
                  }}>
                  <opt.icon size={14} />{opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Kategori */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Kategori</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => set('category', cat.id)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[10px] font-semibold transition-all"
                  style={{
                    background: form.category === cat.id ? `${cat.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${form.category === cat.id ? cat.color + '40' : 'rgba(148,163,184,0.08)'}`,
                    color: form.category === cat.id ? cat.color : '#64748b',
                  }}>
                  <cat.icon size={13} />
                  <span className="text-center leading-tight">{cat.label.split('/')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tutar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tutar *</p>
              <input style={inp} type="number" step="0.01" placeholder="0.00"
                value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tarih</p>
              <input style={inp} type="date" value={form.tx_date} onChange={e => set('tx_date', e.target.value)} />
            </div>
          </div>

          {/* Kişi */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Kişi / Çalışan (opsiyonel)</p>
            <input style={inp} placeholder="Oğuz, İsmail, Patron, ..." value={form.person}
              onChange={e => set('person', e.target.value)} />
          </div>

          {/* Açıklama */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Açıklama</p>
            <input style={inp} placeholder="Kargo ödemedi, çay aldı, Mart maaşı ..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Kapatıldı mı */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
            <div onClick={() => set('is_settled', !form.is_settled)}
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: form.is_settled ? color : 'rgba(255,255,255,0.08)', border: `1px solid ${form.is_settled ? color : 'rgba(148,163,184,0.2)'}` }}>
              {form.is_settled && <Check size={11} color="white" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Kapatıldı / Ödendi</p>
              <p className="text-[10px] text-slate-500">Bu kayıt hesaplaşıldı, aktif bakiyeyi etkilemesin</p>
            </div>
          </label>

          {/* Kaydet */}
          <button onClick={handleSave} disabled={saving || !form.amount}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: color, opacity: saving || !form.amount ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {tx?.id ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Kişi Özet Kartı ──────────────────────────────────────────────────────────
function PersonSummary({ txs, color }) {
  const people = {};
  txs.forEach(t => {
    if (!t.person || t.is_settled) return;
    if (!people[t.person]) people[t.person] = { in: 0, out: 0 };
    if (t.direction === 'in')  people[t.person].in  += t.amount;
    if (t.direction === 'out') people[t.person].out += t.amount;
  });
  const entries = Object.entries(people);
  if (entries.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Kişi Bazlı Bakiye</p>
      <div className="space-y-2">
        {entries.map(([name, bal]) => {
          const net = bal.in - bal.out;
          return (
            <div key={name} className="flex items-center justify-between py-1.5"
              style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: color }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-slate-200">{name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: net >= 0 ? '#10b981' : '#ef4444' }}>
                  {net >= 0 ? '+' : ''}{fmt(net)} ₺
                </p>
                <p className="text-[10px] text-slate-500">
                  {net > 0 ? 'Alacaklı' : net < 0 ? 'Borçlu' : 'Dengede'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Kasa() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [txs, setTxs]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm]  = useState(false);
  const [editing, setEditing]    = useState(null);
  const [search, setSearch]      = useState('');
  const [toast, setToast]        = useState(null);
  const [dialog, setDialog]      = useState({ open: false });
  const [filterDir, setFilterDir] = useState('all');   // all | in | out
  const [filterCat, setFilterCat] = useState('all');
  const [filterPerson, setFilterPerson] = useState('all');

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    hover:  isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cash_transactions')
      .select('*').order('tx_date', { ascending: false }).order('created_at', { ascending: false });
    setTxs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Benzersiz kişiler
  const people = [...new Set(txs.filter(t => t.person).map(t => t.person))];

  // Filtrele
  const filtered = txs.filter(t => {
    if (filterDir !== 'all' && t.direction !== filterDir) return false;
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (filterPerson !== 'all' && t.person !== filterPerson) return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.description||'').toLowerCase().includes(q)
          || (t.person||'').toLowerCase().includes(q);
    }
    return true;
  });

  // Bakiye hesapla (kapatılmamış)
  const openTxs = txs.filter(t => !t.is_settled);
  const totalIn  = openTxs.filter(t => t.direction === 'in').reduce((s,t) => s + t.amount, 0);
  const totalOut = openTxs.filter(t => t.direction === 'out').reduce((s,t) => s + t.amount, 0);
  const netBalance = totalIn - totalOut;

  // Bu ay
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthOut  = openTxs
    .filter(t => t.direction === 'out' && t.tx_date?.startsWith(thisMonth))
    .reduce((s,t) => s + t.amount, 0);
  const monthIn   = openTxs
    .filter(t => t.direction === 'in'  && t.tx_date?.startsWith(thisMonth))
    .reduce((s,t) => s + t.amount, 0);

  const handleSaved = (tx) => {
    setTxs(prev => {
      const exists = prev.find(t => t.id === tx.id);
      return exists ? prev.map(t => t.id === tx.id ? tx : t) : [tx, ...prev];
    });
    setShowForm(false); setEditing(null);
    showToast(tx.id ? 'Kayıt güncellendi ✓' : 'Kayıt eklendi ✓');
  };

  const handleDelete = (id) => {
    setDialog({
      open: true, type: 'danger', title: 'Kaydı Sil',
      message: 'Bu kasa kaydı silinecek. Emin misiniz?',
      onConfirm: async () => {
        await supabase.from('cash_transactions').delete().eq('id', id);
        setTxs(prev => prev.filter(t => t.id !== id));
        setDialog({ open: false });
        showToast('Kayıt silindi');
      }
    });
  };

  const toggleSettle = async (tx) => {
    const updated = { ...tx, is_settled: !tx.is_settled };
    await supabase.from('cash_transactions').update({ is_settled: updated.is_settled }).eq('id', tx.id);
    setTxs(prev => prev.map(t => t.id === tx.id ? updated : t));
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

        {/* ── Başlık ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15` }}>
              <Wallet size={22} style={{ color: currentColor }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>Kasa</h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                Nakit gider & gelir takibi
              </p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold"
            style={{ background: currentColor }}>
            <Plus size={15} />Yeni Kayıt
          </button>
        </div>

        {/* ── Özet Kartlar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Net Bakiye',    value: fmt(Math.abs(netBalance)), prefix: netBalance >= 0 ? '+' : '-', color: netBalance >= 0 ? '#10b981' : '#ef4444', icon: Wallet },
            { label: 'Toplam Gider', value: fmt(totalOut),   prefix: '-', color: '#ef4444',  icon: TrendingDown },
            { label: 'Bu Ay Gider',  value: fmt(monthOut),   prefix: '-', color: '#f97316',  icon: CalendarDays },
            { label: 'Bu Ay Gelir',  value: fmt(monthIn),    prefix: '+', color: '#10b981',  icon: TrendingUp },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl p-4"
              style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl" style={{ background: `${s.color}15` }}>
                  <s.icon size={15} style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-xl font-bold" style={{ color: s.color }}>
                {s.prefix}{s.value} ₺
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: c.muted }}>
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ── İçerik Alanı: 2 Kolon ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Sol: Liste ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filtreler & Arama */}
            <div className="space-y-2">
              {/* Arama */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                style={{ background: c.card, borderColor: c.border }}>
                <Search size={14} style={{ color: c.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Kişi veya açıklama ara..."
                  className="bg-transparent border-none outline-none text-sm flex-1"
                  style={{ color: c.text }} />
                {search && <button onClick={() => setSearch('')}><X size={13} style={{ color: c.muted }} /></button>}
              </div>

              {/* Filtre çipleri */}
              <div className="flex flex-wrap gap-2">
                {/* Yön */}
                {[
                  { v:'all', l:'Tümü' },
                  { v:'out', l:'Giderler' },
                  { v:'in',  l:'Gelirler' },
                ].map(f => (
                  <button key={f.v} onClick={() => setFilterDir(f.v)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: filterDir === f.v ? currentColor : 'rgba(255,255,255,0.06)', color: filterDir === f.v ? '#fff' : c.muted }}>
                    {f.l}
                  </button>
                ))}
                <span style={{ color: c.border }}>|</span>
                {/* Kişi */}
                <button onClick={() => setFilterPerson('all')}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: filterPerson === 'all' ? currentColor : 'rgba(255,255,255,0.06)', color: filterPerson === 'all' ? '#fff' : c.muted }}>
                  Herkes
                </button>
                {people.map(p => (
                  <button key={p} onClick={() => setFilterPerson(p === filterPerson ? 'all' : p)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: filterPerson === p ? currentColor : 'rgba(255,255,255,0.06)', color: filterPerson === p ? '#fff' : c.muted }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* İşlem Listesi */}
            <div className="space-y-2">
              {loading && (
                <div className="flex justify-center py-14">
                  <Loader2 size={24} className="animate-spin" style={{ color: currentColor }} />
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="text-center py-14">
                  <Wallet size={36} className="mx-auto mb-2 opacity-20" style={{ color: c.muted }} />
                  <p className="text-sm font-semibold" style={{ color: c.muted }}>Kayıt bulunamadı</p>
                  <p className="text-xs mt-1 opacity-70" style={{ color: c.muted }}>
                    Yeni kayıt eklemek için sağ üstteki butonu kullanın.
                  </p>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {!loading && filtered.map((tx, i) => {
                  const cat = catById(tx.category);
                  const isOut = tx.direction === 'out';
                  return (
                    <motion.div key={tx.id}
                      layout
                      initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                      exit={{ opacity:0, scale:0.97 }}
                      transition={{ delay: Math.min(i * 0.02, 0.15) }}
                      className="group rounded-2xl p-4 transition-all"
                      style={{
                        background: tx.is_settled ? 'rgba(255,255,255,0.02)' : (isDark ? 'rgba(30,41,59,0.5)' : '#fff'),
                        border: `1px solid ${tx.is_settled ? 'rgba(148,163,184,0.06)' : c.border}`,
                        opacity: tx.is_settled ? 0.55 : 1,
                      }}>
                      <div className="flex items-start gap-3">
                        {/* Kategori İkonu */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}>
                          <cat.icon size={15} style={{ color: cat.color }} />
                        </div>

                        {/* İçerik */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold truncate" style={{ color: c.text }}>
                                  {tx.description || cat.label}
                                </p>
                                <CatBadge catId={tx.category} />
                                {tx.is_settled && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Kapatıldı</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                {tx.person && (
                                  <span className="text-[11px] font-semibold" style={{ color: currentColor }}>{tx.person}</span>
                                )}
                                <span className="text-[10px]" style={{ color: c.muted }}>{fmtD(tx.tx_date)}</span>
                              </div>
                            </div>
                            {/* Tutar */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-bold" style={{ color: isOut ? '#f87171' : '#34d399' }}>
                                {isOut ? '-' : '+'}{fmt(tx.amount)} ₺
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Aksiyonlar (hover) */}
                      <div className="flex items-center gap-2 mt-2.5 pt-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
                        <button onClick={() => toggleSettle(tx)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                          style={{ background: tx.is_settled ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.1)', color: tx.is_settled ? c.muted : '#10b981' }}>
                          <Check size={11} />{tx.is_settled ? 'Yeniden Aç' : 'Kapat / Ödendi'}
                        </button>
                        <button onClick={() => { setEditing(tx); setShowForm(true); }}
                          className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-slate-200"
                          style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-red-400"
                          style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Sağ: Kişi Özeti + Kategori Dağılımı ── */}
          <div className="space-y-5">
            <PersonSummary txs={txs} color={currentColor} />

            {/* Kategori Özeti */}
            <div className="glass-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Kategori Dağılımı</p>
              {CATEGORIES.map(cat => {
                const catTotal = openTxs
                  .filter(t => t.category === cat.id && t.direction === 'out')
                  .reduce((s,t) => s + t.amount, 0);
                if (catTotal === 0) return null;
                const pct = totalOut > 0 ? (catTotal / totalOut) * 100 : 0;
                return (
                  <div key={cat.id} className="mb-2.5">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5">
                        <cat.icon size={11} style={{ color: cat.color }} />
                        <span className="text-[11px] font-semibold" style={{ color: '#94a3b8' }}>{cat.label}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: cat.color }}>{fmt(catTotal)} ₺</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <motion.div className="h-full rounded-full" style={{ background: cat.color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <TxForm tx={editing} onSave={handleSaved} onClose={() => { setShowForm(false); setEditing(null); }} color={currentColor} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <CustomDialog {...dialog} onClose={() => setDialog({ open:false })}
        onConfirm={dialog.onConfirm || (() => setDialog({ open:false }))} />
    </>
  );
}
