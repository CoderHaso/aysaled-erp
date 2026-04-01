import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, AlertCircle, FileDown, FileUp, Eye, RefreshCw,
  X, Building2, Tag, Package, BarChart2, CheckCircle2, Receipt, Info, ScanEye,
  FilePlus2, Plus, Trash2, CheckCheck
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import { useLocation } from 'react-router-dom';
import { pageCache } from '../lib/pageCache';
import CustomDialog from '../components/CustomDialog';

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

// UBL birim kodu → Türkçe karşılık (UN/ECE Rec 20 + yaygın kullanımlar)
const UBL_UNITS = {
  NIU: 'Adet',   // Number of Items/Units
  C62: 'Adet',   // One (unit)
  H87: 'Adet',
  PCE: 'Adet',
  EA:  'Adet',
  PCS: 'Adet',
  UN:  'Adet',
  MTR: 'Metre',
  M:   'Metre',
  KGM: 'Kg',
  KG:  'Kg',
  GRM: 'Gram',
  LTR: 'Litre',
  MTK: 'M²',
  MTQ: 'M³',
  HUR: 'Saat',
  MIN: 'Dakika',
  DAY: 'Gün',
  MON: 'Ay',
  ANN: 'Yıl',
  SET: 'Set',
  RL:  'Rulo',
  PKG: 'Paket',
  BX:  'Kutu',
  PR:  'Çift',
};
const unitLabel = (code) => UBL_UNITS[code?.toUpperCase?.()] || code || '';
const currSymbol = (c) => ({ USD:'$', EUR:'€', GBP:'£', TRY:'₺' }[c] || c || '₺');

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
function InvoiceTable({ items, currency = 'TRY' }) {
  const sym = currSymbol(currency);
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
                  {item.unit && <span className="text-slate-500 ml-1">{unitLabel(item.unit)}</span>}
                </td>
                <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">{fmt(item.unit_price)} <span className="text-slate-500">{sym}</span></td>
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
                <td className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">{fmt(item.tax_amount)} <span className="text-slate-500">{sym}</span></td>
                <td className="px-3 py-3 text-right font-bold text-slate-100 whitespace-nowrap">{fmt(item.line_total)} <span className="text-slate-400 font-normal text-[10px]">{sym}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Özet & Toplamlar */}
      <div className="flex justify-end">
        <div className="rounded-2xl overflow-hidden min-w-[320px]" style={{ border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(255,255,255,0.03)' }}>
          <SumRow label="Mal/Hizmet Toplam Tutarı" value={`${fmt(totalLineExt)} ${sym}`} />
          {totalDiscount > 0 && <SumRow label="Toplam İskonto" value={`${fmt(totalDiscount)} ${sym}`} color="#f97316" />}

          {/* KDV dökümü */}
          {Object.entries(vatBreakdown).map(([pct, d]) => (
            <React.Fragment key={pct}>
              <SumRow label={`KDV Matrahı (%${pct})`} value={`${fmt(d.taxable)} ${sym}`} muted />
              <SumRow label={`Hesaplanan KDV (%${pct})`} value={`${fmt(d.vat)} ${sym}`} color="#60a5fa" />
            </React.Fragment>
          ))}

          <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
            <SumRow label="Vergiler Dahil Toplam" value={`${fmt(totalWithVat)} ${sym}`} bold />
          </div>
          <div style={{ borderTop: '2px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.04)' }}>
            <SumRow label="Ödenecek Tutar" value={`${fmt(totalWithVat)} ${sym}`} bold accent />
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
    fetch('/api/invoices-api?action=detail', {
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
              {isInbox ? 'Gider Faturası' : 'Gelir Faturası'}
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
                <InvoiceTable items={lineItems} currency={invoice.currency} />
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

// Modül-seviyesi in-memory cache (sekme boyunca)
const invoiceCache = new Map();

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Invoices({ type = 'inbox' }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const cacheKey = `invoices_${type}`;
  const [invoices, setInvoices]   = useState(() => invoiceCache.get(type) || pageCache.get(`invoices_${type}`) || []);
  const [loading, setLoading]     = useState(!invoiceCache.has(type) && !pageCache.get(`invoices_${type}`));
  const [syncing, setSyncing]     = useState(false);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [previewInv, setPreviewInv] = useState(null);
  // Manuel fatura oluşturma
  const EMPTY_LINE = () => ({ id: Date.now(), name: '', quantity: 1, unit: 'Adet', unitPrice: 0, taxRate: 20 });
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState({ customer_id: null, cari_name: '', vkntckn: '', city: '', district: '', address: '', tax_office: '', issue_date: new Date().toISOString().slice(0,10), currency: 'TRY', notes: '', exchange_rate: '', lines: [EMPTY_LINE()] });
  const [exchangeRate, setExchangeRate] = useState(null);  // { rate, buyRate, source, date }
  const [fetchingRate, setFetchingRate] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [createType, setCreateType]   = useState('outbox'); // Hangi sekme açtı
  const [formalizing, setFormalizing] = useState(null); // invoice_id
  const [queryingVkn, setQueryingVkn] = useState(false);
  const [entities, setEntities]       = useState([]);
  const [dbItems, setDbItems]         = useState([]);
  // Cari autocomplete dropdown state
  const [entityOpen, setEntityOpen]   = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [quickEntityForm, setQuickEntityForm] = useState(null); // null | { name, vkntckn, phone, email }
  const [quickEntitySaving, setQuickEntitySaving] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false); // keep for compat
  // İtem (kalem) autocomplete per-line state
  const [itemOpenId,    setItemOpenId]    = useState(null); // line.id of the open dropdown
  const [itemSearch,    setItemSearch]    = useState({});   // { [lineId]: searchStr }
  const [quickItemForm, setQuickItemForm] = useState(null); // null | { lineId, name }
  const [quickItemSaving, setQuickItemSaving] = useState(false);
  const location = useLocation();
  const [toast, setToast]       = useState(null);
  const [dialog, setDialog]     = useState({ open: false, title: '', message: '', type: 'confirm', onConfirm: null, loading: false });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Cari/Tedarikçi drawer’dan yönlendirme gelirse faturayı otomatik aç
  useEffect(() => {
    const state = location.state;
    if (!state?.openInvoiceId) return;
    // Listede bul ve aç, yoksa preview aç
    const found = invoices.find(inv => inv.invoice_id === state.openInvoiceId);
    if (found) {
      if (state.documentId) {
        setPreviewInv({ invoiceId: found.invoice_id, documentId: found.document_id || state.documentId, type });
      } else {
        setSelected(found);
      }
    }
    // State’i temizle (tekrar tetiklenmesin)
    window.history.replaceState({}, '');
  }, [location.state, invoices]);

  const isInbox = type === 'inbox';
  const Icon    = isInbox ? FileDown : FileUp;
  const label   = isInbox ? 'Gelen (Alış)' : 'Giden (Satış)';

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    hover:  isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const fetchInvoices = useCallback(async (force = false) => {
    const ck = `invoices_${type}`;
    // 1) Memory cache (sekme boyunca en hızlı)
    if (!force && invoiceCache.has(type)) {
      setInvoices(invoiceCache.get(type));
      setLoading(false);
      return;
    }
    // 2) sessionStorage cache (sayfa yenilemede hızlı)
    if (!force) {
      const cached = pageCache.get(ck);
      if (cached) {
        invoiceCache.set(type, cached);
        setInvoices(cached);
        setLoading(false);
        return;
      }
    }
    setLoading(true); setError(null);
    try {
      // raw_detail ve html_view colonialı çekme — bunlar büyük JSON, timeout'a yol açıyor.
      // Detay açılınca get-invoice-detail endpoint'i ayrıca çeker.
      const { data, error: dbErr } = await supabase
        .from('invoices')
        .select('id, invoice_id, document_id, type, cari_name, vkntckn, amount, currency, issue_date, status, line_items')
        .eq('type', type)
        .order('issue_date', { ascending: false })
        .limit(500);
      if (dbErr) throw dbErr;
      const rows = data || [];
      invoiceCache.set(type, rows);
      pageCache.set(ck, rows); // sessionStorage'a da kaydet
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
      pageCache.invalidate(`invoices_${type}`);
      await fetchInvoices(true);
      setDialog({ open: true, title: 'Başarılı', message: data.message, type: 'alert' });
    } catch (err) { 
      setDialog({ open: true, title: 'Hata', message: 'Eşitleme başarısız: ' + err.message, type: 'alert' });
    }
    finally { setSyncing(false); }
  };

  // Manuel fatura oluşturma
  const openCreate = async (t = 'outbox') => { 
    setCreateType(t); 
    setCreateModal(true); 
    const [custRes, suppRes, itemRes] = await Promise.all([
      supabase.from('customers').select('id, name, vkntckn, phone, email, city, address, tax_office, district'),
      supabase.from('suppliers').select('id, name, vkntckn, phone, email, city, address, tax_office, district'),
      supabase.from('items').select('id, name, sku, unit, item_type, purchase_price, sale_price')
    ]);
    const raw = t === 'inbox' ? (suppRes.data || []) : (custRes.data || []);
    const unique = Array.from(new Map(raw.map(e => [e.id, e])).values());
    setEntities(unique);
    setDbItems(itemRes.data || []);
  };
  const closeCreate = () => {
    setCreateModal(false);
    setEntityOpen(false);
    setEntitySearch('');
    setQuickEntityForm(null);
    setCreateForm({ customer_id: null, cari_name: '', vkntckn: '', city: '', district: '', address: '', tax_office: '', issue_date: new Date().toISOString().slice(0,10), currency: 'TRY', notes: '', lines: [EMPTY_LINE()] });
  };
  const addLine = () => setCreateForm(p => ({ ...p, lines: [...p.lines, EMPTY_LINE()] }));
  const removeLine = (id) => setCreateForm(p => ({ ...p, lines: p.lines.filter(l => l.id !== id) }));
  const updateLine = (id, key, val) => setCreateForm(p => ({ ...p, lines: p.lines.map(l => l.id === id ? { ...l, [key]: val } : l) }));

  // Türkçe dahil case-insensitive normalize (YİĞİT = yiğit = YİĞİT)
  const trNorm = (s = '') => s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g');

  // Kayıtlı varlıklar arasından ara (Türkçe safe)
  const filteredEntities = (() => {
    if (!entitySearch.trim()) return entities.slice(0, 10);
    const q = trNorm(entitySearch);
    return entities.filter(e => trNorm(e.name).includes(q) || (e.vkntckn||'').includes(entitySearch));
  })();
  const entityExactMatch = (() => {
    if (!entitySearch.trim()) return false;
    const q = trNorm(entitySearch);
    return entities.some(e => trNorm(e.name) === q);
  })();

  // Seçim yapıldığında formu doldur
  const selectEntity = (e) => {
    // Adres alanini ilce (district) + adres (address) olarak ayristir
    let district = e.district || '';
    let address  = e.address || '';
    // Eski kayitlarda district adres icinde (ilce) formatinda olabilir
    if (!district && address.startsWith('(')) {
      const m = address.match(/^\(([^)]+)\)\s*(.*)$/);
      if (m) { district = m[1]; address = m[2]; }
    }
    setCreateForm(p => ({ ...p,
      customer_id: e.id,
      cari_name:   e.name,
      vkntckn:     e.vkntckn    || '',
      city:        e.city       || '',
      district:    district,
      address:     address,
      tax_office:  e.tax_office || '',
    }));
    setEntitySearch(e.name);
    setEntityOpen(false);
    setQuickEntityForm(null);
  };

  // Hızlı cari/tedarikçi oluştur
  const quickCreateEntity = async () => {
    if (!quickEntityForm?.name?.trim()) return;
    setQuickEntitySaving(true);
    try {
      const table = createType === 'inbox' ? 'suppliers' : 'customers';
      const payload = {
        name: quickEntityForm.name.trim(),
        vkntckn: quickEntityForm.vkntckn || null,
        phone: quickEntityForm.phone || null,
        email: quickEntityForm.email || null,
      };
      const { data, error } = await supabase.from(table).insert(payload).select('id, name, vkntckn').single();
      if (error) throw error;
      setEntities(prev => [...prev, data]);
      selectEntity(data);
    } catch (e) { 
      setDialog({ open: true, title: 'Hata', message: 'Kayıt oluşturulamadı: ' + e.message, type: 'alert' });
    }
    finally { setQuickEntitySaving(false); }
  };

  // Hızlı item kaydet
  const quickCreateItem = async () => {
    if (!quickItemForm?.name?.trim()) return;
    setQuickItemSaving(true);
    try {
      const payload = {
        name: quickItemForm.name.trim(),
        item_type: quickItemForm.item_type || 'product',
        unit: quickItemForm.unit || 'Adet',
        purchase_price: parseFloat(quickItemForm.purchase_price) || 0,
        sku: quickItemForm.sku || null,
      };
      const { data, error } = await supabase.from('items').insert(payload).select('id, name, unit, item_type, purchase_price').single();
      if (error) throw error;
      setDbItems(prev => [...prev, data]);
      // Satıra ata
      setCreateForm(p => ({ ...p, lines: p.lines.map(line => line.id === quickItemForm.lineId
        ? { ...line, name: data.name, unit: data.unit || 'Adet', unitPrice: data.purchase_price || 0 }
        : line
      )}));
      setQuickItemForm(null);
      setItemOpenId(null);
      setItemSearch(p => ({ ...p, [quickItemForm.lineId]: '' }));
    } catch (e) { 
      setDialog({ open: true, title: 'Hata', message: 'Stok kalemi oluşturulamadı: ' + e.message, type: 'alert' });
    }
    finally { setQuickItemSaving(false); }
  };

  const selectItem = (lineId, item) => {
    const isOutbox = type === 'outbox';
    const basePrice = (isOutbox ? item.sale_price : item.purchase_price) || item.purchase_price || 0;
    const rate = parseFloat(createForm.exchange_rate) || exchangeRate?.rate || 1;
    const finalPrice = (createForm.currency !== 'TRY' && rate > 0) ? (basePrice / rate) : basePrice;

    setCreateForm(p => ({ ...p, lines: p.lines.map(line => line.id === lineId
      ? { ...line, name: item.name, unit: item.unit || 'Adet', unitPrice: finalPrice.toFixed(4), item_code: item.sku || item.item_code }
      : line
    )}));
    setItemSearch(p => ({ ...p, [lineId]: '' }));
    setItemOpenId(null);
  };

  // Hızlı item - Türkçe safe filtreleme
  const getFilteredItems = (lineId) => {
    const q = trNorm(itemSearch[lineId] || '');
    if (!q) return dbItems.slice(0, 8);
    return dbItems.filter(it => trNorm(it.name).includes(q) || trNorm(it.sku || '').includes(q));
  };

  const itemExactMatch = (lineId) => {
    const q = trNorm(itemSearch[lineId] || '');
    return !q || dbItems.some(it => trNorm(it.name) === q);
  };

  // Döviz kuru çek (TCMB)
  const fetchExchangeRate = async (curr, date) => {
    if (curr === 'TRY') { setExchangeRate(null); setCreateForm(p => ({...p, exchange_rate: ''})); return; }
    setFetchingRate(true);
    try {
      const url = `/api/exchange-rate?currency=${curr}${date ? `&date=${date}` : ''}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.success) {
        setExchangeRate(data);
        setCreateForm(p => ({...p, exchange_rate: String(data.rate)}));
      } else {
        setExchangeRate(null);
      }
    } catch { setExchangeRate(null); }
    finally { setFetchingRate(false); }
  };

  const queryCustomerInfo = async () => {
    const vkn = createForm.vkntckn?.trim();
    if (!vkn) return alert('Lutfen sorgulamak icin bir VKN/TCKN girin.');
    if (vkn.length < 10) return alert('Gecerli bir VKN (10) veya TCKN (11) giriniz.');
    
    setQueryingVkn(true);
    try {
      const r = await fetch('/api/invoices-api?action=fetchCustomerInfo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vkn })
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error);

      const { unvan, sehir, ilce, adres, vergiDairesi, binAdi, binaNo, postaKodu, ulke, telefon, eposta } = data.data;
      setCreateForm(p => ({
        ...p,
        cari_name:     unvan        || p.cari_name,
        city:          sehir        || p.city,
        district:      ilce         || p.district,
        address:       adres        || p.address,
        tax_office:    vergiDairesi || p.tax_office,
        building_name: binAdi       || p.building_name || '',
        building_no:   binaNo       || p.building_no   || '',
        postal_code:   postaKodu    || p.postal_code   || '',
        country:       ulke         || p.country       || 'Turkiye',
        phone:         telefon      || p.phone         || '',
        email:         eposta       || p.email         || '',
      }));
      if (data.source) {
        const srcLabel = { db: 'Veritabanı', invoice_xml: 'Fatura XML', uyumsoft: 'Uyumsoft' }[data.source] || data.source;
        console.log(`[queryCustomerInfo] Kaynak: ${srcLabel}`);
      }
    } catch (err) {
      alert('Sorgulama basarisiz: ' + err.message);
    } finally {
      setQueryingVkn(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.cari_name) return alert('Cari adı zorunlu');
    if (createType === 'outbox' && (!createForm.city || !createForm.district || !createForm.address || !createForm.tax_office)) {
      return alert('Gelir faturası için Ülke(TR), Şehir, İlçe, Adres ve Vergi Dairesi alanları Uyumsoft tarafından zorunlu tutulmaktadır.');
    }
    if (!createForm.lines.some(l => l.name)) return alert('En az 1 kalem giriniz');
    if (createForm.currency !== 'TRY' && !createForm.exchange_rate) return alert('Döviz kuru gerekli');

    // Eksik Müşteri Bilgisi Güncelleme Teklifi
    if (createType === 'outbox' && createForm.customer_id) {
      const orig = entities.find(e => e.id === createForm.customer_id);
      if (orig && (!orig.city || !orig.address || !orig.tax_office)) {
        if (confirm("Girdiğiniz adres ve vergi dairesi bilgileri bu müşterinin veritabanı kaydında eksik.\nSonraki faturalarda otomatik gelmesi için müşteri kaydını bu bilgilerle güncelleyelim mi?")) {
          // 'district' sütunu bulunmama ihtimaline karşı address alanına katıyoruz
          const fullAddress = createForm.district ? `(${createForm.district}) ${createForm.address}` : createForm.address;
          await supabase.from('customers').update({ 
            city: createForm.city, 
            address: fullAddress, 
            tax_office: createForm.tax_office 
          }).eq('id', createForm.customer_id);
        }
      }
    }

    setCreating(true);
    try {
      const body = {
        ...createForm,
        type: createType,
        exchange_rate: createForm.currency !== 'TRY' ? Number(createForm.exchange_rate) : undefined,
        lines: createForm.lines.filter(l => l.name).map(l => ({ ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) }))
      };
      const r = await fetch('/api/invoices-api?action=create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!data.success) throw new Error(data.error);
      closeCreate();
      invoiceCache.delete(type);
      pageCache.invalidate(`invoices_${type}`);
      await fetchInvoices(true);
      alert(`Fatura oluşturuldu: ${data.invoice_id}`);
    } catch (err) { alert('Hata: ' + err.message); }
    finally { setCreating(false); }
  };

  // Uyumsoft'a Taslak Gönder (SaveAsDraft)
  const handleFormalize = async (invoiceId) => {
    if (!confirm(`"${invoiceId}" faturasını Uyumsoft'a taslak olarak göndermek istediğinizden emin misiniz?`)) return;
    setFormalizing(invoiceId);
    try {
      const r = await fetch('/api/invoices-api?action=formalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }) });
      const data = await r.json();
      if (!data.success) throw new Error(data.error + (data.debug ? `\n\n[Sistem Mesajı: ${data.debug}]` : ''));
      invoiceCache.delete(type);
      pageCache.invalidate(`invoices_${type}`);
      await fetchInvoices(true);
      alert(data.message);
    } catch (err) { alert('Hata: ' + err.message); }
    finally { setFormalizing(null); }
  };

  // Uyumsoft'taki taslağı resmileştir (SendDraft)
  const handleSendDraft = async (invoiceId) => {
    if (!confirm(`"${invoiceId}" faturasını resmileştirmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) return;
    setFormalizing(invoiceId);
    try {
      const r = await fetch('/api/invoices-api?action=sendDraft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }) });
      const data = await r.json();
      if (!data.success) throw new Error(data.error);
      invoiceCache.delete(type);
      pageCache.invalidate(`invoices_${type}`);
      await fetchInvoices(true);
      setDialog({ open: true, title: 'Başarılı', message: data.message, type: 'alert' });
    } catch (err) { 
      setDialog({ open: true, title: 'Hata', message: 'Hata: ' + err.message, type: 'alert' });
    }
    finally { setFormalizing(null); }
  };

  const handleDeleteDraft = async (inv) => {
    setDialog({
        open: true,
        title: 'Taslağı Sil / İptal Et',
        message: `"${inv.invoice_id}" numaralı taslak faturayı silmek istediğinize emin misiniz?\n\n` +
                 "• Sistem kayıtlarından tamamen silinecek.\n" +
                 "• Uyumsoft portalı üzerinden iptal edilecek.\n" +
                 "• Bu işlem geri alınamaz.",
        type: 'danger',
        onConfirm: async () => {
            setDialog(d => ({ ...d, loading: true }));
            try {
                const r = await fetch('/api/invoices-api?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: inv.invoice_id }) });
                const d = await r.json();
                if (!d.success) throw new Error(d.error);
                
                invoiceCache.delete(type);
                pageCache.invalidate(`invoices_${type}`);
                await fetchInvoices(true);
                showToast('Fatura taslağı silindi');
                setDialog({ open: false });
            } catch (err) {
                setDialog({ open: true, title: 'Hata', message: 'İşlem başarısız: ' + err.message, type: 'alert' });
            }
        }
    });
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
                {isInbox ? 'Gelen (Alış) Faturaları' : 'Giden (Satış) Faturaları'}
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
            {/* Gelir: Fatura Oluştur (outbox → Uyumsoft) */}
            {!isInbox && (
              <button onClick={() => openCreate('outbox')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all"
                style={{ background: '#10b981' }}>
                <FilePlus2 size={15} /> Fatura Oluştur
              </button>
            )}
            {/* Gider: Fatura Ekle (inbox → sadece Supabase) */}
            {isInbox && (
              <button onClick={() => openCreate('inbox')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all"
                style={{ background: '#f59e0b' }}>
                <FilePlus2 size={15} /> Fatura Ekle
              </button>
            )}
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
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: c.muted, width: '100px' }}>Tarih</th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted, width: '160px' }}>Fatura No</th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>{isInbox ? 'Gönderen Cari' : 'Alıcı Cari'}</th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted, width: '130px' }}>Durum</th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-right" style={{ color: c.muted, width: '130px' }}>Tutar</th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-center" style={{ color: c.muted, width: '160px' }}>İşlem</th>
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
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm" style={{ color: c.muted }}>
                        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap" style={{ maxWidth:'160px' }}>
                        <span className="px-2 py-1 text-xs font-bold rounded-lg font-mono block truncate"
                          style={{ background:`${currentColor}15`, color:currentColor }}>
                          {inv.invoice_id}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium" style={{ color: c.text }}>
                        <p className="truncate max-w-[200px]">{inv.cari_name || '-'}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: c.muted }}>{inv.vkntckn}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-bold text-right" style={{ color: c.text }}>
                        {Number(inv.amount).toLocaleString('tr-TR', { minimumFractionDigits:2 })}
                        <span className="text-xs font-normal ml-1" style={{ color: c.muted }}>{inv.currency}</span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap" style={{ width:'160px' }}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={e => { e.stopPropagation(); setSelected(inv); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                            style={{ background:`${currentColor}15`, color:currentColor }}
                            title="Kalemleri Görüntüle">
                            {hasCached
                              ? <CheckCircle2 size={12} className="text-emerald-400" />
                              : <Eye size={12} />}
                            Detay
                          </button>
                          {inv.document_id && (
                            <button
                              onClick={e => { e.stopPropagation(); setPreviewInv({ invoiceId: inv.invoice_id, documentId: inv.document_id, type: inv.type }); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                              style={{ background:'rgba(139,92,246,0.12)', color:'#a78bfa' }}
                              title="Fatura Belgesi Önizle">
                              <ScanEye size={12} />Önizle
                            </button>
                          )}
                          {/* Uyumsoft'a Taslak Gönder — yalnızca Draft + outbox */}
                          {inv.status === 'Draft' && inv.type === 'outbox' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleFormalize(inv.invoice_id); }}
                              disabled={formalizing === inv.invoice_id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                              style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}
                              title="Uyumsoft'a Taslak Olarak Gönder">
                              {formalizing === inv.invoice_id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <CheckCheck size={11} />}
                              Taslak Gönder
                            </button>
                          )}
                          {/* Resmileştir — Queued (Uyumsoft'ta taslak) + outbox */}
                          {inv.status === 'Queued' && inv.type === 'outbox' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleSendDraft(inv.invoice_id); }}
                              disabled={formalizing === inv.invoice_id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                              style={{ background:'rgba(16,185,129,0.12)', color:'#10b981' }}
                              title="Resmileştir (Uyumsoft'tan Gönder)">
                              {formalizing === inv.invoice_id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <CheckCheck size={11} />}
                              Resmileştir
                            </button>
                          )}
                          {/* Sil Butonu — Draft ya da Queued */}
                          {(inv.status === 'Draft' || inv.status === 'Queued') && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteDraft(inv); }}
                              disabled={formalizing === inv.invoice_id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                              style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444' }}
                              title="Taslağı Sil">
                              {formalizing === inv.invoice_id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <X size={11} />}
                              Sil
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

      {/* ── Manuel Fatura Oluşturma Modalı ─────────────────────────────── */}
      <AnimatePresence>
        {createModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeCreate} />
            <motion.div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
              style={{ background: isDark ? '#0c1526' : '#fff', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}` }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

              <div className="sticky top-0 flex items-center justify-between px-6 py-4 z-10"
                style={{ background: isDark ? 'rgba(12,21,38,0.97)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-3">
                  <FilePlus2 size={20} style={{ color: createType === 'inbox' ? '#f59e0b' : '#10b981' }} />
                  <div>
                    <h2 className="font-bold text-base" style={{ color: c.text }}>
                      {createType === 'inbox' ? 'Gider Faturası Ekle' : 'Gelir Faturası Oluştur'}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: c.muted }}>
                      {createType === 'inbox'
                        ? '⚠️ Yalnızca sisteme kaydedilir — Uyumsoft’a gönderilmez'
                        : 'Taslak olarak kaydedilir — Resmileştir ile Uyumsoft’a gönderin'}
                    </p>
                  </div>
                </div>
                <button onClick={closeCreate} className="p-2 rounded-xl" style={{ color: c.muted }}><X size={18} /></button>
              </div>

              <div className="p-6 space-y-4">

                <div className="grid grid-cols-2 gap-3">
                  {/* ── Cari / Tedarikçi Autocomplete Dropdown ── */}
                  <div className="col-span-2 relative">
                    <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>
                      {createType === 'inbox' ? 'Gönderen Cari (Tedarikçi) *' : 'Alıcı Cari (Müşteri) *'}
                    </label>
                    <div
                      className="w-full px-3 py-2 text-sm rounded-xl border flex items-center cursor-text"
                      style={{ background: c.card, borderColor: entityOpen ? currentColor : c.border, color: c.text }}
                      onClick={() => setEntityOpen(true)}
                    >
                      {entityOpen ? (
                        <input
                          autoFocus
                          value={entitySearch}
                          onChange={e => { setEntitySearch(e.target.value); setCreateForm(p => ({...p, cari_name: e.target.value})); }}
                          onBlur={() => setTimeout(() => setEntityOpen(false), 180)}
                          className="flex-1 bg-transparent outline-none text-sm"
                          style={{ color: c.text }}
                          placeholder="İsim veya VKN ile ara..."
                        />
                      ) : (
                        <span className={`flex-1 text-sm ${createForm.cari_name ? '' : 'opacity-40'}`}>
                          {createForm.cari_name || (createType === 'inbox' ? 'Tedarikçi seç veya gir...' : 'Müşteri seç veya gir...')}
                        </span>
                      )}
                      <svg className="w-4 h-4 opacity-40 ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    {entityOpen && (
                      <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                        style={{ background: isDark ? '#0f1f38' : '#fff', border: `1px solid ${c.border}` }}>
                        {filteredEntities.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto">
                            {filteredEntities.map(e => (
                              <div key={e.id}
                                className="px-4 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                                style={{ borderBottom: `1px solid ${c.border}` }}
                                onMouseDown={() => selectEntity(e)}
                                onMouseEnter={ev => ev.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                              >
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: c.text }}>{e.name}</p>
                                  {e.vkntckn && <p className="text-[11px] font-mono" style={{ color: c.muted }}>{e.vkntckn}</p>}
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9', color: c.muted }}>
                                  {createType === 'inbox' ? 'Tedarikçi' : 'Müşteri'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-sm" style={{ color: c.muted }}>Kayıt bulunamadı</div>
                        )}
                        {entitySearch.trim() && !entityExactMatch && (
                          <div
                            className="px-4 py-3 flex items-center gap-2 cursor-pointer font-semibold text-sm border-t"
                            style={{ borderColor: c.border, color: '#10b981' }}
                            onMouseDown={() => { setQuickEntityForm({ name: entitySearch, vkntckn: '', phone: '', email: '' }); setEntityOpen(false); }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            "{entitySearch}" adıyla yeni {createType === 'inbox' ? 'tedarikçi' : 'müşteri'} oluştur
                          </div>
                        )}
                      </div>
                    )}
                    {/* Hızlı cari/tedarikçi mini formu */}
                    {quickEntityForm && (
                      <div className="mt-2 p-3 rounded-xl space-y-2" style={{ background: isDark ? 'rgba(16,185,129,0.07)' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">{createType === 'inbox' ? 'Tedarikçi' : 'Müşteri'} Hızlı Kayıt</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Ad / Ünvan *</label>
                            <input value={quickEntityForm.name} onChange={e => setQuickEntityForm(p => ({...p, name: e.target.value}))}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                              style={{ background: c.card, borderColor: c.border, color: c.text }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>VKN / TCKN (opsiyonel)</label>
                            <input value={quickEntityForm.vkntckn} onChange={e => setQuickEntityForm(p => ({...p, vkntckn: e.target.value}))}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none font-mono"
                              style={{ background: c.card, borderColor: c.border, color: c.text }}
                              placeholder="1234567890" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Telefon (opsiyonel)</label>
                            <input value={quickEntityForm.phone} onChange={e => setQuickEntityForm(p => ({...p, phone: e.target.value}))}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                              style={{ background: c.card, borderColor: c.border, color: c.text }}
                              placeholder="05XX XXX XX XX" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>E-posta (opsiyonel)</label>
                            <input value={quickEntityForm.email} onChange={e => setQuickEntityForm(p => ({...p, email: e.target.value}))}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                              style={{ background: c.card, borderColor: c.border, color: c.text }}
                              placeholder="ornek@firma.com" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setQuickEntityForm(null)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                            style={{ borderColor: c.border, color: c.muted }}>İptal</button>
                          <button onClick={quickCreateEntity} disabled={quickEntitySaving || !quickEntityForm.name?.trim()}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors"
                            style={{ background: '#10b981', opacity: quickEntitySaving ? 0.7 : 1 }}>
                            {quickEntitySaving
                              ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Kaydediliyor...</>
                              : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Kaydet &amp; Seç</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={createType === 'outbox' ? 'col-span-1 sm:col-span-2 lg:col-span-1' : ''}>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>VKN / TCKN</label>
                    <div className="flex items-center gap-2">
                      <input value={createForm.vkntckn} onChange={e => setCreateForm(p => ({...p, vkntckn: e.target.value}))}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none font-mono"
                        style={{ background: c.card, borderColor: c.border, color: c.text }}
                        placeholder="1234567890" />
                      {createType === 'outbox' && (
                        <button onClick={queryCustomerInfo}
                          disabled={queryingVkn}
                          className="px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-colors"
                          style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
                          title="Firma/Kişi bilgilerini Uyumsoft üzerinden ücretsiz sorgula">
                          {queryingVkn ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                          <span className="hidden sm:inline">Sorgula</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {createType === 'outbox' && (
                    <>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Ulke</label>
                        <input value={createForm.country || 'Turkiye'} onChange={e => setCreateForm(p => ({...p, country: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none uppercase"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Turkiye" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Sehir *</label>
                        <input value={createForm.city} onChange={e => setCreateForm(p => ({...p, city: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none uppercase"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Ornegin: IZMIR" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Mahalle / Ilce *</label>
                        <input value={createForm.district} onChange={e => setCreateForm(p => ({...p, district: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none uppercase"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Ornegin: KONAK" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Kasaba / Koy</label>
                        <input value={createForm.town || ''} onChange={e => setCreateForm(p => ({...p, town: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Opsiyonel" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Cadde / Sokak / Adres *</label>
                        <input value={createForm.address} onChange={e => setCreateForm(p => ({...p, address: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Cadde sokak bina kapi no..." />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Bina Adi</label>
                        <input value={createForm.building_name || ''} onChange={e => setCreateForm(p => ({...p, building_name: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Opsiyonel" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Bina / Kapi No</label>
                        <input value={createForm.building_no || ''} onChange={e => setCreateForm(p => ({...p, building_no: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Opsiyonel" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Posta Kodu</label>
                        <input value={createForm.postal_code || ''} onChange={e => setCreateForm(p => ({...p, postal_code: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none font-mono"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="35000" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Tel</label>
                        <input value={createForm.phone || ''} onChange={e => setCreateForm(p => ({...p, phone: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="0232 xxx xx xx" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>E-posta</label>
                        <input value={createForm.email || ''} onChange={e => setCreateForm(p => ({...p, email: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="info@firma.com" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Vergi Dairesi *</label>
                        <input value={createForm.tax_office} onChange={e => setCreateForm(p => ({...p, tax_office: e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-xl border outline-none uppercase"
                          style={{ background: c.card, borderColor: c.border, color: c.text }} placeholder="Ornegin: BORNOVA" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Fatura Tarihi</label>
                    <input type="date" value={createForm.issue_date} onChange={e => setCreateForm(p => ({...p, issue_date: e.target.value}))}
                      className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                      style={{ background: c.card, borderColor: c.border, color: c.text }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Fatura No (Opsiyonel)</label>
                    <input value={createForm.invoice_id || ''} onChange={e => setCreateForm(p => ({...p, invoice_id: e.target.value}))}
                      className="w-full px-3 py-2 text-sm rounded-xl border outline-none font-mono"
                      style={{ background: c.card, borderColor: c.border, color: c.text }}
                      placeholder="Otomatik (AYS2026...)" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Para Birimi</label>
                    <select value={createForm.currency} onChange={e => {
                      const cur = e.target.value;
                      setCreateForm(p => ({...p, currency: cur}));
                      fetchExchangeRate(cur, createForm.issue_date);
                    }}
                      className="w-full px-3 py-2 text-sm rounded-xl border outline-none"
                      style={{ background: c.card, borderColor: c.border, color: c.text }}>
                      {['TRY','USD','EUR','GBP'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  {createForm.currency !== 'TRY' && (
                    <div className="col-span-2">
                      <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Döviz Kuru (TCMB Satış)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" value={createForm.exchange_rate}
                          onChange={e => setCreateForm(p => ({...p, exchange_rate: e.target.value}))}
                          className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none font-mono"
                          style={{ background: c.card, borderColor: c.border, color: c.text }}
                          placeholder="Ör: 32.45" step="0.0001" />
                        <button onClick={() => fetchExchangeRate(createForm.currency, createForm.issue_date)}
                          disabled={fetchingRate}
                          className="px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-colors"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                          {fetchingRate
                            ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Alınıyor...</>
                            : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> TCMB Kuru Al</>}
                        </button>
                      </div>
                      {exchangeRate && (
                        <p className="text-[10px] mt-1 font-mono" style={{ color: c.muted }}>
                          Kaynak: {exchangeRate.source === 'tcmb' ? 'TCMB' : 'Alternatif'} • Tarih: {exchangeRate.date}
                          {exchangeRate.buyRate > 0 && <> • Alış: {exchangeRate.buyRate.toFixed(4)}</>}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Kalemler */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Kalemler</span>
                    <button onClick={addLine}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      <Plus size={12} /> Kalem Ekle
                    </button>
                  </div>
                  <div className="space-y-3">
                    {createForm.lines.map((l, i) => {
                      const fItems = getFilteredItems(l.id);
                      const isItemOpen = itemOpenId === l.id;
                      const noExact = !itemExactMatch(l.id);
                      const curSearch = itemSearch[l.id] || '';
                      return (
                        <div key={l.id} className="rounded-2xl p-3 space-y-2" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${c.border}` }}>
                          {/* Satır üst kısmı: ürün seçici */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.muted }}>Kalem {i + 1}</span>
                            {createForm.lines.length > 1 && (
                              <button onClick={() => removeLine(l.id)} className="text-red-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                            )}
                          </div>

                          {/* Ürün adı dropdown */}
                          <div className="relative">
                            <div
                              className="w-full px-3 py-2 text-sm rounded-xl border flex items-center cursor-text"
                              style={{ background: c.card, borderColor: isItemOpen ? currentColor : c.border, color: c.text }}
                              onClick={() => { setItemOpenId(l.id); setItemSearch(p => ({ ...p, [l.id]: p[l.id] ?? '' })); }}
                            >
                              {isItemOpen ? (
                                <input
                                  autoFocus
                                  value={curSearch}
                                  onChange={e => setItemSearch(p => ({ ...p, [l.id]: e.target.value }))}
                                  onBlur={() => setTimeout(() => { setItemOpenId(null); }, 180)}
                                  className="flex-1 bg-transparent outline-none text-sm"
                                  style={{ color: c.text }}
                                  placeholder="İsim veya SKU ile ara..."
                                />
                              ) : (
                                <span className={`flex-1 text-sm ${l.name ? '' : 'opacity-40'}`}>
                                  {l.name || 'Ürün / Hizmet seç veya yaz...'}
                                </span>
                              )}
                              <svg className="w-4 h-4 opacity-40 ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>

                            {isItemOpen && (
                              <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                                style={{ background: isDark ? '#0f1f38' : '#fff', border: `1px solid ${c.border}` }}>
                                {fItems.length > 0 ? (
                                  <div className="max-h-44 overflow-y-auto">
                                    {fItems.map(it => (
                                      <div key={it.id}
                                        className="px-4 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                                        style={{ borderBottom: `1px solid ${c.border}` }}
                                        onMouseDown={() => selectItem(l.id, it)}
                                        onMouseEnter={ev => ev.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                                      >
                                        <div>
                                          <p className="text-sm font-semibold" style={{ color: c.text }}>{it.name}</p>
                                          <p className="text-[11px]" style={{ color: c.muted }}>{it.item_type === 'rawmaterial' ? 'Hammadde' : it.item_type === 'product' ? 'Mamul' : 'Hizmet'} &middot; {it.unit}</p>
                                        </div>
                                        {(() => {
                                          const p = (type === 'outbox' ? it.sale_price : it.purchase_price) || it.purchase_price || 0;
                                          if (p <= 0) return null;
                                          const rate = parseFloat(createForm.exchange_rate) || exchangeRate?.rate || 1;
                                          const conv = (createForm.currency !== 'TRY' && rate > 0) ? (p / rate) : p;
                                          return (
                                            <span className="text-[11px] font-bold tabular-nums" style={{ color: currentColor }}>
                                              {conv.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {createForm.currency}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-4 py-3 text-sm" style={{ color: c.muted }}>Stokta bulunamadı</div>
                                )}
                                {curSearch.trim() && noExact && (
                                  <div
                                    className="px-4 py-3 flex items-center gap-2 cursor-pointer font-semibold text-sm border-t"
                                    style={{ borderColor: c.border, color: '#6366f1' }}
                                    onMouseDown={() => { setQuickItemForm({ lineId: l.id, name: curSearch, item_type: 'product', unit: 'Adet', purchase_price: '', sku: '' }); setItemOpenId(null); }}
                                    onMouseEnter={ev => ev.currentTarget.style.background = isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)'}
                                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    "{curSearch}" stoka hızlı ekle
                                  </div>
                                )}
                                {curSearch.trim() && (
                                  <div
                                    className="px-4 py-3 flex items-center gap-2 cursor-pointer font-semibold text-sm border-t"
                                    style={{ borderColor: c.border, color: '#10b981' }}
                                    onMouseDown={() => { selectItem(l.id, { id: null, name: curSearch.trim(), unit: 'Adet', purchase_price: 0 }); }}
                                    onMouseEnter={ev => ev.currentTarget.style.background = isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)'}
                                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    "{curSearch}" olarak kayıtsız seç
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Hızlı stok kaydet formu (sadece bu satır için) */}
                          {quickItemForm?.lineId === l.id && (
                            <div className="mt-2 p-3 rounded-xl space-y-2" style={{ background: isDark ? 'rgba(99,102,241,0.08)' : '#f0f0fe', border: '1px solid rgba(99,102,241,0.25)' }}>
                              <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Stoka Hızlı Ekle</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2">
                                  <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Ad *</label>
                                  <input value={quickItemForm.name} onChange={e => setQuickItemForm(p => ({...p, name: e.target.value}))}
                                    className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                                    style={{ background: c.card, borderColor: c.border, color: c.text }} />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Tür</label>
                                  <select value={quickItemForm.item_type} onChange={e => setQuickItemForm(p => ({...p, item_type: e.target.value}))}
                                    className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                                    style={{ background: c.card, borderColor: c.border, color: c.text }}>
                                    <option value="product">Mamul Ürün</option>
                                    <option value="rawmaterial">Hammadde</option>
                                    <option value="service">Hizmet</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Birim</label>
                                  <select value={quickItemForm.unit} onChange={e => setQuickItemForm(p => ({...p, unit: e.target.value}))}
                                    className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                                    style={{ background: c.card, borderColor: c.border, color: c.text }}>
                                    {['Adet','Kg','Ton','m²','m³','Litre','Paket','Kutu','Takım'].map(u => <option key={u}>{u}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Birim Fiyat (opsiyonel)</label>
                                  <input type="number" value={quickItemForm.purchase_price} onChange={e => setQuickItemForm(p => ({...p, purchase_price: e.target.value}))}
                                    className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                                    style={{ background: c.card, borderColor: c.border, color: c.text }}
                                    placeholder="0.00" step="0.01" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>SKU / Kod (opsiyonel)</label>
                                  <input value={quickItemForm.sku || ''} onChange={e => setQuickItemForm(p => ({...p, sku: e.target.value}))}
                                    className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none font-mono"
                                    style={{ background: c.card, borderColor: c.border, color: c.text }}
                                    placeholder="AYS-001" />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => setQuickItemForm(null)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                                  style={{ borderColor: c.border, color: c.muted }}>İptal</button>
                                <button onClick={quickCreateItem} disabled={quickItemSaving || !quickItemForm.name?.trim()}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors"
                                  style={{ background: '#6366f1', opacity: quickItemSaving ? 0.7 : 1 }}>
                                  {quickItemSaving ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Kaydediliyor...</> : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Stoka Ekle &amp; Seç</>}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Miktar, Birim, Birim fiyat, KDV */}
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Miktar</label>
                              <input type="number" value={l.quantity} onChange={e => updateLine(l.id, 'quantity', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none text-center"
                                style={{ background: c.card, borderColor: c.border, color: c.text }}
                                min={1} />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Birim</label>
                              <select value={l.unit || 'Adet'} onChange={e => updateLine(l.id, 'unit', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                                style={{ background: c.card, borderColor: c.border, color: c.text }}>
                                {['Adet','Metre','Kg','Ton','m2','m3','Litre','Paket','Kutu','Takim','Set','Rulo','Saat','Gun'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>Birim Fiyat</label>
                              <input type="number" value={l.unitPrice} onChange={e => updateLine(l.id, 'unitPrice', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none text-right"
                                style={{ background: c.card, borderColor: c.border, color: c.text }}
                                step="0.01" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold mb-0.5 block" style={{ color: c.muted }}>KDV %</label>
                              <select value={l.taxRate} onChange={e => updateLine(l.id, 'taxRate', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                                style={{ background: c.card, borderColor: c.border, color: c.text }}>
                                {[0,1,8,10,20].map(r => <option key={r} value={r}>%{r}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Toplam + Yazıyla */}
                  {(() => {
                    const total = createForm.lines.reduce((s,l) => s+(+l.quantity||0)*(+l.unitPrice||0)*(1+(+l.taxRate||0)/100), 0);
                    const currency = createForm.currency;
                    // Turkce sayi yazimi
                    const ONES = ['','Bir','Iki','Uc','Dort','Bes','Alti','Yedi','Sekiz','Dokuz'];
                    const TENS = ['','On','Yirmi','Otuz','Kirk','Elli','Altmis','Yetmis','Seksen','Doksan'];
                    const toWords = (n) => {
                      n = Math.round(n);
                      if (n === 0) return 'Sifir';
                      if (n < 0) return 'Eksi ' + toWords(-n);
                      let res = '';
                      if (n >= 1000000) { res += toWords(Math.floor(n/1000000)) + ' Milyon '; n %= 1000000; }
                      if (n >= 1000) { const t = Math.floor(n/1000); res += (t === 1 ? '' : toWords(t) + ' ') + 'Bin '; n %= 1000; }
                      if (n >= 100) { res += (Math.floor(n/100) === 1 ? 'Yuz' : ONES[Math.floor(n/100)] + ' Yuz') + ' '; n %= 100; }
                      if (n >= 10) { res += TENS[Math.floor(n/10)] + ' '; n %= 10; }
                      if (n > 0) res += ONES[n] + ' ';
                      return res.trim();
                    };
                    const intPart  = Math.floor(total);
                    const decPart  = Math.round((total - intPart) * 100);
                    const currName = { TRY: 'Turk Lirasi', USD: 'Amerikan Dolari', EUR: 'Euro', GBP: 'Sterlin' }[currency] || currency;
                    const kurusName = { TRY: 'Kurus', USD: 'Sent', EUR: 'Sent', GBP: 'Peni' }[currency] || 'Kurus';
                    let words = '#' + toWords(intPart) + ' ' + currName;
                    if (decPart > 0) words += ' ' + toWords(decPart) + ' ' + kurusName;
                    words += '#';
                    return (
                      <div className="flex items-start justify-between mt-2 flex-wrap gap-2">
                        <div className="text-[11px] font-mono px-3 py-1.5 rounded-lg flex-1" style={{ background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', wordBreak: 'break-word' }}>
                          {words}
                        </div>
                        <div className="text-right text-sm font-bold flex-shrink-0" style={{ color: c.text }}>
                          Toplam: {total.toLocaleString('tr-TR',{minimumFractionDigits:2})} {currency}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Notlar */}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: c.muted }}>Notlar</label>
                  <textarea value={createForm.notes} onChange={e => setCreateForm(p => ({...p, notes: e.target.value}))}
                    rows={2} className="w-full px-3 py-2 text-sm rounded-xl border outline-none resize-none"
                    style={{ background: c.card, borderColor: c.border, color: c.text }}
                    placeholder="İsteğe bağlı not..." />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={closeCreate}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                    style={{ borderColor: c.border, color: c.muted }}>İptal</button>
                  <button onClick={handleCreate} disabled={creating}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                    style={{ background: createType === 'inbox' ? '#f59e0b' : '#10b981', opacity: creating ? 0.7 : 1 }}>
                    {creating ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />}
                    {creating ? 'Kaydediliyor...' : (createType === 'inbox' ? 'Gider Faturası Ekle' : 'Taslak Gelir Faturası Oluştur')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CustomDialog
        {...dialog}
        onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog({ ...dialog, open: false })}
      />
    </>
  );
}
