import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, Trash2, Search, X, Loader2, CheckCircle2,
  ArrowDownLeft, ArrowUpRight, Filter, Users, Package,
  Coffee, Truck, ShoppingBag, Car, MoreHorizontal,
  CalendarDays, TrendingUp, TrendingDown, Check, Edit3,
  FileText, ArrowRightLeft, Image, Upload, Eye, Receipt,
  Building2, Clock, AlertTriangle, Ban, ChevronRight, Scissors,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import CustomDialog from '../components/CustomDialog';
import ImageCropper from '../components/ImageCropper';

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
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const initForm = () => ({
    direction:   tx?.direction   || 'out',
    amount:      tx?.amount      || '',
    category:    tx?.category    || 'diger',
    description: tx?.description || '',
    tx_date:     tx?.tx_date     || new Date().toISOString().split('T')[0],
    currency:    tx?.currency    || 'TRY',
    is_settled:  tx?.is_settled  || false,
  });
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inp = {
    background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`,
    borderRadius: 10, color: isDark ? '#f1f5f9' : '#1e293b',
    padding: '8px 12px', fontSize: 13,
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
        style={{
          background: isDark ? '#0c1526' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
          maxHeight: '90vh'
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}` }}>
          <h2 className="text-sm font-bold" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>
            {tx?.id ? 'Kaydı Düzenle' : 'Yeni Kasa Kaydı'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl transition-colors" style={{ color: '#94a3b8' }}><X size={15} /></button>
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

          {/* Aciklama */}
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
              <p className="text-xs font-semibold" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Kapatıldı / Ödendi</p>
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
  const [filterDir, setFilterDir] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [mainTab, setMainTab]    = useState('kasa'); // kasa | cekler

  // ── Çek State'leri ──
  const [cheques, setCheques]       = useState([]);
  const [chqLoading, setChqLoading] = useState(false);
  const [chqTab, setChqTab]         = useState('received'); // received | given
  const [showChqForm, setShowChqForm] = useState(false);
  const [editChq, setEditChq]       = useState(null);
  const [transferChq, setTransferChq] = useState(null); // devir modal

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

  // Filtrele
  const filtered = txs.filter(t => {
    if (filterDir !== 'all' && t.direction !== filterDir) return false;
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.description||'').toLowerCase().includes(q);
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

  // ── Çek CRUD ──
  const loadCheques = useCallback(async () => {
    setChqLoading(true);
    const { data } = await supabase.from('cheques').select('*').order('created_at', { ascending: false });
    setCheques(data || []);
    setChqLoading(false);
  }, []);

  const [chqLoaded, setChqLoaded] = useState(false);
  useEffect(() => { if (mainTab === 'cekler' && !chqLoaded) { loadCheques(); setChqLoaded(true); } }, [mainTab]);

  const saveCheque = async (chq, formData) => {
    try {
      // Clean: empty strings → null for date fields
      const clean = { ...formData };
      if (!clean.due_date) clean.due_date = null;
      if (!clean.issue_date) clean.issue_date = null;
      let saved;
      if (chq?.id) {
        const { data, error } = await supabase.from('cheques').update(clean).eq('id', chq.id).select().single();
        if (error) throw error;
        saved = data;
        setCheques(prev => prev.map(c2 => c2.id === data.id ? data : c2));
        showToast('Çek güncellendi ✓');
      } else {
        const { data, error } = await supabase.from('cheques').insert(clean).select().single();
        if (error) throw error;
        saved = data;
        setCheques(prev => [data, ...prev]);
        showToast('Çek eklendi ✓');
      }
      setShowChqForm(false); setEditChq(null);
      return saved;
    } catch(e) { showToast(e.message, 'error'); return null; }
  };

  const deleteCheque = (id) => {
    setDialog({
      open: true, type: 'danger', title: 'Çek Sil',
      message: 'Bu çek kaydı silinecek. Emin misiniz?',
      onConfirm: async () => {
        await supabase.from('cheques').delete().eq('id', id);
        setCheques(prev => prev.filter(c2 => c2.id !== id));
        setDialog({ open: false });
        showToast('Çek silindi');
      }
    });
  };

  const doTransfer = async (chq, toName, note) => {
    try {
      // 1. Verilen çek oluştur
      const { data: givenChq } = await supabase.from('cheques').insert({
        direction: 'given', amount: chq.amount, currency: chq.currency,
        cheque_no: chq.cheque_no, bank_name: chq.bank_name, due_date: chq.due_date,
        issue_date: chq.issue_date, from_name: chq.from_name, to_name: toName,
        status: 'active', transferred_from: chq.id, image_url: chq.image_url,
        transfer_note: note || `${chq.from_name || 'Alınan'} çeki ${toName}'e devredildi`,
        notes: `Devir: ${chq.from_name || '?'} → ${toName}`,
      }).select().single();
      // 2. Alınan çeki "used" olarak işaretle
      const { data: updatedChq } = await supabase.from('cheques').update({
        status: 'used', transferred_to: givenChq.id,
        transfer_note: `${toName}'e devredildi`,
      }).eq('id', chq.id).select().single();
      setCheques(prev => [givenChq, ...prev.map(c2 => c2.id === updatedChq.id ? updatedChq : c2)]);
      setTransferChq(null);
      showToast(`Çek ${toName}'e devredildi ✓`);
    } catch(e) { showToast(e.message, 'error'); }
  };

  const uploadChequeImage = async (chqId, file) => {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `cheque_${chqId}_${Date.now()}.${file.name.split('.').pop()}`,
          mimeType: file.type, fileSize: file.size, fileData: base64,
          name: `Çek ${chqId}`,
        }),
      });
      const { publicUrl, error } = await r.json();
      if (error) throw new Error(error);
      await supabase.from('cheques').update({ image_url: publicUrl }).eq('id', chqId);
      setCheques(prev => prev.map(c2 => c2.id === chqId ? { ...c2, image_url: publicUrl } : c2));
      showToast('Görsel yüklendi ✓');
      return publicUrl;
    } catch(e) { showToast('Görsel yüklenemedi: ' + e.message, 'error'); return null; }
  };

  // Media items for image picker
  const [chqMediaItems, setChqMediaItems] = useState([]);
  const [chqImagePicker, setChqImagePicker] = useState(null); // cheque id to attach image
  const [chqMediaSearch, setChqMediaSearch] = useState('');
  const [chqUploading, setChqUploading] = useState(false);

  const openChqImagePicker = async (chqId) => {
    setChqImagePicker(chqId);
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    setChqMediaItems(data || []);
  };

  const selectChqMedia = async (url) => {
    if (!chqImagePicker) return;
    await supabase.from('cheques').update({ image_url: url }).eq('id', chqImagePicker);
    setCheques(prev => prev.map(c2 => c2.id === chqImagePicker ? { ...c2, image_url: url } : c2));
    setChqImagePicker(null);
    showToast('Görsel seçildi ✓');
  };

  const uploadChqDirect = async (file) => {
    if (!file || !chqImagePicker) return;
    setChqUploading(true);
    try {
      const url = await uploadChequeImage(chqImagePicker, file);
      if (url) {
        setChqImagePicker(null);
        const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
        setChqMediaItems(data || []);
      }
    } finally { setChqUploading(false); }
  };

  const CHQ_STATUS = {
    active:    { label: 'Aktif',       color: '#3b82f6', icon: Clock },
    used:      { label: 'Kullanıldı',  color: '#f59e0b', icon: ArrowRightLeft },
    deposited: { label: 'Yatırıldı',   color: '#10b981', icon: Building2 },
    bounced:   { label: 'Karşılıksız', color: '#ef4444', icon: AlertTriangle },
    cancelled: { label: 'İptal',       color: '#94a3b8', icon: Ban },
  };

  const receivedCheques = cheques.filter(c2 => c2.direction === 'received');
  const givenCheques = cheques.filter(c2 => c2.direction === 'given');

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

        {/* ── Başlık + Ana Sekmeler ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15` }}>
              <Wallet size={22} style={{ color: currentColor }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>Kasa</h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                {mainTab === 'kasa' ? 'Nakit gider & gelir takibi' : 'Çek yönetimi'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }}>
              {[{ id: 'kasa', label: 'Kasa', icon: Wallet }, { id: 'cekler', label: 'Çekler', icon: Receipt }].map(t => (
                <button key={t.id} onClick={() => setMainTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: mainTab === t.id ? (isDark ? 'rgba(255,255,255,0.08)' : '#fff') : 'transparent',
                    color: mainTab === t.id ? currentColor : c.muted,
                    boxShadow: mainTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  <t.icon size={13}/> {t.label}
                  {t.id === 'cekler' && cheques.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                      style={{ background: `${currentColor}20`, color: currentColor }}>{cheques.length}</span>
                  )}
                </button>
              ))}
            </div>
            {mainTab === 'kasa' ? (
              <button onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ background: currentColor }}>
                <Plus size={15}/>Yeni Kayıt
              </button>
            ) : (
              <button onClick={() => { setEditChq(null); setShowChqForm(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ background: currentColor }}>
                <Plus size={15}/>Yeni Çek
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════ KASA TAB ═══════════════ */}
        {mainTab === 'kasa' && (
          <>
            {/* Özet Kartlar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Net Bakiye', value: fmt(Math.abs(netBalance)), prefix: netBalance >= 0 ? '+' : '-', color: netBalance >= 0 ? '#10b981' : '#ef4444', icon: Wallet },
                { label: 'Toplam Gider', value: fmt(totalOut), prefix: '-', color: '#ef4444', icon: TrendingDown },
                { label: 'Bu Ay Gider', value: fmt(monthOut), prefix: '-', color: '#f97316', icon: CalendarDays },
                { label: 'Bu Ay Gelir', value: fmt(monthIn), prefix: '+', color: '#10b981', icon: TrendingUp },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay: i * 0.06 }} className="rounded-2xl p-4"
                  style={{ background: c.card, border: `1px solid ${c.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl" style={{ background: `${s.color}15` }}>
                      <s.icon size={15} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.prefix}{s.value} ₺</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: c.muted }}>{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* İçerik Alanı */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sol: Liste */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                    style={{ background: c.card, borderColor: c.border }}>
                    <Search size={14} style={{ color: c.muted }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Aciklama ara..." className="bg-transparent border-none outline-none text-sm flex-1"
                      style={{ color: c.text }} />
                    {search && <button onClick={() => setSearch('')}><X size={13} style={{ color: c.muted }} /></button>}
                  </div>
                </div>
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
                    </div>
                  )}
                  <AnimatePresence mode="popLayout">
                    {!loading && filtered.map((tx, i) => {
                      const cat = catById(tx.category);
                      const isOut = tx.direction === 'out';
                      return (
                        <motion.div key={tx.id} layout
                          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                          exit={{ opacity:0, scale:0.97 }} transition={{ delay: Math.min(i * 0.02, 0.15) }}
                          className="group rounded-2xl p-4 transition-all"
                          style={{
                            background: tx.is_settled ? 'rgba(255,255,255,0.02)' : (isDark ? 'rgba(30,41,59,0.5)' : '#fff'),
                            border: `1px solid ${tx.is_settled ? 'rgba(148,163,184,0.06)' : c.border}`,
                            opacity: tx.is_settled ? 0.55 : 1,
                          }}>
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}>
                              <cat.icon size={15} style={{ color: cat.color }} />
                            </div>
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
                                  <span className="text-[10px]" style={{ color: c.muted }}>{fmtD(tx.tx_date)}</span>
                                </div>
                                <p className="text-base font-bold flex-shrink-0" style={{ color: isOut ? '#f87171' : '#34d399' }}>
                                  {isOut ? '-' : '+'}{fmt(tx.amount)} ₺
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5 pt-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
                            <button onClick={() => toggleSettle(tx)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                              style={{ background: tx.is_settled ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.1)', color: tx.is_settled ? c.muted : '#10b981' }}>
                              <Check size={11} />{tx.is_settled ? 'Yeniden Aç' : 'Kapat / Ödendi'}
                            </button>
                            <button onClick={() => { setEditing(tx); setShowForm(true); }}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: '#64748b' }}>
                              <Edit3 size={12} />
                            </button>
                            <button onClick={() => handleDelete(tx.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: '#64748b' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              {/* Sağ: Kategori Dağılımı */}
              <div className="space-y-5">
                <div className="glass-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Kategori Dağılımı</p>
                  {CATEGORIES.map(cat => {
                    const catTotal = openTxs.filter(t => t.category === cat.id && t.direction === 'out').reduce((s,t) => s + t.amount, 0);
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
          </>
        )}

        {/* ═══════════════ ÇEKLER TAB ═══════════════ */}
        {mainTab === 'cekler' && (
          <>
            {/* Çek Özet */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Alınan Çek', value: receivedCheques.length, sub: fmt(receivedCheques.filter(ch=>ch.status==='active').reduce((s,ch)=>s+Number(ch.amount),0)), color: '#10b981' },
                { label: 'Verilen Çek', value: givenCheques.length, sub: fmt(givenCheques.filter(ch=>ch.status==='active').reduce((s,ch)=>s+Number(ch.amount),0)), color: '#ef4444' },
                { label: 'Aktif Çek', value: cheques.filter(ch=>ch.status==='active').length, sub: fmt(cheques.filter(ch=>ch.status==='active').reduce((s,ch)=>s+Number(ch.amount),0)), color: '#3b82f6' },
                { label: 'Kullanılan', value: cheques.filter(ch=>ch.status==='used').length, sub: fmt(cheques.filter(ch=>ch.status==='used').reduce((s,ch)=>s+Number(ch.amount),0)), color: '#f59e0b' },
              ].map((s,i) => (
                <div key={i} className="rounded-2xl p-4" style={{ background: c.card, border: `1px solid ${c.border}` }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.muted }}>{s.label}</p>
                  <p className="text-xs font-semibold mt-1" style={{ color: s.color }}>{s.sub} ₺</p>
                </div>
              ))}
            </div>

            {/* Alınan / Verilen Sub-tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }}>
              {[
                { id: 'received', label: 'Alınan Çekler', icon: ArrowDownLeft, count: receivedCheques.length, color: '#10b981' },
                { id: 'given', label: 'Verilen Çekler', icon: ArrowUpRight, count: givenCheques.length, color: '#ef4444' },
              ].map(t => (
                <button key={t.id} onClick={() => setChqTab(t.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: chqTab === t.id ? (isDark ? 'rgba(255,255,255,0.08)' : '#fff') : 'transparent',
                    color: chqTab === t.id ? t.color : c.muted,
                    boxShadow: chqTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  <t.icon size={13}/> {t.label}
                  {t.count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                    style={{ background: `${t.color}18`, color: t.color }}>{t.count}</span>}
                </button>
              ))}
            </div>

            {/* Çek Listesi */}
            <div className="space-y-3">
              {chqLoading && (
                <div className="flex justify-center py-14">
                  <Loader2 size={24} className="animate-spin" style={{ color: currentColor }}/>
                </div>
              )}
              {!chqLoading && (chqTab === 'received' ? receivedCheques : givenCheques).length === 0 && (
                <div className="text-center py-14">
                  <Receipt size={36} className="mx-auto mb-2 opacity-20" style={{ color: c.muted }}/>
                  <p className="text-sm font-semibold" style={{ color: c.muted }}>
                    {chqTab === 'received' ? 'Alınan çek yok' : 'Verilen çek yok'}
                  </p>
                </div>
              )}
              {!chqLoading && (chqTab === 'received' ? receivedCheques : givenCheques).map(chq => {
                const st = CHQ_STATUS[chq.status] || CHQ_STATUS.active;
                const StIcon = st.icon;
                const isReceived = chq.direction === 'received';
                const linkedChq = chq.transferred_to ? cheques.find(c2 => c2.id === chq.transferred_to) : null;
                const sourceChq = chq.transferred_from ? cheques.find(c2 => c2.id === chq.transferred_from) : null;
                return (
                  <motion.div key={chq.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                    className="group rounded-2xl overflow-hidden"
                    style={{ background: c.card, border: `1px solid ${c.border}` }}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* İkon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${isReceived ? '#10b981' : '#ef4444'}15` }}>
                          {isReceived ? <ArrowDownLeft size={18} style={{ color: '#10b981' }}/> : <ArrowUpRight size={18} style={{ color: '#ef4444' }}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold" style={{ color: c.text }}>
                                  {isReceived ? (chq.from_name || 'Bilinmeyen') : (chq.to_name || 'Bilinmeyen')}
                                </p>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                                  style={{ background: `${st.color}18`, color: st.color }}>
                                  <StIcon size={10}/> {st.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {chq.cheque_no && <span className="text-[10px] font-mono font-bold" style={{ color: c.muted }}>#{chq.cheque_no}</span>}
                                {chq.bank_name && <span className="text-[10px]" style={{ color: c.muted }}>{chq.bank_name}</span>}
                                {chq.due_date && <span className="text-[10px]" style={{ color: c.muted }}>Vade: {fmtD(chq.due_date)}</span>}
                              </div>
                            </div>
                            <p className="text-lg font-black flex-shrink-0" style={{ color: isReceived ? '#10b981' : '#ef4444' }}>
                              {fmt(chq.amount)} ₺
                            </p>
                          </div>

                          {/* Transfer bilgisi */}
                          {chq.transfer_note && (
                            <div className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
                              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                              <ArrowRightLeft size={11} style={{ color: '#f59e0b' }}/>
                              <span className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>{chq.transfer_note}</span>
                            </div>
                          )}
                          {sourceChq && (
                            <div className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
                              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                              <ArrowDownLeft size={11} style={{ color: '#3b82f6' }}/>
                              <span className="text-[10px] font-semibold" style={{ color: '#3b82f6' }}>
                                {sourceChq.from_name || 'Bilinmeyen'} çeki ile ödeme yapıldı
                              </span>
                            </div>
                          )}
                          {linkedChq && (
                            <div className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
                              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                              <ChevronRight size={11} style={{ color: '#f59e0b' }}/>
                              <span className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>
                                {linkedChq.to_name || '?'} tedarikçisine devredildi
                              </span>
                            </div>
                          )}
                          {chq.notes && !chq.transfer_note && (
                            <p className="text-[10px] mt-1.5" style={{ color: c.muted }}>{chq.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Çek görseli */}
                    {chq.image_url && (
                      <div className="px-4 pb-2">
                        <img src={chq.image_url} alt="Çek" className="w-full max-h-48 object-cover rounded-xl border"
                          style={{ borderColor: c.border }}/>
                      </div>
                    )}

                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-2 px-4 pb-3 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isReceived && chq.status === 'active' && (
                        <button onClick={() => setTransferChq(chq)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                          <ArrowRightLeft size={11}/> Devret
                        </button>
                      )}
                      <button onClick={() => openChqImagePicker(chq.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                        <Upload size={11}/> Görsel
                      </button>
                      <button onClick={() => { setEditChq(chq); setShowChqForm(true); }}
                        className="p-1.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: '#64748b' }}>
                        <Edit3 size={12}/>
                      </button>
                      <button onClick={() => deleteCheque(chq.id)}
                        className="p-1.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: '#64748b' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>

      {/* ── Kasa Form Modal ── */}
      <AnimatePresence>
        {showForm && (
          <TxForm tx={editing} onSave={handleSaved} onClose={() => { setShowForm(false); setEditing(null); }} color={currentColor} />
        )}
      </AnimatePresence>

      {/* ── Çek Form Modal ── */}
      {showChqForm && (
        <ChequeFormInner
          editChq={editChq}
          chqTab={chqTab}
          isDark={isDark}
          c={c}
          currentColor={currentColor}
          CHQ_STATUS={CHQ_STATUS}
          receivedCheques={receivedCheques}
          saveCheque={saveCheque}
          uploadChequeImage={uploadChequeImage}
          openChqImagePicker={openChqImagePicker}
          onClose={() => { setShowChqForm(false); setEditChq(null); }}
          fmt={fmt}
        />
      )}

      {/* ── Devir Modal ── */}
      {transferChq && (() => {
        const TransferModal = () => {
          const [toName, setToName] = useState('');
          const [note, setNote] = useState('');
          const [saving, setSaving] = useState(false);
          const inp = { background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`,
            borderRadius: 10, color: isDark ? '#f1f5f9' : '#1e293b', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' };
          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
              <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
                className="w-full max-w-sm rounded-3xl p-6 space-y-4"
                style={{ background: isDark ? '#0c1526' : '#fff', border: `1px solid ${c.border}` }}>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.12)' }}>
                    <ArrowRightLeft size={24} style={{ color: '#f59e0b' }}/>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: c.text }}>Çek Devret</h3>
                  <p className="text-xs mt-1" style={{ color: c.muted }}>
                    {transferChq.from_name || '?'} — {fmt(transferChq.amount)} ₺
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Kime Devredilecek (Tedarikçi) *</p>
                  <input style={inp} placeholder="GMC Tedarik" value={toName} onChange={e => setToName(e.target.value)}/>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Not</p>
                  <input style={inp} placeholder="Devir açıklaması..." value={note} onChange={e => setNote(e.target.value)}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTransferChq(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ color: c.muted }}>İptal</button>
                  <button disabled={!toName || saving} onClick={async () => { setSaving(true); await doTransfer(transferChq, toName, note); setSaving(false); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: '#f59e0b', opacity: !toName || saving ? 0.5 : 1 }}>
                    {saving ? <Loader2 size={14} className="animate-spin"/> : <ArrowRightLeft size={14}/>} Devret
                  </button>
                </div>
              </motion.div>
            </div>
          );
        };
        return <TransferModal/>;
      })()}

      {/* ── Çek Görsel Seç/Yükle Modal ── */}
      {chqImagePicker && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
            style={{ background: isDark ? '#0c1526' : '#fff', border: `1px solid ${c.border}` }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
              <p className="font-bold text-sm" style={{ color: c.text }}>Görsel Seç / Yükle</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
                  style={{ background: currentColor }}>
                  {chqUploading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
                  Yükle
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f2 = e.target.files?.[0]; if (f2) uploadChqDirect(f2); e.target.value = ''; }}/>
                </label>
                <button onClick={() => setChqImagePicker(null)} style={{ color: c.muted }}><X size={18}/></button>
              </div>
            </div>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
              <input value={chqMediaSearch} onChange={e => setChqMediaSearch(e.target.value)}
                placeholder="Görsel ara..." className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: c.card, borderColor: c.border, color: c.text }}/>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {chqUploading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin" style={{ color: currentColor }}/>
                  <span className="ml-2 text-sm" style={{ color: c.muted }}>Yükleniyor...</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {chqMediaItems
                    .filter(m => m.mime_type?.startsWith('image/') && (m.name || '').toLowerCase().includes(chqMediaSearch.toLowerCase()))
                    .map(m => (
                      <div key={m.id} onClick={() => selectChqMedia(m.file_url)}
                        className="aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-purple-500 transition-all group relative"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                        <img src={m.file_url} alt={m.name} className="w-full h-full object-cover"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                          <p className="text-[10px] text-white truncate">{m.name}</p>
                        </div>
                      </div>
                    ))}
                  {chqMediaItems.filter(m => m.mime_type?.startsWith('image/')).length === 0 && (
                    <div className="col-span-4 text-center py-12">
                      <Upload size={36} className="mx-auto mb-2 opacity-20" style={{ color: c.muted }}/>
                      <p className="text-sm font-semibold" style={{ color: c.muted }}>Henüz görsel yok</p>
                      <p className="text-xs mt-1" style={{ color: c.muted }}>Yukarıdaki "Yükle" butonuyla ekleyebilirsiniz</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <CustomDialog {...dialog} onClose={() => setDialog({ open:false })}
        onConfirm={dialog.onConfirm || (() => setDialog({ open:false }))} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ChequeFormInner — ayrı component, state korunur, hata yapıldığında sıfırlanmaz
// ═══════════════════════════════════════════════════════════════════
function ChequeFormInner({ editChq, chqTab, isDark, c, currentColor, CHQ_STATUS,
  receivedCheques, saveCheque, uploadChequeImage, openChqImagePicker, onClose, fmt }) {

  const [f, setF] = useState({
    direction: editChq?.direction || (chqTab === 'given' ? 'given' : 'received'),
    amount: editChq?.amount || '',
    currency: editChq?.currency || 'TRY',
    cheque_no: editChq?.cheque_no || '',
    bank_name: editChq?.bank_name || '',
    due_date: editChq?.due_date ? editChq.due_date.split('T')[0] : '',
    issue_date: editChq?.issue_date ? editChq.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
    from_name: editChq?.from_name || '',
    to_name: editChq?.to_name || '',
    notes: editChq?.notes || '',
    status: editChq?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [sourceKey, setSourceKey] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [cropSrc, setCropSrc] = useState(null); // data URL for cropper
  const [showCrop, setShowCrop] = useState(false);
  const s = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  // Dosya seçildiğinde preview URL oluştur
  const handleFileSelect = (file) => {
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const inp = {
    background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`,
    borderRadius: 10, color: isDark ? '#f1f5f9' : '#1e293b',
    padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
  };

  const handleSourceChange = (val) => {
    setSourceKey(val);
    if (val === '__biz__') {
      s('from_name', 'Şirket Çeki');
    } else if (val.startsWith('__chq__')) {
      const src = receivedCheques.find(ch2 => ch2.id === val.replace('__chq__', ''));
      if (src) {
        s('from_name', src.from_name || 'Alınan Çek');
        if (!f.amount) s('amount', src.amount);
        if (!f.cheque_no) s('cheque_no', src.cheque_no || '');
        if (!f.bank_name) s('bank_name', src.bank_name || '');
        if (!f.due_date && src.due_date) s('due_date', src.due_date.split('T')[0]);
      }
    }
  };

  const handleSave = async () => {
    if (!f.amount) return;
    setSaving(true);
    const saved = await saveCheque(editChq, { ...f, amount: parseFloat(f.amount) });
    if (imgFile && saved?.id) {
      await uploadChequeImage(saved.id, imgFile);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
        className="w-full max-w-md rounded-3xl overflow-y-auto"
        style={{ background: isDark ? '#0c1526' : '#fff', border: `1px solid ${c.border}`, maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
          <h2 className="text-sm font-bold" style={{ color: c.text }}>{editChq?.id ? 'Çek Düzenle' : 'Yeni Çek'}</h2>
          <button onClick={onClose} style={{ color: c.muted }}><X size={15}/></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Tür */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: c.muted }}>Tür</p>
            <div className="flex gap-2">
              {[{ v:'received', l:'Alınan', c2:'#10b981' }, { v:'given', l:'Verilen', c2:'#ef4444' }].map(o => (
                <button key={o.v} onClick={() => s('direction', o.v)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: f.direction === o.v ? `${o.c2}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${f.direction === o.v ? o.c2+'50' : 'rgba(148,163,184,0.1)'}`,
                    color: f.direction === o.v ? o.c2 : c.muted }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          {/* Tutar + Çek No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Tutar *</p>
              <input style={inp} type="number" step="0.01" placeholder="0.00" value={f.amount} onChange={e => s('amount', e.target.value)}/>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Çek No</p>
              <input style={inp} placeholder="CHK-001" value={f.cheque_no} onChange={e => s('cheque_no', e.target.value)}/>
            </div>
          </div>
          {/* Banka + Vade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Banka</p>
              <input style={inp} placeholder="İş Bankası" value={f.bank_name} onChange={e => s('bank_name', e.target.value)}/>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Vade Tarihi</p>
              <input style={inp} type="date" value={f.due_date} onChange={e => s('due_date', e.target.value)}/>
            </div>
          </div>
          {/* Alınan: Kimden */}
          {f.direction === 'received' && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Kimden (Müşteri) *</p>
              <input style={inp} placeholder="Seva Aydınlatma" value={f.from_name} onChange={e => s('from_name', e.target.value)}/>
            </div>
          )}
          {/* Verilen: Kime + Kaynak */}
          {f.direction === 'given' && (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Kime (Tedarikçi) *</p>
                <input style={inp} placeholder="GMC Tedarik" value={f.to_name} onChange={e => s('to_name', e.target.value)}/>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Kaynak (Çekin Kökeni)</p>
                <select style={{...inp, cursor:'pointer'}} value={sourceKey}
                  onChange={e => handleSourceChange(e.target.value)}>
                  <option value="">Seçin...</option>
                  <option value="__biz__">Şirket (Kendi Çekimiz)</option>
                  {receivedCheques.filter(ch2 => ch2.status === 'active').map(ch2 => (
                    <option key={ch2.id} value={`__chq__${ch2.id}`}>
                      {ch2.from_name||'?'} — {fmt(ch2.amount)} ₺ {ch2.cheque_no ? `#${ch2.cheque_no}` : ''}
                    </option>
                  ))}
                </select>
                {f.from_name && (
                  <p className="text-[10px] mt-1 font-semibold" style={{ color: '#f59e0b' }}>
                    Seçilen: {f.from_name}
                  </p>
                )}
              </div>
            </>
          )}
          {/* Durum */}
          {editChq?.id && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: c.muted }}>Durum</p>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(CHQ_STATUS).map(([k,v]) => (
                  <button key={k} onClick={() => s('status', k)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                    style={{ background: f.status === k ? `${v.color}18` : 'rgba(255,255,255,0.04)', color: f.status === k ? v.color : c.muted }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Görsel */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Çek Görseli (Opsiyonel)</p>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border flex-1"
                style={{ borderColor: c.border, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                <Upload size={13} style={{ color: '#a78bfa' }}/>
                <span className="text-xs truncate" style={{ color: c.muted }}>{imgFile ? imgFile.name : 'Dosya yükle...'}</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); }}/>
              </label>
              {imgFile && cropSrc && (
                <button onClick={() => setShowCrop(true)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap flex items-center gap-1.5"
                  style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                  <Scissors size={12}/> Kırp
                </button>
              )}
              {editChq?.id && (
                <button onClick={() => openChqImagePicker(editChq.id)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap"
                  style={{ borderColor: c.border, color: '#a78bfa' }}>
                  Galeri
                </button>
              )}
            </div>
            {imgFile && cropSrc && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}`, maxHeight: 120 }}>
                <img src={cropSrc} alt="Önizleme" className="w-full object-contain" style={{ maxHeight: 120 }}/>
              </div>
            )}
          </div>

          {/* Kırpma Modal */}
          {showCrop && cropSrc && (
            <ImageCropper
              imageSrc={cropSrc}
              isDark={isDark}
              onCropped={(croppedFile) => {
                setImgFile(croppedFile);
                const reader = new FileReader();
                reader.onload = () => setCropSrc(reader.result);
                reader.readAsDataURL(croppedFile);
                setShowCrop(false);
              }}
              onClose={() => setShowCrop(false)}
            />
          )}
          {/* Not */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Not</p>
            <input style={inp} placeholder="Ek bilgi..." value={f.notes} onChange={e => s('notes', e.target.value)}/>
          </div>
          <button onClick={handleSave} disabled={saving || !f.amount}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: currentColor, opacity: saving || !f.amount ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
            {editChq?.id ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
