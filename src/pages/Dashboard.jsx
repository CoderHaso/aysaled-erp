import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight,
  Package, Users, FileText, CreditCard, ShoppingCart, Plus, Search,
  Bell, BellRing, AlertTriangle, CheckCircle2, Clock, ChevronRight, ChevronDown,
  Loader2, RefreshCw, CalendarClock, TrendingUp, BarChart3, Filter, X,
  Receipt, Wallet, DollarSign, Percent, PieChart, ListFilter, User,
  Calculator, Tag, ArrowDown, ArrowUp, Minus, Eye, Printer,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { printDocument } from '../lib/printService';
import { useFxRates } from '../hooks/useFxRates';
import QuickCostCalculator from '../components/calculator/QuickCostCalculator';
import { trNorm } from '../lib/trNorm';

const CUR_SYM = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n) => n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
const fmtInt = (n) => n != null ? Number(n).toLocaleString('tr-TR') : '0';

const MONTHS = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
];

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

const REPORT_MODES = [
  { id: 'ozet',       label: 'Özet',       icon: PieChart,    color: '#3b82f6' },
  { id: 'receteli',   label: 'Reçeteli (İş Emirli)', icon: Package, color: '#8b5cf6' },
  { id: 'hammadde',   label: 'Hammadde',   icon: Tag,         color: '#f59e0b' },
  { id: 'faturali',   label: 'Faturalı',   icon: Receipt,     color: '#10b981' },
  { id: 'faturasiz',  label: 'Faturasız',  icon: FileText,    color: '#ef4444' },
  { id: 'kdv',        label: 'KDV',        icon: Percent,     color: '#06b6d4' },
  { id: 'kar',        label: 'Kâr',        icon: TrendingUp,  color: '#22c55e' },
];

const QUICK_ACTIONS = [
  { n: 'Satış Yap',  icon: ShoppingCart, color: '#3b82f6', to: '/sales',             state: { openNew: true } },
  { n: 'Stok Ekle',  icon: Plus,         color: '#f59e0b', to: '/stock',             state: { openQuickAdd: true } },
  { n: 'Cari Ara',   icon: Search,       color: '#10b981', to: '/contacts',          state: {} },
  { n: 'Fatura Kes', icon: FileText,     color: '#8b5cf6', to: '/incoming-invoices', state: { openCreate: true } },
];

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, color, trend, isDark }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 border transition-transform hover:-translate-y-0.5"
      style={{
        background: isDark ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.9)',
        borderColor: isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0',
        backdropFilter: 'blur(10px)',
      }}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-xl" style={{ background: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className="text-[10px] font-bold flex items-center gap-0.5"
            style={{ color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
            {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{sub}</p>}
    </motion.div>
  );
}

/* ─── Report Table ────────────────────────────────────────────────────────── */
function ReportTable({ columns, rows, isDark, emptyText = 'Veri bulunamadı' }) {
  const c = {
    headerBg: isDark ? 'rgba(30,41,59,0.7)' : '#f1f5f9',
    rowHover: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    border: isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0',
    text: isDark ? '#e2e8f0' : '#1e293b',
    muted: isDark ? '#94a3b8' : '#64748b',
  };
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: c.border }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: c.headerBg }}>
              {columns.map((col, i) => (
                <th key={i} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                  style={{ color: c.muted }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-sm" style={{ color: c.muted }}>
                <Filter size={28} className="mx-auto mb-2 opacity-30" />
                {emptyText}
              </td></tr>
            ) : rows.map((row, ri) => (
              <tr key={ri} className="border-t transition-colors"
                style={{ borderColor: c.border }}
                onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {columns.map((col, ci) => (
                  <td key={ci} className={`px-4 py-3 text-xs ${col.align === 'right' ? 'text-right font-mono' : ''} ${col.bold ? 'font-semibold' : ''}`}
                    style={{ color: col.color?.(row) || c.text }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && columns.some(c => c.total) && (
            <tfoot>
              <tr className="border-t-2 font-bold" style={{ background: c.headerBg, borderColor: c.border }}>
                {columns.map((col, i) => (
                  <td key={i} className={`px-4 py-3 text-xs ${col.align === 'right' ? 'text-right font-mono' : ''}`}
                    style={{ color: c.text }}>
                    {i === 0 ? 'TOPLAM' : col.total ? fmt(rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0)) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ─── Ana Dashboard ───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const navigate = useNavigate();
  const { convert } = useFxRates();
  
  const [calcOpen, setCalcOpen] = useState(false);

  // State
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [mode, setMode] = useState('ozet');
  const [personId, setPersonId] = useState(''); // uuid or ''
  const [personType, setPersonType] = useState('all'); // 'all' | 'customer' | 'supplier'
  const [personSearch, setPersonSearch] = useState('');
  const [personOpen, setPersonOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [invoicesIn, setInvoicesIn] = useState([]);
  const [invoicesOut, setInvoicesOut] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipeItems, setRecipeItems] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);

  const c = {
    bg: 'var(--bg-app)',
    card: isDark ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.9)',
    border: isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    subBg: isDark ? 'rgba(30,41,59,0.6)' : '#f1f5f9',
  };

  // Date range for selected month
  const startDate = useMemo(() => new Date(year, month, 1).toISOString(), [year, month]);
  const endDate = useMemo(() => new Date(year, month + 1, 0, 23, 59, 59).toISOString(), [year, month]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, oiRes, invInRes, invOutRes, custRes, suppRes, itmRes, recRes, riRes, woRes] = await Promise.all([
        supabase.from('orders')
          .select('id, order_number, customer_id, customer_name, customer_vkntckn, status, currency, subtotal, tax_total, grand_total, is_invoiced, created_at')
          .gte('created_at', startDate).lte('created_at', endDate)
          .not('status', 'eq', 'cancelled'),
        supabase.from('order_items')
          .select('id, order_id, item_id, item_name, item_type, quantity, unit, unit_price, tax_rate, notes, cost_at_sale, cost_currency, cost_details'),
        supabase.from('invoices')
          .select('id, invoice_id, cari_name, vkntckn, amount, tax_exclusive_amount, tax_total, currency, exchange_rate, status, issue_date, is_iade')
          .eq('type', 'inbox')
          .gte('issue_date', startDate.slice(0, 10)).lte('issue_date', endDate.slice(0, 10)),
        supabase.from('invoices')
          .select('id, invoice_id, cari_name, vkntckn, amount, tax_exclusive_amount, tax_total, currency, exchange_rate, status, issue_date, is_iade')
          .eq('type', 'outbox')
          .gte('issue_date', startDate.slice(0, 10)).lte('issue_date', endDate.slice(0, 10)),
        supabase.from('customers').select('id, name, vkntckn, is_faturasiz'),
        supabase.from('suppliers').select('id, name, vkntckn, is_faturasiz'),
        supabase.from('items').select('id, name, item_type, purchase_price, sale_price, base_currency, sale_currency, unit, has_bom'),
        supabase.from('product_recipes').select('id, product_id, name, is_default'),
        supabase.from('recipe_items').select('id, recipe_id, item_id, item_name, quantity, unit'),
        supabase.from('work_orders')
          .select('id, item_id, item_name, order_id, quantity, status, created_at')
          .gte('created_at', startDate).lte('created_at', endDate),
      ]);

      setOrders(ordRes.data || []);
      const ois = oiRes.data || [];
      // Only keep order_items that belong to fetched orders
      const orderIds = new Set((ordRes.data || []).map(o => o.id));
      setOrderItems(ois.filter(oi => orderIds.has(oi.order_id)));
      setInvoicesIn(invInRes.data || []);
      setInvoicesOut(invOutRes.data || []);
      setCustomers(custRes.data || []);
      setSuppliers(suppRes.data || []);
      setItems(itmRes.data || []);
      setRecipes(recRes.data || []);
      setRecipeItems(riRes.data || []);
      setWorkOrders(woRes.data || []);
    } catch (e) {
      console.error('[Dashboard] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build lookup maps
  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  const recipeMap = useMemo(() => {
    const m = {};
    recipes.forEach(r => { if (!m[r.product_id]) m[r.product_id] = []; m[r.product_id].push(r); });
    return m;
  }, [recipes]);

  // Person list for selector
  const personList = useMemo(() => {
    const list = [];
    if (personType === 'all' || personType === 'customer') {
      customers.forEach(c => list.push({ id: c.id, name: c.name, type: 'customer', faturasiz: c.is_faturasiz }));
    }
    if (personType === 'all' || personType === 'supplier') {
      suppliers.forEach(s => list.push({ id: s.id, name: s.name, type: 'supplier', faturasiz: s.is_faturasiz }));
    }
    const q = trNorm(personSearch);
    return q ? list.filter(p => trNorm(p.name).includes(q)) : list;
  }, [customers, suppliers, personType, personSearch]);

  const selectedPerson = useMemo(() =>
    personList.find(p => p.id === personId) || null
  , [personList, personId]);

  // Filtered orders by person
  const filteredOrders = useMemo(() => {
    if (!personId) return orders;
    return orders.filter(o => o.customer_id === personId);
  }, [orders, personId]);

  const filteredOrderItems = useMemo(() => {
    const ids = new Set(filteredOrders.map(o => o.id));
    return orderItems.filter(oi => ids.has(oi.order_id));
  }, [filteredOrders, orderItems]);

  // Helper: is item a recipe product
  const isRecipeProduct = (itemId) => !!recipeMap[itemId];

  // Helper: cost of a recipe product (sum of raw materials * purchase_price, converted to TRY)
  const recipeCost = (itemId) => {
    const recs = recipeMap[itemId];
    if (!recs || recs.length === 0) return 0;
    const defaultRec = recs.find(r => r.is_default) || recs[0];
    const rItems = recipeItems.filter(ri => ri.recipe_id === defaultRec.id);
    return rItems.reduce((sum, ri) => {
      const raw = itemMap[ri.item_id];
      const rawCost = (ri.quantity || 0) * (raw?.purchase_price || 0);
      const rawCur = raw?.base_currency || 'TRY';
      return sum + convert(rawCost, rawCur, 'TRY');
    }, 0);
  };

  // ── RENDER MODES ──────────────────────────────────────────────────────────

  const renderOzet = () => {
    const totalSales = filteredOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const totalTax = filteredOrders.reduce((s, o) => s + Number(o.tax_total || 0), 0);
    const orderCount = filteredOrders.length;
    const invoicedCount = filteredOrders.filter(o => o.is_invoiced).length;
    const noInvoiceCount = orderCount - invoicedCount;
    const productItems = filteredOrderItems.filter(oi => oi.item_type === 'product' || isRecipeProduct(oi.item_id));
    const rawItems = filteredOrderItems.filter(oi => oi.item_type === 'raw' || oi.item_type === 'rawmaterial');
    const gelenKdv = invoicesIn.reduce((s, inv) => s + Number(inv.tax_total || 0), 0);
    const gidenKdv = invoicesOut.reduce((s, inv) => s + Number(inv.tax_total || 0), 0);

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Toplam Satış" value={`₺${fmt(totalSales)}`} icon={ShoppingCart} color="#3b82f6" isDark={isDark}
            sub={`${orderCount} sipariş`} />
          <StatCard label="Faturalı" value={fmtInt(invoicedCount)} sub={`₺${fmt(filteredOrders.filter(o => o.is_invoiced).reduce((s,o) => s + Number(o.grand_total || 0), 0))}`}
            icon={Receipt} color="#10b981" isDark={isDark} />
          <StatCard label="Faturasız" value={fmtInt(noInvoiceCount)} sub={`₺${fmt(filteredOrders.filter(o => !o.is_invoiced).reduce((s,o) => s + Number(o.grand_total || 0), 0))}`}
            icon={FileText} color="#ef4444" isDark={isDark} />
          <StatCard label="KDV (Gelen-Giden)" value={`₺${fmt(gelenKdv - gidenKdv)}`}
            sub={`Gelen: ₺${fmt(gelenKdv)} · Giden: ₺${fmt(gidenKdv)}`}
            icon={Percent} color="#06b6d4" isDark={isDark} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <StatCard label="Reçeteli Ürün Satışı" value={fmtInt(productItems.reduce((s,oi) => s + Number(oi.quantity || 0), 0))}
            sub={`${new Set(productItems.map(oi => oi.item_id)).size} farklı ürün`}
            icon={Package} color="#8b5cf6" isDark={isDark} />
          <StatCard label="Hammadde Satışı" value={fmtInt(rawItems.reduce((s,oi) => s + Number(oi.quantity || 0), 0))}
            sub={`${new Set(rawItems.map(oi => oi.item_id)).size} farklı hammadde`}
            icon={Tag} color="#f59e0b" isDark={isDark} />
        </div>
        {/* Satış kalemleri — sipariş bazlı */}
        {(() => {
          const orderLookup = Object.fromEntries(filteredOrders.map(o => [o.id, o]));
          const typeLabels = {
            receteli:  '📦 Reçeteli',
            recetesiz: '🏷️ Reçetesiz',
            hammadde:  '🧪 Hammadde',
            kayitsiz:  '📌 Kayıtsız',
          };
          const typeColors = {
            receteli:  '#8b5cf6',
            recetesiz: '#3b82f6',
            hammadde:  '#f59e0b',
            kayitsiz:  '#94a3b8',
          };
          const rows = filteredOrderItems.map(oi => {
            const order = orderLookup[oi.order_id];
            const stockItem = itemMap[oi.item_id];
            let realType = 'kayitsiz';
            let stockSource = '';
            if (stockItem) {
              stockSource = stockItem.name;
              if (stockItem.item_type === 'raw' || stockItem.item_type === 'rawmaterial') {
                realType = 'hammadde';
              } else if (stockItem.item_type === 'product' && (stockItem.has_bom || isRecipeProduct(oi.item_id))) {
                realType = 'receteli';
              } else {
                realType = 'recetesiz';
              }
            } else if (oi.item_type) {
              if (oi.item_type === 'product') {
                realType = isRecipeProduct(oi.item_id) ? 'receteli' : 'recetesiz';
              } else if (oi.item_type === 'raw' || oi.item_type === 'rawmaterial') {
                realType = 'hammadde';
              }
            }
            return {
              name: oi.item_name,
              orderNo: order?.order_number || '',
              customer: order?.customer_name || '',
              invoiced: order?.is_invoiced ? '✅' : '❌',
              realType,
              stockSource,
              qty: Number(oi.quantity || 0),
              revenue: Number(oi.quantity || 0) * Number(oi.unit_price || 0),
            };
          });
          const sorted = rows.sort((a, b) => b.revenue - a.revenue);
          return (
            <ReportTable isDark={isDark} emptyText="Bu ay sipariş yok"
              columns={[
                { label: 'Ürün', key: 'name', bold: true },
                { label: 'Sipariş No', key: 'orderNo',
                  color: r => r.orderNo ? '#3b82f6' : '#94a3b8',
                  render: r => r.orderNo || '—' },
                { label: 'Müşteri', key: 'customer', render: r => r.customer || '—' },
                { label: 'Faturalı', key: 'invoiced', align: 'center' },
                { label: 'Tür', key: 'realType', render: r => typeLabels[r.realType] || r.realType,
                  color: r => typeColors[r.realType] || '#64748b' },
                { label: 'Miktar', key: 'qty', align: 'right', render: r => fmtInt(r.qty) },
                { label: 'Tutar', key: 'revenue', align: 'right', total: true, render: r => `₺${fmt(r.revenue)}` },
              ]}
              rows={sorted}
            />
          );
        })()}
      </>
    );
  };

  const renderReceteli = () => {
    // İş emirlerinden ürün bazlı gruplama
    const statusLabels = { pending: '⏳ Bekliyor', in_progress: '⚡ Üretimde', completed: '✅ Tamamlandı', cancelled: '❌ İptal' };
    const orderMap = Object.fromEntries(filteredOrders.map(o => [o.id, o]));
    // Satır bazlı gösterim — her iş emri bir satır
    const rows = workOrders.map(wo => {
      const order = orderMap[wo.order_id];
      const stockItem = itemMap[wo.item_id];
      return {
        product: stockItem?.name || wo.item_name || 'Bilinmeyen',
        orderNo: order?.order_number || '',
        customer: order?.customer_name || '',
        qty: Number(wo.quantity || 1),
        status: wo.status,
        statusLabel: statusLabels[wo.status] || wo.status,
        isAdHoc: !wo.item_id,
        date: wo.created_at ? new Date(wo.created_at).toLocaleDateString('tr-TR') : '',
      };
    });
    const sorted = rows.sort((a, b) => {
      const order = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
    // Özet kartları
    const pending = workOrders.filter(w => w.status === 'pending').length;
    const inProg = workOrders.filter(w => w.status === 'in_progress').length;
    const done = workOrders.filter(w => w.status === 'completed').length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Toplam İş Emri" value={fmtInt(workOrders.length)} icon={Package} color="#8b5cf6" isDark={isDark} />
          <StatCard label="Bekleyen" value={fmtInt(pending)} icon={Clock} color="#f59e0b" isDark={isDark} />
          <StatCard label="Üretimde" value={fmtInt(inProg)} icon={RefreshCw} color="#3b82f6" isDark={isDark} />
          <StatCard label="Tamamlanan" value={fmtInt(done)} icon={CheckCircle2} color="#22c55e" isDark={isDark} />
        </div>
        <ReportTable isDark={isDark} emptyText="Bu ay iş emri yok"
          columns={[
            { label: 'Ürün', key: 'product', bold: true,
              render: r => r.isAdHoc ? `📌 ${r.product}` : r.product },
            { label: 'Sipariş No', key: 'orderNo', render: r => r.orderNo || '—',
              color: r => r.orderNo ? '#3b82f6' : '#94a3b8' },
            { label: 'Müşteri', key: 'customer', render: r => r.customer || '—' },
            { label: 'Miktar', key: 'qty', align: 'right', total: true, render: r => fmtInt(r.qty) },
            { label: 'Durum', key: 'statusLabel',
              color: r => r.status === 'completed' ? '#22c55e' : r.status === 'in_progress' ? '#3b82f6' : r.status === 'cancelled' ? '#ef4444' : '#f59e0b' },
            { label: 'Tarih', key: 'date' },
          ]}
          rows={sorted}
        />
      </div>
    );
  };

  const renderHammadde = () => {
    const grouped = {};
    filteredOrderItems.forEach(oi => {
      if (oi.item_type !== 'raw' && oi.item_type !== 'rawmaterial') return;
      const key = oi.item_id || oi.item_name;
      const itm = itemMap[oi.item_id];
      if (!grouped[key]) grouped[key] = {
        name: oi.item_name, qty: 0, revenue: 0,
        purchasePrice: itm?.purchase_price || 0,
        currency: itm?.base_currency || 'TRY',
        recordedCost: 0, hasRecordedCost: false,
      };
      grouped[key].qty += Number(oi.quantity || 0);
      grouped[key].revenue += Number(oi.quantity || 0) * Number(oi.unit_price || 0);
      // Use cost_at_sale if recorded
      if (oi.cost_at_sale > 0) {
        grouped[key].recordedCost += oi.cost_at_sale * Number(oi.quantity || 0);
        grouped[key].hasRecordedCost = true;
      }
    });
    Object.values(grouped).forEach(g => {
      // Prefer cost_at_sale if available (recorded at time of sale)
      if (g.hasRecordedCost) {
        g.cost = g.recordedCost;
      } else {
        // Fallback: convert current purchase price to TRY
        g.cost = convert(g.purchasePrice * g.qty, g.currency, 'TRY');
      }
      g.profit = g.revenue - g.cost;
    });
    const sorted = Object.values(grouped).sort((a, b) => b.revenue - a.revenue);
    return (
      <ReportTable isDark={isDark} emptyText="Bu ay hammadde satışı yok"
        columns={[
          { label: 'Hammadde', key: 'name', bold: true },
          { label: 'Miktar', key: 'qty', align: 'right', render: r => fmtInt(r.qty) },
          { label: 'Birim Alış', key: 'purchasePrice', align: 'right', render: r => `${CUR_SYM[r.currency] || '₺'}${fmt(r.purchasePrice)}` },
          { label: 'Maliyet', key: 'cost', align: 'right', total: true, render: r => `₺${fmt(r.cost)}` },
          { label: 'Satış', key: 'revenue', align: 'right', total: true, render: r => `₺${fmt(r.revenue)}` },
          { label: 'Kâr', key: 'profit', align: 'right', total: true,
            render: r => `₺${fmt(r.profit)}`,
            color: r => r.profit >= 0 ? '#22c55e' : '#ef4444' },
        ]}
        rows={sorted}
      />
    );
  };

  const renderFaturali = () => {
    // Giden faturalar (iptal/taslak hariç, gerçek faturalar)
    const validInvoicesOut = invoicesOut.filter(inv => inv.cari_name && inv.status !== 'cancelled' && inv.status !== 'draft');
    // Faturalı siparişler
    const invOrders = filteredOrders.filter(o => o.is_invoiced);

    // Fatura → sipariş eşleştirmesi (cari_name / vkntckn üzerinden)
    const rows = [];
    const matchedOrderIds = new Set();
    const matchedInvIds = new Set();

    // 1) Her faturaya en yakın siparişi eşle
    validInvoicesOut.forEach(inv => {
      // vkntckn ile kesin eşleşme dene
      let matchedOrder = null;
      if (inv.vkntckn) {
        matchedOrder = invOrders.find(o =>
          !matchedOrderIds.has(o.id) && o.customer_vkntckn === inv.vkntckn
        );
      }
      // vkntckn yoksa cari_name ile dene
      if (!matchedOrder) {
        const invName = (inv.cari_name || '').toLowerCase().trim();
        matchedOrder = invOrders.find(o =>
          !matchedOrderIds.has(o.id) && (o.customer_name || '').toLowerCase().trim() === invName
        );
      }
      if (matchedOrder) {
        matchedOrderIds.add(matchedOrder.id);
        matchedInvIds.add(inv.id);
      }
      rows.push({
        cari: inv.cari_name,
        faturaNo: inv.invoice_id || '',
        siparisNo: matchedOrder?.order_number || '',
        total: Number(inv.amount || 0),
        tax: Number(inv.tax_total || 0),
        source: matchedOrder ? 'linked' : 'invoice_only',
        date: inv.issue_date || '',
      });
    });

    // 2) Eşleşmemiş faturalı siparişleri ekle
    invOrders.forEach(o => {
      if (matchedOrderIds.has(o.id)) return;
      rows.push({
        cari: o.customer_name,
        faturaNo: '',
        siparisNo: o.order_number || '',
        total: Number(o.grand_total || 0),
        tax: Number(o.tax_total || 0),
        source: 'order_only',
        date: o.created_at ? o.created_at.slice(0, 10) : '',
      });
    });

    const sorted = rows.sort((a, b) => b.total - a.total);
    const totalAmt = sorted.reduce((s, r) => s + r.total, 0);
    const totalTax = sorted.reduce((s, r) => s + r.tax, 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Giden Fatura" value={fmtInt(validInvoicesOut.length)} icon={ArrowUp} color="#10b981" isDark={isDark} />
          <StatCard label="Faturalı Sipariş" value={fmtInt(invOrders.length)} icon={Receipt} color="#3b82f6" isDark={isDark} />
          <StatCard label="Toplam Tutar" value={`₺${fmt(totalAmt)}`} sub={`KDV: ₺${fmt(totalTax)}`} icon={DollarSign} color="#8b5cf6" isDark={isDark} />
        </div>
        <ReportTable isDark={isDark} emptyText="Bu ay faturalı kayıt yok"
          columns={[
            { label: 'Cari / Müşteri', key: 'cari', bold: true },
            { label: 'Fatura No', key: 'faturaNo',
              render: r => r.faturaNo || '—',
              color: r => r.faturaNo ? '#10b981' : '#94a3b8' },
            { label: 'Sipariş No', key: 'siparisNo',
              render: r => r.siparisNo || '—',
              color: r => r.siparisNo ? '#3b82f6' : '#94a3b8' },
            { label: 'Tarih', key: 'date' },
            { label: 'KDV', key: 'tax', align: 'right', total: true, render: r => `₺${fmt(r.tax)}` },
            { label: 'Toplam', key: 'total', align: 'right', total: true, render: r => `₺${fmt(r.total)}` },
          ]}
          rows={sorted}
        />
      </div>
    );
  };

  const renderFaturasiz = () => {
    const noInvOrders = filteredOrders.filter(o => !o.is_invoiced);
    const grouped = {};
    noInvOrders.forEach(o => {
      const key = o.customer_id || o.customer_name;
      if (!grouped[key]) grouped[key] = { name: o.customer_name, count: 0, total: 0 };
      grouped[key].count++;
      grouped[key].total += Number(o.grand_total || 0);
    });
    const sorted = Object.values(grouped).sort((a, b) => b.total - a.total);
    return (
      <ReportTable isDark={isDark} emptyText="Bu ay faturasız satış yok"
        columns={[
          { label: 'Müşteri', key: 'name', bold: true },
          { label: 'Sipariş', key: 'count', align: 'right', render: r => fmtInt(r.count) },
          { label: 'Toplam', key: 'total', align: 'right', total: true, render: r => `₺${fmt(r.total)}` },
        ]}
        rows={sorted}
      />
    );
  };

  const renderKdv = () => {
    // Sadece geçerli (cari_name'i olan) faturaları al — taslak/iptal olanlar hariç
    const validIn = invoicesIn.filter(inv => inv.cari_name && inv.status !== 'cancelled' && inv.status !== 'draft');
    const validOut = invoicesOut.filter(inv => inv.cari_name && inv.status !== 'cancelled' && inv.status !== 'draft');

    // Gelen fatura (alış) KDV
    const gelenByMonth = {};
    validIn.forEach(inv => {
      const k = inv.cari_name;
      if (!gelenByMonth[k]) gelenByMonth[k] = { name: k, count: 0, taxExcl: 0, tax: 0, total: 0 };
      gelenByMonth[k].count++;
      gelenByMonth[k].taxExcl += Number(inv.tax_exclusive_amount || 0);
      gelenByMonth[k].tax += Number(inv.tax_total || 0);
      gelenByMonth[k].total += Number(inv.amount || 0);
    });
    // Giden fatura (satış) KDV
    const gidenByMonth = {};
    validOut.forEach(inv => {
      const k = inv.cari_name;
      if (!gidenByMonth[k]) gidenByMonth[k] = { name: k, count: 0, taxExcl: 0, tax: 0, total: 0 };
      gidenByMonth[k].count++;
      gidenByMonth[k].taxExcl += Number(inv.tax_exclusive_amount || 0);
      gidenByMonth[k].tax += Number(inv.tax_total || 0);
      gidenByMonth[k].total += Number(inv.amount || 0);
    });
    const totalGelenKdv = validIn.reduce((s, inv) => s + Number(inv.tax_total || 0), 0);
    const totalGidenKdv = validOut.reduce((s, inv) => s + Number(inv.tax_total || 0), 0);

    const cols = [
      { label: 'Cari', key: 'name', bold: true },
      { label: 'Fatura', key: 'count', align: 'right' },
      { label: 'Matrah', key: 'taxExcl', align: 'right', total: true, render: r => `₺${fmt(r.taxExcl)}` },
      { label: 'KDV', key: 'tax', align: 'right', total: true, render: r => `₺${fmt(r.tax)}`,
        color: () => '#06b6d4' },
      { label: 'Toplam', key: 'total', align: 'right', total: true, render: r => `₺${fmt(r.total)}` },
    ];

    return (
      <div className="space-y-6">
        {/* Özet kartlar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Gelen Fatura KDV" value={`₺${fmt(totalGelenKdv)}`}
            sub={`${validIn.length} fatura`} icon={ArrowDown} color="#ef4444" isDark={isDark} />
          <StatCard label="Giden Fatura KDV" value={`₺${fmt(totalGidenKdv)}`}
            sub={`${validOut.length} fatura`} icon={ArrowUp} color="#22c55e" isDark={isDark} />
          <StatCard label="Net KDV (Gelen-Giden)" value={`₺${fmt(totalGelenKdv - totalGidenKdv)}`}
            icon={Calculator} color={totalGelenKdv - totalGidenKdv >= 0 ? '#ef4444' : '#22c55e'} isDark={isDark} />
        </div>
        <div>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: c.text }}>
            <ArrowDown size={14} style={{ color: '#ef4444' }} /> Gelen (Alış) Faturaları — KDV Dökümü
          </h4>
          <ReportTable isDark={isDark} columns={cols} rows={Object.values(gelenByMonth).sort((a, b) => b.tax - a.tax)}
            emptyText="Gelen fatura yok" />
        </div>
        <div>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: c.text }}>
            <ArrowUp size={14} style={{ color: '#22c55e' }} /> Giden (Satış) Faturaları — KDV Dökümü
          </h4>
          <ReportTable isDark={isDark} columns={cols} rows={Object.values(gidenByMonth).sort((a, b) => b.tax - a.tax)}
            emptyText="Giden fatura yok" />
        </div>
      </div>
    );
  };

  const renderKar = () => {
    // Faturalı: satış KDV dişi - maliyet
    const faturaliOrders = filteredOrders.filter(o => o.is_invoiced);
    const faturasizOrders = filteredOrders.filter(o => !o.is_invoiced);

    const calcOrderCost = (ords) => {
      const ids = new Set(ords.map(o => o.id));
      const ois = orderItems.filter(oi => ids.has(oi.order_id));
      let cost = 0;
      ois.forEach(oi => {
        const qty = Number(oi.quantity || 0);
        // Prefer cost_at_sale if recorded at time of sale
        if (oi.cost_at_sale > 0) {
          cost += oi.cost_at_sale * qty;
        } else if (isRecipeProduct(oi.item_id)) {
          cost += recipeCost(oi.item_id) * qty;
        } else {
          const itm = itemMap[oi.item_id];
          const rawCur = itm?.base_currency || 'TRY';
          cost += convert((itm?.purchase_price || 0) * qty, rawCur, 'TRY');
        }
      });
      return cost;
    };

    const faturaliRevenue = faturaliOrders.reduce((s, o) => s + Number(o.subtotal || o.grand_total - o.tax_total || 0), 0);
    const faturaliTax = faturaliOrders.reduce((s, o) => s + Number(o.tax_total || 0), 0);
    const faturaliCost = calcOrderCost(faturaliOrders);
    const faturaliNet = faturaliRevenue - faturaliCost;

    const faturasizRevenue = faturasizOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const faturasizCost = calcOrderCost(faturasizOrders);
    const faturasizNet = faturasizRevenue - faturasizCost;

    const totalRevenue = faturaliRevenue + faturasizRevenue;
    const totalCost = faturaliCost + faturasizCost;
    const totalNet = faturaliNet + faturasizNet;

    const rows = [
      { label: 'Faturalı Satış (KDV Hariç)', revenue: faturaliRevenue, cost: faturaliCost, profit: faturaliNet },
      { label: 'Faturasız Satış', revenue: faturasizRevenue, cost: faturasizCost, profit: faturasizNet },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Toplam Ciro" value={`₺${fmt(totalRevenue)}`}
            sub={`Faturalı: ₺${fmt(faturaliRevenue)} · Faturasız: ₺${fmt(faturasizRevenue)}`}
            icon={DollarSign} color="#3b82f6" isDark={isDark} />
          <StatCard label="Toplam Maliyet" value={`₺${fmt(totalCost)}`}
            icon={Calculator} color="#f59e0b" isDark={isDark} />
          <StatCard label="Net Kâr" value={`₺${fmt(totalNet)}`}
            sub={totalRevenue > 0 ? `Marj: %${fmt((totalNet / totalRevenue) * 100)}` : ''}
            icon={TrendingUp} color={totalNet >= 0 ? '#22c55e' : '#ef4444'} isDark={isDark} />
        </div>
        <ReportTable isDark={isDark}
          columns={[
            { label: 'Kategori', key: 'label', bold: true },
            { label: 'Ciro', key: 'revenue', align: 'right', total: true, render: r => `₺${fmt(r.revenue)}` },
            { label: 'Maliyet', key: 'cost', align: 'right', total: true, render: r => `₺${fmt(r.cost)}` },
            { label: 'Net Kâr', key: 'profit', align: 'right', total: true,
              render: r => `₺${fmt(r.profit)}`,
              color: r => r.profit >= 0 ? '#22c55e' : '#ef4444' },
          ]}
          rows={rows}
        />
        {faturaliTax > 0 && (
          <div className="rounded-2xl p-4 border" style={{ background: c.card, borderColor: c.border }}>
            <p className="text-xs" style={{ color: c.muted }}>
              ℹ️ Faturalı satış kâr hesabında KDV (<strong>₺{fmt(faturaliTax)}</strong>) hariç tutulmuştur.
              Faturasız satışlarda KDV yoktur, toplam tutar üzerinden hesaplanmıştır.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (mode) {
      case 'ozet':      return renderOzet();
      case 'receteli':  return renderReceteli();
      case 'hammadde':  return renderHammadde();
      case 'faturali':  return renderFaturali();
      case 'faturasiz': return renderFaturasiz();
      case 'kdv':       return renderKdv();
      case 'kar':       return renderKar();
      default:          return renderOzet();
    }
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Başlık ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: c.text }}>
            Genel Bakış 📊
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: c.muted }}>
            Aylık raporlama ve analiz merkezi
          </p>
        </div>
        {/* Hızlı aksiyon butonları */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map((act, i) => (
            <button key={i} onClick={() => navigate(act.to, { state: act.state })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border"
              style={{ borderColor: c.border, color: act.color, background: act.color + '10' }}
              onMouseEnter={e => e.currentTarget.style.background = act.color + '20'}
              onMouseLeave={e => e.currentTarget.style.background = act.color + '10'}>
              <act.icon size={14} /> {act.n}
            </button>
          ))}
          <button onClick={() => setCalcOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border"
            style={{ borderColor: c.border, color: '#ec4899', background: '#ec489910' }}
            onMouseEnter={e => e.currentTarget.style.background = '#ec489920'}
            onMouseLeave={e => e.currentTarget.style.background = '#ec489910'}>
            <Calculator size={14} /> Maliyet Hesapla
          </button>
          <button onClick={() => {
            const grouped = {};
            filteredOrderItems.forEach(oi => {
              const key = oi.item_id || oi.item_name;
              if (!grouped[key]) grouped[key] = { name: oi.item_name, qty: 0, revenue: 0 };
              grouped[key].qty += Number(oi.quantity || 0);
              grouped[key].revenue += Number(oi.quantity || 0) * Number(oi.unit_price || 0);
            });
            const topItems = Object.values(grouped).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
            const totalSales = filteredOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
            const invoicedOrders = filteredOrders.filter(o => o.is_invoiced);
            const noInvOrders = filteredOrders.filter(o => !o.is_invoiced);
            printDocument('report', {
              month_name: MONTHS[month], year,
              total_sales: totalSales,
              order_count: filteredOrders.length,
              invoiced_count: invoicedOrders.length,
              invoiced_total: invoicedOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0),
              non_invoiced_count: noInvOrders.length,
              non_invoiced_total: noInvOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0),
              net_profit: 0, margin: 0,
              items: topItems,
            }, `Rapor - ${MONTHS[month]} ${year}`);
          }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border"
            style={{ borderColor: c.border, color: '#3b82f6', background: '#3b82f610' }}
            onMouseEnter={e => e.currentTarget.style.background = '#3b82f620'}
            onMouseLeave={e => e.currentTarget.style.background = '#3b82f610'}>
            <Printer size={14} /> Rapor Yazdır
          </button>
        </div>
      </div>

      {/* ── Filtreler ── */}
      <div className="rounded-2xl border p-4 space-y-4 relative z-10" style={{ background: c.card, borderColor: c.border, backdropFilter: 'blur(10px)' }}>

        {/* Ay seçici */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={prevMonth} className="p-2 rounded-xl border transition-colors"
            style={{ borderColor: c.border, color: c.muted }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronDown size={16} className="rotate-90" />
          </button>
          <div className="text-center min-w-[140px]">
            <p className="text-lg font-bold" style={{ color: c.text }}>{MONTHS[month]}</p>
            <p className="text-[10px] font-semibold" style={{ color: c.muted }}>{year}</p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl border transition-colors"
            style={{ borderColor: c.border, color: c.muted }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronDown size={16} className="-rotate-90" />
          </button>

          {/* Kişi seçici */}
          <div className="relative ml-auto">
            <button onClick={() => setPersonOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors"
              style={{ borderColor: c.border, color: c.text, background: personId ? currentColor + '15' : 'transparent' }}>
              <User size={14} style={{ color: personId ? currentColor : c.muted }} />
              {selectedPerson ? selectedPerson.name : 'Tüm Cariler'}
              {personId && (
                <X size={12} className="cursor-pointer" style={{ color: c.muted }}
                  onClick={e => { e.stopPropagation(); setPersonId(''); setPersonSearch(''); }} />
              )}
            </button>
            <AnimatePresence>
              {personOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute right-0 top-full mt-1 w-72 rounded-2xl border shadow-2xl overflow-hidden"
                  style={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: c.border, zIndex: 9999 }}>
                  <div className="p-2 border-b flex gap-1" style={{ borderColor: c.border }}>
                    {['all', 'customer', 'supplier'].map(t => (
                      <button key={t} onClick={() => setPersonType(t)}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                        style={{
                          background: personType === t ? currentColor + '20' : 'transparent',
                          color: personType === t ? currentColor : c.muted,
                        }}>
                        {t === 'all' ? 'Tümü' : t === 'customer' ? 'Müşteri' : 'Tedarikçi'}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-b" style={{ borderColor: c.border }}>
                    <input value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                      placeholder="Ara..." autoFocus
                      className="w-full px-3 py-2 rounded-lg text-xs bg-transparent border outline-none"
                      style={{ borderColor: c.border, color: c.text }} />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {personList.slice(0, 20).map(p => (
                      <button key={p.id} onClick={() => { setPersonId(p.id); setPersonOpen(false); setPersonSearch(''); }}
                        className="w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center justify-between"
                        style={{ color: c.text }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: p.type === 'customer' ? '#3b82f615' : '#10b98115',
                            color: p.type === 'customer' ? '#3b82f6' : '#10b981' }}>
                          {p.type === 'customer' ? 'Müşteri' : 'Tedarikçi'}
                        </span>
                      </button>
                    ))}
                    {personList.length === 0 && (
                      <p className="text-center py-4 text-xs" style={{ color: c.muted }}>Sonuç yok</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Rapor modu seçimi */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {REPORT_MODES.map(rm => {
            const active = mode === rm.id;
            return (
              <button key={rm.id} onClick={() => setMode(rm.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border"
                style={{
                  background: active ? rm.color + '18' : 'transparent',
                  borderColor: active ? rm.color + '40' : c.border,
                  color: active ? rm.color : c.muted,
                  boxShadow: active ? `0 0 12px ${rm.color}15` : 'none',
                }}>
                <rm.icon size={14} />
                {rm.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── İçerik ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={24} className="animate-spin" style={{ color: currentColor }} />
          <span className="text-sm" style={{ color: c.muted }}>Rapor yükleniyor...</span>
        </div>
      ) : (
        <motion.div key={`${mode}-${month}-${year}-${personId}`}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {renderContent()}
        </motion.div>
      )}

      <AnimatePresence>
        {calcOpen && (
          <QuickCostCalculator
            isDark={isDark}
            currentColor={currentColor}
            onClose={() => setCalcOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
