import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, AlertCircle, FileDown, FileUp,
  Eye, RefreshCw, X, Receipt, Building2, Calendar,
  TrendingUp, Hash, CreditCard, Tag, Archive, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  Approved:              { label: 'Onaylandı',    color: '#10b981' },
  SentToGib:             { label: 'GİB\'e Gönderildi', color: '#3b82f6' },
  Processing:            { label: 'İşleniyor',    color: '#f59e0b' },
  Queued:                { label: 'Sırada',        color: '#8b5cf6' },
  Draft:                 { label: 'Taslak',        color: '#94a3b8' },
  Canceled:              { label: 'İptal',         color: '#ef4444' },
  Declined:              { label: 'Reddedildi',    color: '#ef4444' },
  Error:                 { label: 'Hata',          color: '#ef4444' },
  WaitingForAprovement:  { label: 'Onay Bekliyor', color: '#f59e0b' },
  Return:                { label: 'İade',          color: '#f97316' },
};

const TIP_MAP = {
  Sales:          'Satış',
  Return:         'İade',
  Exception:      'İstisna',
  TaxBase:        'Matrah Artırım',
  Withholding:    'Tevkifat',
  Accomodation:   'Konaklama',
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || '-', color: '#94a3b8' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
      style={{ background: `${s.color}18`, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Detail Row ────────────────────────────────────────────────────────────────
function DetailRow({ label, value, mono = false }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-700/30 last:border-0">
      <span className="text-xs text-slate-400 font-medium flex-shrink-0">{label}</span>
      <span className={`text-sm text-right font-semibold text-slate-100 max-w-[60%] break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-slate-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      </div>
      <div className="bg-slate-800/50 rounded-2xl px-4">{children}</div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function InvoiceDetailDrawer({ invoice, isInbox, onClose }) {
  if (!invoice) return null;
  const fmt = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  const hasVat = ['vat1','vat8','vat10','vat18','vat20'].some(k => Number(invoice[k]) > 0);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <motion.div
          className="relative w-full max-w-lg h-full overflow-y-auto custom-scrollbar"
          style={{ background: '#0f172a', borderLeft: '1px solid rgba(148,163,184,0.12)' }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
            style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
            <div>
              <h2 className="text-base font-bold text-slate-100">{invoice.invoice_id}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{isInbox ? 'Gelir Faturası' : 'Gider Faturası'} Detayı</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5">

            {/* Tutar Özet Kartı */}
            <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, #1e40af22, #7c3aed22)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-xs text-slate-400 mb-1">Ödenecek Tutar</p>
              <p className="text-3xl font-bold text-white">
                {fmt(invoice.amount)} <span className="text-lg text-slate-400">{invoice.currency}</span>
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-slate-400">Matrah: <span className="text-slate-200 font-semibold">{fmt(invoice.tax_exclusive_amount)}</span></span>
                <span className="text-slate-400">KDV: <span className="text-slate-200 font-semibold">{fmt(invoice.tax_total)}</span></span>
              </div>
            </div>

            {/* Cari Bilgileri */}
            <Section title={isInbox ? 'Gönderici Cari' : 'Alıcı Cari'} icon={Building2}>
              <DetailRow label="Ünvan / Ad Soyad" value={invoice.cari_name} />
              <DetailRow label="VKN / TCKN" value={invoice.vkntckn} mono />
            </Section>

            {/* Fatura Bilgileri */}
            <Section title="Fatura Bilgileri" icon={Receipt}>
              <DetailRow label="Fatura Numarası" value={invoice.invoice_id} mono />
              <DetailRow label="Belge ID" value={invoice.document_id} mono />
              <DetailRow label="Zarf ID" value={invoice.envelope_identifier} mono />
              <DetailRow label="Düzenleme Tarihi" value={fmtDate(invoice.issue_date)} />
              <DetailRow label="Sisteme Giriş Tarihi" value={fmtDate(invoice.create_date_utc)} />
              <DetailRow label="Referans Sipariş No" value={invoice.order_document_id} mono />
              <DetailRow label="Fatura Türü" value={invoice.invoice_type} />
              <DetailRow label="Senaryo" value={TIP_MAP[invoice.invoice_tip_type] || invoice.invoice_tip_type} />
            </Section>

            {/* KDV Detayları */}
            {hasVat && (
              <Section title="KDV Dökümü" icon={TrendingUp}>
                {Number(invoice.vat1) > 0 && <DetailRow label="KDV %1 Matrah" value={`${fmt(invoice.vat1_taxable)} - KDV: ${fmt(invoice.vat1)}`} />}
                {Number(invoice.vat8) > 0 && <DetailRow label="KDV %8 Matrah" value={`${fmt(invoice.vat8_taxable)} - KDV: ${fmt(invoice.vat8)}`} />}
                {Number(invoice.vat10) > 0 && <DetailRow label="KDV %10 Matrah" value={`${fmt(invoice.vat10_taxable)} - KDV: ${fmt(invoice.vat10)}`} />}
                {Number(invoice.vat18) > 0 && <DetailRow label="KDV %18 Matrah" value={`${fmt(invoice.vat18_taxable)} - KDV: ${fmt(invoice.vat18)}`} />}
                {Number(invoice.vat20) > 0 && <DetailRow label="KDV %20 Matrah" value={`${fmt(invoice.vat20_taxable)} - KDV: ${fmt(invoice.vat20)}`} />}
              </Section>
            )}

            {/* Döviz */}
            {invoice.currency !== 'TRY' && (
              <Section title="Döviz Bilgisi" icon={CreditCard}>
                <DetailRow label="Para Birimi" value={invoice.currency} />
                <DetailRow label="Döviz Kuru" value={invoice.exchange_rate} />
              </Section>
            )}

            {/* Durum */}
            <Section title="Sistem Durumu" icon={Tag}>
              <DetailRow label="Fatura Durumu" value={invoice.status} />
              <DetailRow label="Zarf İşlem Durumu" value={invoice.envelope_status} />
              {invoice.message && <DetailRow label="Sistem Mesajı" value={invoice.message} />}
              <DetailRow label="Yeni mi?" value={invoice.is_new ? 'Evet' : 'Hayır'} />
              <DetailRow label="Görüntülendi mi?" value={invoice.is_seen ? 'Evet' : 'Hayır'} />
              <DetailRow label="Arşivde mi?" value={invoice.is_archived ? 'Evet' : 'Hayır'} />
            </Section>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Invoices({ type = 'inbox' }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const isInbox = type === 'inbox';
  const Icon = isInbox ? FileDown : FileUp;

  useEffect(() => {
    fetchInvoices();
  }, [type]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('type', type)
        .order('issue_date', { ascending: false })
        .limit(200);

      if (dbErr) throw dbErr;
      setInvoices(data || []);
    } catch (err) {
      setError(err.message || 'Veritabanından faturalar alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const syncInvoices = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/sync-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.detail || 'Senkronizasyon başarısız.');
      await fetchInvoices();
      alert(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const c = {
    card: isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    hover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const filtered = invoices.filter(inv => {
    const term = search.toLowerCase();
    return (
      (inv.invoice_id || '').toLowerCase().includes(term) ||
      (inv.cari_name || '').toLowerCase().includes(term) ||
      (inv.vkntckn || '').toLowerCase().includes(term)
    );
  });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15`, color: currentColor }}>
              <Icon size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>
                {isInbox ? 'Gelir Faturaları' : 'Gider Faturaları'}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                {invoices.length} kayıt · Uyumsoft senkronizasyonu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
              <input
                type="text"
                placeholder="Fatura No / Cari / VKN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border outline-none min-w-[220px]"
                style={{ background: c.card, borderColor: c.border, color: c.text }}
              />
            </div>
            <button onClick={syncInvoices} disabled={syncing}
              className="btn-primary flex items-center gap-2" style={{ background: currentColor }}>
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {syncing ? 'Eşitleniyor...' : 'Senkronize Et'}
            </button>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl flex items-center gap-3"
            style={{ background: '#ef444415', color: '#ef4444' }}>
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}

        {/* Table */}
        <div className="rounded-3xl overflow-hidden border" style={{ background: c.card, borderColor: c.border }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: c.border, background: c.hover }}>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Tarih</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Fatura No</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>{isInbox ? 'Gönderen Cari' : 'Alıcı Cari'}</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Durum</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-right" style={{ color: c.muted }}>Tutar</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-center" style={{ color: c.muted }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-14 text-center" style={{ color: c.muted }}>
                      <Loader2 size={30} className="animate-spin mx-auto mb-3" style={{ color: currentColor }} />
                      <p className="text-sm">Faturalar yükleniyor...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-14 text-center" style={{ color: c.muted }}>
                      <Icon size={38} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">Kayıt bulunamadı.</p>
                      <p className="text-xs mt-1 opacity-70">Senkronize Et butonuna basarak Uyumsoft'tan verileri çekin.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv, idx) => {
                    const s = STATUS_MAP[inv.status] || { label: inv.status || '-', color: '#94a3b8' };
                    return (
                      <motion.tr
                        key={inv.id || idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                        className="border-b last:border-0 cursor-pointer transition-colors"
                        style={{ borderColor: c.border }}
                        onMouseEnter={e => e.currentTarget.style.background = c.hover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => setSelected(inv)}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm" style={{ color: c.muted }}>
                          {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-lg font-mono"
                            style={{ background: `${currentColor}15`, color: currentColor }}>
                            {inv.invoice_id}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-medium" style={{ color: c.text, maxWidth: '220px' }}>
                          <p className="truncate">{inv.cari_name || '-'}</p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: c.muted }}>{inv.vkntckn}</p>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-right" style={{ color: c.text }}>
                          {Number(inv.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          <span className="text-xs font-normal ml-1" style={{ color: c.muted }}>{inv.currency}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(inv); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                            style={{ background: `${currentColor}15`, color: currentColor }}
                          >
                            <Eye size={13} />
                            Görüntüle
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <InvoiceDetailDrawer
            invoice={selected}
            isInbox={isInbox}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
