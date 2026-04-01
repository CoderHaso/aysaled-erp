/**
 * Reports.jsx â€” A-ERP Raporlar SayfasÄ±
 * Fatura, SatÄ±ÅŸ, Teklif, Cari ve Kasa raporlarÄ±
 * SVG tabanlÄ± grafikler (harici kÃ¼tÃ¼phane gerektirmez)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, FileText, ShoppingCart, Users, Building2,
  Loader2, RefreshCw, BarChart2, PieChart, Calendar, ArrowUpRight,
  ArrowDownRight, Receipt, Package, Wallet, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmt   = (n) => n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0';
const fmtK  = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `${(n/1000).toFixed(1)}K`;
  return fmt(n);
};
const MONTH_NAMES = ['Oca','Åub','Mar','Nis','May','Haz','Tem','AÄŸu','Eyl','Eki','Kas','Ara'];

// Ay key Ã¼ret: "2024-03"
const monthKey = (d) => d?.substring(0, 7);

// Son N ay listesi (en eskiden yeniye)
const lastNMonths = (n) => {
  const res = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return res;
};

const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
};

// â”€â”€â”€ SVG Ã‡ubuk Grafik â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BarChart({ data, color, color2, label1, label2, height = 180 }) {
  const max = Math.max(...data.map(d => Math.max(d.v1 || 0, d.v2 || 0)), 1);
  const w = 100 / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${Math.max(data.length * 40, 300)} ${height + 40}`} className="w-full" style={{ minWidth: data.length > 8 ? data.length * 38 : undefined }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct}
            x1="0" y1={height - pct * height}
            x2="100%" y2={height - pct * height}
            stroke="rgba(148,163,184,0.1)" strokeWidth="1"
          />
        ))}

        {data.map((d, i) => {
          const x1 = i * 40 + 4;
          const x2 = i * 40 + 22;
          const bw = color2 ? 16 : 32;
          const h1 = ((d.v1 || 0) / max) * (height - 4);
          const h2 = ((d.v2 || 0) / max) * (height - 4);
          return (
            <g key={i}>
              {/* Bar 1 */}
              <rect x={x1} y={height - h1} width={color2 ? 16 : 34} height={Math.max(h1, 2)} rx="3"
                fill={color} opacity="0.85" />
              {/* Bar 2 (opsiyonel) */}
              {color2 && (
                <rect x={x2} y={height - h2} width={16} height={Math.max(h2, 2)} rx="3"
                  fill={color2} opacity="0.7" />
              )}
              {/* X Label */}
              <text x={i * 40 + (color2 ? 20 : 22)} y={height + 14}
                fontSize="8" fill="#64748b" textAnchor="middle">
                {d.label}
              </text>
              {/* Value label */}
              {h1 > 16 && (
                <text x={x1 + (color2 ? 8 : 17)} y={height - h1 - 3}
                  fontSize="7" fill={color} textAnchor="middle" opacity="0.9">
                  {fmtK(d.v1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Lejant */}
      {color2 && (
        <div className="flex items-center gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="w-3 h-3 rounded" style={{ background: color }} />{label1}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="w-3 h-3 rounded" style={{ background: color2 }} />{label2}
          </span>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ SVG Pasta Grafik â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DonutChart({ slices, size = 120 }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  let cumAngle = -90;

  const polarToXy = (angle, r) => {
    const rad = (angle * Math.PI) / 180;
    return { x: 60 + r * Math.cos(rad), y: 60 + r * Math.sin(rad) };
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox="0 0 120 120" className="flex-shrink-0">
        {slices.map((sl, i) => {
          const angle = (sl.value / total) * 360;
          const start = polarToXy(cumAngle, 45);
          const end   = polarToXy(cumAngle + angle, 45);
          const large = angle > 180 ? 1 : 0;
          const path  = `M60 60 L${start.x} ${start.y} A45 45 0 ${large} 1 ${end.x} ${end.y} Z`;
          cumAngle   += angle;
          return <path key={i} d={path} fill={sl.color} opacity="0.85" />;
        })}
        <circle cx="60" cy="60" r="28" fill="#0c1526" />
        <text x="60" y="57" textAnchor="middle" fontSize="11" fill="#f1f5f9" fontWeight="bold">
          {fmt(total)}
        </text>
        <text x="60" y="68" textAnchor="middle" fontSize="7" fill="#64748b">toplam</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sl.color }} />
              <span className="text-[11px] text-slate-400 truncate">{sl.label}</span>
            </div>
            <span className="text-[11px] font-bold text-slate-300 flex-shrink-0">
              {fmt(sl.value)} <span className="text-slate-600 font-normal">({((sl.value/total)*100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// â”€â”€â”€ KPI KartÄ± â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function KpiCard({ label, value, sub, icon: Icon, color, trend, delay = 0 }) {
  return (
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay }}
      className="glass-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="p-2.5 rounded-2xl" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-0.5 text-[11px] font-bold"
            style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold mt-3 text-slate-100">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 text-slate-500">{label}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// â”€â”€â”€ BÃ¶lÃ¼m BaÅŸlÄ±ÄŸÄ± â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SectionTitle({ icon: Icon, title, sub, color }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 rounded-xl" style={{ background: `${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// â”€â”€â”€ Ay SeÃ§ici â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PeriodSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[6, 12, 24].map(n => (
        <button key={n} onClick={() => onChange(n)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: value === n ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
            color: value === n ? '#fff' : '#94a3b8',
          }}>
          {n === 6 ? '6 Ay' : n === 12 ? '12 Ay' : '2 YÄ±l'}
        </button>
      ))}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANA SAYFA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function Reports() {
  const { currentColor } = useTheme();
  const [period, setPeriod]     = useState(12);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('genel');

  // Veri state'leri
  const [invoices, setInvoices]   = useState([]);
  const [orders,   setOrders]     = useState([]);
  const [quotes,   setQuotes]     = useState([]);
  const [customers,setCustomers]  = useState([]);
  const [suppliers,setSuppliers]  = useState([]);
  const [cashTxs,  setCashTxs]    = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - period);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const [invR, ordR, qR, custR, suppR, cashR] = await Promise.all([
        supabase.from('invoices').select('invoice_id,issue_date,amount,currency,status,type,cari_name,vkntckn'),
        supabase.from('orders').select('id,created_at,grand_total,status,customer_name').gte('created_at', cutoffStr + 'T00:00:00'),
        supabase.from('quotes').select('id,created_at,grand_total,status,customer_name,currency').gte('created_at', cutoffStr + 'T00:00:00'),
        supabase.from('customers').select('id,name,source,created_at'),
        supabase.from('suppliers').select('id,name,source,created_at'),
        supabase.from('cash_transactions').select('id,direction,amount,category,person,tx_date,is_settled').gte('tx_date', cutoffStr),
      ]);

      // is_faturasiz kolonunu ayrÄ± sorgula â€” SQL migration Ã§alÄ±ÅŸtÄ±rÄ±lmadÄ±ysa hata yakalanÄ±r
      let custFatMap = {}, suppFatMap = {};
      try {
        const [cf, sf] = await Promise.all([
          supabase.from('customers').select('id,is_faturasiz'),
          supabase.from('suppliers').select('id,is_faturasiz'),
        ]);
        (cf.data || []).forEach(c => { custFatMap[c.id] = c.is_faturasiz || false; });
        (sf.data || []).forEach(s => { suppFatMap[s.id] = s.is_faturasiz || false; });
      } catch (_) { /* kolonlar henÃ¼z yoksa sessizce geÃ§ */ }

      setInvoices(invR.data || []);
      setOrders(ordR.data || []);
      setQuotes(qR.data || []);
      setCustomers((custR.data || []).map(c => ({ ...c, is_faturasiz: custFatMap[c.id] || false })));
      setSuppliers((suppR.data || []).map(s => ({ ...s, is_faturasiz: suppFatMap[s.id] || false })));
      setCashTxs(cashR.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // â”€â”€ Fatura Analizleri â”€â”€
  const months = lastNMonths(period);

  const invoicesByMonth = useMemo(() => {
    const outbox = invoices.filter(i => i.type === 'outbox');
    return months.map(m => ({
      label: monthLabel(m),
      v1: outbox.filter(i => monthKey(i.issue_date) === m).reduce((s,i) => s + (Number(i.amount)||0), 0),
      count: outbox.filter(i => monthKey(i.issue_date) === m).length,
    }));
  }, [invoices, months]);

  const inboxByMonth = useMemo(() => {
    const inbox = invoices.filter(i => i.type === 'inbox');
    return months.map(m => ({
      label: monthLabel(m),
      v1: inbox.filter(i => monthKey(i.issue_date) === m).reduce((s,i) => s + (Number(i.amount)||0), 0),
    }));
  }, [invoices, months]);

  const totalOutboxAmount = invoices.filter(i=>i.type==='outbox').reduce((s,i)=>s+Number(i.amount||0),0);
  const totalInboxAmount  = invoices.filter(i=>i.type==='inbox').reduce((s,i)=>s+Number(i.amount||0),0);
  const lastMonthOutbox   = invoices.filter(i=>i.type==='outbox' && monthKey(i.issue_date) === months[months.length-1]).reduce((s,i)=>s+Number(i.amount||0),0);
  const prevMonthOutbox   = invoices.filter(i=>i.type==='outbox' && monthKey(i.issue_date) === months[months.length-2]).reduce((s,i)=>s+Number(i.amount||0),0);
  const invoiceTrend      = prevMonthOutbox > 0 ? ((lastMonthOutbox - prevMonthOutbox) / prevMonthOutbox) * 100 : 0;

  // Status daÄŸÄ±lÄ±mÄ±
  const invStatusSlices = ['Approved','Processing','Canceled','Error'].map(s => ({
    label: s === 'Approved' ? 'OnaylÄ±' : s === 'Canceled' ? 'Ä°ptal' : s === 'Processing' ? 'Ä°ÅŸlemde' : 'HatalÄ±',
    value: invoices.filter(i=>i.type==='outbox' && i.status===s).length,
    color: s==='Approved'?'#10b981':s==='Canceled'?'#ef4444':s==='Processing'?'#f59e0b':'#64748b',
  })).filter(s=>s.value>0);

  // â”€â”€ SatÄ±ÅŸ (Orders) Analizleri â”€â”€
  const ordersByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: orders.filter(o => monthKey(o.created_at) === m).reduce((s,o) => s+Number(o.grand_total||0), 0),
    v2: orders.filter(o => monthKey(o.created_at) === m && o.status === 'completed').reduce((s,o) => s+Number(o.grand_total||0), 0),
  })), [orders, months]);

  const orderStatusSlices = ['completed','pending','cancelled'].map(s => ({
    label: s==='completed'?'TamamlandÄ±':s==='pending'?'Bekliyor':'Ä°ptal',
    value: orders.filter(o=>o.status===s).length,
    color: s==='completed'?'#10b981':s==='pending'?'#f59e0b':'#ef4444',
  })).filter(s=>s.value>0);

  const totalOrderAmount  = orders.reduce((s,o)=>s+Number(o.grand_total||0),0);
  const completedOrders   = orders.filter(o=>o.status==='completed').length;

  // â”€â”€ Teklif (Quotes) Analizleri â”€â”€
  const quotesByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: quotes.filter(q => monthKey(q.created_at) === m).length,
    v2: quotes.filter(q => monthKey(q.created_at) === m && q.status === 'accepted').length,
  })), [quotes, months]);

  const quoteConversion = quotes.length > 0
    ? ((quotes.filter(q=>q.status==='accepted').length / quotes.length) * 100).toFixed(1)
    : '0';

  const quoteStatusSlices = ['draft','sent','accepted','rejected'].map(s => ({
    label: s==='draft'?'Taslak':s==='sent'?'GÃ¶nderildi':s==='accepted'?'Kabul':'Reddedildi',
    value: quotes.filter(q=>q.status===s).length,
    color: s==='draft'?'#64748b':s==='sent'?'#3b82f6':s==='accepted'?'#10b981':'#ef4444',
  })).filter(s=>s.value>0);

  // â”€â”€ FaturasÄ±z Cari/TedarikÃ§i â”€â”€
  const faturasizCust = customers.filter(c => c.is_faturasiz);
  const faturasizSupp = suppliers.filter(s => s.is_faturasiz);
  const normalCust    = customers.filter(c => !c.is_faturasiz);
  const normalSupp    = suppliers.filter(s => !s.is_faturasiz);

  // Bu mÃ¼ÅŸterilerle yapÄ±lan satÄ±ÅŸlar
  const faturasizCustNames = new Set(faturasizCust.map(c => c.name));
  const faturasizOrderAmt  = orders.filter(o => faturasizCustNames.has(o.customer_name)).reduce((s,o)=>s+Number(o.grand_total||0),0);
  const faturasizQuoteAmt  = quotes.filter(q => faturasizCustNames.has(q.customer_name)).reduce((s,q)=>s+Number(q.grand_total||0),0);

  // â”€â”€ Kasa Analizleri â”€â”€
  const openCash   = cashTxs.filter(t=>!t.is_settled);
  const cashOut    = openCash.filter(t=>t.direction==='out').reduce((s,t)=>s+t.amount,0);
  const cashIn     = openCash.filter(t=>t.direction==='in').reduce((s,t)=>s+t.amount,0);
  const cashByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: openCash.filter(t=>t.direction==='out' && monthKey(t.tx_date)===m).reduce((s,t)=>s+t.amount,0),
    v2: openCash.filter(t=>t.direction==='in'  && monthKey(t.tx_date)===m).reduce((s,t)=>s+t.amount,0),
  })), [cashTxs, months]);

  // â”€â”€ Tab YapÄ±sÄ± â”€â”€
  const TABS = [
    { id:'genel',    label:'Genel',      icon: BarChart2   },
    { id:'fatura',   label:'Faturalar',  icon: Receipt     },
    { id:'satis',    label:'SatÄ±ÅŸ',      icon: ShoppingCart},
    { id:'teklif',   label:'Teklifler',  icon: FileText    },
    { id:'karsi',    label:'Cariler',    icon: Users       },
    { id:'kasa',     label:'Kasa',       icon: Wallet      },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* â”€â”€ BaÅŸlÄ±k â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl" style={{ background: `${currentColor}18` }}>
            <BarChart2 size={22} style={{ color: currentColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Raporlar</h1>
            <p className="text-sm text-slate-500 mt-0.5">Finansal analitik & iÅŸ zekasÄ±</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button onClick={load}
            className="p-2 rounded-xl transition-colors text-slate-500 hover:text-slate-200"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* â”€â”€ Tab Bar â”€â”€ */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: activeTab === t.id ? currentColor : 'transparent',
              color: activeTab === t.id ? '#fff' : '#94a3b8',
            }}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin" style={{ color: currentColor }} />
        </div>
      ) : (
        <>
          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              GENEL BAKIÅ
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {activeTab === 'genel' && (
            <div className="space-y-6">
              {/* KPI'lar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Toplam SatÄ±ÅŸ Cirosu" value={`â‚º${fmtK(totalOutboxAmount)}`} icon={TrendingUp} color="#10b981" trend={invoiceTrend} delay={0.0} />
                <KpiCard label="Toplam SipariÅŸ" value={fmt(orders.length)} sub={`${completedOrders} tamamlandÄ±`} icon={ShoppingCart} color="#3b82f6" delay={0.07} />
                <KpiCard label="Teklif DÃ¶nÃ¼ÅŸÃ¼mÃ¼" value={`%${quoteConversion}`} sub={`${quotes.filter(q=>q.status==='accepted').length}/${quotes.length} kabul`} icon={FileText} color="#8b5cf6" delay={0.14} />
                <KpiCard label="Aktif FaturasÄ±z Cari" value={faturasizCust.length + faturasizSupp.length} sub="genel + tedarikÃ§i" icon={AlertTriangle} color="#f59e0b" delay={0.21} />
              </div>

              {/* Fatura + SipariÅŸ yan yana */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-5">
                  <SectionTitle icon={Receipt} title="AylÄ±k SatÄ±ÅŸ FaturalarÄ± (TL)" color="#10b981" />
                  <BarChart data={invoicesByMonth} color="#10b981" />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={ShoppingCart} title="AylÄ±k SipariÅŸ TutarÄ±" color="#3b82f6" label1="Toplam" label2="Tamamlanan" />
                  <BarChart data={ordersByMonth} color="#3b82f6" color2="#10b981" label1="Toplam" label2="Tamamlanan" />
                </div>
              </div>

              {/* Durum daÄŸÄ±lÄ±mlarÄ± */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="glass-card p-5">
                  <SectionTitle icon={Receipt} title="Fatura DurumlarÄ±" color="#10b981" />
                  <DonutChart slices={invStatusSlices.length ? invStatusSlices : [{label:'Veri yok', value:1, color:'#334155'}]} />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={ShoppingCart} title="SipariÅŸ DurumlarÄ±" color="#3b82f6" />
                  <DonutChart slices={orderStatusSlices.length ? orderStatusSlices : [{label:'Veri yok', value:1, color:'#334155'}]} />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={FileText} title="Teklif DurumlarÄ±" color="#8b5cf6" />
                  <DonutChart slices={quoteStatusSlices.length ? quoteStatusSlices : [{label:'Veri yok', value:1, color:'#334155'}]} />
                </div>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              FATURA RAPORLARI
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {activeTab === 'fatura' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Toplam Giden Fatura" value={invoices.filter(i=>i.type==='outbox').length} icon={Receipt} color="#10b981" delay={0} />
                <KpiCard label="Giden Ciro (TL)" value={`â‚º${fmtK(totalOutboxAmount)}`} icon={TrendingUp} color="#10b981" trend={invoiceTrend} delay={0.07} />
                <KpiCard label="Toplam Gelen Fatura" value={invoices.filter(i=>i.type==='inbox').length} icon={Receipt} color="#f97316" delay={0.14} />
                <KpiCard label="Gelen Gider (TL)" value={`â‚º${fmtK(totalInboxAmount)}`} icon={TrendingDown} color="#f97316" delay={0.21} />
              </div>

              {/* AylÄ±k giden */}
              <div className="glass-card p-5">
                <SectionTitle icon={Receipt} title="AylÄ±k Giden Fatura Cirosu (TL)" sub="Uyumsoft Ã¼zerinden gÃ¶nderilen faturalar" color="#10b981" />
                <BarChart data={invoicesByMonth} color="#10b981" />
                {/* Ay tablosu */}
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                        {['Ay','Fatura SayÄ±sÄ±','Tutar (TL)'].map(h => (
                          <th key={h} className="py-2 px-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesByMonth.slice().reverse().map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                          <td className="py-2 px-3 text-slate-300 font-semibold">{row.label}</td>
                          <td className="py-2 px-3 text-slate-400">{row.count || 0}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: '#10b981' }}>â‚º{fmt(row.v1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AylÄ±k gelen */}
              <div className="glass-card p-5">
                <SectionTitle icon={Receipt} title="AylÄ±k Gelen Fatura Gideri (TL)" sub="TedarikÃ§ilerden alÄ±nan faturalar" color="#f97316" />
                <BarChart data={inboxByMonth} color="#f97316" />
              </div>

              {/* Durum + MÃ¼ÅŸteri daÄŸÄ±lÄ±mÄ± */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="glass-card p-5">
                  <SectionTitle icon={PieChart} title="Fatura Durum DaÄŸÄ±lÄ±mÄ±" color="#8b5cf6" />
                  <DonutChart slices={invStatusSlices.length ? invStatusSlices : [{label:'Veri yok', value:1, color:'#334155'}]} />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={Users} title="En Ã‡ok Faturalananlar (Top 5)" color="#3b82f6" />
                  {(() => {
                    const byName = {};
                    invoices.filter(i=>i.type==='outbox').forEach(i => {
                      byName[i.cari_name||'Bilinmeyen'] = (byName[i.cari_name||'Bilinmeyen']||0) + Number(i.amount||0);
                    });
                    return Object.entries(byName)
                      .sort((a,b)=>b[1]-a[1]).slice(0,5)
                      .map(([name,amt],i) => (
                        <div key={i} className="flex items-center justify-between py-2"
                          style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                          <span className="text-xs text-slate-300 truncate flex-1 mr-2">{name}</span>
                          <span className="text-xs font-bold" style={{ color: currentColor }}>â‚º{fmtK(amt)}</span>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              SATIÅ RAPORLARI
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {activeTab === 'satis' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Toplam SipariÅŸ" value={orders.length} icon={ShoppingCart} color="#3b82f6" delay={0} />
                <KpiCard label="Toplam Ciro" value={`â‚º${fmtK(totalOrderAmount)}`} icon={TrendingUp} color="#3b82f6" delay={0.07} />
                <KpiCard label="Tamamlanan" value={completedOrders} sub={`${orders.length > 0 ? ((completedOrders/orders.length)*100).toFixed(0) : 0}% oranÄ±`} icon={Receipt} color="#10b981" delay={0.14} />
                <KpiCard label="Ort. SipariÅŸ TutarÄ±" value={orders.length ? `â‚º${fmtK(totalOrderAmount/orders.length)}` : 'â‚º0'} icon={BarChart2} color="#8b5cf6" delay={0.21} />
              </div>

              <div className="glass-card p-5">
                <SectionTitle icon={ShoppingCart} title="AylÄ±k SipariÅŸ Cirosu" color="#3b82f6" />
                <BarChart data={ordersByMonth} color="#3b82f6" color2="#10b981" label1="Toplam" label2="Tamamlanan" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="glass-card p-5">
                  <SectionTitle icon={PieChart} title="SipariÅŸ Durum DaÄŸÄ±lÄ±mÄ±" color="#3b82f6" />
                  <DonutChart slices={orderStatusSlices.length ? orderStatusSlices : [{label:'Veri yok',value:1,color:'#334155'}]} />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={Users} title="En Ã‡ok SipariÅŸ Veren MÃ¼ÅŸteriler (Top 5)" color="#10b981" />
                  {(() => {
                    const byName = {};
                    orders.forEach(o => {
                      byName[o.customer_name||'Bilinmeyen'] = (byName[o.customer_name||'Bilinmeyen']||0) + Number(o.grand_total||0);
                    });
                    return Object.entries(byName).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amt],i) => (
                      <div key={i} className="flex items-center justify-between py-2"
                        style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                        <span className="text-xs text-slate-300 truncate flex-1 mr-2">{name}</span>
                        <span className="text-xs font-bold" style={{ color: currentColor }}>â‚º{fmtK(amt)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              TEKLÄ°F RAPORLARI
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {activeTab === 'teklif' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Toplam Teklif" value={quotes.length} icon={FileText} color="#8b5cf6" delay={0} />
                <KpiCard label="Kabul Edilen" value={quotes.filter(q=>q.status==='accepted').length} icon={TrendingUp} color="#10b981" delay={0.07} />
                <KpiCard label="DÃ¶nÃ¼ÅŸÃ¼m OranÄ±" value={`%${quoteConversion}`} icon={BarChart2} color="#f59e0b" delay={0.14} />
                <KpiCard label="Reddedilen" value={quotes.filter(q=>q.status==='rejected').length} icon={TrendingDown} color="#ef4444" delay={0.21} />
              </div>

              <div className="glass-card p-5">
                <SectionTitle icon={FileText} title="AylÄ±k Teklif SayÄ±sÄ±" sub="Mavi = toplam / YeÅŸil = kabul edilen" color="#8b5cf6" />
                <BarChart data={quotesByMonth} color="#8b5cf6" color2="#10b981" label1="Toplam" label2="Kabul" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="glass-card p-5">
                  <SectionTitle icon={PieChart} title="Teklif Durum DaÄŸÄ±lÄ±mÄ±" color="#8b5cf6" />
                  <DonutChart slices={quoteStatusSlices.length ? quoteStatusSlices : [{label:'Veri yok',value:1,color:'#334155'}]} />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={Users} title="Teklif Verilen MÃ¼ÅŸteriler (Top 5)" color="#8b5cf6" />
                  {(() => {
                    const byName = {};
                    quotes.forEach(q => {
                      byName[q.customer_name||'Bilinmeyen'] = (byName[q.customer_name||'Bilinmeyen']||0) + 1;
                    });
                    return Object.entries(byName).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count],i) => (
                      <div key={i} className="flex items-center justify-between py-2"
                        style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                        <span className="text-xs text-slate-300 truncate flex-1 mr-2">{name}</span>
                        <span className="text-xs font-bold" style={{ color: currentColor }}>{count} teklif</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              CARÄ° / TEDARÄ°KÃ‡Ä° RAPORLARI (FaturasÄ±z ayrÄ±mÄ±)
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {activeTab === 'karsi' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Toplam Cari" value={customers.length} sub={`${normalCust.length} normal / ${faturasizCust.length} faturasÄ±z`} icon={Users} color="#3b82f6" delay={0} />
                <KpiCard label="Toplam TedarikÃ§i" value={suppliers.length} sub={`${normalSupp.length} normal / ${faturasizSupp.length} faturasÄ±z`} icon={Building2} color="#f97316" delay={0.07} />
                <KpiCard label="FaturasÄ±z Ciro" value={`â‚º${fmtK(faturasizOrderAmt)}`} sub="faturasÄ±z carilerle sipariÅŸ" icon={AlertTriangle} color="#f59e0b" delay={0.14} />
                <KpiCard label="FaturasÄ±z Teklif" value={`â‚º${fmtK(faturasizQuoteAmt)}`} sub="faturasÄ±z carilerle teklif" icon={FileText} color="#8b5cf6" delay={0.21} />
              </div>

              {/* FaturasÄ±z Cariler */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <h3 className="text-sm font-bold text-slate-100">FaturasÄ±z Cariler</h3>
                  <span className="ml-auto text-xs text-amber-400 font-bold">{faturasizCust.length} kayÄ±t</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">Bu carilerle yapÄ±lan iÅŸlemler e-fatura dÄ±ÅŸÄ±nda tutulur.</p>
                {faturasizCust.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-6">HenÃ¼z faturasÄ±z cari eklenmemiÅŸ.</p>
                ) : (
                  <div className="space-y-1.5">
                    {faturasizCust.map(c => {
                      const cOrders = orders.filter(o=>o.customer_name===c.name);
                      const cQuotes = quotes.filter(q=>q.customer_name===c.name);
                      const cAmt = cOrders.reduce((s,o)=>s+Number(o.grand_total||0),0);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-xl"
                          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                            <p className="text-[10px] text-slate-500">{cOrders.length} sipariÅŸ Â· {cQuotes.length} teklif</p>
                          </div>
                          <p className="text-sm font-bold text-amber-400">â‚º{fmtK(cAmt)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FaturasÄ±z TedarikÃ§iler */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  <h3 className="text-sm font-bold text-slate-100">FaturasÄ±z TedarikÃ§iler</h3>
                  <span className="ml-auto text-xs text-orange-400 font-bold">{faturasizSupp.length} kayÄ±t</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">Fatura almadan Ã§alÄ±ÅŸÄ±lan tedarik iliÅŸkileri.</p>
                {faturasizSupp.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-6">HenÃ¼z faturasÄ±z tedarikÃ§i eklenmemiÅŸ.</p>
                ) : (
                  <div className="space-y-1.5">
                    {faturasizSupp.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
                        <p className="text-sm font-semibold text-slate-200">{s.name}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>FaturasÄ±z</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Normal vs FaturasÄ±z */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="glass-card p-5">
                  <SectionTitle icon={PieChart} title="Cari Tipi DaÄŸÄ±lÄ±mÄ±" color="#3b82f6" />
                  <DonutChart slices={[
                    { label: 'Normal Cari',    value: normalCust.length,    color: '#3b82f6' },
                    { label: 'FaturasÄ±z',      value: faturasizCust.length, color: '#f59e0b' },
                    { label: 'Fatura Senkronu',value: customers.filter(c=>c.source==='invoice_sync').length, color: '#10b981' },
                  ].filter(s=>s.value>0)} />
                </div>
                <div className="glass-card p-5">
                  <SectionTitle icon={PieChart} title="TedarikÃ§i Tipi DaÄŸÄ±lÄ±mÄ±" color="#f97316" />
                  <DonutChart slices={[
                    { label: 'Normal TedarikÃ§i', value: normalSupp.length,    color: '#f97316' },
                    { label: 'FaturasÄ±z',         value: faturasizSupp.length, color: '#f59e0b' },
                  ].filter(s=>s.value>0)} />
                </div>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              KASA RAPORLARI
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {activeTab === 'kasa' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Toplam Gider" value={`â‚º${fmtK(cashOut)}`} icon={TrendingDown} color="#ef4444" delay={0} />
                <KpiCard label="Toplam Gelir" value={`â‚º${fmtK(cashIn)}`} icon={TrendingUp} color="#10b981" delay={0.07} />
                <KpiCard label="Net Bakiye" value={`${cashIn-cashOut>=0?'+':''}â‚º${fmtK(Math.abs(cashIn-cashOut))}`} icon={Wallet} color={cashIn-cashOut>=0?'#10b981':'#ef4444'} delay={0.14} />
                <KpiCard label="KayÄ±t SayÄ±sÄ±" value={cashTxs.length} icon={BarChart2} color="#8b5cf6" delay={0.21} />
              </div>

              <div className="glass-card p-5">
                <SectionTitle icon={Wallet} title="AylÄ±k Kasa Hareketi" sub="KÄ±rmÄ±zÄ± = gider / YeÅŸil = gelir" color="#ef4444" />
                <BarChart data={cashByMonth} color="#ef4444" color2="#10b981" label1="Gider" label2="Gelir" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Kategori daÄŸÄ±lÄ±mÄ± */}
                <div className="glass-card p-5">
                  <SectionTitle icon={PieChart} title="Gider Kategori DaÄŸÄ±lÄ±mÄ±" color="#ef4444" />
                  {(() => {
                    const CATS = {maas:'MaaÅŸ',avans:'Avans',kargo:'Kargo',market:'Market',cay_kahve:'Ã‡ay/Kahve',akaryakit:'AkaryakÄ±t',diger:'DiÄŸer'};
                    const COLS = {maas:'#8b5cf6',avans:'#3b82f6',kargo:'#f97316',market:'#10b981',cay_kahve:'#f59e0b',akaryakit:'#ef4444',diger:'#64748b'};
                    const slices = Object.entries(CATS).map(([id,label]) => ({
                      label,
                      value: openCash.filter(t=>t.direction==='out'&&t.category===id).reduce((s,t)=>s+t.amount,0),
                      color: COLS[id],
                    })).filter(s=>s.value>0);
                    return <DonutChart slices={slices.length?slices:[{label:'Veri yok',value:1,color:'#334155'}]} />;
                  })()}
                </div>

                {/* KiÅŸi bazlÄ± */}
                <div className="glass-card p-5">
                  <SectionTitle icon={Users} title="KiÅŸi BazlÄ± Gider (Top 5)" color="#8b5cf6" />
                  {(() => {
                    const byPerson = {};
                    openCash.filter(t=>t.direction==='out'&&t.person).forEach(t => {
                      byPerson[t.person] = (byPerson[t.person]||0) + t.amount;
                    });
                    const entries = Object.entries(byPerson).sort((a,b)=>b[1]-a[1]).slice(0,5);
                    if (entries.length === 0) return (
                      <p className="text-xs text-slate-600 text-center py-6">KiÅŸi bazlÄ± kasa kaydÄ± yok.</p>
                    );
                    return entries.map(([name,amt],i) => (
                      <div key={i} className="flex items-center justify-between py-2"
                        style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                        <span className="text-xs text-slate-300 font-semibold">{name}</span>
                        <span className="text-xs font-bold" style={{ color: '#ef4444' }}>â‚º{fmtK(amt)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

