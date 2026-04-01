/**
 * PaymentsTab — Cari/Tedarikçi bazında ödeme takip bileşeni
 * entityType: 'customer' | 'supplier'
 * entityId: uuid
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Loader2, CheckCircle2, CalendarClock, AlertTriangle,
  Clock, CreditCard, ArrowDownLeft, ArrowUpRight, Bell, Trash2,
  Edit3, FileText, ChevronDown, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt  = (n) => n != null
  ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';

const STATUS_CFG = {
  pending:   { label: 'Bekliyor',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'   },
  partial:   { label: 'Kısmi Ödendi',   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'   },
  paid:      { label: 'Ödendi',         color: '#10b981', bg: 'rgba(16,185,129,0.1)'   },
  overdue:   { label: 'Vadesi Geçti',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)'    },
  cancelled: { label: 'İptal',          color: '#64748b', bg: 'rgba(100,116,139,0.1)'  },
};

// Hazır hatırlatma planları
const PRESET_SCHEDULES = [
  {
    label: 'Standart (3 kez)',
    desc: '3 gün önce, vadede, 3 gün sonra',
    schedule: [
      { type: 'before', days: 3 },
      { type: 'on_date', days: 0 },
      { type: 'after', days: 3 },
    ],
  },
  {
    label: 'Erken Hatırlatma',
    desc: '7 gün önce, 3 gün önce, vadede',
    schedule: [
      { type: 'before', days: 7 },
      { type: 'before', days: 3 },
      { type: 'on_date', days: 0 },
    ],
  },
  {
    label: 'Geç Takip',
    desc: 'Vadede, 3 gün sonra, 7 gün sonra',
    schedule: [
      { type: 'on_date', days: 0 },
      { type: 'after', days: 3 },
      { type: 'after', days: 7 },
    ],
  },
];

const CUR_SYMS = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
const sym = (c) => CUR_SYMS[c] || c;

const daysLeft = (due) => {
  if (!due) return null;
  return Math.floor((new Date(due) - Date.now()) / 86400000);
};

// ─── Ödeme Satırı ─────────────────────────────────────────────────────────────
function PaymentRow({ payment, onEdit, onDelete, onMarkPaid, color }) {
  const st = STATUS_CFG[payment.status] || STATUS_CFG.pending;
  const days = daysLeft(payment.due_date);
  const isPaid = payment.status === 'paid';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl p-4 group transition-all"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isPaid ? 'rgba(16,185,129,0.15)' : st.color + '25'}` }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Sol */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: st.bg }}>
            {payment.direction === 'receivable'
              ? <ArrowDownLeft size={14} style={{ color: '#10b981' }} />
              : <ArrowUpRight size={14} style={{ color: '#ef4444' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-100">
                {payment.description || (payment.direction === 'receivable' ? 'Alacak' : 'Borç')}
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                {st.label}
              </span>
              {payment.direction === 'receivable'
                ? <span className="text-[10px] text-emerald-500 font-semibold">Alacak</span>
                : <span className="text-[10px] text-red-400 font-semibold">Borç</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {payment.invoice_ref && (
                <span className="text-[10px] font-mono text-blue-400">#{payment.invoice_ref}</span>
              )}
              {payment.due_date && (
                <span className="text-[11px]" style={{
                  color: days < 0 ? '#ef4444' : days <= 3 ? '#f97316' : '#64748b'
                }}>
                  📅 {days === null ? '' : days === 0 ? 'Bugün!' : days < 0 ? `${Math.abs(days)} gün geçti` : `${days} gün kaldı`}
                  {' '}· {fmtD(payment.due_date)}
                </span>
              )}
            </div>
            {/* Kısmi ödeme bilgisi */}
            {payment.status === 'partial' && payment.paid_amount > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(100, (payment.paid_amount / payment.amount) * 100)}%`,
                  background: '#3b82f6',
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Sağ */}
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold" style={{ color: payment.direction === 'receivable' ? '#10b981' : '#f87171' }}>
            {sym(payment.currency)}{fmt(payment.amount)}
          </p>
          {payment.currency !== 'TRY' && payment.amount_try && (
            <p className="text-[10px] text-slate-500">≈ ₺{fmt(payment.amount_try)}</p>
          )}
          {payment.status === 'partial' && (
            <p className="text-[10px] text-blue-400">{sym(payment.currency)}{fmt(payment.paid_amount)} ödendi</p>
          )}
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="flex items-center gap-2 mt-3 pt-3 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
        {!isPaid && (
          <button onClick={() => onMarkPaid(payment)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <CheckCircle2 size={11} />Ödendi İşaretle
          </button>
        )}
        <button onClick={() => onEdit(payment)}
          className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-slate-200"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Edit3 size={12} />
        </button>
        <button onClick={() => onDelete(payment.id)}
          className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-red-400"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Yeni/Düzenle Modal ───────────────────────────────────────────────────────
function PaymentFormModal({ payment, entityId, entityName, entityType, invoices, onSave, onClose, color }) {
  const [form, setForm] = useState(payment || {
    direction:  entityType === 'customer' ? 'receivable' : 'payable',
    amount:     '',
    currency:   'TRY',
    due_date:   '',
    description: '',
    invoice_ref: '',
    reminder_settings: { enabled: false, preset: null, schedule: [], notifications: [] },
  });
  const [saving, setSaving] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Kur çek (TRY değilse)
  const fetchRate = async () => {
    if (!form.currency || form.currency === 'TRY') return;
    setFetchingRate(true);
    try {
      const date = form.due_date || new Date().toISOString().split('T')[0];
      const r = await fetch(`/api/exchange-rate?currency=${form.currency}&date=${date}`);
      const d = await r.json();
      if (d.rate) {
        const amt = parseFloat(form.amount) || 0;
        setForm(f => ({ ...f, exchange_rate: d.rate, amount_try: +(amt * d.rate).toFixed(4) }));
      }
    } catch(e) {}
    finally { setFetchingRate(false); }
  };

  useEffect(() => {
    if (form.currency !== 'TRY' && form.amount) fetchRate();
  }, [form.currency, form.amount, form.due_date]);

  const handleSave = async () => {
    if (!form.amount) return;
    setSaving(true);
    try {
      const payload = {
        entity_type:  entityType,
        entity_id:    entityId,
        entity_name:  entityName,
        direction:    form.direction,
        amount:       parseFloat(form.amount),
        currency:     form.currency || 'TRY',
        exchange_rate: form.exchange_rate || 1,
        amount_try:   form.amount_try || parseFloat(form.amount),
        due_date:     form.due_date || null,
        description:  form.description || null,
        invoice_ref:  form.invoice_ref || null,
        reminder_settings: form.reminder_settings || { enabled: false, schedule: [] },
        status:       'pending',
        paid_amount:  0,
        updated_at:   new Date().toISOString(),
      };
      let data;
      if (payment?.id) {
        const { data: d } = await supabase.from('payments').update(payload).eq('id', payment.id).select().single();
        data = d;
      } else {
        const { data: d } = await supabase.from('payments').insert(payload).select().single();
        data = d;
      }

      // Hatırlatma bildirimleri oluştur
      if (data && form.reminder_settings?.enabled && form.due_date && form.reminder_settings?.schedule?.length > 0) {
        await generateNotifications(data);
      }

      onSave(data);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const generateNotifications = async (paymentData) => {
    // Önce eski bildirimleri sil
    if (paymentData.id) {
      await supabase.from('notifications').delete().eq('related_id', paymentData.id);
    }
    const due = new Date(form.due_date + 'T12:00:00');
    const notifs = form.reminder_settings.schedule.map(s => {
      const notifDate = new Date(due);
      if (s.type === 'before') notifDate.setDate(due.getDate() - s.days);
      if (s.type === 'after')  notifDate.setDate(due.getDate() + s.days);

      const days = s.days;
      const isAfter = s.type === 'after';
      const isOn = s.type === 'on_date';

      const title = isOn
        ? `💳 Ödeme Vadesi: ${entityName}`
        : isAfter
          ? `⚠️ Vadesi Geçti (${days} gün): ${entityName}`
          : `🔔 Ödeme Hatırlatma (${days} gün kaldı): ${entityName}`;

      const amtStr = `${sym(paymentData.currency)}${fmt(paymentData.amount)}`;
      const message = `${paymentData.description || ''} — ${amtStr} — Son ödeme: ${fmtD(form.due_date)}`;

      return {
        type:         isAfter ? 'overdue' : 'payment_reminder',
        title,
        message,
        related_id:   paymentData.id,
        related_type: 'payment',
        entity_name:  entityName,
        due_date:     form.due_date,
        priority:     isAfter ? 'urgent' : isOn ? 'high' : 'normal',
        is_read:      false,
        created_at:   notifDate.toISOString(),
      };
    });
    await supabase.from('notifications').insert(notifs);
  };

  const applyPreset = (preset) => {
    setForm(f => ({
      ...f,
      reminder_settings: { ...f.reminder_settings, enabled: true, preset: preset.label, schedule: preset.schedule }
    }));
  };

  const inp = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 10,
    color: '#f1f5f9',
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{ background: '#0c1526', border: '1px solid rgba(148,163,184,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <h2 className="text-base font-bold text-slate-100">
            {payment?.id ? 'Ödeme Düzenle' : 'Yeni Ödeme Ekle'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Yön */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Ödeme Türü</p>
            <div className="flex gap-2">
              {[
                { v: 'receivable', l: 'Alacak', icon: ArrowDownLeft, c: '#10b981' },
                { v: 'payable',    l: 'Borç',   icon: ArrowUpRight,  c: '#ef4444' },
              ].map(opt => (
                <button key={opt.v} onClick={() => set('direction', opt.v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: form.direction === opt.v ? `${opt.c}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.direction === opt.v ? opt.c + '50' : 'rgba(148,163,184,0.1)'}`,
                    color: form.direction === opt.v ? opt.c : '#64748b',
                  }}>
                  <opt.icon size={14} />{opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Tutar + Döviz */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tutar *</p>
              <input style={inp} type="number" step="0.01" placeholder="0.00"
                value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Döviz</p>
              <select style={{ ...inp, cursor: 'pointer' }}
                value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['TRY','USD','EUR','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* TL karşılığı */}
          {form.currency !== 'TRY' && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              {fetchingRate
                ? <p className="text-xs text-blue-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" />Kur çekiliyor...</p>
                : <p className="text-xs text-blue-300">
                    TL karşılığı: <strong className="text-blue-100">₺{fmt(form.amount_try || 0)}</strong>
                    {form.exchange_rate ? ` (1 ${form.currency} = ₺${form.exchange_rate})` : ''}
                  </p>}
            </div>
          )}

          {/* Açıklama */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Açıklama</p>
            <input style={inp} placeholder="Ödeme açıklaması..."
              value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Son Ödeme Tarihi */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Son Ödeme Tarihi</p>
            <input style={inp} type="date"
              value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
          </div>

          {/* Fatura Bağla */}
          {invoices?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fatura Bağla (Opsiyonel)</p>
              <select style={{ ...inp, cursor: 'pointer' }}
                value={form.invoice_ref || ''} onChange={e => set('invoice_ref', e.target.value)}>
                <option value="">— Fatura seç —</option>
                {invoices.map(inv => (
                  <option key={inv.id || inv.invoice_id} value={inv.invoice_id}>
                    {inv.invoice_id} — {fmt(inv.amount)} {inv.currency} — {fmtD(inv.issue_date)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ─── Hatırlatma Ayarları ─── */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(148,163,184,0.12)' }}>
            <button
              onClick={() => setForm(f => ({
                ...f, reminder_settings: { ...f.reminder_settings, enabled: !f.reminder_settings?.enabled }
              }))}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-2">
                <Bell size={13} style={{ color: color }} />
                <span className="text-sm font-semibold text-slate-300">Hatırlatma Bildirimleri</span>
              </div>
              <div className="flex items-center gap-2">
                {form.reminder_settings?.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${color}20`, color }}>
                    Aktif
                  </span>
                )}
                <ChevronDown size={14} style={{ color: '#64748b', transform: form.reminder_settings?.enabled ? 'rotate(180deg)' : '' }} />
              </div>
            </button>

            {form.reminder_settings?.enabled && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                <p className="text-[10px] text-slate-500 pt-3">Hazır planlar:</p>
                <div className="space-y-2">
                  {PRESET_SCHEDULES.map(preset => {
                    const active = form.reminder_settings?.preset === preset.label;
                    return (
                      <button key={preset.label} onClick={() => applyPreset(preset)}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{
                          background: active ? `${color}15` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? color + '40' : 'rgba(148,163,184,0.1)'}`,
                        }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold" style={{ color: active ? color : '#e2e8f0' }}>{preset.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</p>
                          </div>
                          {active && <Check size={13} style={{ color }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500">
                  Bildirimler kayıt sırasında <span style={{ color }}>Bildirimler</span> sekmesine eklenir.
                </p>
              </div>
            )}
          </div>

          {/* Kaydet */}
          <button onClick={handleSave} disabled={saving || !form.amount}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
            style={{ background: color, opacity: saving || !form.amount ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {payment?.id ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Mark Paid Modal ──────────────────────────────────────────────────────────
function MarkPaidModal({ payment, onConfirm, onClose, color }) {
  const [paidAmt, setPaidAmt] = useState(String(payment.amount));
  const [paidAt, setPaidAt]   = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]   = useState(false);

  const isPartial = parseFloat(paidAmt) < payment.amount;

  const inp = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 10, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: '#0c1526', border: '1px solid rgba(148,163,184,0.12)' }}>
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <h2 className="text-sm font-bold text-slate-100">Ödeme Kaydet</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-500 hover:text-white"><X size={15} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ödenen Tutar</p>
            <input style={inp} type="number" step="0.01" value={paidAmt}
              onChange={e => setPaidAmt(e.target.value)} />
            {isPartial && (
              <p className="text-[10px] text-blue-400 mt-1">
                Tam tutar: {sym(payment.currency)}{fmt(payment.amount)} — Kısmi ödeme olarak işlenecek
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ödeme Tarihi</p>
            <input style={inp} type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
          </div>
          <button
            onClick={async () => {
              setSaving(true);
              const paid = parseFloat(paidAmt);
              const full  = parseFloat(payment.amount);
              const status = paid >= full ? 'paid' : 'partial';
              await onConfirm({ paid_amount: paid, paid_at: paidAt, status });
              setSaving(false);
              onClose();
            }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: color }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            {isPartial ? 'Kısmi Ödeme Kaydet' : 'Ödendi İşaretle'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Ana PaymentsTab ──────────────────────────────────────────────────────────
export default function PaymentsTab({ entityId, entityName, entityType, payments, onPaymentsChange, setDialog, invoices, prefill, onPrefillUsed }) {
  const { currentColor } = useTheme();
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [markingPaid,  setMarkingPaid]  = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Fatura / Sipariş'ten "Ödemeye Geçir" ile gelince formu önceden doldur
  useEffect(() => {
    if (prefill) {
      setEditing({
        direction:   prefill.direction || (entityType === 'customer' ? 'receivable' : 'payable'),
        amount:      prefill.amount || '',
        currency:    prefill.currency || 'TRY',
        description: prefill.description || '',
        due_date:    '',
        invoice_ref: '',
        reminder_settings: { enabled: false, preset: null, schedule: [] },
      });
      setShowForm(true);
      onPrefillUsed?.();
    }
  }, [prefill]);

  // Toplam hesapla (TL bazında)
  const stats = payments.reduce((acc, p) => {
    const amt = p.amount_try || p.amount || 0;
    if (p.direction === 'receivable') { acc.receivable += amt; }
    else { acc.payable += amt; }
    if (p.status === 'overdue') acc.overdue += 1;
    if (p.status === 'pending' || p.status === 'partial') acc.pending += 1;
    return acc;
  }, { receivable: 0, payable: 0, overdue: 0, pending: 0 });
  const netBalance = stats.receivable - stats.payable;

  const filtered = filterStatus === 'all'
    ? payments
    : payments.filter(p => p.status === filterStatus);

  const handleSaved = (payment) => {
    setShowForm(false);
    setEditing(null);
    onPaymentsChange(prev => {
      const exists = prev.find(p => p.id === payment.id);
      return exists ? prev.map(p => p.id === payment.id ? payment : p) : [payment, ...prev];
    });
  };

  const handleDelete = (id) => {
    setDialog({
      open: true, type: 'danger', title: 'Ödemeyi Sil',
      message: 'Bu ödeme kaydı silinecek. Emin misiniz?',
      onConfirm: async () => {
        await supabase.from('payments').delete().eq('id', id);
        // İlgili bildirimleri de sil
        await supabase.from('notifications').delete().eq('related_id', id);
        onPaymentsChange(prev => prev.filter(p => p.id !== id));
        setDialog({ open: false });
      }
    });
  };

  const handleMarkPaid = async ({ paid_amount, paid_at, status }) => {
    const id = markingPaid.id;
    const { data } = await supabase.from('payments')
      .update({ paid_amount, paid_at, status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (data) onPaymentsChange(prev => prev.map(p => p.id === id ? data : p));
    // Ödendi bildirimi oluştur (overdue varsa overdue bildirimlerini kapat)
    if (status === 'paid') {
      await supabase.from('notifications').update({ is_read: true }).eq('related_id', id);
    }
  };

  return (
    <div className="space-y-4">

      {/* Özet */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Alacak (TL)',  value: `+₺${fmt(stats.receivable)}`, color: '#10b981' },
          { label: 'Borç (TL)',    value: `-₺${fmt(stats.payable)}`,    color: '#ef4444' },
          {
            label: 'Net Bakiye',
            value: `${netBalance >= 0 ? '+' : ''}₺${fmt(Math.abs(netBalance))}`,
            color: netBalance >= 0 ? '#10b981' : '#ef4444'
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-2.5 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
            <p className="text-xs font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Uyarı: Vadesi Geçmiş */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={13} style={{ color: '#ef4444' }} />
          <p className="text-xs text-red-400 font-semibold">
            {stats.overdue} adet vadesi geçmiş ödeme var!
          </p>
        </div>
      )}

      {/* Araç Çubuğu */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { id: 'all',     l: 'Tümü' },
            { id: 'pending', l: 'Bekleyenler' },
            { id: 'overdue', l: 'Vadesi Geçen' },
            { id: 'paid',    l: 'Ödenenler' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: filterStatus === f.id ? currentColor : 'rgba(255,255,255,0.05)',
                color: filterStatus === f.id ? '#fff' : '#94a3b8',
              }}>
              {f.l}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
          style={{ background: currentColor }}>
          <Plus size={12} />Ödeme Ekle
        </button>
      </div>

      {/* Ödeme Listesi */}
      {filtered.length === 0 && (
        <div className="text-center py-10">
          <CreditCard size={32} className="mx-auto mb-2 opacity-20 text-slate-400" />
          <p className="text-sm text-slate-500">
            {filterStatus === 'all' ? 'Henüz ödeme kaydı yok.' : 'Bu filtrede ödeme yok.'}
          </p>
          {filterStatus === 'all' && (
            <p className="text-xs text-slate-600 mt-1">Faturalar sekmesinden borç/alacak ekleyebilir veya buradan manuel ekleyebilirsiniz.</p>
          )}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {filtered.map(p => (
          <PaymentRow
            key={p.id}
            payment={p}
            color={currentColor}
            onEdit={(py) => { setEditing(py); setShowForm(true); }}
            onDelete={handleDelete}
            onMarkPaid={(py) => setMarkingPaid(py)}
          />
        ))}
      </AnimatePresence>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <PaymentFormModal
            payment={editing}
            entityId={entityId}
            entityName={entityName}
            entityType={entityType}
            invoices={invoices}
            color={currentColor}
            onSave={handleSaved}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>

      {/* Mark Paid Modal */}
      <AnimatePresence>
        {markingPaid && (
          <MarkPaidModal
            payment={markingPaid}
            color={currentColor}
            onConfirm={handleMarkPaid}
            onClose={() => setMarkingPaid(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
