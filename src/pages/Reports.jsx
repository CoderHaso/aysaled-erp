import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, FileText, ShoppingCart, Users, Building2,
  Loader2, RefreshCw, BarChart2, PieChart, Receipt, Wallet,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart, DonutChart, KpiCard, SectionTitle, TopList,
  fmt, fmtK, monthKey, monthLabel, lastNMonths,
} from '../components/ReportCharts';

// ─── Yardimcilar ─────────────────────────────────────────────────────────────
const EMPTY_DONUT = [{ label: 'Veri yok', value: 1, color: '#1e293b' }];

function groupByMonth(items, months, valueKey) {
  return months.map(m => ({
    label: monthLabel(m),
    v1: items.filter(x => monthKey(x.created_at || x.issue_date || x.tx_date) === m)
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

// ─── Period Selector ─────────────────────────────────────────────────────────
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
          {n === 6 ? '6 Ay' : n === 12 ? '12 Ay' : '2 Yil'}
        </button>
      ))}
    </div>
  );
}

// ─── Sub-tab bar ─────────────────────────────────────────────────────────────
function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b mb-4" style={{ borderColor: 'rgba(148,163,184,0.1)' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className="px-3 py-1.5 text-xs font-semibold transition-all rounded-t-lg"
          style={{
            color: active === t ? '#fff' : '#64748b',
            background: active === t ? 'rgba(255,255,255,0.08)' : 'transparent',
            borderBottom: active === t ? '2px solid var(--color-primary)' : '2px solid transparent',
          }}>{t}</button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const { currentColor } = useTheme();
  const [period, setPeriod]       = useState(12);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('genel');

  const [invoices,  setInvoices]  = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [quotes,    setQuotes]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cashTxs,   setCashTxs]  = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - period);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      // Quotes tarihsiz cekip client-side filtrele (tablo created_at tipi belirsiz)
      const [invR, ordR, qR, custR, suppR, cashR] = await Promise.all([
        supabase.from('invoices').select('invoice_id,issue_date,amount,currency,status,type,cari_name,vkntckn'),
        supabase.from('orders').select('id,created_at,grand_total,status,customer_name,customer_id').gte('created_at', cutoffStr + 'T00:00:00Z'),
        supabase.from('quotes').select('id,created_at,grand_total,status,customer_name,currency'),
        supabase.from('customers').select('id,name,source,created_at'),
        supabase.from('suppliers').select('id,name,source,created_at'),
        supabase.from('cash_transactions').select('id,direction,amount,category,person,tx_date,is_settled').gte('tx_date', cutoffStr),
      ]);

      // is_faturasiz kolonunu ayri cek (migration olmayabilir)
      let custFatMap = {}, suppFatMap = {};
      try {
        const [cf, sf] = await Promise.all([
          supabase.from('customers').select('id,is_faturasiz'),
          supabase.from('suppliers').select('id,is_faturasiz'),
        ]);
        (cf.data || []).forEach(c => { custFatMap[c.id] = !!c.is_faturasiz; });
        (sf.data || []).forEach(s => { suppFatMap[s.id] = !!s.is_faturasiz; });
      } catch (_) {}

      setInvoices(invR.data || []);
      setOrders(ordR.data || []);

      // Quotes client-side tarih filtresi
      const allQ = qR.data || [];
      const cutoffMs = cutoff.getTime();
      setQuotes(allQ.filter(q => q.created_at ? new Date(q.created_at).getTime() >= cutoffMs : true));

      setCustomers((custR.data || []).map(c => ({ ...c, is_faturasiz: custFatMap[c.id] || false })));
      setSuppliers((suppR.data || []).map(s => ({ ...s, is_faturasiz: suppFatMap[s.id] || false })));
      setCashTxs(cashR.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => lastNMonths(period), [period]);

  // ── Fatura Hesaplamalari ──
  const outbox    = invoices.filter(i => i.type === 'outbox');
  const inbox     = invoices.filter(i => i.type === 'inbox');
  const outActive = outbox.filter(i => i.status !== 'Canceled' && i.status !== 'Error');
  const outCancel = outbox.filter(i => i.status === 'Canceled');
  const outboxByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: outActive.filter(i => monthKey(i.issue_date) === m).reduce((s, i) => s + Number(i.amount || 0), 0),
    v2: outCancel.filter(i => monthKey(i.issue_date) === m).reduce((s, i) => s + Number(i.amount || 0), 0),
  })), [invoices, months]);
  const totalOutbox  = outActive.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalInbox   = inbox.reduce((s, i) => s + Number(i.amount || 0), 0);

  // ── Siparis Hesaplamalari ──
  const activeOrders    = orders.filter(o => o.status !== 'cancelled');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalOrderAmt   = activeOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);

  // Faturali/Faturasiz siparis ayrimi
  const faturasizCustIds = new Set(customers.filter(c => c.is_faturasiz).map(c => c.id));
  const faturasizCustNames = new Set(customers.filter(c => c.is_faturasiz).map(c => c.name));
  const ordersFaturali  = activeOrders.filter(o => !faturasizCustIds.has(o.customer_id) && !faturasizCustNames.has(o.customer_name));
  const ordersFaturasiz = activeOrders.filter(o => faturasizCustIds.has(o.customer_id) || faturasizCustNames.has(o.customer_name));
  const ordersByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: activeOrders.filter(o => monthKey(o.created_at) === m).reduce((s, o) => s + Number(o.grand_total || 0), 0),
    v2: completedOrders.filter(o => monthKey(o.created_at) === m).reduce((s, o) => s + Number(o.grand_total || 0), 0),
  })), [orders, months]);

  // ── Teklif Hesaplamalari ──
  const activeQuotes = quotes.filter(q => q.status !== 'rejected');
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
  const rejectedQuotes = quotes.filter(q => q.status === 'rejected');
  const convRate = quotes.length > 0 ? ((acceptedQuotes.length / quotes.length) * 100).toFixed(1) : '0';
  const quotesByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: quotes.filter(q => monthKey(q.created_at) === m).length,
    v2: acceptedQuotes.filter(q => monthKey(q.created_at) === m).length,
  })), [quotes, months]);

  // ── Kasa ──
  const openCash = cashTxs.filter(t => !t.is_settled);
  const cashOut  = openCash.filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0);
  const cashIn   = openCash.filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
  const cashByMonth = useMemo(() => months.map(m => ({
    label: monthLabel(m),
    v1: openCash.filter(t => t.direction === 'out' && monthKey(t.tx_date) === m).reduce((s, t) => s + t.amount, 0),
    v2: openCash.filter(t => t.direction === 'in'  && monthKey(t.tx_date) === m).reduce((s, t) => s + t.amount, 0),
  })), [cashTxs, months]);

  // ── Cari/Tedarikci ──
  const normalCust   = customers.filter(c => !c.is_faturasiz);
  const fatCust      = customers.filter(c => c.is_faturasiz);
  const normalSupp   = suppliers.filter(s => !s.is_faturasiz);
  const fatSupp      = suppliers.filter(s => s.is_faturasiz);

  // Trend (onceki ay vs bu ay outbox)
  const lastM    = months[months.length - 1];
  const prevM    = months[months.length - 2];
  const lastMAmt = outActive.filter(i => monthKey(i.issue_date) === lastM).reduce((s, i) => s + Number(i.amount || 0), 0);
  const prevMAmt = outActive.filter(i => monthKey(i.issue_date) === prevM).reduce((s, i) => s + Number(i.amount || 0), 0);
  const invTrend = prevMAmt > 0 ? ((lastMAmt - prevMAmt) / prevMAmt) * 100 : 0;

  // ── Tabs ──
  const TABS = [
    { id: 'genel',   label: 'Genel',       icon: BarChart2    },
    { id: 'fatura',  label: 'Faturalar',   icon: Receipt      },
    { id: 'satis',   label: 'Satis',       icon: ShoppingCart },
    { id: 'teklif',  label: 'Teklifler',   icon: FileText     },
    { id: 'karsi',   label: 'Cariler',     icon: Users        },
    { id: 'tedarik', label: 'Tedarikciler',icon: Building2    },
    { id: 'kasa',    label: 'Kasa',        icon: Wallet       },
  ];

  // ── Render ──
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">

      {/* Baslik */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl" style={{ background: `${currentColor}18` }}>
            <BarChart2 size={20} style={{ color: currentColor }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Raporlar</h1>
            <p className="text-xs text-slate-500">Finansal analitik ve is zekasi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button onClick={load} className="p-2 rounded-xl text-slate-500 hover:text-slate-200"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: activeTab === t.id ? currentColor : 'transparent',
              color: activeTab === t.id ? '#fff' : '#94a3b8',
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
          {/* ═══════ GENEL ═══════ */}
          {activeTab === 'genel' && <GenelTab
            currentColor={currentColor} totalOutbox={totalOutbox} totalOrderAmt={totalOrderAmt}
            activeOrders={activeOrders} completedOrders={completedOrders} convRate={convRate}
            fatCust={fatCust} fatSupp={fatSupp} invTrend={invTrend}
            outboxByMonth={outboxByMonth} ordersByMonth={ordersByMonth}
            outActive={outActive} activeQuotes={activeQuotes} acceptedQuotes={acceptedQuotes}
            ordersFaturali={ordersFaturali} ordersFaturasiz={ordersFaturasiz}
          />}

          {/* ═══════ FATURA ═══════ */}
          {activeTab === 'fatura' && <FaturaTab
            currentColor={currentColor} outActive={outActive} outCancel={outCancel}
            inbox={inbox} outbox={outbox} outboxByMonth={outboxByMonth}
            totalOutbox={totalOutbox} totalInbox={totalInbox} invTrend={invTrend}
            months={months}
          />}

          {/* ═══════ SATIS ═══════ */}
          {activeTab === 'satis' && <SatisTab
            currentColor={currentColor} activeOrders={activeOrders} cancelledOrders={cancelledOrders}
            completedOrders={completedOrders} totalOrderAmt={totalOrderAmt}
            ordersByMonth={ordersByMonth} ordersFaturali={ordersFaturali}
            ordersFaturasiz={ordersFaturasiz}
          />}

          {/* ═══════ TEKLIF ═══════ */}
          {activeTab === 'teklif' && <TeklifTab
            currentColor={currentColor} quotes={quotes} acceptedQuotes={acceptedQuotes}
            rejectedQuotes={rejectedQuotes} activeQuotes={activeQuotes}
            convRate={convRate} quotesByMonth={quotesByMonth}
          />}

          {/* ═══════ CARILER ═══════ */}
          {activeTab === 'karsi' && <CariTab
            currentColor={currentColor} customers={customers} normalCust={normalCust}
            fatCust={fatCust} orders={activeOrders} quotes={activeQuotes}
            faturasizCustNames={faturasizCustNames}
          />}

          {/* ═══════ TEDARIKCILER ═══════ */}
          {activeTab === 'tedarik' && <TedarikTab
            currentColor={currentColor} suppliers={suppliers} normalSupp={normalSupp}
            fatSupp={fatSupp} inbox={inbox}
          />}

          {/* ═══════ KASA ═══════ */}
          {activeTab === 'kasa' && <KasaTab
            currentColor={currentColor} cashTxs={cashTxs} openCash={openCash}
            cashOut={cashOut} cashIn={cashIn} cashByMonth={cashByMonth}
          />}
        </>
      )}
    </div>
  );
}

// ─── GENEL TAB ───────────────────────────────────────────────────────────────
function GenelTab({ currentColor, totalOutbox, totalOrderAmt, activeOrders, completedOrders, convRate, fatCust, fatSupp, invTrend, outboxByMonth, ordersByMonth, outActive, activeQuotes, acceptedQuotes, ordersFaturali, ordersFaturasiz }) {
  const fatAmt = ordersFaturasiz.reduce((s, o) => s + Number(o.grand_total || 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Satis Cirosu" value={`TL ${fmtK(totalOutbox)}`} icon={TrendingUp} color="#10b981" trend={invTrend} />
        <KpiCard label="Siparis Cirosu" value={`TL ${fmtK(totalOrderAmt)}`} sub={`${completedOrders.length} tamamlandi`} icon={ShoppingCart} color="#3b82f6" />
        <KpiCard label="Teklif Donusumu" value={`%${convRate}`} sub={`${acceptedQuotes.length}/${activeQuotes.length + (activeQuotes.length - acceptedQuotes.length)} kabul`} icon={FileText} color="#8b5cf6" />
        <KpiCard label="Faturasiz Ciro" value={`TL ${fmtK(fatAmt)}`} sub={`${fatCust.length + fatSupp.length} kayit`} icon={AlertTriangle} color="#f59e0b" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title="Aylik Satis Cirosu (TL)" color="#10b981" />
          <BarChart data={outboxByMonth} color="#10b981" label1="Aktif" label2="Iptal" color2="#ef444440" unit="TL " />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={ShoppingCart} title="Aylik Siparis Cirosu" color="#3b82f6" />
          <BarChart data={ordersByMonth} color="#3b82f6" color2="#10b981" label1="Toplam" label2="Tamamlanan" unit="TL " />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4">
          <SectionTitle icon={ShoppingCart} title="Faturali / Faturasiz Satis" color="#3b82f6" />
          <DonutChart slices={[
            { label: 'Faturali', value: ordersFaturali.reduce((s, o) => s + Number(o.grand_total || 0), 0), color: '#3b82f6' },
            { label: 'Faturasiz', value: fatAmt, color: '#f59e0b' },
          ].filter(s => s.value > 0)} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={Users} title="Fatura Durumu Dagilimi" color="#10b981" />
          <DonutChart slices={['Approved', 'Processing', 'Canceled', 'Error'].map(s => ({
            label: s === 'Approved' ? 'Onaylandi' : s === 'Canceled' ? 'Iptal' : s === 'Processing' ? 'Islemde' : 'Hatali',
            value: outActive.filter(i => i.status === s).length || outboxByMonth.length,
            color: s === 'Approved' ? '#10b981' : s === 'Canceled' ? '#ef4444' : s === 'Processing' ? '#f59e0b' : '#64748b',
          })).filter(s => s.value > 0)} />
        </div>
      </div>
    </div>
  );
}

// ─── FATURA TAB ───────────────────────────────────────────────────────────────
function FaturaTab({ currentColor, outActive, outCancel, inbox, outbox, outboxByMonth, totalOutbox, totalInbox, invTrend, months }) {
  const [sub, setSub] = useState('Giden');
  const inboxByMonth = (months || []).map((m, i) => ({
    label: outboxByMonth[i]?.label || monthLabel(m),
    v1: inbox.filter(x => monthKey(x.issue_date) === m).reduce((s, x) => s + Number(x.amount || 0), 0),
  }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Aktif Giden Fatura" value={outActive.length} icon={Receipt} color="#10b981" trend={invTrend} />
        <KpiCard label="Giden Ciro" value={`TL ${fmtK(totalOutbox)}`} icon={TrendingUp} color="#10b981" />
        <KpiCard label="Iptal Fatura" value={outCancel.length} icon={AlertTriangle} color="#ef4444" />
        <KpiCard label="Gelen Gider" value={`TL ${fmtK(totalInbox)}`} icon={TrendingDown} color="#f97316" />
      </div>
      <SubTabs tabs={['Giden', 'Gelen', 'Iptal']} active={sub} onChange={setSub} />
      {sub === 'Giden' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={Receipt} title="Aylik Giden Fatura Cirosu" sub="Aktif faturalar" color="#10b981" />
            <BarChart data={outboxByMonth} color="#10b981" unit="TL " />
          </div>
          <div className="glass-card p-4">
            <SectionTitle icon={Users} title="En Cok Faturalananlar" color={currentColor} />
            <TopList color={currentColor} unit="TL " items={topN(outActive, 'cari_name', 'amount')} />
          </div>
        </div>
      )}
      {sub === 'Gelen' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title="Aylik Gelen Fatura Gideri" color="#f97316" />
          <BarChart data={inboxByMonth} color="#f97316" unit="TL " />
        </div>
      )}
      {sub === 'Iptal' && (
        <div className="space-y-3">
          <div className="glass-card p-4">
            <SectionTitle icon={AlertTriangle} title="Iptal Edilen Faturalar" color="#ef4444" />
            <p className="text-xs text-slate-500 mb-3">Bu faturalar cirolara dahil edilmemistir.</p>
            {outCancel.slice(0, 20).map((inv, i) => (
              <div key={i} className="flex justify-between items-center py-2"
                style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                <div>
                  <p className="text-xs font-mono text-blue-400">{inv.invoice_id}</p>
                  <p className="text-[10px] text-slate-500">{inv.cari_name} &middot; {inv.issue_date?.slice(0, 10)}</p>
                </div>
                <span className="text-xs font-bold text-red-400">TL {fmtK(inv.amount)}</span>
              </div>
            ))}
            {outCancel.length === 0 && <p className="text-xs text-slate-600 text-center py-6">Iptal fatura yok</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SATIS TAB ───────────────────────────────────────────────────────────────
function SatisTab({ currentColor, activeOrders, cancelledOrders, completedOrders, totalOrderAmt, ordersByMonth, ordersFaturali, ordersFaturasiz }) {
  const [sub, setSub] = useState('Ozet');
  const fataliAmt = ordersFaturali.reduce((s, o) => s + Number(o.grand_total || 0), 0);
  const fatasizAmt = ordersFaturasiz.reduce((s, o) => s + Number(o.grand_total || 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Aktif Siparis" value={activeOrders.length} icon={ShoppingCart} color="#3b82f6" />
        <KpiCard label="Toplam Ciro" value={`TL ${fmtK(totalOrderAmt)}`} icon={TrendingUp} color="#3b82f6" />
        <KpiCard label="Faturali Ciro" value={`TL ${fmtK(fataliAmt)}`} icon={Receipt} color="#10b981" />
        <KpiCard label="Faturasiz Ciro" value={`TL ${fmtK(fatasizAmt)}`} icon={AlertTriangle} color="#f59e0b" />
      </div>
      <SubTabs tabs={['Ozet', 'Faturali', 'Faturasiz', 'Iptal']} active={sub} onChange={setSub} />
      {sub === 'Ozet' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={ShoppingCart} title="Aylik Siparis Cirosu" color="#3b82f6" />
            <BarChart data={ordersByMonth} color="#3b82f6" color2="#10b981" label1="Toplam" label2="Tamamlanan" unit="TL " />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <SectionTitle icon={PieChart} title="Faturali / Faturasiz Dagilim" color={currentColor} />
              <DonutChart slices={[
                { label: 'Faturali', value: fataliAmt, color: '#3b82f6' },
                { label: 'Faturasiz', value: fatasizAmt, color: '#f59e0b' },
              ].filter(s => s.value > 0)} />
            </div>
            <div className="glass-card p-4">
              <SectionTitle icon={Users} title="En Cok Siparis Veren" color={currentColor} />
              <TopList color={currentColor} unit="TL " items={topN(activeOrders, 'customer_name', 'grand_total')} />
            </div>
          </div>
        </div>
      )}
      {sub === 'Faturali' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title={`Faturali Siparisler — TL ${fmtK(fataliAmt)}`} color="#10b981" />
          <TopList color="#10b981" unit="TL " items={topN(ordersFaturali, 'customer_name', 'grand_total')} />
        </div>
      )}
      {sub === 'Faturasiz' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Faturasiz Siparisler — TL ${fmtK(fatasizAmt)}`} color="#f59e0b" />
          <p className="text-[11px] text-slate-500 mb-3">Faturasiz cari olarak isaretlenenlerin siparisleri</p>
          <TopList color="#f59e0b" unit="TL " items={topN(ordersFaturasiz, 'customer_name', 'grand_total')} />
        </div>
      )}
      {sub === 'Iptal' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Iptal Siparisler (${cancelledOrders.length})`} color="#ef4444" />
          <p className="text-xs text-slate-500 mb-3">Bu siparisler cirolara ve istatistiklere dahil edilmemistir.</p>
          {cancelledOrders.slice(0, 20).map((o, i) => (
            <div key={i} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
              <div>
                <p className="text-xs font-semibold text-slate-300">{o.customer_name || 'Bilinmeyen'}</p>
                <p className="text-[10px] text-slate-500">{o.created_at?.slice(0, 10)}</p>
              </div>
              <span className="text-xs font-bold text-red-400">TL {fmtK(o.grand_total)}</span>
            </div>
          ))}
          {cancelledOrders.length === 0 && <p className="text-xs text-slate-600 text-center py-6">Iptal siparis yok</p>}
        </div>
      )}
    </div>
  );
}

// ─── TEKLIF TAB ───────────────────────────────────────────────────────────────
function TeklifTab({ currentColor, quotes, acceptedQuotes, rejectedQuotes, activeQuotes, convRate, quotesByMonth }) {
  const [sub, setSub] = useState('Ozet');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Teklif" value={quotes.length} icon={FileText} color="#8b5cf6" />
        <KpiCard label="Kabul Edilen" value={acceptedQuotes.length} icon={TrendingUp} color="#10b981" />
        <KpiCard label="Donusum Orani" value={`%${convRate}`} icon={BarChart2} color="#f59e0b" />
        <KpiCard label="Reddedilen" value={rejectedQuotes.length} icon={TrendingDown} color="#ef4444" />
      </div>
      <SubTabs tabs={['Ozet', 'Reddedilenler']} active={sub} onChange={setSub} />
      {sub === 'Ozet' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <SectionTitle icon={FileText} title="Aylik Teklif Sayisi" sub="Mor = toplam, Yesil = kabul" color="#8b5cf6" />
            <BarChart data={quotesByMonth} color="#8b5cf6" color2="#10b981" label1="Toplam" label2="Kabul" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <SectionTitle icon={PieChart} title="Teklif Durum Dagilimi" color="#8b5cf6" />
              <DonutChart slices={[
                { label: 'Taslak',      value: quotes.filter(q => q.status === 'draft').length,    color: '#64748b' },
                { label: 'Gonderildi', value: quotes.filter(q => q.status === 'sent').length,     color: '#3b82f6' },
                { label: 'Kabul',       value: acceptedQuotes.length,                              color: '#10b981' },
                { label: 'Reddedildi', value: rejectedQuotes.length,                              color: '#ef4444' },
              ].filter(s => s.value > 0)} />
            </div>
            <div className="glass-card p-4">
              <SectionTitle icon={Users} title="En Cok Teklif Verilen" color={currentColor} />
              <TopList color={currentColor} items={topN(quotes, 'customer_name', 'grand_total')} unit="TL " />
            </div>
          </div>
        </div>
      )}
      {sub === 'Reddedilenler' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Reddedilen Teklifler (${rejectedQuotes.length})`} color="#ef4444" />
          <p className="text-[11px] text-slate-500 mb-3">Ana metriklere dahil edilmemistir.</p>
          {rejectedQuotes.slice(0, 20).map((q, i) => (
            <div key={i} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
              <div>
                <p className="text-xs font-semibold text-slate-300">{q.customer_name || 'Bilinmeyen'}</p>
                <p className="text-[10px] text-slate-500">{q.created_at?.slice(0, 10)}</p>
              </div>
              <span className="text-xs font-bold text-red-400">TL {fmtK(q.grand_total)}</span>
            </div>
          ))}
          {rejectedQuotes.length === 0 && <p className="text-xs text-slate-600 text-center py-6">Reddedilen teklif yok</p>}
        </div>
      )}
    </div>
  );
}

// ─── CARI TAB ────────────────────────────────────────────────────────────────
function CariTab({ currentColor, customers, normalCust, fatCust, orders, quotes, faturasizCustNames }) {
  const [sub, setSub] = useState('Faturali');
  const fataliOrders  = orders.filter(o => !faturasizCustNames.has(o.customer_name));
  const fatasizOrders = orders.filter(o => faturasizCustNames.has(o.customer_name));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Cari" value={customers.length} icon={Users} color="#3b82f6" />
        <KpiCard label="Faturali" value={normalCust.length} icon={Receipt} color="#10b981" />
        <KpiCard label="Faturasiz" value={fatCust.length} icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="Faturasiz Ciro" value={`TL ${fmtK(fatasizOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0))}`} icon={TrendingUp} color="#f59e0b" />
      </div>
      <SubTabs tabs={['Faturali', 'Faturasiz', 'Dagilim']} active={sub} onChange={setSub} />
      {sub === 'Faturali' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title={`Faturali Cariler (${normalCust.length})`} color="#10b981" />
          <TopList color="#10b981" unit="TL " items={topN(fataliOrders, 'customer_name', 'grand_total')} />
        </div>
      )}
      {sub === 'Faturasiz' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Faturasiz Cariler (${fatCust.length})`} color="#f59e0b" />
          <p className="text-[11px] text-slate-500 mb-3">Bu carilerle yapilan islemler e-fatura disinda tutulur.</p>
          {fatCust.length === 0 && <p className="text-xs text-slate-600 text-center py-6">Faturasiz cari yok</p>}
          {fatCust.map(c => {
            const cOrders = orders.filter(o => o.customer_name === c.name);
            const cAmt = cOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
            return (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl mb-2"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                  <p className="text-[10px] text-slate-500">{cOrders.length} siparis</p>
                </div>
                <p className="text-sm font-bold text-amber-400">TL {fmtK(cAmt)}</p>
              </div>
            );
          })}
        </div>
      )}
      {sub === 'Dagilim' && (
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Cari Tip Dagilimi" color={currentColor} />
          <DonutChart slices={[
            { label: 'Faturali (Manuel)', value: normalCust.filter(c => c.source === 'manual').length, color: '#3b82f6' },
            { label: 'Faturadan Senkron',  value: customers.filter(c => c.source === 'invoice_sync').length, color: '#10b981' },
            { label: 'Faturasiz',          value: fatCust.length, color: '#f59e0b' },
          ].filter(s => s.value > 0)} />
        </div>
      )}
    </div>
  );
}

// ─── TEDARIKCI TAB ────────────────────────────────────────────────────────────
function TedarikTab({ currentColor, suppliers, normalSupp, fatSupp, inbox }) {
  const [sub, setSub] = useState('Faturali');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Tedarikci" value={suppliers.length} icon={Building2} color="#f97316" />
        <KpiCard label="Faturali" value={normalSupp.length} icon={Receipt} color="#10b981" />
        <KpiCard label="Faturasiz" value={fatSupp.length} icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="Gelen Fatura Gideri" value={`TL ${fmtK(inbox.reduce((s, i) => s + Number(i.amount || 0), 0))}`} icon={TrendingDown} color="#f97316" />
      </div>
      <SubTabs tabs={['Faturali', 'Faturasiz', 'Dagilim']} active={sub} onChange={setSub} />
      {sub === 'Faturali' && (
        <div className="glass-card p-4">
          <SectionTitle icon={Receipt} title={`Faturali Tedarikciler (${normalSupp.length})`} color="#10b981" />
          <TopList color="#10b981" unit="TL " items={topN(inbox, 'cari_name', 'amount')} />
        </div>
      )}
      {sub === 'Faturasiz' && (
        <div className="glass-card p-4">
          <SectionTitle icon={AlertTriangle} title={`Faturasiz Tedarikciler (${fatSupp.length})`} color="#f59e0b" />
          {fatSupp.length === 0 && <p className="text-xs text-slate-600 text-center py-6">Faturasiz tedarikci yok</p>}
          {fatSupp.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl mb-2"
              style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <p className="text-sm font-semibold text-slate-200">{s.name}</p>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Faturasiz</span>
            </div>
          ))}
        </div>
      )}
      {sub === 'Dagilim' && (
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Tedarikci Tip Dagilimi" color={currentColor} />
          <DonutChart slices={[
            { label: 'Normal',    value: normalSupp.length, color: '#f97316' },
            { label: 'Faturasiz', value: fatSupp.length,    color: '#f59e0b' },
          ].filter(s => s.value > 0)} />
        </div>
      )}
    </div>
  );
}

// ─── KASA TAB ────────────────────────────────────────────────────────────────
function KasaTab({ currentColor, cashTxs, openCash, cashOut, cashIn, cashByMonth }) {
  const CATS = { maas: 'Maas', avans: 'Avans', kargo: 'Kargo', market: 'Market', cay_kahve: 'Cay/Kahve', akaryakit: 'Akaryakit', diger: 'Diger' };
  const COLS = { maas: '#8b5cf6', avans: '#3b82f6', kargo: '#f97316', market: '#10b981', cay_kahve: '#f59e0b', akaryakit: '#ef4444', diger: '#64748b' };
  const catSlices = Object.entries(CATS).map(([id, label]) => ({
    label, value: openCash.filter(t => t.direction === 'out' && t.category === id).reduce((s, t) => s + t.amount, 0), color: COLS[id],
  })).filter(s => s.value > 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Toplam Gider" value={`TL ${fmtK(cashOut)}`} icon={TrendingDown} color="#ef4444" />
        <KpiCard label="Toplam Gelir" value={`TL ${fmtK(cashIn)}`} icon={TrendingUp} color="#10b981" />
        <KpiCard label="Net Bakiye" value={`${cashIn - cashOut >= 0 ? '+' : ''}TL ${fmtK(Math.abs(cashIn - cashOut))}`} icon={Wallet} color={cashIn - cashOut >= 0 ? '#10b981' : '#ef4444'} />
        <KpiCard label="Kayit Sayisi" value={cashTxs.length} icon={BarChart2} color="#8b5cf6" />
      </div>
      <div className="glass-card p-4">
        <SectionTitle icon={Wallet} title="Aylik Kasa Hareketi" sub="Kirmizi = gider, Yesil = gelir" color="#ef4444" />
        <BarChart data={cashByMonth} color="#ef4444" color2="#10b981" label1="Gider" label2="Gelir" unit="TL " />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle icon={PieChart} title="Gider Kategori Dagilimi" color="#ef4444" />
          <DonutChart slices={catSlices.length ? catSlices : EMPTY_DONUT} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle icon={Users} title="Kisi Bazli Gider (Top 5)" color="#8b5cf6" />
          <TopList color="#8b5cf6" unit="TL "
            items={topN(openCash.filter(t => t.direction === 'out' && t.person), 'person', 'amount')} />
        </div>
      </div>
    </div>
  );
}
