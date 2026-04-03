import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronDown, Plus, Search, Trash2, Edit2,
  TrendingUp, TrendingDown, Minus, X, Check, Loader2,
  Receipt, User, Building2, AlertCircle, CheckCircle2,
  ArrowUpRight, ArrowDownLeft, Filter, Download
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../contexts/ThemeContext';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const fmtN  = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD  = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const today = () => new Date().toISOString().slice(0, 10);

// ── Tab tanımları ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'faturali_cari',        label: 'Faturalı Cari',        type: 'customer', faturasiz: false, icon: User       },
  { id: 'faturasiz_cari',       label: 'Faturasız Cari',       type: 'customer', faturasiz: true,  icon: User       },
  { id: 'faturali_tedarikci',   label: 'Faturalı Tedarikçi',  type: 'supplier', faturasiz: false, icon: Building2  },
  { id: 'faturasiz_tedarikci',  label: 'Faturasız Tedarikçi', type: 'supplier', faturasiz: true,  icon: Building2  },
];

// ── Hareket formu (modal) ──────────────────────────────────────────────────────
function HareketModal({ contact, contactType, onClose, onSaved }) {
  const { currentColor } = useTheme();
  const [form, setForm] = useState({
    tarih: today(), baslik: '', aciklama: '',
    borc: '', alacak: '', currency: 'TRY'
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!form.baslik.trim())          return setErr('Başlık zorunlu');
    if (!form.borc && !form.alacak)   return setErr('Borç veya alacak tutarı girilmeli');
    setSaving(true); setErr('');
    try {
      const payload = {
        tarih:   form.tarih,
        baslik:  form.baslik.trim(),
        aciklama: form.aciklama || null,
        borc:    parseFloat(form.borc)   || 0,
        alacak:  parseFloat(form.alacak) || 0,
        currency: form.currency,
        kaynak:  'manual',
      };
      if (contactType === 'customer') payload.musteri_id    = contact.id;
      else                             payload.tedarikci_id  = contact.id;

      const { error } = await supabase.from('cari_hareketler').insert(payload);
      if (error) throw error;
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const inp = 'w-full px-3 py-2 text-sm rounded-xl outline-none';
  const inpStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.18)', color: '#f1f5f9' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: '#0f1f38', border: '1px solid rgba(148,163,184,0.12)' }}>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Yeni Hareket</p>
            <h3 className="text-sm font-bold text-white mt-0.5">{contact.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white"><X size={16}/></button>
        </div>

        {/* Tip seçimi */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Borç (Alacağımız)',   field: 'borc',   color: '#ef4444', icon: TrendingUp },
            { label: 'Alacak (Ödeme)',       field: 'alacak', color: '#10b981', icon: TrendingDown },
          ].map(({ label, field, color, icon: Ic }) => (
            <div key={field}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
              <div className="flex items-center gap-1.5">
                <Ic size={12} style={{ color }} className="shrink-0" />
                <input type="number" className={inp} style={inpStyle}
                  placeholder="0.00" step="0.01" min="0"
                  value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value, [field === 'borc' ? 'alacak' : 'borc']: '' }))} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Başlık / Fatura No *</p>
          <input className={inp} style={inpStyle} placeholder="FAT-2025-001 veya Ödeme vb."
            value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tarih</p>
            <input type="date" className={inp} style={inpStyle}
              value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Para Birimi</p>
            <select className={inp} style={inpStyle}
              value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {['TRY', 'USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Açıklama</p>
          <textarea className={`${inp} resize-none`} style={inpStyle} rows={2}
            placeholder="İsteğe bağlı not..."
            value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} />
        </div>

        {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12}/>{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-slate-400"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)' }}>
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

// ── Tekil kişi satırı (accordion) ─────────────────────────────────────────────
function ContactRow({ contact, contactType, color }) {
  const [open, setOpen]       = useState(false);
  const [hareketler, setHar]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setModal] = useState(false);
  const [deleting, setDel]    = useState(null);
  const loaded = useRef(false);

  const loadHareketler = useCallback(async () => {
    setLoading(true);
    try {
      const filter = contactType === 'customer'
        ? { musteri_id:   contact.id }
        : { tedarikci_id: contact.id };
      const col = contactType === 'customer' ? 'musteri_id' : 'tedarikci_id';
      const { data } = await supabase.from('cari_hareketler')
        .select('*').eq(col, contact.id).order('tarih', { ascending: true }).order('created_at', { ascending: true });
      setHar(data || []);
    } finally { setLoading(false); }
  }, [contact.id, contactType]);

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

  // Anlık bakiye hesabı (running balance)
  let runningBalance = 0;
  const rows = hareketler.map(h => {
    runningBalance += (h.borc || 0) - (h.alacak || 0);
    return { ...h, snapshot_balance: runningBalance };
  });
  const totalBalance = runningBalance;

  const balColor = totalBalance > 0 ? '#ef4444' : totalBalance < 0 ? '#10b981' : '#94a3b8';
  const balLabel = totalBalance > 0 ? 'Borçlu' : totalBalance < 0 ? 'Alacaklı' : 'Eşit';

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ border: open ? `1px solid ${color}30` : '1px solid rgba(148,163,184,0.08)', background: 'rgba(255,255,255,0.025)' }}>

      {/* Başlık satırı */}
      <button onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0"
          style={{ background: color + '30', color }}>
          {(contact.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{contact.name}</p>
          <p className="text-[11px] text-slate-500 truncate">{contact.phone || contact.vkntckn || '—'}</p>
        </div>
        {/* Bakiye */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: balColor }}>
            {totalBalance === 0 ? '—' : `${fmtN(Math.abs(totalBalance))} ₺`}
          </p>
          <p className="text-[10px]" style={{ color: balColor }}>{balLabel}</p>
        </div>
        <ChevronDown size={16} className="text-slate-500 shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {/* Detay (açık) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>

              {loading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 size={18} className="animate-spin text-blue-400"/>
                  <span className="text-sm text-slate-400">Yükleniyor...</span>
                </div>
              )}

              {!loading && rows.length === 0 && (
                <div className="text-center py-6">
                  <Receipt size={28} className="mx-auto mb-2 opacity-20 text-slate-400"/>
                  <p className="text-xs text-slate-500">Henüz hareket yok</p>
                </div>
              )}

              {!loading && rows.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                        {['Tarih', 'Başlık / Açıklama', 'Borç', 'Alacak', 'Bakiye', ''].map(h => (
                          <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((h, i) => (
                        <motion.tr key={h.id}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="group border-b border-slate-800/50 hover:bg-white/[0.03] transition-colors">
                          <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{fmtD(h.tarih)}</td>
                          <td className="py-2 px-2 max-w-[180px]">
                            <p className="text-slate-200 font-medium truncate">{h.baslik}</p>
                            {h.aciklama && <p className="text-slate-600 truncate">{h.aciklama}</p>}
                          </td>
                          <td className="py-2 px-2 font-mono text-right">
                            {h.borc > 0 ? <span className="text-red-400">+{fmtN(h.borc)}</span> : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="py-2 px-2 font-mono text-right">
                            {h.alacak > 0 ? <span className="text-emerald-400">-{fmtN(h.alacak)}</span> : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="py-2 px-2 font-mono font-bold text-right whitespace-nowrap"
                            style={{ color: h.snapshot_balance > 0 ? '#ef4444' : h.snapshot_balance < 0 ? '#10b981' : '#94a3b8' }}>
                            {fmtN(Math.abs(h.snapshot_balance))} ₺
                          </td>
                          <td className="py-2 px-2">
                            <button onClick={() => handleDelete(h.id)} disabled={deleting === h.id}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 transition-all">
                              {deleting === h.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                    {/* Toplam */}
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(148,163,184,0.15)' }}>
                        <td colSpan={2} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Net Bakiye</td>
                        <td className="py-2 px-2 font-mono font-bold text-right text-red-400 text-xs">
                          {fmtN(rows.reduce((s, h) => s + h.borc, 0))} ₺
                        </td>
                        <td className="py-2 px-2 font-mono font-bold text-right text-emerald-400 text-xs">
                          {fmtN(rows.reduce((s, h) => s + h.alacak, 0))} ₺
                        </td>
                        <td className="py-2 px-2 font-mono font-bold text-right text-xs"
                          style={{ color: balColor }}>
                          {fmtN(Math.abs(totalBalance))} ₺
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Hareket ekle butonu */}
              <button onClick={() => setModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all mt-2"
                style={{ background: `${color}15`, color, border: `1px dashed ${color}40` }}>
                <Plus size={13}/> Hareket Ekle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hareket modal */}
      {showModal && (
        <HareketModal
          contact={contact}
          contactType={contactType}
          onClose={() => setModal(false)}
          onSaved={async () => {
            setModal(false);
            loaded.current = false;
            await loadHareketler();
            loaded.current = true;
          }}
        />
      )}
    </div>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function HesapDefteri() {
  const { currentColor, effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [activeTab, setActiveTab] = useState('faturali_cari');
  const [contacts, setContacts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');

  const tab = TABS.find(t => t.id === activeTab);

  const loadContacts = useCallback(async () => {
    if (!tab) return;
    setLoading(true);
    try {
      const table = tab.type === 'customer' ? 'customers' : 'suppliers';
      const { data } = await supabase
        .from(table)
        .select('id, name, phone, vkntckn, email, city, is_faturasiz')
        .eq('is_faturasiz', tab.faturasiz)
        .eq('is_active', true)
        .order('name');
      setContacts(data || []);
    } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const filtered = contacts.filter(c =>
    search === '' ||
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.vkntckn || '').includes(search)
  );

  const tabColor = tab?.type === 'customer' ? '#3b82f6' : '#f97316';

  return (
    <div className="flex flex-col h-full" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${currentColor}20` }}>
              <BookOpen size={18} style={{ color: currentColor }}/>
            </div>
            <div>
              <h1 className="text-lg font-bold">Hesap Defteri</h1>
              <p className="text-xs text-slate-500">Cari ve Tedarikçi Borç / Alacak Takibi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex-shrink-0 px-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {TABS.map(t => {
            const active = t.id === activeTab;
            const c = t.type === 'customer' ? '#3b82f6' : '#f97316';
            return (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(''); }}
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

      {/* Arama */}
      <div className="flex-shrink-0 px-6 mt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
          <Search size={14} className="text-slate-500 shrink-0"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder-slate-600"
            placeholder={`${tab?.label} ara...`}
            value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-500"/></button>}
        </div>
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 size={22} className="animate-spin" style={{ color: tabColor }}/>
            <span className="text-sm text-slate-400">Yükleniyor...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            {tab?.type === 'customer' ? <User size={40} className="mx-auto mb-3 opacity-20 text-slate-400"/> : <Building2 size={40} className="mx-auto mb-3 opacity-20 text-slate-400"/>}
            <p className="text-sm text-slate-500">
              {search ? 'Arama sonucu bulunamadı' : `${tab?.label} bulunamadı`}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {!loading && filtered.map((contact, i) => (
            <motion.div key={contact.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}>
              <ContactRow
                contact={contact}
                contactType={tab?.type}
                color={tabColor}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Özet alt bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex-shrink-0 px-6 py-3 border-t" style={{ borderColor: 'rgba(148,163,184,0.08)' }}>
          <p className="text-xs text-slate-500 text-center">
            {filtered.length} {tab?.label.toLowerCase()} listeleniyor
          </p>
        </div>
      )}
    </div>
  );
}
