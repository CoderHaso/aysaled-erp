import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellRing, AlertTriangle, CalendarClock, FileText, CheckCircle2,
  Loader2, RefreshCw, Trash2, CheckCheck, X, Filter,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtD  = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
const fmtDT = (d) => d ? new Date(d).toLocaleString('tr-TR', { dateStyle:'medium', timeStyle:'short' }) : '-';
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
  urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Acil'     },
  high:   { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Yüksek'   },
  normal: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Normal'   },
  low:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Düşük'    },
};

const TYPE_ICON = {
  payment_reminder: CalendarClock,
  overdue:          AlertTriangle,
  invoice:          FileText,
  system:           Bell,
};

const TYPE_LABEL = {
  payment_reminder: 'Ödeme Hatırlatma',
  overdue:          'Vadesi Geçmiş',
  invoice:          'Fatura',
  system:           'Sistem',
};

const FILTERS = [
  { id: 'all',     label: 'Tümü'     },
  { id: 'unread',  label: 'Okunmamış'},
  { id: 'overdue', label: 'Vadesi Geçmiş'},
  { id: 'payment_reminder', label: 'Hatırlatmalar' },
];

// ─── Bildirim Kartı ───────────────────────────────────────────────────────────
function NotifCard({ notif, onRead, onDelete, color }) {
  const p    = PRIORITY_STYLE[notif.priority] || PRIORITY_STYLE.normal;
  const Icon = TYPE_ICON[notif.type] || Bell;
  const daysLeft = notif.due_date
    ? Math.floor((new Date(notif.due_date) - Date.now()) / 86400000)
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-start gap-4 p-4 rounded-2xl group transition-all"
      style={{
        background: notif.is_read ? 'rgba(255,255,255,0.02)' : p.bg,
        border: `1px solid ${notif.is_read ? 'rgba(148,163,184,0.07)' : p.color + '30'}`,
        opacity: notif.is_read ? 0.6 : 1,
      }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
        style={{ background: p.bg, border: `1px solid ${p.color}30` }}>
        <Icon size={16} style={{ color: p.color }} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-100">{notif.title}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: p.bg, color: p.color }}>
                {p.label}
              </span>
              {!notif.is_read && (
                <span className="w-2 h-2 rounded-full" style={{ background: p.color, flexShrink: 0 }} />
              )}
            </div>
            {notif.message && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
            )}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {notif.entity_name && (
                <span className="text-[11px] font-semibold text-slate-400">{notif.entity_name}</span>
              )}
              {notif.due_date && (
                <span className="text-[11px]" style={{
                  color: daysLeft < 0 ? '#ef4444' : daysLeft <= 3 ? '#f97316' : '#64748b'
                }}>
                  📅 {relTime(notif.due_date)} — {fmtD(notif.due_date)}
                </span>
              )}
              <span className="text-[10px] text-slate-600">{TYPE_LABEL[notif.type] || notif.type}</span>
              <span className="text-[10px] text-slate-600">{fmtDT(notif.created_at)}</span>
            </div>
          </div>

          {/* Aksiyonlar */}
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notif.is_read && (
              <button onClick={() => onRead(notif.id)}
                title="Okundu işaretle"
                className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-emerald-400"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <CheckCircle2 size={13} />
              </button>
            )}
            <button onClick={() => onDelete(notif.id)}
              title="Sil"
              className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-red-400"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Notifications() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [notifs, setNotifs]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');

  const c = {
    pageBg:   'var(--bg-app)',
    cardBg:   'var(--bg-card)',
    border:   'var(--border)',
    textBase: 'var(--text-base)',
    textMuted:'var(--text-muted)',
  };

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter === 'unread')  q = q.eq('is_read', false);
    if (filter === 'overdue') q = q.eq('type', 'overdue');
    if (filter === 'payment_reminder') q = q.eq('type', 'payment_reminder');
    const { data } = await q;
    setNotifs(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  };

  const deleteNotif = async (id) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  const clearRead = async () => {
    setNotifs(prev => prev.filter(n => !n.is_read));
    await supabase.from('notifications').delete().eq('is_read', true);
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl" style={{ background: `${currentColor}20` }}>
              {unread > 0 ? <BellRing size={20} style={{ color: currentColor }} /> : <Bell size={20} style={{ color: currentColor }} />}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: c.textBase }}>Bildirimler</h1>
              <p className="text-xs mt-0.5" style={{ color: c.textMuted }}>
                {unread > 0 ? `${unread} okunmamış bildirim` : 'Tüm bildirimler okundu'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="p-2 rounded-xl transition-colors text-slate-500 hover:text-slate-200"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {unread > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: `${currentColor}15`, color: currentColor }}>
              <CheckCheck size={13} />
              Tümünü Okundu Say
            </button>
          )}
          <button onClick={clearRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Trash2 size={13} />
            Okunanları Temizle
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: filter === f.id ? currentColor : 'rgba(255,255,255,0.06)',
              color: filter === f.id ? '#fff' : '#94a3b8',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: currentColor }} />
        </div>
      )}

      {!loading && notifs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Bell size={40} strokeWidth={1.2} style={{ color: '#334155' }} />
          </div>
          <p className="font-semibold text-slate-400">Bildirim bulunamadı</p>
          <p className="text-sm text-slate-600 text-center max-w-xs">
            Ödeme hatırlatmaları, vadesi geçmiş borçlar ve sistem bildirimleri burada görünecek.
          </p>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {!loading && notifs.map(n => (
          <NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} color={currentColor} />
        ))}
      </AnimatePresence>
    </div>
  );
}
