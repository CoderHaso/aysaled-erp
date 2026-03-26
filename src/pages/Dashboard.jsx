import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight,
  Package, Users, FileText, CreditCard, ShoppingCart, RefreshCcw, Zap, Plus, Search
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// ─── Metrik kartları ───────────────────────────────────────────────────────────
const METRICS = [
  { name: 'Toplam Stok',   value: '1,248',   change: '+12%', up: true,  icon: Package,    bg: '#3b82f6' },
  { name: 'Aktif Cariler', value: '42',       change: '+3',   up: true,  icon: Users,      bg: '#10b981' },
  { name: 'Aylık Satış',   value: '₺84.200', change: '-5%',  up: false, icon: FileText,   bg: '#8b5cf6' },
  { name: 'Kasa Dengesi',  value: '$12.450', change: '+₺2k', up: true,  icon: CreditCard, bg: '#f59e0b' },
];

// ─── Hızlı Aksiyonlar ─────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { n: 'Satış Yap',     icon: ShoppingCart, color: '#3b82f6' },
  { n: 'Stok Ekle',     icon: Plus,         color: '#f59e0b' },
  { n: 'Cari Ara',      icon: Search,       color: '#10b981' },
  { n: 'Gelen Kutusu',  icon: FileText,     color: '#8b5cf6' },
];

export default function Dashboard() {
  const [invoices, setInvoices]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const { effectiveMode, currentColor } = useTheme();

  const isDark = effectiveMode === 'dark';

  // ── Renk şemaları  ────────────────────────────────────────────────────────
  const c = {
    // Genel zemin
    pageBg:        'var(--bg-app)',
    cardBg:        'var(--bg-card)',
    headerBg:      'var(--bg-header)',
    border:        'var(--border)',
    // Metin
    textBase:      'var(--text-base)',
    textMuted:     'var(--text-muted)',
    // Arama
    searchBg:      isDark ? 'rgba(30,41,59,0.8)'  : 'rgba(241,245,249,0.9)',
    searchBorder:  isDark ? 'rgba(71,85,105,0.5)'  : '#e2e8f0',
    // Input gibi alanlar
    subBg:         isDark ? 'rgba(30,41,59,0.6)'   : 'rgba(255,255,255,0.8)',
    // Hover
    hoverBg:       isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    // Tablo satır hover
    rowHover:      isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    // Badge arkaplanları
    badgeUp:       isDark ? 'rgba(16,185,129,0.2)'  : '#dcfce7',
    badgeUpText:   isDark ? '#4ade80'                : '#15803d',
    badgeDown:     isDark ? 'rgba(239,68,68,0.2)'   : '#fee2e2',
    badgeDownText: isDark ? '#f87171'                : '#dc2626',
    // Tablo bölücüler
    divider:       isDark ? 'rgba(148,163,184,0.1)'  : '#f1f5f9',
    // Hızlı aksiyonlar arkaplan
    actionBg:      isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    actionHover:   isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
    // Kurumsal banner
    bannerBg:      `linear-gradient(135deg, ${currentColor} 0%, color-mix(in srgb, ${currentColor} 60%, #000) 100%)`,
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/get-invoices');
      setInvoices(response.data);
    } catch (err) {
      console.error(err);
      alert("Backend bağlantı hatası!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
        {/* ── İçerik ─────────────────────────────────────────────────────────── */}
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

          {/* Karşılama + senkronize */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: c.textBase }}>
                Hoş Geldin, Efe 👋
              </h1>
              <p className="mt-1 font-medium" style={{ color: c.textMuted }}>
                A-ERP Sistem Özetin ve Hızlı Aksiyonlar
              </p>
            </div>

            <button
              onClick={fetchInvoices}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border text-sm font-semibold transition-all"
              style={{
                background: c.subBg, borderColor: c.border, color: c.textMuted,
              }}
            >
              <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} style={{ color: currentColor }} />
              Uyumsoft Senkronizasyonu
            </button>
          </div>

          {/* ── Metrik Kartlar ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {METRICS.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 group cursor-pointer"
                style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl text-white shadow-lg"
                    style={{ background: m.bg }}>
                    <m.icon size={22} />
                  </div>
                  <div className="flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg"
                    style={{
                      background: m.up ? c.badgeUp : c.badgeDown,
                      color:      m.up ? c.badgeUpText : c.badgeDownText,
                    }}>
                    {m.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {m.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: c.textMuted }}>
                    {m.name}
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: c.textBase }}>
                    {m.value}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── 2 Kolon Alt ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Gelen Faturalar */}
            <div className="lg:col-span-2 glass-card p-6 lg:p-8 min-h-[380px]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: c.textBase }}>
                    Son Gelen Faturalar
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: c.textMuted }}>
                    Uyumsoft API'den çekilen kayıtlar
                  </p>
                </div>
                <button className="text-sm font-bold"
                  style={{ color: currentColor }}>
                  Tümünü Gör
                </button>
              </div>

              {!invoices && !loading && (
                <div className="flex flex-col items-center justify-center py-16" style={{ color: c.textMuted }}>
                  <FileText size={44} strokeWidth={1} />
                  <p className="mt-3 text-sm font-medium">Senkronize et butonuna basınız.</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-16 gap-3" style={{ color: c.textMuted }}>
                  <RefreshCcw size={18} className="animate-spin" style={{ color: currentColor }} />
                  <span className="font-medium text-sm">Veriler çekiliyor...</span>
                </div>
              )}

              {invoices && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: c.textMuted, borderBottom: `1px solid ${c.divider}` }}>
                        <th className="pb-3">Gönderici</th>
                        <th className="pb-3">Tarih</th>
                        <th className="pb-3">Tutar</th>
                        <th className="pb-3">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: `1px solid ${c.divider}` }}
                        onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="py-4 font-semibold" style={{ color: c.textBase }}>Uyumsoft Test Müşterisi</td>
                        <td className="py-4" style={{ color: c.textMuted }}>26.03.2026</td>
                        <td className="py-4 font-bold" style={{ color: c.textBase }}>₺15.450,00</td>
                        <td className="py-4">
                          <span className="badge badge-success">Onaylandı</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="p-4 rounded-2xl mt-4"
                    style={{ background: c.actionBg, border: `1px solid ${c.border}` }}>
                    <pre className="text-[10px] overflow-x-auto" style={{ color: c.textMuted }}>
                      {JSON.stringify(invoices, null, 2).substring(0, 400)}...
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Sağ kolon */}
            <div className="space-y-5">
              {/* Premium Banner */}
              <div className="rounded-2xl p-6 overflow-hidden relative"
                style={{ background: c.bannerBg }}>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={18} color="rgba(255,255,255,0.9)" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/70">Pro</span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    Premium ERP
                  </h3>
                  <p className="text-white/70 text-sm mt-1">
                    Uyumsoft entegrasyonu aktif.
                  </p>
                  <button className="mt-5 font-bold text-sm px-5 py-2 rounded-xl transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.25)',
                      backdropFilter: 'blur(8px)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                    Abonelik Yönetimi
                  </button>
                </div>
                {/* Dekoratif daireler */}
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.1)', filter: 'blur(20px)' }} />
                <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(12px)' }} />
              </div>

              {/* Hızlı Aksiyonlar */}
              <div className="glass-card p-6">
                <h3 className="font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: c.textMuted }}>
                  Hızlı Aksiyonlar
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {QUICK_ACTIONS.map((act, i) => (
                    <button key={i}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all text-center"
                      style={{
                        background: c.actionBg,
                        borderColor: c.border,
                        color: act.color,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.actionHover}
                      onMouseLeave={e => e.currentTarget.style.background = c.actionBg}
                    >
                      <div className="p-2 rounded-xl" style={{ background: `${act.color}20` }}>
                        <act.icon size={18} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: c.textBase }}>
                        {act.n}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
