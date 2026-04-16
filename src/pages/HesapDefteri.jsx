import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronDown, Plus, Search, Trash2,
  TrendingUp, TrendingDown, X, Check, Loader2,
  Receipt, User, Building2, AlertCircle, CheckCircle2,
  ArrowUpDown, ChevronsUpDown
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation } from 'react-router-dom';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const fmtN = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const today = () => new Date().toISOString().slice(0, 10);

// ── Tab tanımları ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'faturali_cari',       label: 'Faturalı Cari',        type: 'customer', faturasiz: false, icon: User      },
  { id: 'faturasiz_cari',      label: 'Faturasız Cari',       type: 'customer', faturasiz: true,  icon: User      },
  { id: 'faturali_tedarikci',  label: 'Faturalı Tedarikçi',  type: 'supplier', faturasiz: false, icon: Building2 },
  { id: 'faturasiz_tedarikci', label: 'Faturasız Tedarikçi', type: 'supplier', faturasiz: true,  icon: Building2 },
];

// Cari mi (müşteri) = Alacak / Alınan   |   Tedarikçi mi = Verecek / Verilen
const colLabels = (type) => type === 'customer'
  ? { pos: 'Alacak',  neg: 'Alınan',  posTitle: 'Alacağımız', negTitle: 'Alınan (Tahsilat)' }
  : { pos: 'Verecek', neg: 'Verilen', posTitle: 'Ödeyeceğimiz', negTitle: 'Verilen (Ödeme)' };

const SORT_OPTIONS = [
  { id: 'az',        label: 'A → Z'          },
  { id: 'za',        label: 'Z → A'          },
  { id: 'alacak_d',  label: 'Alacak ↓ (büyük)' },
  { id: 'alacak_a',  label: 'Alacak ↑ (küçük)'  },
  { id: 'verecek_d', label: 'Verecek ↓ (büyük)' },
  { id: 'verecek_a', label: 'Verecek ↑ (küçük)'  },
  { id: 'yeni',      label: 'Son hareket (yeni)'  },
  { id: 'eski',      label: 'Son hareket (eski)'  },
];

// ── Hareket formu modal ────────────────────────────────────────────────────────
function HareketModal({ contact, contactType, onClose, onSaved, prefill }) {
  const { currentColor } = useTheme();
  const [form, setForm] = useState({
    tarih: today(), baslik: '', aciklama: '',
    borc: '', alacak: '', currency: 'TRY',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  // Prefill: dışardan gelen ön-doldurma (Ödemeye Geçir butonundan)
  useEffect(() => {
    if (!prefill) return;
    setForm(f => ({
      ...f,
      baslik:   prefill.baslik   || prefill.description || '',
      borc:     prefill.borc     || (prefill.direction === 'receivable' || prefill.direction === 'alacak' ? (prefill.amount || '') : ''),
      alacak:   prefill.alacak   || (prefill.direction === 'verecek' || prefill.direction === 'payable'  ? (prefill.amount || '') : ''),
      currency: prefill.currency || 'TRY',
      aciklama: prefill.aciklama || '',
      tarih:    prefill.tarih    || today(),
    }));
  }, [prefill]);

  const handleSave = async () => {
    if (!form.baslik.trim())        return setErr('Başlık zorunlu');
    if (!form.borc && !form.alacak) return setErr('Alacak veya Verecek tutarı girilmeli');
    setSaving(true); setErr('');
    try {
      const payload = {
        tarih:    form.tarih,
        baslik:   form.baslik.trim(),
        aciklama: form.aciklama || null,
        borc:     parseFloat(form.borc)   || 0,
        alacak:   parseFloat(form.alacak) || 0,
        currency: form.currency,
        kaynak:   'manual',
      };
      if (contactType === 'customer') payload.musteri_id   = contact.id;
      else                             payload.tedarikci_id = contact.id;

      const { error } = await supabase.from('cari_hareketler').insert(payload);
      if (error) throw error;
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const inp = 'w-full px-3 py-2 text-sm rounded-xl outline-none';
  const iS  = { background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.18)' : '#e2e8f0'}`, color: isDark ? '#f1f5f9' : '#1e293b' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: isDark ? '#0f1f38' : '#ffffff', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}` }}>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Yeni Hareket</p>
            <h3 className="text-sm font-bold mt-0.5" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{contact.name}</h3>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: '#94a3b8' }}/></button>
        </div>

        {/* Alacak / Alınan — veya — Verecek / Verilen */}
        <div className="grid grid-cols-2 gap-3">
        {[
          { label: contactType === 'customer' ? 'Alacak (Alacağımız)' : 'Verecek (Ödeyeceğimiz)', field: 'borc',   color: contactType === 'customer' ? '#10b981' : '#ef4444', icon: contactType === 'customer' ? TrendingUp : TrendingDown },
          { label: contactType === 'customer' ? 'Alınan (Tahsilat)'   : 'Verilen (Ödeme)',         field: 'alacak', color: contactType === 'customer' ? '#3b82f6' : '#f97316',  icon: contactType === 'customer' ? TrendingDown : TrendingUp },
        ].map(({ label, field, color, icon: Ic }) => (
            <div key={field}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
              <div className="flex items-center gap-1.5">
                <Ic size={12} style={{ color }} className="shrink-0"/>
                <input type="number" className={inp} style={iS}
                  placeholder="0.00" step="0.01" min="0"
                  value={form[field]}
                  onChange={e => setForm(f => ({
                    ...f,
                    [field]: e.target.value,
                    [field === 'borc' ? 'alacak' : 'borc']: '',
                  }))}/>
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Başlık / Fatura No *</p>
          <input className={inp} style={iS} placeholder="FAT-2025-001 veya Ödeme vb."
            value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))}/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tarih</p>
            <input type="date" className={inp} style={iS}
              value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))}/>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Para Birimi</p>
            <select className={inp} style={iS}
              value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {['TRY','USD','EUR','GBP'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Açıklama</p>
          <textarea className={`${inp} resize-none`} style={iS} rows={2}
            placeholder="İsteğe bağlı not..."
            value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))}/>
        </div>

        {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12}/>{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm"
            style={{ color: isDark ? '#94a3b8' : '#64748b', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}` }}>
            İptal
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: currentColor, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
            Kaydet
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Bakiye gösterge helper ─────────────────────────────────────────────────────
function BalanceChip({ value, compact = false }) {
  const color  = value > 0 ? '#10b981' : value < 0 ? '#ef4444' : '#64748b';
  const label  = value > 0 ? 'Alacak'  : value < 0 ? 'Verecek'  : 'Eşit';
  return (
    <div className="text-right shrink-0">
      <p className="text-sm font-bold" style={{ color }}>
        {value === 0 ? '—' : `${fmtN(Math.abs(value))} ₺`}
      </p>
      {!compact && <p className="text-[10px] font-semibold" style={{ color }}>{label}</p>}
    </div>
  );
}

// ── Tekil kişi satırı (accordion) ─────────────────────────────────────────────
function ContactRow({ contact, contactType, color, preloadedBalance, externalOpen, externalPrefill, externalAutoModal, onExternalHandled }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [open, setOpen]       = useState(false);
  const [hareketler, setHar]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setModal] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [deleting, setDel]    = useState(null);
  const loaded = useRef(false);

  const loadHareketler = useCallback(async () => {
    setLoading(true);
    try {
      const col = contactType === 'customer' ? 'musteri_id' : 'tedarikci_id';
      const { data } = await supabase.from('cari_hareketler')
        .select('*').eq(col, contact.id)
        .order('tarih', { ascending: true })
        .order('created_at', { ascending: true });
      setHar(data || []);
    } finally { setLoading(false); }
  }, [contact.id, contactType]);

  // Dışarından (location.state) otomatik aç
  useEffect(() => {
    if (!externalOpen) return;
    setOpen(true);
    const doOpen = async () => {
      if (!loaded.current) { loaded.current = true; await loadHareketler(); }
      if (externalAutoModal) {
        setPrefill(externalPrefill || null);
        setModal(true);
        onExternalHandled?.();
      }
    };
    doOpen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpen, externalAutoModal]);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded.current) { loaded.current = true; await loadHareketler(); }
  };

  const handleDelete = async (id) => {
    setDel(id);
    await supabase.from('cari_hareketler').delete().eq('id', id);
    setHar(h => h.filter(x => x.id !== id));
    setDel(null);
  };

  // Anlık bakiye (borc=Alacak, alacak=Verecek → net = borc - alacak)
  let running = 0;
  const rows = hareketler.map(h => {
    running += (h.borc || 0) - (h.alacak || 0);
    return { ...h, snapshot: running };
  });
  // Yerel veri yüklenmeden önce parent'ın önceden hesapladığı bakiyeyi göster
  const totalBalance = hareketler.length > 0 ? running : (preloadedBalance ?? 0);

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: open ? `1px solid ${color}30` : `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}`,
        background: isDark ? 'rgba(255,255,255,0.025)' : '#fafbfc',
      }}>

      {/* Başlık satırı */}
      <button onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: color + '20', color }}>
          {(contact.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{contact.name}</p>
          <p className="text-[11px] truncate" style={{ color: '#64748b' }}>{contact.phone || contact.vkntckn || '—'}</p>
        </div>
        <BalanceChip value={totalBalance}/>
        <ChevronDown size={15} className="text-slate-500 shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
      </button>

      {/* ── Detay (açık) ── */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="px-3 pb-4" style={{ borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}` }}>

              {loading && (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }}/>
                  <span className="text-xs" style={{ color: '#64748b' }}>Yükleniyor…</span>
                </div>
              )}

              {!loading && rows.length === 0 && (
                <div className="text-center py-8">
                  <Receipt size={26} className="mx-auto mb-2 opacity-20" style={{ color: '#94a3b8' }}/>
                  <p className="text-xs" style={{ color: '#64748b' }}>Henüz hareket yok</p>
                </div>
              )}

              {!loading && rows.length > 0 && (
                <div className="mt-3 w-full overflow-x-auto">
                  {/* Sabit genişlik tablosu */}
                  <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: '520px' }}>
                    <colgroup>
                      <col style={{ width: '82px' }}/>  {/* Tarih */}
                      <col/>                             {/* Başlık — flexible */}
                      <col style={{ width: '88px' }}/>  {/* Alacak */}
                      <col style={{ width: '88px' }}/>  {/* Verecek */}
                      <col style={{ width: '92px' }}/>  {/* Bakiye */}
                      <col style={{ width: '28px' }}/>  {/* Sil */}
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0'}` }}>
                        <th className="text-left pb-2 pt-1 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Tarih</th>
                        <th className="text-left pb-2 pt-1 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Başlık</th>
                        <th className="text-right pb-2 pt-1 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: contactType === 'customer' ? '#059669' : '#dc2626' }}>
                          {contactType === 'customer' ? 'Alacak' : 'Verecek'}
                        </th>
                        <th className="text-right pb-2 pt-1 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: contactType === 'customer' ? '#2563eb' : '#f97316' }}>
                          {contactType === 'customer' ? 'Alınan' : 'Verilen'}
                        </th>
                        <th className="text-right pb-2 pt-1 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Bakiye</th>
                        <th/>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((h, i) => {
                        const balColor = h.snapshot > 0 ? '#10b981' : h.snapshot < 0 ? '#ef4444' : '#64748b';
                        const balLabel = h.snapshot > 0 ? 'Alacak' : h.snapshot < 0 ? 'Verecek' : 'Eşit';
                        return (
                          <motion.tr key={h.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.025 }}
                            className="group transition-colors"
                            style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : '#f1f5f9'}` }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td className="py-2 px-1 whitespace-nowrap text-[11px]" style={{ color: '#64748b' }}>
                              {fmtD(h.tarih)}
                            </td>
                            <td className="py-2 px-1 overflow-hidden">
                              <p className="font-medium truncate text-[12px]" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{h.baslik}</p>
                              {h.aciklama && <p className="truncate text-[10px]" style={{ color: '#94a3b8' }}>{h.aciklama}</p>}
                            </td>
                            <td className="py-2 px-1 font-mono text-right whitespace-nowrap">
                              {h.borc > 0
                                ? <span className="text-[12px]" style={{ color: '#10b981' }}>{fmtN(h.borc)}</span>
                                : <span className="text-[11px]" style={{ color: '#94a3b8' }}>—</span>}
                            </td>
                            <td className="py-2 px-1 font-mono text-right whitespace-nowrap">
                              {h.alacak > 0
                                ? <span className="text-[12px]" style={{ color: '#ef4444' }}>{fmtN(h.alacak)}</span>
                                : <span className="text-[11px]" style={{ color: '#94a3b8' }}>—</span>}
                            </td>
                            <td className="py-2 px-1 font-mono text-right whitespace-nowrap">
                              <span className="font-bold text-[11px]" style={{ color: balColor }}>
                                {fmtN(Math.abs(h.snapshot))}
                              </span>
                              <span className="block text-[9px] font-semibold" style={{ color: balColor }}>{balLabel}</span>
                            </td>
                            <td className="py-2 px-1">
                              <button onClick={() => handleDelete(h.id)} disabled={deleting === h.id}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 transition-all" style={{ color: '#94a3b8' }}>
                                {deleting === h.id ? <Loader2 size={11} className="animate-spin"/> : <Trash2 size={11}/>}
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                    {/* Toplam satırı */}
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}` }}>
                         <td colSpan={2} className="pt-2 pb-1 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Net Bakiye</td>
                        <td className="pt-2 pb-1 px-1 font-mono font-bold text-right text-emerald-500 text-[11px]">
                          {fmtN(rows.reduce((s, h) => s + (h.borc || 0), 0))} ₺
                          <span className="block text-[9px] font-normal text-slate-400">{contactType === 'customer' ? 'Alacak' : 'Verecek'}</span>
                        </td>
                        <td className="pt-2 pb-1 px-1 font-mono font-bold text-right text-[11px]"
                          style={{ color: contactType === 'customer' ? '#2563eb' : '#f97316' }}>
                          {fmtN(rows.reduce((s, h) => s + (h.alacak || 0), 0))} ₺
                          <span className="block text-[9px] font-normal text-slate-400">{contactType === 'customer' ? 'Alınan' : 'Verilen'}</span>
                        </td>
                        <td className="pt-2 pb-1 px-1 font-mono font-bold text-right text-[11px]"
                          style={{ color: totalBalance > 0 ? '#10b981' : totalBalance < 0 ? '#ef4444' : '#64748b' }}>
                          {fmtN(Math.abs(totalBalance))} ₺
                          <span className="block text-[9px] font-semibold"
                            style={{ color: totalBalance > 0 ? '#10b981' : totalBalance < 0 ? '#ef4444' : '#64748b' }}>
                            {totalBalance > 0 ? 'Alacak' : totalBalance < 0 ? 'Verecek' : 'Eşit'}
                          </span>
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Hareket ekle */}
              <button onClick={() => setModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all mt-3"
                style={{ background: `${color}12`, color, border: `1px dashed ${color}35` }}>
                <Plus size={12}/> Hareket Ekle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showModal && (
        <HareketModal contact={contact} contactType={contactType}
          prefill={prefill}
          onClose={() => { setModal(false); setPrefill(null); }}
          onSaved={async () => {
            setModal(false);
            setPrefill(null);
            loaded.current = false;
            await loadHareketler();
            loaded.current = true;
          }}/>
      )}
    </div>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function HesapDefteri() {
  const { currentColor, effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [activeTab, setActiveTab]   = useState('faturali_cari');
  const [contacts, setContacts]     = useState([]);
  const [balances, setBalances]     = useState({});   // { [contactId]: number }
  const [lastDates, setLastDates]   = useState({});   // { [contactId]: string }
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [sort, setSort]             = useState('alacak_d');
  const [sortOpen, setSortOpen]     = useState(false);

  const tab = TABS.find(t => t.id === activeTab);

  const loadContacts = useCallback(async () => {
    if (!tab) return;
    setLoading(true);
    try {
      const table = tab.type === 'customer' ? 'customers' : 'suppliers';
      const idCol  = tab.type === 'customer' ? 'musteri_id' : 'tedarikci_id';

      // 1. Kişi listesi
      const { data: contactData } = await supabase
        .from(table)
        .select('id, name, phone, vkntckn, email, city, is_faturasiz')
        .eq('is_faturasiz', tab.faturasiz)
        .eq('is_active', true);
      const list = contactData || [];

      // 2. Toplam bakiyeler
      const ids = list.map(c => c.id);
      if (ids.length > 0) {
        const { data: aggData } = await supabase
          .from('cari_hareketler')
          .select(`${idCol}, borc, alacak, tarih`)
          .in(idCol, ids);

        // Bakiye ve son tarih hesapla
        const balMap = {}, dateMap = {};
        (aggData || []).forEach(h => {
          const cid = h[idCol];
          if (!cid) return;
          balMap[cid]  = (balMap[cid]  || 0) + (h.borc || 0) - (h.alacak || 0);
          if (!dateMap[cid] || h.tarih > dateMap[cid]) dateMap[cid] = h.tarih;
        });
        setBalances(balMap);
        setLastDates(dateMap);
      } else {
        setBalances({});
        setLastDates({});
      }

      setContacts(list);
    } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // location.state ile Customers/Suppliers'dan gelince otomatik HareketModal aç
  const location = useLocation();
  const [pendingHareket, setPendingHareket] = useState(null); // { contact, contactType, prefill }
  useEffect(() => {
    const state = location.state;
    if (!state?.openHareket) return;
    const { contactId, contactType: cType, prefill: pf, tabId } = state.openHareket;
    // Sekmeyi seç
    if (tabId) setActiveTab(tabId);
    // Contacts yüklenince bul ve modal aç
    setPendingHareket({ contactId, contactType: cType, prefill: pf });
    window.history.replaceState({}, '');
  }, [location.state]);

  // contacts yüklendiğinde pending hareket varsa işle
  useEffect(() => {
    if (!pendingHareket || contacts.length === 0) return;
    const found = contacts.find(c => c.id === pendingHareket.contactId);
    if (found) {
      setSelectedContact({
        contact: found,
        contactType: pendingHareket.contactType,
        prefill: pendingHareket.prefill,
        autoOpenModal: true,
      });
      setPendingHareket(null);
    }
  }, [contacts, pendingHareket]);

  const [selectedContact, setSelectedContact] = useState(null); // { contact, contactType, prefill, autoOpenModal }

  // Filtre + sıralama
  const filtered = contacts
    .filter(c =>
      search === '' ||
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.vkntckn || '').includes(search)
    )
    .sort((a, b) => {
      const ba = balances[a.id] || 0;
      const bb = balances[b.id] || 0;
      const da = lastDates[a.id] || '';
      const db = lastDates[b.id] || '';
      switch (sort) {
        case 'az':        return (a.name || '').localeCompare(b.name || '', 'tr');
        case 'za':        return (b.name || '').localeCompare(a.name || '', 'tr');
        case 'alacak_d':  return Math.max(0, bb) - Math.max(0, ba);
        case 'alacak_a':  return Math.max(0, ba) - Math.max(0, bb);
        case 'verecek_d': return Math.min(0, ba) - Math.min(0, bb);
        case 'verecek_a': return Math.min(0, bb) - Math.min(0, ba);
        case 'yeni':      return db > da ? 1 : db < da ? -1 : 0;
        case 'eski':      return da > db ? 1 : da < db ? -1 : 0;
        default:          return 0;
      }
    });

  const tabColor = tab?.type === 'customer' ? '#3b82f6' : '#f97316';
  const sortLabel = SORT_OPTIONS.find(s => s.id === sort)?.label || 'Sırala';

  // Özet: toplam alacak ve verecek
  const totalAlacak  = Object.values(balances).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const totalVerecek = Object.values(balances).filter(v => v < 0).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${currentColor}20` }}>
            <BookOpen size={18} style={{ color: currentColor }}/>
          </div>
          <div>
            <h1 className="text-lg font-bold">Hesap Defteri</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Alacak / Verecek Takibi</p>
          </div>
        </div>

        {/* Özet bar */}
        {!loading && (totalAlacak !== 0 || totalVerecek !== 0) && (
          <div className="flex gap-3 mt-3">
            <div className="flex-1 flex items-start justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#059669' }}>
                  {tab?.type === 'customer' ? 'Toplam Alacak' : 'Toplam Verecek'}
                </p>
                <p className="text-[10px] text-slate-500">{tab?.type === 'customer' ? 'Müşterilerden alacağımız' : 'Tedarikçilere ödeyeceğimiz'}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: '#10b981' }}>{fmtN(totalAlacak)} ₺</p>
            </div>
            <div className="flex-1 flex items-start justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#dc2626' }}>
                  {tab?.type === 'customer' ? 'Toplam Alınan' : 'Toplam Verilen'}
                </p>
                <p className="text-[10px] text-slate-500">{tab?.type === 'customer' ? 'Müşteriden alınan (tahsilat)' : 'Tedarikçiye verilen (ödeme)'}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{fmtN(Math.abs(totalVerecek))} ₺</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Sekmeler ── */}
      <div className="flex-shrink-0 px-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }}>
          {TABS.map(t => {
            const active = t.id === activeTab;
            const c = t.type === 'customer' ? '#3b82f6' : '#f97316';
            return (
              <button key={t.id}
                onClick={() => { setActiveTab(t.id); setSearch(''); setSortOpen(false); }}
                className="flex items-center gap-1.5 flex-1 justify-center py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all truncate"
                style={{
                  background: active ? `${c}20` : 'transparent',
                  color: active ? c : '#64748b',
                  border: active ? `1px solid ${c}30` : '1px solid transparent',
                }}>
                <t.icon size={11} className="shrink-0"/>
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Arama + Sıralama ── */}
      <div className="flex-shrink-0 px-6 mt-3 flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0'}` }}>
          <Search size={13} style={{ color: '#94a3b8' }} className="shrink-0"/>
          <input className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}
            placeholder={`${tab?.label} ara…`} value={search}
            onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color: '#94a3b8' }}/></button>}
        </div>

        {/* Sıralama dropdown */}
        <div className="relative">
          <button onClick={() => setSortOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              background: sortOpen ? `${tabColor}20` : (isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'),
              border: `1px solid ${sortOpen ? tabColor + '40' : (isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0')}`,
              color: sortOpen ? tabColor : '#64748b',
            }}>
            <ChevronsUpDown size={12}/>
            <span className="hidden sm:inline">{sortLabel}</span>
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: isDark ? '#0f1f38' : '#ffffff', border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`, minWidth: '160px' }}>
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.id}
                    onClick={() => { setSort(opt.id); setSortOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={{
                      background: sort === opt.id ? `${tabColor}20` : 'transparent',
                      color: sort === opt.id ? tabColor : '#94a3b8',
                    }}>
                    {sort === opt.id && <span className="mr-1">✓</span>}
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── İçerik ── */}
      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 size={20} className="animate-spin" style={{ color: tabColor }}/>
            <span className="text-sm" style={{ color: '#64748b' }}>Yükleniyor…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            {tab?.type === 'customer'
              ? <User size={38} className="mx-auto mb-3 opacity-20" style={{ color: '#94a3b8' }}/>
              : <Building2 size={38} className="mx-auto mb-3 opacity-20" style={{ color: '#94a3b8' }}/>}
            <p className="text-sm" style={{ color: '#64748b' }}>
              {search ? 'Arama sonucu bulunamadı' : `${tab?.label} bulunamadı`}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {!loading && filtered.map((contact, i) => {
            const isSel = selectedContact?.contact?.id === contact.id;
            return (
              <motion.div key={contact.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.018 }}>
                <ContactRow
                  contact={contact}
                  contactType={tab?.type}
                  color={tabColor}
                  preloadedBalance={balances[contact.id] ?? 0}
                  externalOpen={isSel}
                  externalPrefill={isSel ? selectedContact?.prefill : null}
                  externalAutoModal={isSel && !!selectedContact?.autoOpenModal}
                  onExternalHandled={() => setSelectedContact(null)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Alt bilgi ── */}
      {!loading && filtered.length > 0 && (
        <div className="flex-shrink-0 px-6 py-2 border-t text-center"
          style={{ borderColor: isDark ? 'rgba(148,163,184,0.07)' : '#e2e8f0' }}>
          <p className="text-[11px]" style={{ color: '#64748b' }}>
            {filtered.length} kayıt · {SORT_OPTIONS.find(s => s.id === sort)?.label}
          </p>
        </div>
      )}
    </div>
  );
}
