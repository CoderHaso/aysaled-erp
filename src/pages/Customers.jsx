import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Building2, Phone, Mail, X, Loader2, RefreshCw,
  Receipt, TrendingUp, Users, ChevronRight, Edit3, Trash2,
  AlertCircle, FileText, Package, CheckCircle2, Info, ExternalLink,
  CreditCard, CalendarClock, AlertTriangle, ArrowDownLeft, ArrowUpRight,
  Bell, Clock, ShoppingCart,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { pageCache } from '../lib/pageCache';
import CustomDialog from '../components/CustomDialog';
import PaymentsTab from '../components/PaymentsTab';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';

// ─── Toast ─────────────────────────────────────────────────────────────────
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

// ─── Detail Drawer ─────────────────────────────────────────────────────────
function CustomerDrawer({ customer, onClose, onSaved, setDialog }) {
  const { currentColor } = useTheme();
  const navigate = useNavigate();
  const [invoices, setInvoices]       = useState([]);
  const [loadingInv, setLoadingInv]   = useState(true);
  const [tab, setTab]                 = useState('info');   // 'info' | 'invoices'
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState({ ...customer });
  const [saving, setSaving]           = useState(false);

  const [payments, setPayments]       = useState([]);

  const isNew = !customer.id;

  useEffect(() => {
    if (!customer.vkntckn || isNew) { setLoadingInv(false); return; }
    setLoadingInv(true);
    // Carilere gönderdiğimiz faturalar = outbox (giden/satış faturası)
    supabase.from('invoices').select('*').eq('vkntckn', customer.vkntckn).eq('type', 'outbox')
      .order('issue_date', { ascending: false })
      .then(({ data }) => { setInvoices(data || []); setLoadingInv(false); });
  }, [customer.vkntckn]);

  // Ödemeler
  useEffect(() => {
    if (!customer.id || isNew) return;
    supabase.from('payments')
      .select('*')
      .eq('entity_type', 'customer')
      .eq('entity_id', customer.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []));
  }, [customer.id]);

  // Faturasız müşteri için siparisler
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  useEffect(() => {
    if (!customer.id || isNew || !customer.is_faturasiz) return;
    setLoadingOrders(true);
    supabase.from('orders').select('id,order_number,created_at,grand_total,status,customer_name')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOrders(data || []); setLoadingOrders(false); });
  }, [customer.id, customer.is_faturasiz]);

  // Ödemeye geçir ön-doldurma state
  const [paymentPrefill, setPaymentPrefill] = useState(null);

  // Toplam bakiye (TL cinsinden)
  const balance = payments.reduce((s, p) => {
    const amt = p.amount_try || p.amount || 0;
    return p.direction === 'receivable' ? s + amt : s - amt;
  }, 0);
  const hasOverdue = payments.some(p => p.status === 'overdue');

  const totalAmount = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const lastInvoice = invoices[0];

  const handleSave = async () => {
    setSaving(true);
    pageCache.invalidate('customers');
    try {
      if (isNew) {
        await supabase.from('customers').insert({ ...form, source: 'manual' });
      } else {
        await supabase.from('customers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', customer.id);
      }
      onSaved?.();
      onClose();
    } catch (e) { 
      setDialog({ open: true, title: 'Hata', message: 'Kayıt sırasında hata oluştu: ' + e.message, type: 'alert' });
    }
    finally { setSaving(false); }
  };

  const fmtBalance = (n) => {
    const abs = Math.abs(n);
    return abs.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const TABS = [
    { id: 'info',     label: 'Bilgiler',                       icon: Info },
    ...(customer.is_faturasiz
      ? [{ id: 'orders',  label: `Siparisler (${orders.length})`,    icon: ShoppingCart }]
      : [{ id: 'invoices',label: `Faturalar (${invoices.length})`,   icon: Receipt }]
    ),
    { id: 'payments', label: `Ödemeler (${payments.length})`,  icon: CreditCard },
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
                  style={{ background: currentColor }}>
                  {(form.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cari</p>
                  <h2 className="text-sm font-bold text-slate-100 leading-tight max-w-[220px] truncate">
                    {form.name || 'Yeni Cari'}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isNew && (
                  <button onClick={() => setEditing(v => !v)}
                    className="p-2 rounded-xl transition-colors text-slate-400 hover:text-white"
                    style={{ background: editing ? `${currentColor}20` : 'transparent' }}>
                    <Edit3 size={15} style={{ color: editing ? currentColor : undefined }} />
                  </button>
                )}
                <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Stats (değil yeni) */}
            {!isNew && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: 'Fatura', value: invoices.length, color: currentColor },
                  {
                    label: 'Bakiye (TL)',
                    value: balance === 0 ? '₺0' : `${balance > 0 ? '+' : '-'}₺${fmtBalance(balance)}`,
                    color: balance > 0 ? '#10b981' : balance < 0 ? '#ef4444' : '#94a3b8'
                  },
                  { label: 'Son Fatura', value: fmtD(lastInvoice?.issue_date), color: '#f59e0b' },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-2.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${hasOverdue && i===1 ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.08)'}` }}>
                    <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                    {hasOverdue && i === 1 && (
                      <p className="text-[9px] text-red-400 font-bold mt-0.5">⚠ Vadesi geçmiş!</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            {!isNew && (
              <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className="flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: tab === t.id ? currentColor : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8' }}>
                    <t.icon size={11} />{t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* ── Bilgiler Tab ── */}
            {(tab === 'info' || isNew) && (
              <div className="space-y-3">
                {[
                  { k: 'name',        l: 'Cari Adı / Unvan *',  ph: 'Ahmet Demir veya Firma A.Ş.' },
                  { k: 'vkntckn',     l: 'VKN / TCKN',          ph: '1234567890' },
                  { k: 'tax_office',  l: 'Vergi Dairesi',        ph: 'Kadıköy VD' },
                  { k: 'phone',       l: 'Telefon',              ph: '0212 000 00 00' },
                  { k: 'email',       l: 'E-posta',              ph: 'info@ornek.com' },
                  { k: 'address',     l: 'Adres',                ph: 'Mahalle, Cadde...' },
                  { k: 'city',        l: 'Şehir',                ph: 'İstanbul' },
                  { k: 'notes',       l: 'Notlar',               ph: 'Ek bilgiler...' },
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

                {/* Faturasız Toggle */}
                {(editing || isNew) && (
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                    style={{ background: 'rgba(245,158,11,0.06)', border: `1px solid ${form.is_faturasiz ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.1)'}` }}>
                    <div onClick={() => setForm(f => ({ ...f, is_faturasiz: !f.is_faturasiz }))}
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all cursor-pointer"
                      style={{ background: form.is_faturasiz ? '#f59e0b' : 'rgba(255,255,255,0.08)', border: `1px solid ${form.is_faturasiz ? '#f59e0b' : 'rgba(148,163,184,0.2)'}` }}>
                      {form.is_faturasiz && <CheckCircle2 size={11} color="white" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: form.is_faturasiz ? '#f59e0b' : '#94a3b8' }}>Faturasız Cari</p>
                      <p className="text-[10px] text-slate-500">E-fatura dışında, nakit / kayıt dışı işlemler için</p>
                    </div>
                  </label>
                )}
                {!editing && !isNew && customer.is_faturasiz && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span className="text-[11px] font-bold text-amber-400">⚠ Faturasız Cari — e-fatura dışında işlemler</span>
                  </div>
                )}

                {/* Kaydet butonu */}
                {(editing || isNew) && (
                  <div className="flex gap-2 pt-2">
                    {!isNew && (
                      <button onClick={() => { setEditing(false); setForm({ ...customer }); }}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)' }}>
                        İptal
                      </button>
                    )}
                    <button onClick={handleSave} disabled={saving || !form.name?.trim()}
                      className="flex-1 py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                      style={{ background: currentColor, opacity: (!form.name?.trim() || saving) ? 0.6 : 1 }}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {isNew ? 'Kaydet' : 'Güncelle'}
                    </button>
                  </div>
                )}

                {/* Kaynak badge */}
                {!isNew && customer.source === 'invoice_sync' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl"
                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <Receipt size={12} className="text-blue-400" />
                    <p className="text-xs text-blue-400">Bu cari, fatura senkronizasyonundan oluşturuldu.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Faturalar Tab ── */}
            {tab === 'invoices' && !isNew && (
              <div className="space-y-3">
                {loadingInv && (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <Loader2 size={22} className="animate-spin text-blue-400" />
                    <span className="text-sm text-slate-400">Yükleniyor...</span>
                  </div>
                )}
                {!loadingInv && invoices.length === 0 && (
                  <div className="text-center py-10">
                    <Receipt size={36} className="mx-auto mb-2 opacity-20 text-slate-400" />
                    <p className="text-sm text-slate-500">Bu cariye ait fatura bulunamadı.</p>
                  </div>
                )}
                  {!loadingInv && invoices.map((inv, i) => (
                    <motion.div key={inv.id || i}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-2xl p-4 group transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = `${currentColor}40`}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(148,163,184,0.08)'}
                    >
                      {/* Fatura başlık satırı */}
                      <div className="flex items-start justify-between gap-2" onClick={() => {
                        onClose();
                        navigate('/incoming-invoices', { state: { openInvoiceId: inv.invoice_id, documentId: inv.document_id } });
                      }} style={{ cursor: 'pointer' }}>
                        <div className="flex-1">
                          <p className="text-xs font-mono text-blue-400 font-bold">{inv.invoice_id}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{fmtD(inv.issue_date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-100">{fmt(inv.amount)} <span className="text-[10px] text-slate-500">{inv.currency}</span></p>
                            <StatusDot status={inv.status} />
                          </div>
                          <ExternalLink size={12} className="text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                        </div>
                      </div>

                      {/* Kalemler */}
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

                      {/* Ödemeye Geçir Butonu */}
                      <div className="mt-2.5 pt-2 flex justify-end"
                        style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setPaymentPrefill({
                              direction: 'receivable',
                              amount: inv.amount,
                              currency: inv.currency || 'TRY',
                              description: `Fatura: ${inv.invoice_id}`,
                            });
                            setTab('payments');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                        >
                          <CreditCard size={11} />Ödemeye Geçir
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
            )}

            {/* ── Siparisler Tab (Faturasız musteriler için) ── */}
            {tab === 'orders' && !isNew && (
              <div className="space-y-3">
                {loadingOrders && (
                  <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-blue-400" /></div>
                )}
                {!loadingOrders && orders.length === 0 && (
                  <div className="text-center py-10">
                    <ShoppingCart size={36} className="mx-auto mb-2 opacity-20 text-slate-400" />
                    <p className="text-sm text-slate-500">Bu cariye ait siparis bulunamadı.</p>
                  </div>
                )}
                {!loadingOrders && orders.map((ord, i) => {
                  const statusColors = { completed: '#10b981', pending: '#f59e0b', cancelled: '#ef4444' };
                  const statusLabels = { completed: 'Tamamlandı', pending: 'Bekliyor', cancelled: 'İptal' };
                  const sc = statusColors[ord.status] || '#94a3b8';
                  return (
                    <div key={ord.id} className="rounded-2xl p-4 transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono font-bold" style={{ color: currentColor }}>{ord.order_number || ord.id.slice(0,8)}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{fmtD(ord.created_at?.split('T')[0])}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-100">{fmt(ord.grand_total)} ₺</p>
                          <span className="text-[10px] font-bold" style={{ color: sc }}>{statusLabels[ord.status] || ord.status}</span>
                        </div>
                      </div>
                      <div className="flex justify-end mt-2 pt-2" style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                        <button
                          onClick={() => {
                            setPaymentPrefill({
                              direction: 'receivable',
                              amount: ord.grand_total,
                              currency: 'TRY',
                              description: `Siparis: ${ord.order_number || ord.id.slice(0,8)}`,
                            });
                            setTab('payments');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                        >
                          <CreditCard size={11} />Ödemeye Geçir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* ── Ödemeler Tab ── */}
            {tab === 'payments' && !isNew && (
              <PaymentsTab
                entityId={customer.id}
                entityName={customer.name}
                entityType="customer"
                payments={payments}
                onPaymentsChange={setPayments}
                setDialog={setDialog}
                invoices={invoices}
                prefill={paymentPrefill}
                onPrefillUsed={() => setPaymentPrefill(null)}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatusDot({ status }) {
  const colors = { Approved: '#10b981', Canceled: '#ef4444', Error: '#ef4444', Processing: '#f59e0b' };
  const col = colors[status] || '#94a3b8';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-0.5"
      style={{ color: col }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: col }} />
      {status || '-'}
    </span>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Customers() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [syncingInv, setSyncingInv] = useState(false);
  const [enriching,  setEnriching]  = useState(false);
  const [enrichLog,  setEnrichLog]  = useState(null);  // { enriched, processed, errors[]}
  const [dialog,     setDialog]     = useState({ open: false, title: '', message: '', type: 'confirm', onConfirm: null, loading: false });

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    hover:  isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const loadCustomers = useCallback(async (force = false) => {
    setLoading(true);
    const { data } = await pageCache.cachedQuery(
      'customers',
      () => supabase.from('customers').select('*').order('name'),
      force
    );
    setCustomers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // Faturalardan otomatik cari oluştur (manuel tetikleme)
  const syncFromInvoices = async () => {
    setSyncingInv(true);
    try {
      const { data: invs } = await supabase
        .from('invoices').select('cari_name, vkntckn').eq('type', 'outbox').not('vkntckn', 'is', null);
      const uniq = {};
      (invs || []).forEach(r => { if (r.vkntckn) uniq[r.vkntckn] = r.cari_name; });
      const rows = Object.entries(uniq).map(([vkntckn, name]) => ({ name, vkntckn, source: 'invoice_sync' }));
      if (rows.length > 0) {
        await supabase.from('customers').upsert(rows, { onConflict: 'vkntckn', ignoreDuplicates: true });
      }
      await loadCustomers(true);
      showToast(`${rows.length} cari senkronize edildi ✓`);
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSyncingInv(false); }
  };

  // Uyumsoft'tan tam UBL çekerek MEVCUT carilerin boş alanlarını doldur
  // ÖNEMLİ: Yeni cari oluşturmaz, sadece mevcut VKN'leri günceller
  const enrichContacts = async () => {
    setEnriching(true);
    const totals = { processed: 0, enriched: 0, errors: [], skipped: 0 };
    setEnrichLog({ ...totals, running: true, remaining: '?' });

    try {
      let keepGoing = true;
      while (keepGoing) {
        const r = await fetch('/api/enrich-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'customers', limit: 10 }),
        });
        const data = await r.json();
        const res  = data.results || {};

        totals.processed += res.processed || 0;
        totals.enriched  += res.enriched  || 0;
        totals.skipped   += res.skipped   || 0;
        totals.errors     = [...totals.errors, ...(res.errors || [])];

        setEnrichLog({ ...totals, running: true, remaining: data.remaining ?? '?' });

        if (!data.success || data.remaining === 0 || (res.processed || 0) === 0) keepGoing = false;
      }
    } catch (e) {
      totals.errors.push(e.message);
    } finally {
      setEnriching(false);
      setEnrichLog(prev => ({ ...prev, running: false }));
      await loadCustomers(true);
      showToast(`${totals.enriched} cari zenginleştirildi ✓`);
    }
  };


  const deleteCustomer = async (id, name) => {
    setDialog({
      open: true,
      title: 'Cari Sil',
      message: `"${name}" isimli cariyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      type: 'danger',
      onConfirm: async () => {
        setDialog(d => ({ ...d, loading: true }));
        try {
          pageCache.invalidate('customers');
          const { error } = await supabase.from('customers').delete().eq('id', id);
          if (error) throw error;
          showToast('Cari silindi');
          loadCustomers(true);
          setDialog({ open: false });
        } catch (e) {
          setDialog({ open: true, title: 'Hata', message: 'Silme başarısız: ' + e.message, type: 'alert' });
        }
      }
    });
  };

  const [filterSource, setFilterSource] = useState('all');

  const filtered = customers.filter(c => {
    const t = search.toLowerCase();
    const matchSearch = (c.name||'').toLowerCase().includes(t)
      || (c.vkntckn||'').includes(t)
      || (c.phone||'').includes(t)
      || (c.email||'').toLowerCase().includes(t);
    const matchSource = filterSource === 'all' ? true
      : filterSource === 'faturali'  ? (!c.is_faturasiz && c.source !== 'manual')
      : filterSource === 'faturasiz' ? !!c.is_faturasiz
      : filterSource === 'faturadan' ? c.source === 'invoice_sync'
      : filterSource === 'manuel'    ? c.source === 'manual'
      : true;
    return matchSearch && matchSource;
  });

  const invoicedCount = customers.filter(c => c.vkntckn && c.source === 'invoice_sync').length;
  const manualCount   = customers.filter(c => c.source === 'manual').length;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15`, color: currentColor }}>
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>Cariler</h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                {customers.length} kayıt · Müşteri Yönetimi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={syncFromInvoices} disabled={syncingInv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              {syncingInv ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Faturalardan Senkronize Et
            </button>
            <button onClick={enrichContacts} disabled={enriching}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {enriching ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
              {enriching ? 'Zenginleştiriliyor...' : 'Adres/İletişim Çek'}
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
              style={{ background: currentColor }}>
              <Plus size={15} />Manuel Ekle
            </button>
          </div>
        </div>

        {/* Zenginleştirme log paneli */}
        {enrichLog && (
          <div className="mb-4 p-4 rounded-2xl text-xs" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {enrichLog.running && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                <p className="font-bold text-emerald-400">
                  {enrichLog.running
                    ? `Çalışıyor... (kalan: ${enrichLog.remaining ?? '?'})`
                    : 'Zenginleştirme Tamamlandı'}
                </p>
              </div>
              {!enrichLog.running && (
                <button onClick={() => setEnrichLog(null)} className="text-slate-500 hover:text-white"><X size={13} /></button>
              )}
            </div>
            <div className="flex gap-4 text-slate-300 mb-2">
              <span>✅ Zenginleştirilen: <strong className="text-emerald-400">{enrichLog.enriched}</strong></span>
              <span>🔄 İşlenen: <strong>{enrichLog.processed}</strong></span>
              <span>⏩ Atlanan: <strong>{enrichLog.skipped}</strong></span>
            </div>
            {enrichLog.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-amber-400 font-semibold mb-1">Hatalar ({enrichLog.errors.length}):</p>
                {enrichLog.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-red-400 font-mono truncate">{typeof e === 'string' ? e.slice(0, 80) : e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { l:'Toplam Cari',     v: customers.length,  c: currentColor, ic: Users },
            { l:'Fatura Bağlantılı', v: invoicedCount,  c: '#10b981',    ic: Receipt },
            { l:'Manuel Kayıt',   v: manualCount,        c: '#8b5cf6',    ic: Edit3 },
            { l:'Aktif',           v: customers.filter(c=>c.is_active).length, c:'#f59e0b', ic: CheckCircle2 },
          ].map(({ l, v, c: col, ic: Ic }, i) => (
            <div key={i} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="p-2 rounded-xl" style={{ background: `${col}15` }}>
                <Ic size={18} style={{ color: col }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: col }}>{v}</p>
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
            placeholder="Ad, VKN/TCKN, telefon veya e-posta ara..."
            className="bg-transparent border-none outline-none text-sm flex-1"
            style={{ color: c.text }} />
          {search && <button onClick={() => setSearch('')}><X size={14} style={{ color: c.muted }} /></button>}
        </div>

        {/* Filtre Butonlari */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { id: 'all',       label: 'Tumü' },
            { id: 'faturali',  label: 'Faturali' },
            { id: 'faturasiz', label: 'Faturasiz' },
            { id: 'faturadan', label: 'Faturadan' },
            { id: 'manuel',    label: 'Manuel' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterSource(f.id)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filterSource === f.id ? currentColor : 'rgba(255,255,255,0.06)',
                color: filterSource === f.id ? '#fff' : '#94a3b8',
              }}>{f.label}</button>
          ))}
        </div>

        <div className="rounded-3xl overflow-hidden border" style={{ background: c.card, borderColor: c.border }}>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: c.muted }}>
              <Loader2 size={22} className="animate-spin" style={{ color: currentColor }} />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: c.muted }}>
              <Users size={40} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold">{search ? 'Sonuç bulunamadı' : 'Henüz cari eklenmemiş'}</p>
              <p className="text-xs mt-1 opacity-70">Manuel ekle veya faturalardan senkronize et.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b" style={{ borderColor: c.border, background: c.hover }}>
                    {['Cari', 'VKN/TCKN', 'İletişim', 'Durum', 'Kaynak', ''].map(h => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: c.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((cust, idx) => (
                    <motion.tr key={cust.id || idx}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                      className="border-b last:border-0 cursor-pointer transition-colors"
                      style={{ borderColor: c.border }}
                      onMouseEnter={e => e.currentTarget.style.background = c.hover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setSelected(cust)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ background: currentColor }}>
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: c.text }}>{cust.name}</p>
                            {cust.city && <p className="text-xs" style={{ color: c.muted }}>{cust.city}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono" style={{ color: c.muted }}>{cust.vkntckn || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {cust.phone && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: c.muted }}>
                            <Phone size={10} />{cust.phone}
                          </div>
                        )}
                        {cust.email && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: c.muted }}>
                            <Mail size={10} />{cust.email}
                          </div>
                        )}
                        {!cust.phone && !cust.email && <span className="text-xs" style={{ color: c.muted }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${cust.is_active ? '' : 'opacity-50'}`}
                          style={{ background: cust.is_active ? '#10b98118' : '#94a3b818', color: cust.is_active ? '#10b981' : '#94a3b8' }}>
                          {cust.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-semibold"
                          style={{ color: cust.source === 'invoice_sync' ? '#60a5fa' : '#8b5cf6' }}>
                          {cust.source === 'invoice_sync' ? '🔗 Faturadan' : '✏️ Manuel'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); setSelected(cust); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: currentColor }}
                            onMouseEnter={e => e.currentTarget.style.background = `${currentColor}15`}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ChevronRight size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteCustomer(cust.id, cust.name); }}
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

      {/* Detail / Edit Drawer */}
      <AnimatePresence>
        {selected && (
          <CustomerDrawer
            customer={selected}
            onClose={() => setSelected(null)}
            onSaved={() => { loadCustomers(); showToast('Cari güncellendi ✓'); }}
            setDialog={setDialog}
          />
        )}
        {showNew && (
          <CustomerDrawer
            customer={{ name: '', vkntckn: '', phone: '', email: '', address: '', city: '', notes: '', tax_office: '', is_active: true, is_faturasiz: false }}
            onClose={() => setShowNew(false)}
            onSaved={() => { loadCustomers(); setShowNew(false); showToast('Yeni cari eklendi ✓'); }}
            setDialog={setDialog}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <CustomDialog 
        {...dialog} 
        onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog({ ...dialog, open: false })}
      />
    </>
  );
}
