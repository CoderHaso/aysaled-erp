import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, AlertCircle, FileDown, FileUp, Eye, RefreshCw,
  X, Building2, Tag, Package, BarChart2, CheckCircle2, Receipt, Info, ScanEye
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import InvoicePreviewModal from '../components/InvoicePreviewModal';

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

const fmt  = (n) => n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { year:'numeric', month:'long', day:'numeric' }) : '-';

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || '-', color: '#94a3b8' };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
      style={{ background: `${s.color}18`, color: s.color }}>
      {s.label}
    </span>
  );
}

// ─── Gerçek Fatura Tablosu ────────────────────────────────────────────────────
function InvoiceTable({ items }) {
  const hasDiscount = items.some(i => i.discount_rate || i.discount_amount);
  const hasItemCode = items.some(i => i.item_code);

  const totalLineExt    = items.reduce((s, i) => s + (i.line_total || 0), 0);
  const totalDiscount   = items.reduce((s, i) => s + (i.discount_amount || 0), 0);
  const totalVat        = items.reduce((s, i) => s + (i.tax_amount || 0), 0);
  const totalWithVat    = totalLineExt + totalVat;

  // KDV dökümü
  const vatBreakdown = {};
  items.forEach(i => {
    const pct = i.tax_percent || 0;
    if (!vatBreakdown[pct]) vatBreakdown[pct] = { taxable: 0, vat: 0 };
    vatBreakdown[pct].taxable += i.line_total || 0;
    vatBreakdown[pct].vat    += i.tax_amount || 0;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Kalem tablosu */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(148,163,184,0.12)' }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
              <th className="px-3 py-2.5 text-left font-bold text-slate-400 w-8">#</th>
              {hasItemCode && <th className="px-3 py-2.5 text-left font-bold text-slate-400">Stok Kodu</th>}
              <th className="px-3 py-2.5 text-left font-bold text-slate-400">Mal / Hizmet</th>
              <th className="px-3 py-2.5 text-right font-bold text-slate-400">Miktar</th>
              <th className="px-3 py-2.5 text-right font-bold text-slate-400">Birim Fiyat</th>
              {hasDiscount && <th className="px-3 py-2.5 text-right font-bold text-slate-400">İsk. %</th>}
              {hasDiscount && <th className="px-3 py-2.5 text-right font-bold text-slate-400">İsk. Tutar</th>}
              <th className="px-3 py-2.5 text-right font-bold text-slate-400">KDV %</th>
              <th className="px-3 py-2.5 text-right font-bold text-slate-400">KDV Tutarı</th>
              <th className="px-3 py-2.5 text-right font-bold text-slate-400">M.H. Tutarı</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(148,163,184,0.07)' : 'none' }}>
                <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                {hasItemCode && (
                  <td className="px-3 py-3 font-mono text-slate-400 whitespace-nowrap">{item.item_code || '-'}</td>
                )}
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-100">{item.name}</p>
                  {item.note && <p className="text-slate-500 mt-0.5 italic text-[10px]">{item.note}</p>}
                </td>
                <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">
                  {item.quantity != null ? fmt(item.quantity) : '-'}
                  {item.unit && <span className="text-slate-500 ml-1">{item.unit}</span>}
                </td>
                <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">{fmt(item.unit_price)}</td>
                {hasDiscount && (
                  <td className="px-3 py-3 text-right text-slate-400 whitespace-nowrap">
                    {item.discount_rate ? `%${fmt(item.discount_rate)}` : '-'}
                  </td>
                )}
                {hasDiscount && (
                  <td className="px-3 py-3 text-right text-orange-400 whitespace-nowrap">
                    {item.discount_amount ? fmt(item.discount_amount) : '-'}
                  </td>
                )}
                <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">%{item.tax_percent || 0}</td>
                <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">{fmt(item.tax_amount)}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-100 whitespace-nowrap">{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Özet & Toplamlar */}
      <div className="flex justify-end">
        <div className="rounded-2xl overflow-hidden min-w-[320px]" style={{ border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(255,255,255,0.03)' }}>
          <SumRow label="Mal/Hizmet Toplam Tutarı" value={fmt(totalLineExt)} />
          {totalDiscount > 0 && <SumRow label="Toplam İskonto" value={fmt(totalDiscount)} color="#f97316" />}

          {/* KDV dökümü */}
          {Object.entries(vatBreakdown).map(([pct, d]) => (
            <React.Fragment key={pct}>
              <SumRow label={`KDV Matrahı (%${pct})`} value={fmt(d.taxable)} muted />
              <SumRow label={`Hesaplanan KDV (%${pct})`} value={fmt(d.vat)} color="#60a5fa" />
            </React.Fragment>
          ))}

          <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
            <SumRow label="Vergiler Dahil Toplam" value={fmt(totalWithVat)} bold />
          </div>
          <div style={{ borderTop: '2px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.04)' }}>
            <SumRow label="Ödenecek Tutar" value={fmt(totalWithVat)} bold accent />
          </div>
        </div>
      </div>
    </div>
  );
}

function SumRow({ label, value, muted, bold, color, accent }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5 gap-8"
      style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
      <span className={`text-xs ${muted ? 'text-slate-500' : 'text-slate-400'} ${bold ? 'font-bold' : ''}`}>{label}</span>
      <span className={`text-sm font-bold tabular-nums whitespace-nowrap`}
        style={{ color: accent ? '#34d399' : (color || (bold ? '#f1f5f9' : '#94a3b8')) }}>
        {value}
      </span>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function InvoiceDetailDrawer({ invoice, isInbox, onClose, onLineItemsLoaded }) {
  const [lineItems, setLineItems]   = useState(null);
  const [fetchState, setFetchState] = useState('loading');
  const { currentColor } = useTheme();

  useEffect(() => {
    if (!invoice) return;

    // Cache'li mi?
    if (invoice.line_items && Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
      setLineItems(invoice.line_items);
      setFetchState('done');
      return;
    }

    setFetchState('loading');
    fetch('/api/get-invoice-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId:  invoice.invoice_id,
        documentId: invoice.document_id,
        type:       invoice.type
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const items = data.line_items || [];
          setLineItems(items);
          setFetchState('done');
          // Üst bileşene haber ver → ✓ tiki anında göster
          onLineItemsLoaded?.(invoice.invoice_id, items);
        } else {
          setFetchState('error');
        }
      })
      .catch(() => setFetchState('error'));
  }, [invoice]);

  if (!invoice) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div className="relative w-full max-w-3xl h-full overflow-y-auto"
          style={{ background: '#0c1526', borderLeft: '1px solid rgba(148,163,184,0.1)' }}
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 250 }}>

          {/* Başlık */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
            style={{ background: 'rgba(12,21,38,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">
                {isInbox ? 'Gelir Faturası' : 'Gider Faturası'}
              </p>
              <h2 className="text-base font-bold text-slate-100 font-mono">{invoice.invoice_id}</h2>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <button onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Büyük tutar kartı */}
            <div className="rounded-2xl p-5"
              style={{ background: `linear-gradient(135deg,${currentColor}18,${currentColor}08)`, border:`1px solid ${currentColor}28` }}>
              <p className="text-xs text-slate-400 mb-1">Ödenecek Toplam Tutar</p>
              <p className="text-3xl font-bold text-white">
                {fmt(invoice.amount)} <span className="text-base text-slate-400">{invoice.currency}</span>
              </p>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <span className="text-slate-400">Matrah: <strong className="text-slate-200">{fmt(invoice.tax_exclusive_amount)}</strong></span>
                <span className="text-slate-400">KDV: <strong className="text-slate-200">{fmt(invoice.tax_total)}</strong></span>
                {invoice.currency !== 'TRY' && (
                  <span className="text-slate-400">Kur: <strong className="text-slate-200">{invoice.exchange_rate}</strong></span>
                )}
              </div>
            </div>

            {/* İki kolon: Gönderici / Fatura Bilgisi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard title={isInbox ? 'Gönderici Cari' : 'Alıcı Cari'} icon={Building2}>
                <DR label="Ünvan / Ad" value={invoice.cari_name} />
                <DR label="VKN / TCKN" value={invoice.vkntckn} mono />
              </InfoCard>
              <InfoCard title="Fatura Bilgileri" icon={Receipt}>
                <DR label="Fatura No" value={invoice.invoice_id} mono />
                <DR label="ETTN (UUID)" value={invoice.document_id} mono small />
                <DR label="Düzenleme Tarihi" value={fmtD(invoice.issue_date)} />
                <DR label="Sisteme Giriş" value={fmtD(invoice.create_date_utc)} />
                <DR label="Fatura Türü" value={invoice.invoice_type} />
                <DR label="Senaryo" value={invoice.invoice_tip_type} />
                {invoice.order_document_id && <DR label="Sipariş Ref." value={invoice.order_document_id} mono />}
              </InfoCard>
            </div>

            {/* Sistem Durumu */}
            <InfoCard title="Sistem Durumu" icon={Tag}>
              <div className="grid grid-cols-2 gap-x-4">
                <DR label="Durum" value={invoice.status} />
                <DR label="Zarf Durumu" value={invoice.envelope_status} />
                <DR label="Zarf ID" value={invoice.envelope_identifier} mono small />
                <DR label="Görüntülendi" value={invoice.is_seen ? 'Evet' : 'Hayır'} />
                {invoice.message && <div className="col-span-2"><DR label="Sistem Mesajı" value={invoice.message} /></div>}
              </div>
            </InfoCard>

            {/* ── Fatura Kalemleri ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package size={13} style={{ color: '#818cf8' }} />
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                  Fatura Kalemleri
                </h3>
              </div>

              {fetchState === 'loading' && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 size={28} className="animate-spin text-blue-400" />
                  <p className="text-xs text-slate-400">Kalemler Uyumsoft'tan çekiliyor...</p>
                </div>
              )}
              {fetchState === 'error' && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 text-red-400 text-sm">
                  <AlertCircle size={16} /><span>Kalemler yüklenemedi.</span>
                </div>
              )}
              {fetchState === 'done' && (!lineItems || lineItems.length === 0) && (
                <div className="flex items-center gap-2 py-6 text-slate-500 text-xs justify-center">
                  <Info size={14} /><span>Bu faturada kalem bulunamadı.</span>
                </div>
              )}
              {fetchState === 'done' && lineItems?.length > 0 && (
                <InvoiceTable items={lineItems} />
              )}
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Küçük kart bileşeni
function InfoCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon size={12} className="text-slate-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      {children}
    </div>
  );
}

function DR({ label, value, mono, small }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-slate-700/20 last:border-0">
      <span className="text-[11px] text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-right font-semibold text-slate-200 break-all ${mono ? 'font-mono' : ''} ${small ? 'text-[10px]' : 'text-xs'}`}>
        {value}
      </span>
    </div>
  );
}

// Modül-seviyesi cache
const invoiceCache = new Map();

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Invoices({ type = 'inbox' }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [invoices, setInvoices]   = useState(() => invoiceCache.get(type) || []);
  const [loading, setLoading]     = useState(!invoiceCache.has(type));
  const [syncing, setSyncing]     = useState(false);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [previewInv, setPreviewInv] = useState(null); // { invoiceId, documentId, type }

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
    if (!force && invoiceCache.has(type)) {
      setInvoices(invoiceCache.get(type));
      setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('invoices').select('*').eq('type', type)
        .order('issue_date', { ascending: false }).limit(500);
      if (dbErr) throw dbErr;
      const rows = data || [];
      invoiceCache.set(type, rows);
      setInvoices(rows);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }, [type]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // API'den kalem gelince ilgili faturayı cache + state'de anında güncelle → ✓ tiki
  const handleLineItemsLoaded = useCallback((invoiceId, items) => {
    setInvoices(prev => {
      const updated = prev.map(inv =>
        inv.invoice_id === invoiceId ? { ...inv, line_items: items } : inv
      );
      invoiceCache.set(type, updated);
      // selected'i da güncelle
      setSelected(s => s?.invoice_id === invoiceId ? { ...s, line_items: items } : s);
      return updated;
    });
  }, [type]);

  const syncInvoices = async () => {
    setSyncing(true); setError(null);
    try {
      const res  = await fetch('/api/sync-invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error);
      invoiceCache.delete(type);
      await fetchInvoices(true);
      alert(data.message);
    } catch (err) { setError(err.message); }
    finally { setSyncing(false); }
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
            <div className="p-3 rounded-2xl flex-shrink-0" style={{ background:`${currentColor}15`, color:currentColor }}>
              <Icon size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>
                {isInbox ? 'Gelir Faturaları' : 'Gider Faturaları'}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                {invoices.length} kayıt · Uyumsoft e-Fatura
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
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all"
              style={{ background: currentColor, opacity: syncing ? 0.7 : 1 }}>
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {syncing ? 'Eşitleniyor...' : 'Senkronize Et'}
            </button>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity:0,y:-5 }} animate={{ opacity:1,y:0 }}
            className="p-4 rounded-xl flex items-center gap-3 mb-4"
            style={{ background:'#ef444415', color:'#ef4444' }}>
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}

        {/* Tablo */}
        <div className="rounded-3xl overflow-hidden border" style={{ background: c.card, borderColor: c.border }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: c.border, background: c.hover }}>
                  {['Tarih','Fatura No', isInbox?'Gönderen Cari':'Alıcı Cari','Durum','Tutar','İşlem'].map(h => (
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
                    <p className="text-xs mt-1 opacity-70">Senkronize Et'e basarak verileri çekin.</p>
                  </td></tr>
                ) : filtered.map((inv, idx) => {
                  const hasCached = inv.line_items?.length > 0;
                  return (
                    <motion.tr key={inv.id || idx}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                      className="border-b last:border-0 cursor-pointer transition-colors"
                      style={{ borderColor: c.border }}
                      onMouseEnter={e => e.currentTarget.style.background = c.hover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setSelected(inv)}>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm" style={{ color: c.muted }}>
                        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg font-mono"
                          style={{ background:`${currentColor}15`, color:currentColor }}>
                          {inv.invoice_id}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium" style={{ color: c.text, maxWidth:'220px' }}>
                        <p className="truncate">{inv.cari_name || '-'}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: c.muted }}>{inv.vkntckn}</p>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-right" style={{ color: c.text }}>
                        {Number(inv.amount).toLocaleString('tr-TR', { minimumFractionDigits:2 })}
                        <span className="text-xs font-normal ml-1" style={{ color: c.muted }}>{inv.currency}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={e => { e.stopPropagation(); setSelected(inv); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={{ background:`${currentColor}15`, color:currentColor }}
                            title="Detayları Görüntüle">
                            {hasCached
                              ? <CheckCircle2 size={13} className="text-emerald-400" />
                              : <Eye size={13} />}
                            Detay
                          </button>
                          {inv.document_id && (
                            <button
                              onClick={e => { e.stopPropagation(); setPreviewInv({ invoiceId: inv.invoice_id, documentId: inv.document_id, type: inv.type }); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                              style={{ background:'rgba(139,92,246,0.12)', color:'#a78bfa' }}
                              title="Fatura Görselini Önizle">
                              <ScanEye size={13} />Önizle
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
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
            onLineItemsLoaded={handleLineItemsLoaded}
          />
        )}
      </AnimatePresence>

      {previewInv && (
        <InvoicePreviewModal
          invoiceId={previewInv.invoiceId}
          documentId={previewInv.documentId}
          type={previewInv.type}
          onClose={() => setPreviewInv(null)}
        />
      )}
    </>
  );
}
