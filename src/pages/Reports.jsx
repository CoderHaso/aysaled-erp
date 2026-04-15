import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, FileText, ShoppingCart, Users, Building2,
  Loader2, RefreshCw, BarChart2, PieChart, Receipt, Wallet,
  AlertTriangle, ArrowUpRight, ArrowDownRight, BookOpen,
  Scissors, Hammer, Calendar, ChevronLeft, ChevronRight,
  Filter, Package, BadgePercent, Scale,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart, DonutChart, KpiCard, SectionTitle, TopList,
  fmt, fmtK, monthKey, monthLabel, lastNMonths,
} from '../components/ReportCharts';

// ─── Yardimci araçlar ─────────────────────────────────────────────────────────
const EMPTY_DONUT = [{ label: 'Veri yok', value: 1, color: '#1e293b' }];

function groupByMonth(items, months, valueKey) {
  return months.map(m => ({
    label: monthLabel(m),
    v1: items.filter(x => monthKey(x.created_at || x.issue_date || x.tx_date || x.tarih) === m)
             .reduce((s, x) => s + Number(x[valueKey] || 0), 0),
  }));
}

function topN(items, nameKey, valueKey, n = 5) {
  const map = {};
  items.forEach(x => {
    const k = x[nameKey] || 'Bilinmeyen';
    map[k] = (map[k] || 0) + Number(x[valueKey] || 0);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
}

// Dönem: { type: 'preset', n: 1|6|12|24 } veya { type: 'month', year, month }
function calcDateRange(period) {
  if (period.type === 'month') {
    const start = new Date(period.year, period.month - 1, 1);
    const end   = new Date(period.year, period.month, 0); // ayın son günü
    return {
      start: start.toISOString().split('T')[0],
      end:   end.toISOString().split('T')[0],
      months: [`${period.year}-${String(period.month).padStart(2,'0')}`],
    };
  }
  // preset
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - period.n);
  return { start: cutoff.toISOString().split('T')[0], end: null, months: lastNMonths(period.n) };
}

// ─── Dönem Seçici ─────────────────────────────────────────────────────────────
function PeriodSelector({ value, onChange }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const MONTH_NAMES = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  const labelFor = (p) => {
    if (p.type === 'preset') return p.n === 1 ? 'Son 1 Ay' : p.n === 6 ? '6 Ay' : p.n === 12 ? '12 Ay' : '2 Yıl';
    return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
  };

  const isSame = (a, b) => {
    if (a.type !== b.type) return false;
    if (a.type === 'preset') return a.n === b.n;
    return a.year === b.year && a.month === b.month;
  };

  const bg  = (active) => active ? 'var(--color-primary)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9');
  const col = (active) => active ? '#fff' : (isDark ? '#94a3b8' : '#64748b');

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { type:'preset', n:1 },
        { type:'preset', n:6 },
        { type:'preset', n:12 },
        { type:'preset', n:24 },
      ].map(p => {
        const active = isSame(value, p);
        return (
          <button key={p.n} onClick={() => { onChange(p); setShowPicker(false); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: bg(active), color: col(active) }}>
            {labelFor(p)}
          </button>
        );
      })}

      {/* Özel ay seçici */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: value.type === 'month' ? 'var(--color-primary)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
            color: value.type === 'month' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
          }}>
          <Calendar size={12} />
          {value.type === 'month' ? labelFor(value) : 'Ay Seç'}
        </button>

        {showPicker && (
          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4 shadow-2xl"
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`,
              minWidth: 240,
            }}>
            {/* Yıl nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setPickerYear(y => y - 1)} className="p-1 rounded hover:bg-white/10">
                <ChevronLeft size={16} className="text-slate-400" />
              </button>
              <span className="text-sm font-bold" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{pickerYear}</span>
              <button onClick={() => setPickerYear(y => y + 1)} className="p-1 rounded hover:bg-white/10">
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTH_NAMES.map((name, idx) => {
                const p = { type: 'month', year: pickerYear, month: idx + 1 };
                const active = isSame(value, p);
                return (
                  <button key={idx}
                    onClick={() => { onChange(p); setShowPicker(false); }}
                    className="py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: active ? 'var(--color-primary)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'), color: active ? '#fff' : (isDark ? '#94a3b8' : '#64748b') }}>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SubTab bar ───────────────────────────────────────────────────────────────
function SubTabs({ tabs, active, onChange }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="flex gap-1 border-b mb-4" style={{ borderColor: isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className="px-3 py-1.5 text-xs font-semibold transition-all rounded-t-lg"
          style={{
            color: active === t ? (isDark ? '#fff' : '#1e293b') : '#64748b',
            background: active === t ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
            borderBottom: active === t ? '2px solid var(--color-primary)' : '2px solid transparent',
          }}>{t}</button>
      ))}
    </div>
  );
}

// ─── Ufak line chart alternatifi — SVG sparkline ──────────────────────────────
function Sparkline({ data, color = '#10b981', height = 40 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => Number(d.v1 || 0));
  const max = Math.max(...vals, 1);
  const w = 200, h = height;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={pts} />
      <polyline
        fill={color + '18'} stroke="none"
        points={`0,${h} ${pts} ${w},${h}`} />
    </svg>
  );
}

// ─── ANA SAYFA ────────────────────────────────────────────────────────────────
export default function Reports() {
  const { currentColor, effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [period, setPeriod] = useState({ type: 'preset', n: 12 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('genel');

  // Veri state'leri
  const [invoices,    setInvoices]    = useState([]);
  const [orders,      setOrders]      = useState([]);
  const [quotes,      setQuotes]      = useState([]);
  const [customers,   setCustomers]   = useState([]);
  const [suppliers,   setSuppliers]   = useState([]);
  const [cashTxs,     setCashTxs]     = useState([]);
  const [isEmriRows,  setIsEmriRows]  = useState([]);
  const [cekRows,     setCekRows]     = useState([]);
  const [hareketRows, setHareketRows] = useState([]);

  const { start: cutoffStr, months } = useMemo(() => calcDateRange(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = { start: cutoffStr };

      const [invR, ordR, qR, custR, suppR, cashR, emriR, cekR, harR] = await Promise.all([
        supabase.from('invoices').select('invoice_id,issue_date,amount,currency,status,type,cari_name,vkntckn,tax_total,tax_exclusive_amount'),
        supabase.from('orders').select('id,created_at,grand_total,status,customer_name,customer_id').gte('created_at', cutoffStr + 'T00:00:00Z'),
        supabase.from('quotes').select('id,created_at,grand_total,status,company_name,currency'),
        supabase.from('customers').select('id,name,source,created_at,is_faturasiz'),
        supabase.from('suppliers').select('id,name,source,created_at,is_faturasiz'),
        supabase.from('cash_transactions').select('id,direction,amount,category,person,tx_date,is_settled').gte('tx_date', cutoffStr),
        // İş Emri — mevcut tabloyu dene, eksik kolon varsa boş dön
        supabase.from('work_orders').select('id,created_at,status').gte('created_at', cutoffStr + 'T00:00:00Z').then(r => r).catch(() => ({ data: [] })),
        // Çekler — tablo yoksa boş dön (404 bekleniyor)
        supabase.from('checks').select('id,created_at,amount,status,drawer_name,due_date').gte('created_at', cutoffStr + 'T00:00:00Z').then(r => r.error?.code === '42P01' ? { data: [] } : r).catch(() => ({ data: [] })),
        // Hesap Defteri hareketleri — musteri/tedarikci id ile birlikte
        supabase.from('cari_hareketler').select('id,tarih,borc,alacak,currency,kaynak,baslik,musteri_id,tedarikci_id').gte('tarih', cutoffStr).then(r => r).catch(() => ({ data: [] })),
      ]);

      setInvoices(invR.data || []);
      setOrders(ordR.data || []);
      const cutoffMs = new Date(cutoffStr).getTime();
      setQuotes((qR.data || []).filter(q => q.created_at ? new Date(q.created_at).getTime() >= cutoffMs : true));
      setCustomers(custR.data || []);
      setSuppliers(suppR.data || []);
      setCashTxs(cashR.data || []);
      setIsEmriRows(emriR?.data || []);
      setCekRows(cekR?.data || []);
      setHareketRows(harR?.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [cutoffStr]);

  useEffect(() => { load(); }, [load]);

  // ── Fatura Hesapları ─────────────────────────────────────────────────────────
  const outbox     = invoices.filter(i => i.type === 'outbox');
  const inbox      = invoices.filter(i => i.type === 'inbox');
  const outActive  = outbox.filter(i => i.status !== 'Canceled' && i.status !== 'Error');
  const outCancel  = outbox.filter(i => i.status === 'Canceled');
  const totalOutbox  = outActive.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalInbox   = inbox.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalKDVSatis = outActive.reduce((s, i) => s + Number(i.tax_total || 0), 0);
  const totalKDVAlim  = inbox.reduce((s, i) => s + Number(i.tax_total || 0), 0);
  const matrahSatis   = outActive.reduce((s, i) => s + Number(i.tax_exclusive_amount || 0), 0);
  const matrahAlim    = inbox.reduce((s, i) => s + Number(i.tax_exclusive_amount || 0), 0);
  const brutKar       = matrahSatis - matrahAlim;
  const netKar        = brutKar - (totalKDVSatis - totalKDVAlim);

  const outboxByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: outActive.filter(i => monthKey(i.issue_date) === m).reduce((s, i) => s + Number(i.amount || 0), 0),
    v2: outCancel.filter(i => monthKey(i.issue_date) === m).reduce((s, i) => s + Number(i.amount || 0), 0),
  })), [invoices, months]);

  const inboxByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: inbox.filter(i => monthKey(i.issue_date) === m).reduce((s, i) => s + Number(i.amount || 0), 0),
  })), [invoices, months]);

  // ── Sipariş ─────────────────────────────────────────────────────────────────
  const activeOrders    = orders.filter(o => o.status !== 'cancelled');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalOrderAmt   = activeOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);

  const faturasizCustIds   = new Set(customers.filter(c => c.is_faturasiz).map(c => c.id));
  const faturasizCustNames = new Set(customers.filter(c => c.is_faturasiz).map(c => c.name));
  const ordersFaturali     = activeOrders.filter(o => !faturasizCustIds.has(o.customer_id) && !faturasizCustNames.has(o.customer_name));
  const ordersFaturasiz    = activeOrders.filter(o => faturasizCustIds.has(o.customer_id)  || faturasizCustNames.has(o.customer_name));

  const ordersByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: activeOrders.filter(o => monthKey(o.created_at) === m).reduce((s, o) => s + Number(o.grand_total || 0), 0),
    v2: completedOrders.filter(o => monthKey(o.created_at) === m).reduce((s, o) => s + Number(o.grand_total || 0), 0),
  })), [orders, months]);

  // ── Teklif ──────────────────────────────────────────────────────────────────
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
  const rejectedQuotes = quotes.filter(q => q.status === 'rejected');
  const convRate = quotes.length > 0 ? ((acceptedQuotes.length / quotes.length) * 100).toFixed(1) : '0';

  const quotesByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: quotes.filter(q => monthKey(q.created_at) === m).length,
    v2: acceptedQuotes.filter(q => monthKey(q.created_at) === m).length,
  })), [quotes, months]);

  // ── Kasa ────────────────────────────────────────────────────────────────────
  const openCash = cashTxs.filter(t => !t.is_settled);
  const cashOut  = openCash.filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0);
  const cashIn   = openCash.filter(t => t.direction === 'in').reduce((s, t)  => s + t.amount, 0);
  const cashByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: openCash.filter(t => t.direction === 'out' && monthKey(t.tx_date) === m).reduce((s,t) => s+t.amount, 0),
    v2: openCash.filter(t => t.direction === 'in'  && monthKey(t.tx_date) === m).reduce((s,t) => s+t.amount, 0),
  })), [cashTxs, months]);

  // ── İş Emri ─────────────────────────────────────────────────────────────────
  const emriCompleted = isEmriRows.filter(e => e.status === 'completed');
  const emriPending   = isEmriRows.filter(e => e.status !== 'completed' && e.status !== 'cancelled');
  const emriByMonth   = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: isEmriRows.filter(e => monthKey(e.created_at) === m).length,
    v2: emriCompleted.filter(e => monthKey(e.created_at) === m).length,
  })), [isEmriRows, months]);

  // ── Çekler ──────────────────────────────────────────────────────────────────
  const cekWaiting  = cekRows.filter(c => c.status === 'waiting' || c.status === 'pending');
  const cekPaid     = cekRows.filter(c => c.status === 'paid' || c.status === 'verildi');
  const cekBounced  = cekRows.filter(c => c.status === 'bounced' || c.status === 'karşılıksız');
  const cekTotal    = cekRows.reduce((s, c) => s + Number(c.amount || 0), 0);
  const cekByMonth  = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: cekRows.filter(c => monthKey(c.created_at) === m).reduce((s,c) => s + Number(c.amount||0), 0),
  })), [cekRows, months]);

  // ── Hesap Defteri ────────────────────────────────────────────────────────────
  const hdAlacak  = hareketRows.reduce((s, h) => s + Number(h.borc   || 0), 0);
  const hdVerecek = hareketRows.reduce((s, h) => s + Number(h.alacak || 0), 0);
  const hdByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: hareketRows.filter(h => monthKey(h.tarih) === m).reduce((s,h) => s + Number(h.borc||0), 0),
    v2: hareketRows.filter(h => monthKey(h.tarih) === m).reduce((s,h) => s + Number(h.alacak||0), 0),
  })), [hareketRows, months]);

  // ── Cari ────────────────────────────────────────────────────────────────────
  const normalCust = customers.filter(c => !c.is_faturasiz);
  const fatCust    = customers.filter(c => c.is_faturasiz);
  const normalSupp = suppliers.filter(s => !s.is_faturasiz);
  const fatSupp    = suppliers.filter(s => s.is_faturasiz);

  // Trend (önceki ay vs bu ay)
  const lastM = months[months.length - 1];
  const prevM = months[months.length - 2];
  const lastMAmt = outActive.filter(i => monthKey(i.issue_date) === lastM).reduce((s, i) => s + Number(i.amount || 0), 0);
  const prevMAmt = outActive.filter(i => monthKey(i.issue_date) === prevM).reduce((s, i) => s + Number(i.amount || 0), 0);
  const invTrend = prevMAmt > 0 ? ((lastMAmt - prevMAmt) / prevMAmt) * 100 : 0;
  const fatAmt   = ordersFaturasiz.reduce((s, o) => s + Number(o.grand_total || 0), 0);

  // ── Sekme tanımları ─────────────────────────────────────────────────────────
  const TABS = [
    { id: 'genel',    label: 'Genel',         icon: BarChart2    },
    { id: 'fatura',   label: 'Faturalar',      icon: Receipt      },
    { id: 'faturasiz',label: 'Faturasızlar',   icon: AlertTriangle},
    { id: 'kdv',      label: 'KDV & Kâr',      icon: BadgePercent },
    { id: 'satis',    label: 'Satış',          icon: ShoppingCart },
    { id: 'teklif',   label: 'Teklifler',      icon: FileText     },
    { id: 'isemri',   label: 'İş Emirleri',    icon: Hammer       },
    { id: 'cek',      label: 'Çekler',         icon: Scissors     },
    { id: 'hesap',    label: 'Hesap Defteri',  icon: BookOpen     },
    { id: 'kasa',     label: 'Kasa',           icon: Wallet       },
    { id: 'karsi',    label: 'Cariler',        icon: Users        },
    { id: 'tedarik',  label: 'Tedarikciler',   icon: Building2    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">

      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl" style={{ background: `${currentColor}18` }}>
            <BarChart2 size={20} style={{ color: currentColor }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>Raporlar</h1>
            <p className="text-xs text-slate-500">Finansal analitik ve iş zekası</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button onClick={load} className="p-2 rounded-xl transition-colors"
            style={{ color: '#64748b', background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: activeTab === t.id ? currentColor : 'transparent',
              color: activeTab === t.id ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
            }}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: currentColor }} />
        </div>
      ) : (
        <>
          {activeTab === 'genel'    && <GenelTab    {...{ currentColor, totalOutbox, totalOrderAmt, activeOrders, completedOrders, convRate, fatCust, fatSupp, invTrend, outboxByMonth, ordersByMonth, outActive, activeQuotes: quotes, acceptedQuotes, ordersFaturali, ordersFaturasiz, fatAmt, isEmriRows, cekRows, cashIn, cashOut, months }} />}
          {activeTab === 'fatura'   && <FaturaTab   {...{ currentColor, outActive, outCancel, inbox, outbox, outboxByMonth, inboxByMonth, totalOutbox, totalInbox, invTrend, months }} />}
          {activeTab === 'faturasiz'&& <FaturasizTab {...{ currentColor, ordersFaturasiz, fatCust, fatSupp, orders: activeOrders, invoices, fatAmt }} />}
          {activeTab === 'kdv'      && <KdvKarTab   {...{ currentColor, totalKDVSatis, totalKDVAlim, matrahSatis, matrahAlim, brutKar, netKar, outboxByMonth, inboxByMonth }} />}
          {activeTab === 'satis'    && <SatisTab    {...{ currentColor, activeOrders, cancelledOrders, completedOrders, totalOrderAmt, ordersByMonth, ordersFaturali, ordersFaturasiz }} />}
          {activeTab === 'teklif'   && <TeklifTab   {...{ currentColor, quotes, acceptedQuotes, rejectedQuotes, activeQuotes: quotes, convRate, quotesByMonth }} />}
          {activeTab === 'isemri'   && <IsEmriTab   {...{ currentColor, isEmriRows, emriCompleted, emriPending, emriByMonth }} />}
          {activeTab === 'cek'      && <CekTab      {...{ currentColor, cekRows, cekWaiting, cekPaid, cekBounced, cekTotal, cekByMonth }} />}
          {activeTab === 'hesap'    && <HesapTab    {...{ currentColor, hareketRows, hdAlacak, hdVerecek, hdByMonth }} />}
          {activeTab === 'kasa'     && <KasaTab     {...{ currentColor, cashTxs, openCash, cashOut, cashIn, cashByMonth }} />}
          {activeTab === 'karsi'    && <CariTab     {...{ currentColor, customers, normalCust, fatCust, orders: activeOrders, quotes, faturasizCustNames }} />}
          {activeTab === 'tedarik'  && <TedarikTab  {...{ currentColor, suppliers, normalSupp, fatSupp, inbox }} />}
        </>
      )}
    </div>
  );
}

// ─── GENEL TAB ────────────────────────────────────────────────────────────────
function GenelTab({ currentColor, totalOutbox, totalOrderAmt, activeOrders, completedOrders, convRate, fatCust, fatSupp, invTrend, outboxByMonth, ordersByMonth, outActive, activeQuotes, acceptedQuotes, ordersFaturali, ordersFaturasiz, fatAmt, isEmriRows, cekRows, cashIn, cashOut, months }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Satış Cirosu" value={`TL ${fmtK(totalOutbox)}`} icon={TrendingUp}   color="#10b981" trend={invTrend} />
        <KpiCard label="Sipariş Cirosu" value={`TL ${fmtK(totalOrderAmt)}`} sub={`${completedOrders.length} tamamlandı`} icon={ShoppingCart} color="#3b82f6" />
        <KpiCard label="Teklif Dönüşüm" value={`%${convRate}`} icon={FileText} color="#8b5cf6" />
        <KpiCard label="Faturasız Ciro" value={`TL ${fmtK(fatAmt)}`} sub={`${fatCust.length+fatSupp.length} kayıt`} icon={AlertTriangle} color="#f59e0b" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Kasa Gelir" value={`TL ${fmtK(cashIn)}`} icon={TrendingUp} color="#10b981" />
        <KpiCard label="Kasa Gider" value={`TL ${fmtK(cashOut)}`} icon={TrendingDown} color="#ef4444" />
        <KpiCard label="İş Emri" value={isEmriRows.length} sub={`${isEmriRows.filter(e=>e.status==='completed').length} tamamlandı`} icon={Hammer} color="#f97316" />
        <KpiCard label="Çekler" value={cekRows.length} sub={`${cekRows.filter(c=>c.status==='waiting'||c.status==='pending').length} bekleyen`} icon={Scissors} color="#6366f1" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title="Aylık Satış Cirosu (TL)" color="#10b981" />
          <BarChart data={outboxByMonth} color="#10b981" label1="Aktif" label2="İptal" color2="#ef444440" unit="TL " />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={ShoppingCart} title="Aylık Sipariş Cirosu" color="#3b82f6" />
          <BarChart data={ordersByMonth} color="#3b82f6" color2="#10b981" label1="Toplam" label2="Tamamlanan" unit="TL " />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Faturalı / Faturasız Satış" color="#3b82f6" />
          <DonutChart slices={[
            { label: 'Faturalı',  value: ordersFaturali.reduce((s,o) => s+Number(o.grand_total||0),0),  color:'#3b82f6' },
            { label: 'Faturasız', value: fatAmt, color: '#f59e0b' },
          ].filter(s => s.value > 0)} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={Users} title="Fatura Durum Dağılımı" color="#10b981" />
          <DonutChart slices={['Approved','Processing','Canceled','Error'].map(s => ({
            label: s==='Approved'?'Onaylandı':s==='Canceled'?'İptal':s==='Processing'?'İşlemde':'Hatalı',
            value: outActive.filter(i=>i.status===s).length,
            color: s==='Approved'?'#10b981':s==='Canceled'?'#ef4444':s==='Processing'?'#f59e0b':'#64748b',
          })).filter(s=>s.value>0)} />
        </div>
      </div>
    </div>
  );
}

// ─── FATURA TAB ───────────────────────────────────────────────────────────────
function FaturaTab({ currentColor, outActive, outCancel, inbox, outbox, outboxByMonth, inboxByMonth, totalOutbox, totalInbox, invTrend, months }) {
  const [sub, setSub] = useState('Giden');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Aktif Giden Fatura" value={outActive.length}              icon={Receipt}     color="#10b981" trend={invTrend} />
        <KpiCard label="Giden Ciro"         value={`TL ${fmtK(totalOutbox)}`}    icon={TrendingUp}  color="#10b981" />
        <KpiCard label="İptal Fatura"       value={outCancel.length}              icon={AlertTriangle} color="#ef4444" />
        <KpiCard label="Gelen Gider"        value={`TL ${fmtK(totalInbox)}`}     icon={TrendingDown} color="#f97316" />
      </div>
      <SubTabs tabs={['Giden','Gelen','İptal']} active={sub} onChange={setSub} />
      {sub === 'Giden' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={Receipt} title="Aylık Giden Fatura Cirosu" sub="Aktif faturalar" color="#10b981" />
            <BarChart data={outboxByMonth} color="#10b981" unit="TL " />
          </div>
          <div className="glass-card p-4">
            <SectionTitle icon={PieChart} title="Durum Dağılımı" color={currentColor} />
            <DonutChart slices={['Approved','Processing','Draft','Canceled','Error'].map(s => ({
              label: {Approved:'Onaylandı', Processing:'İşlemde', Draft:'Taslak', Canceled:'İptal', Error:'Hata'}[s]||s,
              value: outbox.filter(i=>i.status===s).length,
              color: {Approved:'#10b981', Processing:'#f59e0b', Draft:'#94a3b8', Canceled:'#ef4444', Error:'#8b5cf6'}[s],
            })).filter(s=>s.value>0)} />
          </div>
          <div className="glass-card p-4">
            <SectionTitle icon={Users} title="En Çok Faturalananlar" color={currentColor} />
            <TopList color={currentColor} unit="TL " items={topN(outActive,'cari_name','amount')} />
          </div>
        </div>
      )}
      {sub === 'Gelen' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={Receipt} title="Aylık Gelen Fatura Gideri" color="#f97316" />
            <BarChart data={inboxByMonth} color="#f97316" unit="TL " />
          </div>
          <div className="glass-card p-4">
            <SectionTitle icon={Users} title="En Çok Harcanan Tedarikçi" color="#f97316" />
            <TopList color="#f97316" unit="TL " items={topN(inbox,'cari_name','amount')} />
          </div>
        </div>
      )}
      {sub === 'İptal' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title="İptal Edilen Faturalar" color="#ef4444" />
          <p className="text-xs text-slate-500 mb-3">Bu faturalar cirolara dahil edilmemiştir.</p>
          {outCancel.slice(0,20).map((inv,i) => (
            <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom:'1px solid rgba(148,163,184,0.06)' }}>
              <div>
                <p className="text-xs font-mono text-blue-400">{inv.invoice_id}</p>
                <p className="text-[10px] text-slate-500">{inv.cari_name} · {inv.issue_date?.slice(0,10)}</p>
              </div>
              <span className="text-xs font-bold text-red-400">TL {fmtK(inv.amount)}</span>
            </div>
          ))}
          {outCancel.length === 0 && <p className="text-xs text-slate-600 text-center py-6">İptal fatura yok</p>}
        </div>
      )}
    </div>
  );
}

// ─── FATURASIZLAR TAB ─────────────────────────────────────────────────────────
function FaturasizTab({ currentColor, ordersFaturasiz, fatCust, fatSupp, orders, invoices, fatAmt }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturasız Ciro"     value={`TL ${fmtK(fatAmt)}`}     icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="Faturasız Sipariş"  value={ordersFaturasiz.length}    icon={ShoppingCart}  color="#f59e0b" />
        <KpiCard label="Faturasız Cari"     value={fatCust.length}            icon={Users}         color="#f59e0b" />
        <KpiCard label="Faturasız Tedarikçi" value={fatSupp.length}           icon={Building2}     color="#f97316" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4">
          <SectionTitle icon={Users} title={`Faturasız Cariler (${fatCust.length})`} color="#f59e0b" />
          {fatCust.length === 0 && <p className="text-xs text-slate-500 text-center py-6">Faturasız cari yok</p>}
          {fatCust.map(c => {
            const cOrds  = orders.filter(o => o.customer_name === c.name);
            const cAmt   = cOrds.reduce((s,o) => s+Number(o.grand_total||0),0);
            return (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl mb-2"
                style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{c.name}</p>
                  <p className="text-[10px] text-slate-500">{cOrds.length} sipariş</p>
                </div>
                <p className="text-sm font-bold text-amber-400">TL {fmtK(cAmt)}</p>
              </div>
            );
          })}
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={Building2} title={`Faturasız Tedarikciler (${fatSupp.length})`} color="#f97316" />
          {fatSupp.length === 0 && <p className="text-xs text-slate-500 text-center py-6">Faturasız tedarikçi yok</p>}
          {fatSupp.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl mb-2"
              style={{ background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.15)' }}>
              <p className="text-sm font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{s.name}</p>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>Faturasız</span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-card p-4">
        <SectionTitle icon={ShoppingCart} title="Faturasız Sipariş Detayı" color="#f59e0b" />
        <p className="text-[11px] text-slate-500 mb-3">Bu siparişler e-fatura kapsamı dışındadır.</p>
        <TopList color="#f59e0b" unit="TL " items={topN(ordersFaturasiz,'customer_name','grand_total')} />
      </div>
    </div>
  );
}

// ─── KDV & KÂR TAB ───────────────────────────────────────────────────────────
function KdvKarTab({ currentColor, totalKDVSatis, totalKDVAlim, matrahSatis, matrahAlim, brutKar, netKar, outboxByMonth, inboxByMonth }) {
  const netKDV = totalKDVSatis - totalKDVAlim;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Tahsil Edilen KDV" value={`TL ${fmtK(totalKDVSatis)}`} sub="(Satışlardan)"   icon={BadgePercent}  color="#6366f1" />
        <KpiCard label="Ödenen KDV"         value={`TL ${fmtK(totalKDVAlim)}`}  sub="(Alımlardan)"   icon={BadgePercent}  color="#f97316" />
        <KpiCard label="Net KDV Yükü"       value={`TL ${fmtK(Math.abs(netKDV))}`} sub={netKDV >= 0 ? 'Ödenecek':'İade Alınacak'} icon={Scale} color={netKDV>=0?'#ef4444':'#10b981'} />
        <KpiCard label="Brüt Kâr (Matrah)"  value={`TL ${fmtK(brutKar)}`}       icon={TrendingUp}    color={brutKar>=0?'#10b981':'#ef4444'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
        <KpiCard label="Satış Matrahı"  value={`TL ${fmtK(matrahSatis)}`} sub="(KDV Hariç Ciro)" icon={Receipt} color="#10b981" />
        <KpiCard label="Alım Matrahı"   value={`TL ${fmtK(matrahAlim)}`}  sub="(KDV Hariç Maliyet)" icon={TrendingDown} color="#f97316" />
      </div>

      <div className="glass-card p-4">
        <SectionTitle icon={BadgePercent} title="KDV Özeti" color="#6366f1" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            { label:'Tahsil Edilen KDV', val: totalKDVSatis, color:'#6366f1' },
            { label:'Ödenen KDV',        val: totalKDVAlim,  color:'#f97316' },
            { label:'Net KDV Yükü',      val: netKDV,        color: netKDV>=0?'#ef4444':'#10b981' },
          ].map(row => (
            <div key={row.label} className="rounded-2xl p-4 text-center"
              style={{ background:`${row.color}10`, border:`1px solid ${row.color}25` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: row.color }}>{row.label}</p>
              <p className="text-2xl font-black" style={{ color: row.color }}>TL {fmtK(Math.abs(row.val))}</p>
              {row.label === 'Net KDV Yükü' && <p className="text-[10px] text-slate-500 mt-1">{netKDV>=0?'Vergi dairesine ödenecek':'Vergi dairesinden iade alınacak'}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4">
        <SectionTitle icon={Scale} title="Kâr Analizi" color="#10b981" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            { label:'Brüt Kâr (Matrah Farkı)', val: brutKar,                    color: brutKar>=0?'#10b981':'#ef4444', info:'Satış matrahı − Alım matrahı' },
            { label:'Net KDV Yükü',            val: netKDV,                      color: netKDV>=0?'#ef4444':'#10b981',  info:'Tahsil Edilen KDV − Ödenen KDV' },
            { label:'Net Kâr (Vergi Sonrası)',  val: brutKar - Math.max(0,netKDV), color: (brutKar-Math.max(0,netKDV))>=0?'#10b981':'#ef4444', info:'Brüt Kâr − Net KDV Yükü' },
          ].map(row => (
            <div key={row.label} className="rounded-2xl p-4"
              style={{ background:`${row.color}10`, border:`1px solid ${row.color}25` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: row.color }}>{row.label}</p>
              <p className="text-[9px] text-slate-500 mb-2">{row.info}</p>
              <p className="text-xl font-black" style={{ color: row.color }}>{row.val < 0 ? '-' : ''}TL {fmtK(Math.abs(row.val))}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title="Aylık Satış Cirosu (TL)" color="#10b981" />
          <BarChart data={outboxByMonth} color="#10b981" unit="TL " />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={TrendingDown} title="Aylık Alım Gideri (TL)" color="#f97316" />
          <BarChart data={inboxByMonth} color="#f97316" unit="TL " />
        </div>
      </div>
    </div>
  );
}

// ─── SATIS TAB ────────────────────────────────────────────────────────────────
function SatisTab({ currentColor, activeOrders, cancelledOrders, completedOrders, totalOrderAmt, ordersByMonth, ordersFaturali, ordersFaturasiz }) {
  const [sub, setSub] = useState('Özet');
  const fataliAmt  = ordersFaturali.reduce((s,o)  => s+Number(o.grand_total||0),0);
  const fatasizAmt = ordersFaturasiz.reduce((s,o) => s+Number(o.grand_total||0),0);
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Aktif Sipariş"  value={activeOrders.length}         icon={ShoppingCart} color="#3b82f6" />
        <KpiCard label="Toplam Ciro"    value={`TL ${fmtK(totalOrderAmt)}`} icon={TrendingUp}   color="#3b82f6" />
        <KpiCard label="Faturalı Ciro"  value={`TL ${fmtK(fataliAmt)}`}    icon={Receipt}      color="#10b981" />
        <KpiCard label="Faturasız Ciro" value={`TL ${fmtK(fatasizAmt)}`}   icon={AlertTriangle} color="#f59e0b" />
      </div>
      <SubTabs tabs={['Özet','Faturalı','Faturasız','İptal']} active={sub} onChange={setSub} />
      {sub === 'Özet' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={ShoppingCart} title="Aylık Sipariş Cirosu" color="#3b82f6" />
            <BarChart data={ordersByMonth} color="#3b82f6" color2="#10b981" label1="Toplam" label2="Tamamlanan" unit="TL " />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <SectionTitle icon={PieChart} title="Faturalı / Faturasız Dağılım" color={currentColor} />
              <DonutChart slices={[
                { label:'Faturalı',  value:fataliAmt,  color:'#3b82f6' },
                { label:'Faturasız', value:fatasizAmt, color:'#f59e0b' },
              ].filter(s=>s.value>0)} />
            </div>
            <div className="glass-card p-4">
              <SectionTitle icon={Users} title="En Çok Sipariş Veren" color={currentColor} />
              <TopList color={currentColor} unit="TL " items={topN(activeOrders,'customer_name','grand_total')} />
            </div>
          </div>
        </div>
      )}
      {sub === 'Faturalı' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title={`Faturalı Siparişler — TL ${fmtK(fataliAmt)}`} color="#10b981" />
          <TopList color="#10b981" unit="TL " items={topN(ordersFaturali,'customer_name','grand_total')} />
        </div>
      )}
      {sub === 'Faturasız' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Faturasız Siparişler — TL ${fmtK(fatasizAmt)}`} color="#f59e0b" />
          <TopList color="#f59e0b" unit="TL " items={topN(ordersFaturasiz,'customer_name','grand_total')} />
        </div>
      )}
      {sub === 'İptal' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`İptal Siparişler (${cancelledOrders.length})`} color="#ef4444" />
          {cancelledOrders.slice(0,20).map((o,i) => (
            <div key={i} className="flex justify-between py-2" style={{ borderBottom:'1px solid rgba(148,163,184,0.06)' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{o.customer_name||'Bilinmeyen'}</p>
                <p className="text-[10px] text-slate-500">{o.created_at?.slice(0,10)}</p>
              </div>
              <span className="text-xs font-bold text-red-400">TL {fmtK(o.grand_total)}</span>
            </div>
          ))}
          {cancelledOrders.length===0 && <p className="text-xs text-slate-600 text-center py-6">İptal sipariş yok</p>}
        </div>
      )}
    </div>
  );
}

// ─── TEKLİF TAB ───────────────────────────────────────────────────────────────
function TeklifTab({ currentColor, quotes, acceptedQuotes, rejectedQuotes, activeQuotes, convRate, quotesByMonth }) {
  const [sub, setSub] = useState('Özet');
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Teklif"    value={quotes.length}        icon={FileText}  color="#8b5cf6" />
        <KpiCard label="Kabul Edilen"     value={acceptedQuotes.length} icon={TrendingUp} color="#10b981" />
        <KpiCard label="Dönüşüm Oranı"   value={`%${convRate}`}        icon={BarChart2} color="#f59e0b" />
        <KpiCard label="Reddedilen"       value={rejectedQuotes.length} icon={TrendingDown} color="#ef4444" />
      </div>
      <SubTabs tabs={['Özet','Reddedilenler']} active={sub} onChange={setSub} />
      {sub === 'Özet' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={FileText} title="Aylık Teklif Sayısı" sub="Mor = toplam, Yeşil = kabul" color="#8b5cf6" />
            <BarChart data={quotesByMonth} color="#8b5cf6" color2="#10b981" label1="Toplam" label2="Kabul" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <SectionTitle icon={PieChart} title="Teklif Durum Dağılımı" color="#8b5cf6" />
              <DonutChart slices={[
                { label:'Taslak',    value:quotes.filter(q=>q.status==='draft').length,    color:'#64748b' },
                { label:'Gönderildi',value:quotes.filter(q=>q.status==='sent').length,      color:'#3b82f6' },
                { label:'Kabul',     value:acceptedQuotes.length,                           color:'#10b981' },
                { label:'Reddedildi',value:rejectedQuotes.length,                           color:'#ef4444' },
              ].filter(s=>s.value>0)} />
            </div>
            <div className="glass-card p-4">
              <SectionTitle icon={Users} title="En Çok Teklif Verilen" color={currentColor} />
              <TopList color={currentColor} items={topN(quotes,'company_name','grand_total')} unit="TL " />
            </div>
          </div>
        </div>
      )}
      {sub === 'Reddedilenler' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Reddedilen Teklifler (${rejectedQuotes.length})`} color="#ef4444" />
          {rejectedQuotes.slice(0,20).map((q,i) => (
            <div key={i} className="flex justify-between py-2" style={{ borderBottom:'1px solid rgba(148,163,184,0.06)' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{q.company_name||'Bilinmeyen'}</p>
                <p className="text-[10px] text-slate-500">{q.created_at?.slice(0,10)}</p>
              </div>
              <span className="text-xs font-bold text-red-400">TL {fmtK(q.grand_total)}</span>
            </div>
          ))}
          {rejectedQuotes.length===0 && <p className="text-xs text-slate-600 text-center py-6">Reddedilen teklif yok</p>}
        </div>
      )}
    </div>
  );
}

// ─── İŞ EMRİ TAB ─────────────────────────────────────────────────────────────
function IsEmriTab({ currentColor, isEmriRows, emriCompleted, emriPending, emriByMonth }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam İş Emri"  value={isEmriRows.length}        icon={Hammer}    color="#f97316" />
        <KpiCard label="Tamamlanan"       value={emriCompleted.length}      icon={TrendingUp} color="#10b981" />
        <KpiCard label="Devam Eden"       value={emriPending.length}        icon={RefreshCw} color="#3b82f6" />
        <KpiCard label="İptal"            value={isEmriRows.filter(e=>e.status==='cancelled').length} icon={AlertTriangle} color="#ef4444" />
      </div>
      {isEmriRows.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Hammer size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
          <p className="text-slate-500">Seçili dönemde iş emri bulunamadı.</p>
          <p className="text-xs text-slate-400 mt-1">Farklı bir dönem deneyin veya veri bekleniyor.</p>
        </div>
      ) : (
        <>
          <div className="glass-card p-4">
            <SectionTitle icon={Hammer} title="Aylık İş Emri Sayısı" sub="Turuncu = toplam, Yeşil = tamamlanan" color="#f97316" />
            <BarChart data={emriByMonth} color="#f97316" color2="#10b981" label1="Toplam" label2="Tamamlanan" />
          </div>
          <div className="glass-card p-4">
            <SectionTitle icon={PieChart} title="Durum Dağılımı" color="#f97316" />
            <DonutChart slices={[
              { label:'Tamamlandı', value: emriCompleted.length,    color:'#10b981' },
              { label:'Devam Eden', value: emriPending.length,      color:'#3b82f6' },
              { label:'Bekliyor',   value: isEmriRows.filter(e=>e.status==='pending').length, color:'#f59e0b' },
              { label:'İptal',      value: isEmriRows.filter(e=>e.status==='cancelled').length, color:'#ef4444' },
            ].filter(s=>s.value>0)} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── ÇEK TAB ─────────────────────────────────────────────────────────────────
function CekTab({ currentColor, cekRows, cekWaiting, cekPaid, cekBounced, cekTotal, cekByMonth }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Çek"   value={cekRows.length}                   icon={Scissors}    color="#6366f1" />
        <KpiCard label="Çek Toplamı"  value={`TL ${fmtK(cekTotal)}`}           icon={TrendingUp}  color="#6366f1" />
        <KpiCard label="Bekleyen"     value={cekWaiting.length}                 icon={RefreshCw}   color="#f59e0b" sub={`TL ${fmtK(cekWaiting.reduce((s,c)=>s+Number(c.amount||0),0))}`} />
        <KpiCard label="Karşılıksız"  value={cekBounced.length}                 icon={AlertTriangle} color="#ef4444" />
      </div>
      {cekRows.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Scissors size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
          <p className="text-slate-500">Seçili dönemde çek bulunamadı.</p>
          <p className="text-xs text-slate-400 mt-1">checks tablosu henüz mevcut değil ya da veri yok.</p>
        </div>
      ) : (
        <>
          <div className="glass-card p-4">
            <SectionTitle icon={Scissors} title="Aylık Çek Tutarı" color="#6366f1" />
            <BarChart data={cekByMonth} color="#6366f1" unit="TL " />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <SectionTitle icon={PieChart} title="Çek Durumu Dağılımı" color="#6366f1" />
              <DonutChart slices={[
                { label:'Bekleyen',    value: cekWaiting.length,  color:'#f59e0b' },
                { label:'Tahsil',     value: cekPaid.length,     color:'#10b981' },
                { label:'Karşılıksız',value: cekBounced.length,  color:'#ef4444' },
              ].filter(s=>s.value>0)} />
            </div>
            <div className="glass-card p-4">
              <SectionTitle icon={Users} title="En Yüksek Çek Tutarı (Kişi)" color={currentColor} />
              <TopList color={currentColor} unit="TL " items={topN(cekRows,'drawer_name','amount')} />
            </div>
          </div>
          <div className="glass-card p-4">
            <SectionTitle icon={AlertTriangle} title="Bekleyen Çekler" color="#f59e0b" />
            {cekWaiting.slice(0,15).map((c,i) => (
              <div key={i} className="flex justify-between py-2" style={{ borderBottom:'1px solid rgba(148,163,184,0.06)' }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{c.drawer_name||'Bilinmeyen'}</p>
                  <p className="text-[10px] text-slate-500">Vade: {c.due_date?.slice(0,10)||'-'}</p>
                </div>
                <span className="text-xs font-bold text-amber-400">TL {fmtK(c.amount)}</span>
              </div>
            ))}
            {cekWaiting.length===0 && <p className="text-xs text-slate-500 text-center py-4">Bekleyen çek yok</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── HESAP DEFTERİ TAB ────────────────────────────────────────────────
function HesapTab({ currentColor, hareketRows, hdAlacak, hdVerecek, hdByMonth }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const net = hdAlacak - hdVerecek;

  // Cari (musteri) hareketleri: borc = Alacak (alacağımız), alacak = Alınan (aldığımız)
  const cariH     = hareketRows.filter(h => h.musteri_id);
  const cariAlacak = cariH.reduce((s, h) => s + Number(h.borc   || 0), 0); // alacağımız
  const cariAlinan = cariH.reduce((s, h) => s + Number(h.alacak || 0), 0); // aldığımız

  // Tedarikçi hareketleri: alacak = Verecek (ödeyeceğimiz), borc = Verilen (verdiğimiz)
  const tedarikH   = hareketRows.filter(h => h.tedarikci_id);
  const tedVerecek  = tedarikH.reduce((s, h) => s + Number(h.alacak || 0), 0); // ödeyeceğimiz
  const tedVerilen  = tedarikH.reduce((s, h) => s + Number(h.borc   || 0), 0); // verdiğimiz

  const faturaliH = hareketRows.filter(h => h.kaynak === 'invoice');
  const manuelH   = hareketRows.filter(h => h.kaynak === 'manual' || !h.kaynak);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Cari Alacak"    value={`TL ${fmtK(cariAlacak)}`}  sub="Müşteriden alacağımız" icon={TrendingUp}  color="#10b981" />
        <KpiCard label="Cari Alınan"    value={`TL ${fmtK(cariAlinan)}`}  sub="Müşteriden alınan"     icon={TrendingDown} color="#3b82f6" />
        <KpiCard label="Tedarikçi Verecek" value={`TL ${fmtK(tedVerecek)}`} sub="Tedarikçiye ödeyeceğimiz" icon={TrendingDown} color="#ef4444" />
        <KpiCard label="Tedarikçi Verilen" value={`TL ${fmtK(tedVerilen)}`} sub="Tedarikçiye verilen"    icon={TrendingUp}  color="#f97316" />
      </div>

      {/* Özet net */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Net Cari Bakiye',    val: cariAlacak - cariAlinan,    sub: 'Alacak − Alınan',        posLabel: 'Hâlâ alacağımız var', negLabel: 'Fazla alınmış' },
          { label: 'Net Tedarikçi',      val: tedVerilen - tedVerecek,    sub: 'Verilen − Verecek',      posLabel: 'Fazla ödeme yapılmış', negLabel: 'Hâlâ borcumuz var' },
          { label: 'Genel Net Bakiye',   val: net,                         sub: 'Tüm alacak − verecek',  posLabel: 'Net alacaklısınız', negLabel: 'Net borçlusunuz' },
        ].map(row => {
          const pos = row.val >= 0;
          const color = pos ? '#10b981' : '#ef4444';
          return (
            <div key={row.label} className="glass-card p-4 rounded-2xl"
              style={{ border: `1px solid ${color}22` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{row.label}</p>
              <p className="text-[10px] text-slate-500 mb-2">{row.sub}</p>
              <p className="text-xl font-black" style={{ color }}>{row.val < 0 ? '-' : '+'}TL {fmtK(Math.abs(row.val))}</p>
              <p className="text-[10px] mt-1" style={{ color }}>{pos ? row.posLabel : row.negLabel}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-card p-4">
        <SectionTitle icon={BookOpen} title="Aylık Alacak / Alınan (Cari)" sub="Yeşil = Alacak (alacağımız), Kırmızı = Alınan (tahsilat)" color="#10b981" />
        <BarChart data={hdByMonth} color="#10b981" color2="#ef4444" label1="Alacak" label2="Alınan" unit="TL " />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Hareket Tipi Dağılımı" color={currentColor} />
          <DonutChart slices={[
            { label:'Cari (Müşteri)',   value: cariH.length,    color:'#3b82f6' },
            { label:'Tedarikçi',        value: tedarikH.length, color:'#f97316' },
            { label:'Manuel/Diğer',     value: manuelH.length,  color:'#8b5cf6' },
          ].filter(s=>s.value>0)} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={TrendingUp} title="En Büyük Alacak Tutarları" color="#10b981" />
          <TopList color="#10b981" unit="TL "
            items={topN(hareketRows.filter(h => h.borc > 0), 'baslik', 'borc')} />
        </div>
      </div>
    </div>
  );
}

// ─── CARİ TAB ────────────────────────────────────────────────────────────────
function CariTab({ currentColor, customers, normalCust, fatCust, orders, quotes, faturasizCustNames }) {
  const [sub, setSub] = useState('Faturalı');
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const fataliOrders  = orders.filter(o => !faturasizCustNames.has(o.customer_name));
  const fatasizOrders = orders.filter(o => faturasizCustNames.has(o.customer_name));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Cari"    value={customers.length}  icon={Users}         color="#3b82f6" />
        <KpiCard label="Faturalı"       value={normalCust.length} icon={Receipt}       color="#10b981" />
        <KpiCard label="Faturasız"      value={fatCust.length}    icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="Faturasız Ciro" value={`TL ${fmtK(fatasizOrders.reduce((s,o)=>s+Number(o.grand_total||0),0))}`} icon={TrendingUp} color="#f59e0b" />
      </div>
      <SubTabs tabs={['Faturalı','Faturasız','Dağılım']} active={sub} onChange={setSub} />
      {sub === 'Faturalı' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title={`Faturalı Cariler (${normalCust.length})`} color="#10b981" />
          <TopList color="#10b981" unit="TL " items={topN(fataliOrders,'customer_name','grand_total')} />
        </div>
      )}
      {sub === 'Faturasız' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Faturasız Cariler (${fatCust.length})`} color="#f59e0b" />
          {fatCust.length===0 && <p className="text-xs text-slate-600 text-center py-6">Faturasız cari yok</p>}
          {fatCust.map(c => {
            const cOrds = orders.filter(o=>o.customer_name===c.name);
            const cAmt  = cOrds.reduce((s,o)=>s+Number(o.grand_total||0),0);
            return (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl mb-2"
                style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{c.name}</p>
                  <p className="text-[10px] text-slate-500">{cOrds.length} sipariş</p>
                </div>
                <p className="text-sm font-bold text-amber-400">TL {fmtK(cAmt)}</p>
              </div>
            );
          })}
        </div>
      )}
      {sub === 'Dağılım' && (
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Cari Tip Dağılımı" color={currentColor} />
          <DonutChart slices={[
            { label:'Faturalı (Manuel)',  value:normalCust.filter(c=>c.source==='manual').length,         color:'#3b82f6' },
            { label:'Faturadan Senkron',  value:customers.filter(c=>c.source==='invoice_sync').length,    color:'#10b981' },
            { label:'Faturasız',          value:fatCust.length,                                           color:'#f59e0b' },
          ].filter(s=>s.value>0)} />
        </div>
      )}
    </div>
  );
}

// ─── TEDARİKÇİ TAB ────────────────────────────────────────────────────────────
function TedarikTab({ currentColor, suppliers, normalSupp, fatSupp, inbox }) {
  const [sub, setSub] = useState('Faturalı');
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Tedarikçi" value={suppliers.length}   icon={Building2}    color="#f97316" />
        <KpiCard label="Faturalı"         value={normalSupp.length}  icon={Receipt}      color="#10b981" />
        <KpiCard label="Faturasız"        value={fatSupp.length}     icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="Gelen Fatura Gideri" value={`TL ${fmtK(inbox.reduce((s,i)=>s+Number(i.amount||0),0))}`} icon={TrendingDown} color="#f97316" />
      </div>
      <SubTabs tabs={['Faturalı','Faturasız','Dağılım']} active={sub} onChange={setSub} />
      {sub === 'Faturalı' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title={`Faturalı Tedarikciler (${normalSupp.length})`} color="#10b981" />
          <TopList color="#10b981" unit="TL " items={topN(inbox,'cari_name','amount')} />
        </div>
      )}
      {sub === 'Faturasız' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Faturasız Tedarikciler (${fatSupp.length})`} color="#f59e0b" />
          {fatSupp.length===0 && <p className="text-xs text-slate-600 text-center py-6">Faturasız tedarikçi yok</p>}
          {fatSupp.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl mb-2"
              style={{ background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.15)' }}>
              <p className="text-sm font-semibold" style={{ color: isDark?'#e2e8f0':'#1e293b' }}>{s.name}</p>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>Faturasız</span>
            </div>
          ))}
        </div>
      )}
      {sub === 'Dağılım' && (
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Tedarikçi Tip Dağılımı" color={currentColor} />
          <DonutChart slices={[
            { label:'Normal',    value:normalSupp.length, color:'#f97316' },
            { label:'Faturasız', value:fatSupp.length,    color:'#f59e0b' },
          ].filter(s=>s.value>0)} />
        </div>
      )}
    </div>
  );
}

// ─── KASA TAB ─────────────────────────────────────────────────────────────────
function KasaTab({ currentColor, cashTxs, openCash, cashOut, cashIn, cashByMonth }) {
  const CATS = { maas:'Maaş', avans:'Avans', kargo:'Kargo', market:'Market', cay_kahve:'Çay/Kahve', akaryakit:'Akaryakıt', diger:'Diğer' };
  const COLS = { maas:'#8b5cf6', avans:'#3b82f6', kargo:'#f97316', market:'#10b981', cay_kahve:'#f59e0b', akaryakit:'#ef4444', diger:'#64748b' };
  const catSlices = Object.entries(CATS).map(([id,label]) => ({
    label, color: COLS[id],
    value: openCash.filter(t=>t.direction==='out'&&t.category===id).reduce((s,t)=>s+t.amount,0),
  })).filter(s=>s.value>0);

  const settledIn  = cashTxs.filter(t=>t.is_settled&&t.direction==='in').reduce((s,t)=>s+t.amount,0);
  const settledOut = cashTxs.filter(t=>t.is_settled&&t.direction==='out').reduce((s,t)=>s+t.amount,0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Gider"   value={`TL ${fmtK(cashOut)}`}           icon={TrendingDown} color="#ef4444" />
        <KpiCard label="Toplam Gelir"   value={`TL ${fmtK(cashIn)}`}            icon={TrendingUp}   color="#10b981" />
        <KpiCard label="Net Bakiye"     value={`${cashIn-cashOut>=0?'+':''}TL ${fmtK(Math.abs(cashIn-cashOut))}`} icon={Wallet} color={cashIn-cashOut>=0?'#10b981':'#ef4444'} />
        <KpiCard label="Kayıt Sayısı"   value={cashTxs.length}                   icon={BarChart2}    color="#8b5cf6" />
      </div>
      <div className="glass-card p-4">
        <SectionTitle icon={Wallet} title="Aylık Kasa Hareketi" sub="Kırmızı = gider, Yeşil = gelir" color="#ef4444" />
        <BarChart data={cashByMonth} color="#ef4444" color2="#10b981" label1="Gider" label2="Gelir" unit="TL " />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Gider Kategori Dağılımı" color="#ef4444" />
          <DonutChart slices={catSlices.length ? catSlices : EMPTY_DONUT} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={Users} title="Kişi Bazlı Gider (Top 5)" color="#8b5cf6" />
          <TopList color="#8b5cf6" unit="TL "
            items={topN(openCash.filter(t=>t.direction==='out'&&t.person),'person','amount')} />
        </div>
      </div>
    </div>
  );
}
