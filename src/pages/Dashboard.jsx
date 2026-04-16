import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight,
  Package, Users, FileText, CreditCard, ShoppingCart, Plus, Search,
  Bell, BellRing, AlertTriangle, CheckCircle2, Clock, ChevronRight,
  Loader2, RefreshCw, CalendarClock, TrendingUp,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
const relTime = (d) => {
  if (!d) return '';
  const diff = Math.floor((new Date(d) - Date.now()) / 86400000);
  if (diff === 0)  return 'Bugün';
  if (diff === 1)  return 'Yarın';
  if (diff === -1) return 'Dün';
  if (diff > 0)   return `${diff} gün sonra`;
  return `${Math.abs(diff)} gün geçti`;
};

const PRIORITY_STYLE = {
  urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Acil' },
  high:   { color: '#f97316', bg: 'rgba(249,115,22,0.1)', label: 'Yüksek' },
  normal: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Normal' },
  low:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',label: 'Düşük' },
};

const TYPE_ICON = {
  payment_reminder: CalendarClock,
  overdue:          AlertTriangle,
  invoice:          FileText,
  system:           Bell,
};

// ─── Hızlı Aksiyonlar ─────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { n: 'Satış Yap',  icon: ShoppingCart, color: '#3b82f6', to: '/sales',               state: { openNew: true } },
  { n: 'Stok Ekle',  icon: Plus,         color: '#f59e0b', to: '/stock',               state: { openQuickAdd: true } },
  { n: 'Cari Ara',   icon: Search,       color: '#10b981', to: '/customers',           state: {} },
  { n: 'Fatura Kes', icon: FileText,     color: '#8b5cf6', to: '/outgoing-invoices',   state: { openCreate: true } },
];

// ─── Bildirim Satırı ──────────────────────────────────────────────────────────
function NotifRow({ notif, onRead, color }) {
  const p    = PRIORITY_STYLE[notif.priority] || PRIORITY_STYLE.normal;
  const Icon = TYPE_ICON[notif.type] || Bell;
  const daysLeft = notif.due_date
    ? Math.floor((new Date(notif.due_date) - Date.now()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer group transition-all"
      style={{
        background: notif.is_read ? 'rgba(255,255,255,0.02)' : p.bg,
        border: `1px solid ${notif.is_read ? 'rgba(148,163,184,0.06)' : p.color + '25'}`,
        opacity: notif.is_read ? 0.55 : 1,
      }}
      onClick={() => !notif.is_read && onRead(notif.id)}
    >
      {/* Icon */}
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: p.bg, border: `1px solid ${p.color}30` }}>
        <Icon size={14} style={{ color: p.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold text-slate-200 leading-snug">
            {notif.title}
          </p>
          {!notif.is_read && (
            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: p.color }} />
          )}
        </div>
        {notif.message && (
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {notif.entity_name && (
            <span className="text-[10px] font-semibold text-slate-500">{notif.entity_name}</span>
          )}
          {notif.due_date && (
            <span className="text-[10px]" style={{
              color: daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f97316' : '#64748b'
            }}>
              {relTime(notif.due_date)} · {fmtD(notif.due_date)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Ana Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const navigate = useNavigate();

  const [notifs, setNotifs]         = useState([]);
  const [loadingN, setLoadingN]     = useState(true);
  const [metrics, setMetrics]       = useState({
    customers: 0, suppliers: 0, pending_payments: 0, overdue_payments: 0,
  });

  const c = {
    pageBg:    'var(--bg-app)',
    cardBg:    'var(--bg-card)',
    border:    'var(--border)',
    textBase:  'var(--text-base)',
    textMuted: 'var(--text-muted)',
    subBg:     isDark ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.8)',
    actionBg:  isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    actionHover: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
    badgeUp:   isDark ? 'rgba(16,185,129,0.2)'  : '#dcfce7',
    badgeUpText: isDark ? '#4ade80'              : '#15803d',
    badgeDown: isDark ? 'rgba(239,68,68,0.2)'   : '#fee2e2',
    badgeDownText: isDark ? '#f87171'            : '#dc2626',
  };

  // Bildirimleri yükle
  const loadNotifs = useCallback(async () => {
    setLoadingN(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40);
      setNotifs(data || []);
    } catch (e) {
      console.error('[Dashboard] notifications load error:', e);
    } finally {
      setLoadingN(false);
    }
  }, []);

  // Metrikleri yükle
  const loadMetrics = useCallback(async () => {
    try {
      const [{ count: customers }, { count: suppliers }, paymentsRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('status'),
      ]);
      const pmts = paymentsRes.data || [];
      setMetrics({
        customers: customers || 0,
        suppliers: suppliers || 0,
        pending_payments: pmts.filter(p => p.status === 'pending' || p.status === 'partial').length,
        overdue_payments: pmts.filter(p => p.status === 'overdue').length,
      });
    } catch (e) {
      console.error('[Dashboard] metrics error:', e);
    }
  }, []);

  useEffect(() => {
    loadNotifs();
    loadMetrics();
    // Ödeme tarihi geçmiş olanları overdue'ya çek
    supabase.from('payments')
      .update({ status: 'overdue' })
      .lt('due_date', new Date().toISOString().split('T')[0])
      .in('status', ['pending', 'partial'])
      .then(() => {});
  }, []);

  // Okundu işaretle
  const markRead = async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const METRICS = [
    { name: 'Aktif Cariler',    value: metrics.customers,         icon: Users,        bg: '#3b82f6', up: true,  change: '' },
    { name: 'Tedarikçiler',     value: metrics.suppliers,         icon: Package,      bg: '#10b981', up: true,  change: '' },
    { name: 'Bekleyen Ödemeler',value: metrics.pending_payments,  icon: CreditCard,   bg: '#f59e0b', up: false, change: '' },
    { name: 'Vadesi Geçmiş',    value: metrics.overdue_payments,  icon: AlertTriangle,bg: '#ef4444', up: false, change: '' },
  ];

  return (
    <div>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

        {/* Başlık */}
        <div className="pt-2">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: c.textBase }}>
            Hoş Geldin, Efe 👋
          </h1>
          <p className="mt-1 font-medium" style={{ color: c.textMuted }}>
            A-ERP Genel Bakış
          </p>
        </div>

        {/* ── Metrik Kartlar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {METRICS.map((m, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card p-5 group cursor-pointer"
              style={{ transition: 'transform 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-2xl text-white shadow-lg" style={{ background: m.bg }}>
                  <m.icon size={18} />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.textMuted }}>
                  {m.name}
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: c.textBase }}>
                  {m.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── 2 Kolon Alt ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Bildirimler Paneli (2/3 genişlik) */}
          <div className="lg:col-span-2 glass-card p-6 min-h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ background: `${currentColor}20` }}>
                  {unreadCount > 0
                    ? <BellRing size={16} style={{ color: currentColor }} />
                    : <Bell size={16} style={{ color: currentColor }} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: c.textBase }}>Bildirimler</h3>
                  <p className="text-[10px]" style={{ color: c.textMuted }}>
                    {unreadCount > 0 ? `${unreadCount} okunmamış` : 'Hepsi okundu'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={loadNotifs}
                  className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-slate-300">
                  <RefreshCw size={13} className={loadingN ? 'animate-spin' : ''} />
                </button>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: `${currentColor}15`, color: currentColor }}>
                    Tümünü Oku
                  </button>
                )}
              </div>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 480 }}>
              {loadingN && (
                <div className="flex items-center justify-center py-16 gap-2">
                  <Loader2 size={20} className="animate-spin" style={{ color: currentColor }} />
                  <span className="text-sm text-slate-400">Bildirimler yükleniyor...</span>
                </div>
              )}
              {!loadingN && notifs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Bell size={32} style={{ color: c.textMuted }} strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: c.textMuted }}>Bildirim yok</p>
                  <p className="text-xs text-center max-w-[220px]" style={{ color: c.textMuted }}>
                    Ödeme hatırlatmaları ve sistem bildirimleri burada görünecek.
                  </p>
                </div>
              )}
              <AnimatePresence>
                {!loadingN && notifs.map(n => (
                  <NotifRow key={n.id} notif={n} onRead={markRead} color={currentColor} />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Sağ Kolon */}
          <div className="space-y-5">
            {/* Hızlı Aksiyonlar */}
            <div className="glass-card p-6">
              <h3 className="font-bold mb-4 text-xs uppercase tracking-widest" style={{ color: c.textMuted }}>
                Hızlı Aksiyonlar
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {QUICK_ACTIONS.map((act, i) => (
                  <button key={i}
                    onClick={() => navigate(act.to, { state: act.state })}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all text-center"
                    style={{ background: c.actionBg, borderColor: c.border }}
                    onMouseEnter={e => e.currentTarget.style.background = c.actionHover}
                    onMouseLeave={e => e.currentTarget.style.background = c.actionBg}
                  >
                    <div className="p-2 rounded-xl" style={{ background: `${act.color}20` }}>
                      <act.icon size={18} style={{ color: act.color }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: c.textBase }}>{act.n}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Özet - Vadesi Yaklaşan */}
            <DueSoonCard color={currentColor} textBase={c.textBase} textMuted={c.textMuted} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vadesi Yaklaşan Ödemeler Kartı ──────────────────────────────────────────
function DueSoonCard({ color, textBase, textMuted }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const soon  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    supabase.from('payments')
      .select('id,entity_name,direction,amount,currency,amount_try,due_date,status')
      .in('status', ['pending','partial','overdue'])
      .lte('due_date', soon)
      .order('due_date', { ascending: true })
      .limit(5)
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, []);

  const fmt = (n, cur) => n != null
    ? `${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur || ''}`
    : '-';

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock size={13} style={{ color }} />
        <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: textMuted }}>
          Yaklaşan / Geçmiş
        </h3>
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin" style={{ color }} />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: textMuted }}>7 gün içinde vadeli ödeme yok</p>
      )}

      {!loading && items.map((p, i) => {
        const days = p.due_date
          ? Math.floor((new Date(p.due_date) - Date.now()) / 86400000)
          : null;
        const isOverdue = days !== null && days < 0;
        return (
          <div key={p.id} className="flex items-start justify-between gap-2 py-2"
            style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(148,163,184,0.07)' : 'none' }}>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold truncate" style={{ color: textBase }}>
                {p.entity_name || '—'}
              </p>
              <p className="text-[10px] mt-0.5" style={{
                color: isOverdue ? '#ef4444' : days <= 2 ? '#f97316' : '#64748b'
              }}>
                {days === null ? '—' : days === 0 ? 'Bugün!' : isOverdue ? `${Math.abs(days)} gün geçti!` : `${days} gün kaldı`}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] font-bold" style={{ color: isOverdue ? '#ef4444' : textBase }}>
                {p.currency !== 'TRY' && p.amount_try
                  ? fmt(p.amount_try, '₺')
                  : fmt(p.amount, p.currency === 'TRY' ? '₺' : p.currency)}
              </p>
              <p className="text-[10px] text-slate-500">
                {p.direction === 'receivable' ? 'Alacak' : 'Borç'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
