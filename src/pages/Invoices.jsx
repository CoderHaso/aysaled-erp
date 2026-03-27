import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, AlertCircle, FileDown, FileUp, Eye, RefreshCw,
  X, Receipt, Building2, TrendingUp, CreditCard, Tag, Package,
  ChevronRight, Hash, BarChart2, Info
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  Approved:             { label: 'Onaylandı',         color: '#10b981' },
  SentToGib:            { label: "GİB'e Gönderildi", color: '#3b82f6' },
  Processing:           { label: 'İşleniyor',         color: '#f59e0b' },
  Queued:               { label: 'Sırada',             color: '#8b5cf6' },
  Draft:                { label: 'Taslak',             color: '#94a3b8' },
  Canceled:             { label: 'İptal',              color: '#ef4444' },
  Declined:             { label: 'Reddedildi',         color: '#ef4444' },
  Error:                { label: 'Hata',               color: '#ef4444' },
  WaitingForAprovement: { label: 'Onay Bekliyor',     color: '#f59e0b' },
  Return:               { label: 'İade',               color: '#f97316' },
};
const TIP_MAP = {
  Sales: 'Satış', Return: 'İade', Exception: 'İstisna',
  TaxBase: 'Matrah Artırım', Withholding: 'Tevkifat', Accomodation: 'Konaklama',
};

const fmt  = (n)  => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtD = (d)  => d ? new Date(d).toLocaleDateString('tr-TR', { year:'numeric', month:'long', day:'numeric' }) : '-';

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || '-', color: '#94a3b8' };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
      style={{ background: `${s.color}18`, color: s.color }}>
      {s.label}
    </span>
  );
}

function DetailRow({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-700/25 last:border-0">
      <span className="text-xs text-slate-400 font-medium flex-shrink-0">{label}</span>
      <span className={`text-sm text-right font-semibold text-slate-100 max-w-[60%] break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children, accent }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={13} style={{ color: accent || '#94a3b8' }} />
        <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent || '#94a3b8' }}>{title}</h3>
      </div>
      <div className="rounded-2xl px-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Line Items Table ─────────────────────────────────────────────────────────
function LineItemsTable({ items, fetchState }) {
  if (fetchState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Loader2 size={28} className="animate-spin text-blue-400" />
        <p className="text-xs text-slate-400">Fatura kalemleri Uyumsoft'tan çekiliyor...</p>
      </div>
    );
  }
  if (fetchState === 'error') {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 text-red-400 text-sm">
        <AlertCircle size={16} /><span>Kalemler yüklenemedi.</span>
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 text-slate-500 text-xs justify-center">
        <Info size={14} /><span>Bu faturada kalem bulunamadı.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(148,163,184,0.1)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
            <th className="px-3 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider">Ürün/Hizmet</th>
            <th className="px-3 py-2.5 text-right font-bold text-slate-400 uppercase tracking-wider">Miktar</th>
            <th className="px-3 py-2.5 text-right font-bold text-slate-400 uppercase tracking-wider">Birim Fiyat</th>
            <th className="px-3 py-2.5 text-right font-bold text-slate-400 uppercase tracking-wider">KDV%</th>
            <th className="px-3 py-2.5 text-right font-bold text-slate-400 uppercase tracking-wider">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(148,163,184,0.07)' : 'none' }}>
              <td className="px-3 py-3">
                <p className="font-semibold text-slate-100">{item.name}</p>
                {item.item_code && <p className="text-slate-500 mt-0.5 font-mono">{item.item_code}</p>}
                {item.note && <p className="text-slate-600 mt-0.5 italic">{item.note}</p>}
              </td>
              <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">
                {fmt(item.quantity)} <span className="text-slate-500">{item.unit}</span>
              </td>
              <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">{fmt(item.unit_price)}</td>
              <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">%{item.tax_percent}</td>
              <td className="px-3 py-3 text-right font-bold text-slate-100 whitespace-nowrap">{fmt(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.03)' }}>
            <td colSpan="4" className="px-3 py-2.5 text-right text-slate-400 text-xs font-bold">Satır Toplamı:</td>
            <td className="px-3 py-2.5 text-right font-bold text-blue-400 text-xs">
              {fmt(items.reduce((s, l) => s + (l.line_total || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function InvoiceDetailDrawer({ invoice, isInbox, onClose }) {
  const [lineItems, setLineItems]   = useState(invoice?.line_items || null);
  const [fetchState, setFetchState] = useState(
    invoice?.line_items?.length > 0 ? 'done' : 'loading'
  );

  const { currentColor } = useTheme();

  useEffect(() => {
    if (!invoice) return;

    // Zaten cache'li verisi varsa api çağrısı yapma
    if (invoice.line_items && invoice.line_items.length > 0) {
      setLineItems(invoice.line_items);
      setFetchState('done');
      return;
    }

    // API'den çek
    setFetchState('loading');
    fetch('/api/get-invoice-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId:  invoice.invoice_id,
        documentId: invoice.document_id,  // Uyumsoft iç ID (UUID)
        type:       invoice.type
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setLineItems(data.line_items || []);
          setFetchState('done');
        } else {
          setFetchState('error');
        }
      })
      .catch(() => setFetchState('error'));
  }, [invoice]);

  if (!invoice) return null;

  const hasVat = ['vat1','vat8','vat10','vat18','vat20'].some(k => Number(invoice[k]) > 0);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full max-w-2xl h-full overflow-y-auto"
          style={{ background: '#0c1526', borderLeft: '1px solid rgba(148,163,184,0.1)' }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 250 }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
            style={{ background: 'rgba(12,21,38,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">
                {isInbox ? 'Gelir Faturası' : 'Gider Faturası'}
              </p>
              <h2 className="text-base font-bold text-slate-100 font-mono">{invoice.invoice_id}</h2>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <button onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/08 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-0">

            {/* Tutar Özet */}
            <div className="rounded-2xl p-5 mb-5"
              style={{ background: `linear-gradient(135deg, ${currentColor}18, ${currentColor}08)`, border: `1px solid ${currentColor}28` }}>
              <p className="text-xs text-slate-400 mb-1">Ödenecek Toplam Tutar</p>
              <p className="text-3xl font-bold text-white">
                {fmt(invoice.amount)}
                <span className="text-base text-slate-400 ml-2">{invoice.currency}</span>
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <span className="text-slate-400">Matrah: <span className="text-slate-200 font-semibold">{fmt(invoice.tax_exclusive_amount)}</span></span>
                <span className="text-slate-400">KDV: <span className="text-slate-200 font-semibold">{fmt(invoice.tax_total)}</span></span>
                {invoice.currency !== 'TRY' && (
                  <span className="text-slate-400">Kur: <span className="text-slate-200 font-semibold">{invoice.exchange_rate}</span></span>
                )}
              </div>
            </div>

            {/* Cari */}
            <Section title={isInbox ? 'Gönderici Cari' : 'Alıcı Cari'} icon={Building2}>
              <DetailRow label="Ünvan / Ad Soyad" value={invoice.cari_name} />
              <DetailRow label="VKN / TCKN" value={invoice.vkntckn} mono />
            </Section>

            {/* Fatura Bilgileri */}
            <Section title="Fatura Bilgileri" icon={Receipt}>
              <DetailRow label="Fatura No" value={invoice.invoice_id} mono />
              <DetailRow label="Belge ID" value={invoice.document_id} mono />
              <DetailRow label="Zarf ID" value={invoice.envelope_identifier} mono />
              <DetailRow label="Düzenleme Tarihi" value={fmtD(invoice.issue_date)} />
              <DetailRow label="Sisteme Giriş" value={fmtD(invoice.create_date_utc)} />
              <DetailRow label="Sipariş Referansı" value={invoice.order_document_id} mono />
              <DetailRow label="Fatura Türü" value={invoice.invoice_type} />
              <DetailRow label="Senaryo" value={TIP_MAP[invoice.invoice_tip_type] || invoice.invoice_tip_type} />
            </Section>

            {/* KDV Dökümü */}
            {hasVat && (
              <Section title="KDV Dökümü" icon={BarChart2}>
                {Number(invoice.vat1)  > 0 && <DetailRow label="KDV %1"  value={`Matrah: ${fmt(invoice.vat1_taxable)}  →  KDV: ${fmt(invoice.vat1)}`} />}
                {Number(invoice.vat8)  > 0 && <DetailRow label="KDV %8"  value={`Matrah: ${fmt(invoice.vat8_taxable)}  →  KDV: ${fmt(invoice.vat8)}`} />}
                {Number(invoice.vat10) > 0 && <DetailRow label="KDV %10" value={`Matrah: ${fmt(invoice.vat10_taxable)} →  KDV: ${fmt(invoice.vat10)}`} />}
                {Number(invoice.vat18) > 0 && <DetailRow label="KDV %18" value={`Matrah: ${fmt(invoice.vat18_taxable)} →  KDV: ${fmt(invoice.vat18)}`} />}
                {Number(invoice.vat20) > 0 && <DetailRow label="KDV %20" value={`Matrah: ${fmt(invoice.vat20_taxable)} →  KDV: ${fmt(invoice.vat20)}`} />}
              </Section>
            )}

            {/* Durum */}
            <Section title="Sistem Durumu" icon={Tag}>
              <DetailRow label="Durum" value={invoice.status} />
              <DetailRow label="Zarf Durumu" value={invoice.envelope_status} />
              {invoice.message && <DetailRow label="Sistem Mesajı" value={invoice.message} />}
              <DetailRow label="Görüntülendi mi?" value={invoice.is_seen ? 'Evet' : 'Hayır'} />
              <DetailRow label="Arşivde mi?" value={invoice.is_archived ? 'Evet' : 'Hayır'} />
            </Section>

            {/* Ürün Kalemleri */}
            <Section title="Fatura Kalemleri (Ürünler)" icon={Package} accent="#6366f1">
              <div className="pb-4">
                <LineItemsTable items={lineItems} fetchState={fetchState} />
              </div>
            </Section>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Modül-seviyesi in-memory cache (sayfa yenilenene kadar veri hafizada kalır) ─
const invoiceCache = new Map(); // key: 'inbox' | 'outbox'

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Invoices({ type = 'inbox' }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [invoices, setInvoices]   = useState(() => invoiceCache.get(type) || []);
  const [loading, setLoading]     = useState(!invoiceCache.has(type)); // zaten varsa loading yok
  const [syncing, setSyncing]     = useState(false);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);

  const isInbox = type === 'inbox';
  const Icon    = isInbox ? FileDown : FileUp;

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    hover:  isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const fetchInvoices = useCallback(async (force = false) => {
    // Cache varsa ve force değilse tekrar çekme
    if (!force && invoiceCache.has(type)) {
      setInvoices(invoiceCache.get(type));
      setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('type', type)
        .order('issue_date', { ascending: false })
        .limit(500);
      if (dbErr) throw dbErr;
      const rows = data || [];
      invoiceCache.set(type, rows); // cache'e yaz
      setInvoices(rows);
    } catch (err) {
      setError(err.message || 'Veritabanından faturalar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const syncInvoices = async () => {
    setSyncing(true); setError(null);
    try {
      const res  = await fetch('/api/sync-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Senkronizasyon başarısız.');
      invoiceCache.delete(type); // cache temizle, force re-fetch yap
      await fetchInvoices(true);
      alert(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = invoices.filter(inv => {
    const t = search.toLowerCase();
    return (inv.invoice_id||'').toLowerCase().includes(t)
      || (inv.cari_name||'').toLowerCase().includes(t)
      || (inv.vkntckn||'').toLowerCase().includes(t);
  });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

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
              <input type="text" placeholder="Fatura No / Cari / VKN..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border outline-none min-w-[220px]"
                style={{ background: c.card, borderColor: c.border, color: c.text }} />
            </div>
            <button onClick={syncInvoices} disabled={syncing}
              className="btn-primary flex items-center gap-2" style={{ background: currentColor }}>
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {syncing ? 'Eşitleniyor...' : 'Senkronize Et'}
            </button>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity:0, y:-5 }} animate={{ opacity:1, y:0 }}
            className="p-4 rounded-xl flex items-center gap-3 mb-4"
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
                  {['Tarih','Fatura No', isInbox ? 'Gönderen Cari':'Alıcı Cari', 'Durum','Tutar','İşlem'].map(h => (
                    <th key={h} className={`px-5 py-4 text-xs font-bold uppercase tracking-wider ${h==='Tutar'?'text-right':h==='İşlem'?'text-center':''}`}
                      style={{ color: c.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="px-5 py-14 text-center" style={{ color: c.muted }}>
                    <Loader2 size={30} className="animate-spin mx-auto mb-3" style={{ color: currentColor }} />
                    <p className="text-sm">Faturalar yükleniyor...</p>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="6" className="px-5 py-14 text-center" style={{ color: c.muted }}>
                    <Icon size={38} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Kayıt bulunamadı.</p>
                    <p className="text-xs mt-1 opacity-70">Senkronize Et butonuna basarak Uyumsoft'tan verileri çekin.</p>
                  </td></tr>
                ) : filtered.map((inv, idx) => (
                  <motion.tr
                    key={inv.id || idx}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
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
                    <td className="px-5 py-3.5 text-sm font-medium" style={{ color: c.text, maxWidth:'220px' }}>
                      <p className="truncate">{inv.cari_name || '-'}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: c.muted }}>{inv.vkntckn}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-right" style={{ color: c.text }}>
                      {Number(inv.amount).toLocaleString('tr-TR', { minimumFractionDigits:2 })}
                      <span className="text-xs font-normal ml-1" style={{ color: c.muted }}>{inv.currency}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(inv); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: `${currentColor}15`, color: currentColor }}
                      >
                        <Eye size={13} />
                        Görüntüle
                        {inv.line_items?.length > 0 && <span className="opacity-60">✓</span>}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

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
