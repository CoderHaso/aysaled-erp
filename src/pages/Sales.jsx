import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, X, Loader2, ChevronDown, Check, AlertTriangle,
  ShoppingCart, Clock, History, Zap, Trash2, Package, Edit3,
  FileText, User, Calendar, CreditCard, MapPin, StickyNote,
  ChevronRight, CheckCircle2, XCircle, RefreshCw, TrendingUp,
  Receipt, ScanEye, FlaskConical, Send, BookOpen,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import CustomDialog from '../components/CustomDialog';
import RecipePickerModal from '../components/RecipePickerModal';

// ─── Sabitler & Yardımcılar ───────────────────────────────────────────────────
const STATUS = {
  pending:    { label: 'Beklemede',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  processing: { label: 'Hazırlanıyor', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  completed:  { label: 'Tamamlandı',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  cancelled:  { label: 'İptal',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];
const TAX_RATES  = [0, 1, 8, 10, 18, 20];

const fmt   = (n, cur = 'TRY') => {
  const sym = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[cur] || '';
  return `${sym}${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtD  = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }) : '-';
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const isUrgent = (o) =>
  (o.status === 'pending' || o.status === 'processing') &&
  o.due_date &&
  new Date(o.due_date) <= addDays(new Date(), 3);

// Sipariş numarası üret: AYS-{ilk kelime}-{padded count}
async function generateOrderNumber(customerName) {
  const firstWord = (customerName || 'MUS')
    .split(/\s+/)[0]
    .replace(/[^A-Za-zİÇŞĞÜÖıçşğüö0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(3, '0');
  return `AYS-${firstWord}-${seq}`;
}

// Adresten ilçe/şehir ayıklama (Örn: (ÇİĞLİ) ... , İZMİR)
function parseTurkishAddress(addr) {
  if (!addr) return { address: '', district: '', city: '' };
  let address = addr.trim();
  let district = '';
  let city = '';

  // (İLÇE) başa veya sona gelebilir
  const distMatch = address.match(/^\(([^)]+)\)\s*/) || address.match(/\s*\(([^)]+)\)$/);
  if (distMatch) {
    district = distMatch[1].trim();
    address = address.replace(distMatch[0], '').trim();
  }

  // Virgülden sonra genelde şehir gelir
  const parts = address.split(',');
  if (parts.length > 1) {
    const last = parts.pop().trim();
    if (last.length < 15 && last === last.toUpperCase()) { // Şehir genelde büyük harf ve kısa
      city = last;
      address = parts.join(',').trim();
    }
  }

  return { address, district, city };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, urgent }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
        style={{ background: s.bg, color: s.color }}>
        {s.label}
      </span>
      {urgent && (
        <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
          <Zap size={10} />ACİL
        </span>
      )}
    </div>
  );
}

// ─── Ürün Satırı ──────────────────────────────────────────────────────────────
function LineRow({ line, idx, allItems, allRecipes, currency, onChange, onRemove, c, exchangeRate, invoiceToggle }) {
  const [open, setOpen]             = useState(false);
  const [q, setQ]                   = useState('');
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const matches = allItems.filter(i =>
    !q || i.name.toLowerCase().includes(q.toLowerCase()) ||
    (i.sku||'').toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  // product_recipes: bu ürüne ait reçete var mı?
  const hasRecipe = line.item_id && (allRecipes || []).some(r => r.product_id === line.item_id);

  // Fiyat dönüştürme: stok'taki item.base_currency → satış currency
  const convertPrice = (item) => {
    const basePrice    = item.sale_price || item.purchase_price || 0;
    const itemCurrency = item.base_currency || 'TRY';
    if (itemCurrency === currency) return basePrice; // aynı birim, dönüş gerekmez
    const rate = exchangeRate?.rate || 1;
    if (itemCurrency === 'TRY' && currency !== 'TRY') return basePrice / rate; // TRY→yabancı
    if (itemCurrency !== 'TRY' && currency === 'TRY')  return basePrice * rate; // yabancı→TRY
    return basePrice; // farklı yabancı para birimleri aralarında yaklaşık
  };

  const total    = (line.quantity || 0) * (line.unit_price || 0);
  const taxAmt   = invoiceToggle ? total * (line.tax_rate || 0) / 100 : 0;
  const stockOk  = line.stock_count == null || line.quantity <= line.stock_count;

  return (
    <div className="rounded-xl p-3 space-y-2.5 relative"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${stockOk ? 'rgba(148,163,184,0.1)' : 'rgba(239,68,68,0.3)'}` }}>
      {/* Ürün seç */}
      <div className="relative">
        <div onClick={() => setOpen(v => !v)}
          className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.12)' }}>
          <div>
            {line.item_name
              ? <><p className="text-sm font-semibold text-slate-100">{line.item_name}</p>
                  <p className="text-[10px] text-slate-500">{line.item_type === 'product' ? '⚡ Mamül' : '🔩 Hammadde'}</p></>
              : <p className="text-sm text-slate-500">Ürün / Hammadde seç...</p>
            }
          </div>
          <div className="flex items-center gap-2">
            {line.stock_count != null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stockOk ? 'text-emerald-400' : 'text-red-400'}`}
                style={{ background: stockOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                Stok: {line.stock_count} {line.unit}
              </span>
            )}
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
              className="absolute z-40 w-full mt-1 rounded-xl overflow-hidden"
              style={{ background: '#0c1a2e', border: '1px solid rgba(148,163,184,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
              <div className="p-2">
                <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Ara..." className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#f1f5f9' }} />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {matches.length === 0 && q && <p className="px-4 py-3 text-xs text-slate-500">Sonuç yok</p>}

                {q.trim().length > 0 && (
                  <>
                    {/* Kayıtsız devam et */}
                    <div onClick={() => {
                        onChange({ item_id: null, item_name: q.trim(), item_type: 'product',
                          unit: 'Adet', unit_price: 0, stock_count: null });
                        setOpen(false); setQ('');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span className="text-sm text-slate-400">📋 <strong className="text-slate-300">&quot;{q}&quot;</strong> — Kayıtsız devam et</span>
                    </div>
                    {/* Yeni ürün / hammadde oluştur */}
                    <div onClick={() => {
                        window.open('#/stock', '_blank');
                        setOpen(false); setQ('');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span className="text-sm text-emerald-400">➕ Stok’a Yeni Ürün / Hammadde Ekle</span>
                    </div>
                  </>
                )}

                {matches.map(item => (
                  <div key={item.id} onClick={() => {
                    const finalPrice = convertPrice(item);
                    onChange({ item_id: item.id, item_name: item.name, item_type: item.item_type,
                      unit: item.unit, unit_price: finalPrice, stock_count: item.stock_count || 0,
                      tax_rate: item.vat_rate ?? 20, item_base_currency: item.base_currency || 'TRY' });
                    setOpen(false); setQ('');
                  }}
                    className="flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <p className="text-sm text-slate-100 font-semibold">{item.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.item_type === 'product' ? '⚡' : '🔩'} {item.unit}
                        {item.sku ? ` · ${item.sku}` : ''}
                        {item.base_currency && item.base_currency !== 'TRY' ? (
                          <span className="ml-1 text-amber-500 font-bold">{item.base_currency}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-300">
                        {fmt(item.sale_price || item.purchase_price, item.base_currency || 'TRY')}
                      </p>
                      {item.base_currency && item.base_currency !== currency && (
                        <p className="text-[10px] text-amber-400">
                          ≈ {fmt(convertPrice(item), currency)}
                        </p>
                      )}
                      <p className="text-[10px]" style={{ color: item.stock_count > 0 ? '#10b981' : '#ef4444' }}>
                        Stok: {item.stock_count}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reçete Seç butonu — sadece kayıtlı mamul ve BOM var ise */}
      {hasRecipe && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Reçete</p>
          <button onClick={() => setShowRecipePicker(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all"
            style={{
              background: line.recipe_note ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${line.recipe_note ? 'rgba(139,92,246,0.35)' : 'rgba(139,92,246,0.2)'}`,
              color: line.recipe_note ? '#c4b5fd' : '#64748b',
            }}>
            <span className="flex items-center gap-2 text-left truncate">
              <FlaskConical size={13} className="shrink-0" style={{ color: '#a78bfa' }}/>
              <span className="truncate">{line.recipe_note ? '✓ ' + line.recipe_key : 'Reçete Seç...'}</span>
            </span>
            <BookOpen size={12} style={{ color: '#a78bfa', flexShrink: 0 }}/>
          </button>
          {line.recipe_note && (
            <p className="text-[10px] text-slate-600 mt-1 truncate px-1">{line.recipe_note}</p>
          )}
        </div>
      )}

      {/* Reçete Picker Modal */}
      {showRecipePicker && (
        <RecipePickerModal
          productId={line.item_id}
          productName={line.item_name}
          allRecipes={allRecipes || []}
          allItems={allItems || []}
          currentColor="#8b5cf6"
          onClose={() => setShowRecipePicker(false)}
          onSelect={(recipeData) => {
            onChange({ recipe_id: recipeData.recipe_id, recipe_key: recipeData.recipe_key, recipe_note: recipeData.recipe_note, recipe_components: recipeData.components });
            setShowRecipePicker(false);
          }}/>
      )}

      {/* Sayısal alanlar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Miktar" type="number" value={line.quantity}
          onChange={v => onChange({ quantity: parseFloat(v) || 0 })} suffix={line.unit} />
        <Field label="Birim Fiyat" type="number" value={line.unit_price}
          onChange={v => onChange({ unit_price: parseFloat(v) || 0 })} />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
            style={{ color: invoiceToggle ? '#94a3b8' : '#475569' }}>KDV %
            {!invoiceToggle && <span className="ml-1 text-[9px] text-slate-600">(resmi fatura yok)</span>}
          </p>
          <select value={invoiceToggle ? (line.tax_rate ?? 20) : 0}
            onChange={e => onChange({ tax_rate: parseFloat(e.target.value) })}
            disabled={!invoiceToggle}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: invoiceToggle ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.15)', color: invoiceToggle ? '#f1f5f9' : '#475569',
              cursor: invoiceToggle ? 'pointer' : 'not-allowed' }}>
            {TAX_RATES.map(r => <option key={r} value={r}>%{r}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Satır Toplam</p>
          <div className="px-3 py-2 rounded-xl text-sm font-bold text-emerald-400"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            {fmt(total + taxAmt, currency)}
          </div>
        </div>
      </div>

      {/* Not + sil */}
      <div className="flex gap-2">
        <input value={line.notes || ''} onChange={e => onChange({ notes: e.target.value })}
          placeholder="Satır notu (opsiyonel)"
          className="flex-1 px-3 py-1.5 rounded-xl text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', color: '#94a3b8' }} />
        <button onClick={onRemove}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, suffix, placeholder }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <div className="relative">
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9', paddingRight: suffix ? '2.5rem' : undefined }} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Sipariş Formu ────────────────────────────────────────────────────────────
function OrderForm({ order, customers, allItems, allRecipes = [], onClose, onSaved, currentColor, quoteId, quoteRevertFn, markQuoteAccepted }) {
  const isEdit = !!order?.id;
  // ── Local dialog state (OrderForm kendi dialogunu yönetir) ──
  const [dialog, setDialog] = useState({ open: false, title: '', message: '', type: 'confirm', onConfirm: null, loading: false });

  // İptal edilince teklifi geri al
  const handleCancel = () => {
    if (quoteRevertFn) quoteRevertFn(); // teklifi orijinal duruma döndür
    onClose();
  };

  // Başarılı kayıt sonrası temiz kapat (revert YOK)
  const closeClean = () => {
    onSaved?.();
    onClose();
  };

  const blankLine = () => ({
    _key: Math.random(), item_id: null, item_name: '', item_type: 'product',
    quantity: 1, unit: 'Adet', unit_price: 0, tax_rate: 20, stock_count: null, notes: '',
  });

  const [form, setForm] = useState({
    customer_id:          order?.customer_id || '',
    customer_name:        order?.customer_name || '',
    customer_vkntckn:     order?.customer_vkntckn || '',
    customer_tax_office:  order?.customer_tax_office || '',
    customer_address:     order?.customer_address || '',
    customer_district:    order?.customer_district || '',
    customer_city:        order?.customer_city || '',
    customer_phone:       order?.customer_phone || '',
    customer_email:       order?.customer_email || '',
    customer_country:     order?.customer_country || 'Turkiye',
    customer_building_name: order?.customer_building_name || '',
    customer_building_no:   order?.customer_building_no || '',
    customer_postal_code:   order?.customer_postal_code || '',
    order_number:         order?.order_number || '',
    status:               order?.status || 'pending',
    currency:             order?.currency || 'TRY',
    due_date:             order?.due_date ? order.due_date.slice(0, 10) : addDays(new Date(), 7).toISOString().slice(0, 10),
    delivery_address:     order?.delivery_address || '',
    billing_address:      order?.billing_address || '',
    notes:                order?.notes || '',
    quote_id:             order?.quote_id || null,
  });
  const [lines, setLines]   = useState(order?.items?.length ? order.items.map(i => ({ ...i, _key: Math.random() })) : [blankLine()]);
  const [saving, setSaving] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [custQ, setCustQ]       = useState('');
  // Fatura toggle
  const [invoiceToggle, setInvoiceToggle] = useState(false);
  const [draftLoading,  setDraftLoading]  = useState(false);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState(null);  // string URL veya null

  const [exchangeRate, setExchangeRate] = useState(null);
  
  const fetchExchangeRate = async (curr, date) => {
    if (curr === 'TRY') { setExchangeRate(null); return; }
    try {
      const qs = new URLSearchParams({ currency: curr });
      if (date) qs.append('date', date);
      const res = await fetch(`/api/exchange-rate?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExchangeRate(data);
              } else { setExchangeRate(null); }
            } catch { 
              setExchangeRate(null);
            }
          };

  useEffect(() => {
    fetchExchangeRate(form.currency, form.due_date);
  }, [form.currency, form.due_date]);

  // Müşteri seçince: sipariş no üret + adres/iletişim auto-fill
  const selectCustomer = async (cust) => {
    const num = await generateOrderNumber(cust.name);
    const parsed = parseTurkishAddress(cust.address);
    // Adres icinde (Ilce) Adres formatini coz
    let district = cust.district || parsed.district || '';
    let addr     = cust.address  || '';
    if (!district && addr.startsWith('(')) {
      const m = addr.match(/^\(([^)]+)\)\s*(.*)$/);
      if (m) { district = m[1]; addr = m[2]; }
    }
    setForm(f => ({
      ...f,
      customer_id:          cust.id,
      customer_name:        cust.name,
      customer_vkntckn:     cust.vkntckn    || '',
      customer_tax_office:  cust.tax_office || '',
      customer_address:     addr            || parsed.address || '',
      customer_district:    district,
      customer_city:        parsed.city     || cust.city || '',
      customer_phone:       cust.phone      || '',
      customer_email:       cust.email      || '',
      customer_country:     cust.country    || 'Turkiye',
      customer_building_name: cust.building_name || '',
      customer_building_no:   cust.building_no   || '',
      customer_postal_code:   cust.postal_code   || '',
      delivery_address: f.delivery_address || addr || cust.address || '',
      billing_address:  f.billing_address  || addr || cust.address || '',
      order_number: isEdit ? f.order_number : num,
    }));
    setCustOpen(false); setCustQ('');
  };

  const filteredCusts = customers.filter(c =>
    !custQ || c.name.toLowerCase().includes(custQ.toLowerCase()) || (c.vkntckn||'').includes(custQ)
  ).slice(0, 8);

  const updateLine = (idx, patch) =>
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const removeLine = (idx) => setLines(ls => ls.filter((_, i) => i !== idx));

  // Toplamlar
  const subtotal   = lines.reduce((s, l) => s + (l.quantity||0) * (l.unit_price||0), 0);
  const taxTotal   = lines.reduce((s, l) => s + (l.quantity||0) * (l.unit_price||0) * (l.tax_rate||0) / 100, 0);
  const grandTotal = subtotal + taxTotal;

  // KDV dökümü
  const vatBreak = {};
  lines.forEach(l => {
    const pct = l.tax_rate || 0;
    vatBreak[pct] = (vatBreak[pct] || 0) + (l.quantity||0) * (l.unit_price||0) * pct / 100;
  });

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.order_number.trim()) return;

    if (invoiceToggle && !isEdit) {
      if (!form.customer_vkntckn || !form.customer_tax_office || !form.customer_city || !form.customer_address) {
        setDialog({ open: true, title: 'Eksik Bilgi', message: "Resmi fatura oluşturabilmek için müşterinin VKN/TCKN, Vergi Dairesi, Şehir ve Açık Adres alanları Uyumsoft tarafından zorunlu tutulmaktadır!", type: 'alert' });
        return;
      }
    }

    setSaving(true);
    try {
      if (form.currency !== 'TRY' && (!exchangeRate || !exchangeRate.rate)) {
        throw new Error('Dövizli fatura için kur bilgisi bulunamadı! Lütfen bekleyin veya sayfayı yenileyip kurun yüklendiğinden emin olun.');
      }

      // WHITELIST: Sadece DB şemasında olan sütunları gönder (400 Bad Request önleme)
      const orderData = {
        order_number:     form.order_number,
        customer_id:      form.customer_id   || null,
        customer_name:    form.customer_name,
        customer_vkntckn: form.customer_vkntckn || null,
        status:           form.status         || 'pending',
        currency:         form.currency       || 'TRY',
        due_date:         form.due_date ? new Date(form.due_date).toISOString() : null,
        delivery_address: form.delivery_address || null,
        billing_address:  form.billing_address  || null,
        notes:            form.notes            || null,
        subtotal:         Math.round(subtotal   * 100) / 100,
        tax_total:        Math.round(taxTotal   * 100) / 100,
        grand_total:      Math.round(grandTotal * 100) / 100,
        // quote_id — tekliften gelen siparişlerde bağlantı kurulur
        ...(quoteId ? { quote_id: quoteId } : {}),
      };

      let orderId;
      if (isEdit) {
        const { error: updErr } = await supabase.from('orders').update(orderData).eq('id', order.id);
        if (updErr) throw updErr;
        orderId = order.id;
        await supabase.from('order_items').delete().eq('order_id', orderId);
      } else {
        const { data, error } = await supabase.from('orders').insert(orderData).select('id').single();
        if (error) throw error;
        orderId = data.id;
      }

      const orderLines = lines.filter(l => l.item_name);
      if (orderLines.length > 0) {
        const items = orderLines.map(l => ({
          order_id:    orderId,
          item_id:     l.item_id     || null,
          item_name:   l.item_name,
          item_type:   l.item_type   || 'product',
          quantity:    Number(l.quantity)   || 1,
          unit:        l.unit        || 'Adet',
          unit_price:  Number(l.unit_price) || 0,
          tax_rate:    Number(l.tax_rate)   || 0,
          stock_count: l.stock_count != null ? Number(l.stock_count) : null,
          notes:       l.notes       || null,
          // Reçete bilgisi — iş emri + kart gösterimi için
          recipe_id:   l.recipe_id   || null,
          recipe_key:  l.recipe_key  || null,
          recipe_note: l.recipe_note || null,
        }));
        const { error: itemsErr } = await supabase.from('order_items').insert(items);
        if (itemsErr) console.warn('[order_items insert]', itemsErr.message);
      }

      // ── Teklif varsa accepted olarak işaretle ──
      if (quoteId && !isEdit) {
        try {
          await fetch(`/api/quotes?id=${quoteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'accepted' })
          });
        } catch (_) { /* teklif güncelleme kritik değil */ }
      }

      // ── UYUMSOFT INVOICE DRAFT CREATION ──
      if (invoiceToggle && !isEdit) {
        try {
          const invBody = {
            type: 'outbox',
            cari_name: form.customer_name,
            vkntckn: form.customer_vkntckn?.trim(),
            city: form.customer_city?.trim(),
            district: form.customer_district?.trim(),
            address: form.customer_address?.trim(),
            tax_office: form.customer_tax_office?.trim(),
            currency: form.currency,
            notes: form.notes,
            exchange_rate: exchangeRate?.rate || 1,
            lines: orderLines.map(l => ({
              name: l.item_name,
              quantity: Number(l.quantity),
              unit: l.unit,
              unitPrice: Number(l.unit_price),
              taxRate: Number(l.tax_rate)
            }))
          };
          
          const r_create = await fetch('/api/invoices-api?action=create', { method: 'POST', body: JSON.stringify(invBody), headers: {'Content-Type': 'application/json'} });
          const d_create = await r_create.json();
          if (d_create.success && d_create.invoice_id) {
             const r_form = await fetch('/api/invoices-api?action=formalize', { method: 'POST', body: JSON.stringify({ invoiceId: d_create.invoice_id }), headers: {'Content-Type': 'application/json'} });
             const d_form = await r_form.json();
             if (d_form.success) {
               setDialog({ 
                 open: true, title: '✓ Sipariş Oluşturuldu', message: "Sipariş kaydedildi ve Uyumsoft tarafında fatura taslağı başarıyla oluşturuldu!", type: 'alert',
                 onConfirm: () => { setDialog({ open: false }); closeClean(); }
               });
             } else {
               setDialog({ 
                 open: true, title: 'Bilgi', message: `Sipariş kaydedildi ancak fatura taslağı iletilemedi: ${d_form.error}`, type: 'alert',
                 onConfirm: () => { setDialog({ open: false }); closeClean(); }
               });
             }
          } else {
             setDialog({ 
               open: true, title: 'Bilgi', message: `Sipariş kaydedildi ancak fatura sistemi kaydı başarısız: ${d_create.error}`, type: 'alert',
               onConfirm: () => { setDialog({ open: false }); closeClean(); }
             });
          }
        } catch (invErr) {
          setDialog({ 
            open: true, title: 'Hata', message: `Sipariş kaydedildi ama teknik hata oluştu: ${invErr.message}`, type: 'alert',
            onConfirm: () => { setDialog({ open: false }); closeClean(); }
          });
        }
      } else {
        // Faturasız sipariş — direkt kapat
        onSaved?.();
        onClose();
      }
      // Fatura listesini yenilemek için cache temizle
      if (invoiceToggle) {
        try { sessionStorage.removeItem('page_cache_invoices_outbox'); } catch(e){}
      }
    } catch (e) { 
        setDialog({ open: true, title: 'Hata', message: e.message, type: 'alert' }); 
    }
    finally { setSaving(false); }
  };

  return (
    <>
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Background overlay click-to-close */}
      <div className="absolute inset-0 z-0" onClick={onClose} />
      
      <motion.div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl z-10"
        style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)' }}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(15,23,42,0.97)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(148,163,184,0.08)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {isEdit ? 'Sipariş Düzenle' : 'Yeni Sipariş'}
          </p>
          <h2 className="text-base font-bold text-slate-100 font-mono mt-0.5">
            {form.order_number || '—'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="p-2 rounded-xl text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Müşteri + Sipariş No */}
        <SectionCard title="Sipariş Bilgileri" icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Müşteri seçici */}
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Müşteri *</p>
              <div onClick={() => setCustOpen(v => !v)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)' }}>
                <span className={`text-sm ${form.customer_name ? 'text-slate-100' : 'text-slate-500'}`}>
                  {form.customer_name || 'Müşteri seç veya yaz...'}
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </div>
              <AnimatePresence>
                {custOpen && (
                  <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                    className="absolute z-40 w-full mt-1 rounded-xl overflow-hidden"
                    style={{ background: '#0c1a2e', border:'1px solid rgba(148,163,184,0.15)', boxShadow:'0 20px 40px rgba(0,0,0,0.5)' }}>
                    <div className="p-2">
                      <input autoFocus value={custQ}
                        onChange={e => { setCustQ(e.target.value); setForm(f => ({ ...f, customer_name: e.target.value })); }}
                        placeholder="Ara veya yeni isim gir..."
                        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', color: '#f1f5f9' }} />
                    </div>
                    {filteredCusts.map(c => (
                      <div key={c.id} onClick={() => selectCustomer(c)}
                        className="px-4 py-2.5 cursor-pointer transition-colors"
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <p className="text-sm text-slate-100 font-semibold">{c.name}</p>
                        {c.vkntckn && <p className="text-[10px] text-slate-500 font-mono">{c.vkntckn}</p>}
                      </div>
                    ))}
                    {custQ && (
                      <>
                        {/* Kayıtsız devam et */}
                        <div className="px-4 py-2.5 cursor-pointer transition-colors border-t"
                          style={{ borderColor: 'rgba(148,163,184,0.08)' }}
                          onClick={async () => {
                            const num = await generateOrderNumber(custQ);
                            setForm(f => ({ ...f, customer_name: custQ, customer_id: null, order_number: isEdit ? f.order_number : num }));
                            setCustOpen(false);
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.07)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <p className="text-sm text-slate-400">📋 <strong className="text-slate-300">&quot;{custQ}&quot;</strong> — Kayıtsız devam et</p>
                          <p className="text-[10px] text-slate-600">Sisteme kayıt oluşturulmaz</p>
                        </div>
                        {/* Yeni kayıt oluştur */}
                        <div className="px-4 py-2.5 cursor-pointer transition-colors"
                          onClick={async () => {
                            const num = await generateOrderNumber(custQ);
                            setForm(f => ({ ...f, customer_name: custQ, customer_id: null, order_number: isEdit ? f.order_number : num }));
                            setCustOpen(false);
                            // Cariler sayfasına yönlendirme yerine bilgi ver
                            window.open('#/contacts', '_blank');
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <p className="text-sm text-emerald-400">➕ <strong>&quot;{custQ}&quot;</strong> — Yeni kayıt oluştur</p>
                          <p className="text-[10px] text-slate-600">Cariler sayfası açılır (sipariş devam eder)</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Field label="Sipariş No" value={form.order_number} onChange={v => setForm(f => ({ ...f, order_number: v }))} />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Teslim Tarihi</p>
              <input type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9' }} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Para Birimi</p>
              <div className="flex gap-1">
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, currency: c }))}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background: form.currency === c ? `${currentColor}20` : 'rgba(255,255,255,0.04)', color: form.currency === c ? currentColor : '#64748b', border: `1px solid ${form.currency === c ? `${currentColor}40` : 'rgba(148,163,184,0.1)'}` }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {isEdit && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Durum</p>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(STATUS).map(([key, val]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, status: key }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                      style={{ background: form.status === key ? val.bg : 'rgba(255,255,255,0.04)', color: form.status === key ? val.color : '#64748b', border: `1px solid ${form.status === key ? val.color + '40' : 'rgba(148,163,184,0.1)'}` }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Ürün Kalemleri */}
        <SectionCard title="Ürün / Hammadde Kalemleri" icon={Package}>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <LineRow key={line._key} line={line} idx={idx} allItems={allItems}
                currency={form.currency} exchangeRate={exchangeRate}
                allRecipes={allRecipes} invoiceToggle={invoiceToggle}
                onChange={patch => updateLine(idx, patch)}
                onRemove={() => removeLine(idx)}
                c={{}} />

            ))}
          </div>
          <button onClick={() => setLines(ls => [...ls, blankLine()])}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(148,163,184,0.2)', color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.color = currentColor}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
            <Plus size={15} />Kalem Ekle
          </button>
        </SectionCard>

        {/* Adres & Notlar */}
        <SectionCard title="Adres & Notlar" icon={MapPin}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Teslimat Adresi</p>
              <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9' }}
                rows={2} placeholder="Opsiyonel..."
                value={form.delivery_address} onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fatura Adresi</p>
              <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9' }}
                rows={2} placeholder="Opsiyonel..."
                value={form.billing_address} onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sipariş Notu</p>
              <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)', color: '#f1f5f9' }}
                rows={2} placeholder="Ek bilgi, özel talepler..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </SectionCard>

        {/* Özet */}
        <SectionCard title="Sipariş Özeti" icon={TrendingUp}>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(148,163,184,0.1)' }}>
            {Object.entries(vatBreak).map(([pct, amt]) => (
              <React.Fragment key={pct}>
                <SumRow label={`Matrah (%${pct} KDV için)`} value={fmt(lines.filter(l=>(l.tax_rate||0)==pct).reduce((s,l)=>s+(l.quantity||0)*(l.unit_price||0),0), form.currency)} />
                <SumRow label={`KDV %${pct}`} value={fmt(amt, form.currency)} color="#60a5fa" />
              </React.Fragment>
            ))}
            <SumRow label="Ara Toplam (KDV hariç)" value={fmt(subtotal, form.currency)} />
            <SumRow label="Toplam KDV" value={fmt(taxTotal, form.currency)} color="#60a5fa" />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/30 p-4 border-y border-slate-700/50">
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kur Kaynağı & Durum</p>
                 <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <TrendingUp size={12} className="text-violet-400" />
                    {exchangeRate ? (
                      <span>1 {form.currency} = {exchangeRate.rate?.toFixed(4)} ₺ ({exchangeRate.source === 'tcmb' ? 'TCMB' : 'Manuel'})</span>
                    ) : (
                      <span className="text-red-400 italic">Kur bulunamadı!</span>
                    )}
                 </div>
              </div>
              {form.currency !== 'TRY' && (
                <Field label="Kur (Manuel Düzenle)" type="number" 
                  value={exchangeRate?.rate || ''} 
                  onChange={v => setExchangeRate({ rate: Number(v), source: 'manual', date: new Date().toISOString() })} 
                  placeholder="Örn: 32.45" />
              )}
            </div>

            <div style={{ borderTop: '2px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.03)' }}>
              <SumRow label="GENEL TOPLAM" value={fmt(grandTotal, form.currency)} bold accent />
              {form.currency !== 'TRY' && (
                <div className="px-4 py-2 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Genel Toplam (TL)</span>
                  <span>{fmt(grandTotal * (exchangeRate?.rate || 1), 'TRY')}</span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Fatura Toggle */}
        <SectionCard title="Resmi Fatura" icon={Receipt}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">Resmi Fatura Kesilecek</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Kapalıysa sadece iç sipariş kaydı. Açıksa Uyumsoft'a taslak gönderilebilir.
              </p>
            </div>
            {/* Toggle Switch */}
            <button onClick={() => { setInvoiceToggle(v => !v); setDraftPreviewUrl(null); }}
              className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
              style={{ background: invoiceToggle ? '#10b981' : 'rgba(148,163,184,0.2)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all"
                style={{ left: invoiceToggle ? '1.625rem' : '0.125rem' }} />
            </button>
          </div>

          <AnimatePresence>
            {invoiceToggle && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                className="overflow-hidden">
                <div className="pt-4 flex flex-col gap-3">
                  <p className="text-xs text-slate-400">
                    Siparişi kaydettiğinizde Uyumsoft'ta Giden Taslak Fatura olarak da gönderilecektir. Uyumsoft portalı üzerinden daha sonra resmileştirebilmeniz için lütfen zorunlu alanları eksiksiz girin:
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 p-4 rounded-xl" style={{ border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.05)' }}>
                      <div className="relative">
                        <Field label="VKN / TCKN *" value={form.customer_vkntckn} onChange={v => setForm(f => ({ ...f, customer_vkntckn: v }))} placeholder="10 veya 11 hane" />
                        <button onClick={async () => {
                          const vkn = form.customer_vkntckn?.trim();
                          if (!vkn || vkn.length < 10) {
                              setDialog({ open: true, title: 'Gecersiz Giris', message: 'Lutfen gecerli bir VKN (10 hane) veya TCKN (11 hane) girin.', type: 'alert' });
                              return;
                          }
                          setDraftLoading(true);
                          try {
                            const r = await fetch('/api/invoices-api?action=fetchCustomerInfo', { method: 'POST', body: JSON.stringify({ vkn }), headers: {'Content-Type': 'application/json'} });
                            const d = await r.json();
                            if (d.success) {
                              setForm(f => ({
                                ...f,
                                customer_name:          d.data.unvan        || f.customer_name,
                                customer_city:          d.data.sehir        || f.customer_city,
                                customer_district:      d.data.ilce         || f.customer_district,
                                customer_address:       d.data.adres        || f.customer_address,
                                customer_tax_office:    d.data.vergiDairesi || f.customer_tax_office,
                                customer_country:       d.data.ulke         || f.customer_country || 'Turkiye',
                                customer_building_name: d.data.binAdi       || f.customer_building_name || '',
                                customer_building_no:   d.data.binaNo       || f.customer_building_no  || '',
                                customer_postal_code:   d.data.postaKodu    || f.customer_postal_code  || '',
                                customer_phone:         d.data.telefon      || f.customer_phone || '',
                                customer_email:         d.data.eposta       || f.customer_email || '',
                              }));
                            } else throw new Error(d.error);
                          } catch (e) { 
                              setDialog({ open: true, title: 'Sorgu Hatasi', message: e.message, type: 'alert' }); 
                          }
                          finally { setDraftLoading(false); }
                        }}
                          disabled={draftLoading || saving}
                          className="absolute right-0 top-6 px-3 py-1 rounded-lg text-[10px] font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50">
                          {draftLoading ? 'Sorgulanıyor...' : 'DB / XML Sorgula'}
                        </button>
                      </div>
                      <Field label="Vergi Dairesi *" value={form.customer_tax_office} onChange={v => setForm(f => ({ ...f, customer_tax_office: v }))} placeholder="Ornegin: BORNOVA" />
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: 'rgba(148,163,184,0.7)' }}>Ulke</label>
                        <input value={form.customer_country} onChange={e => setForm(f => ({ ...f, customer_country: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-xl outline-none border font-mono uppercase"
                          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(148,163,184,0.12)', color: '#e2e8f0' }} />
                      </div>
                      <Field label="Sehir *" value={form.customer_city} onChange={v => setForm(f => ({ ...f, customer_city: v }))} placeholder="Ornegin: IZMIR" />
                      <Field label="Mahalle / Ilce *" value={form.customer_district} onChange={v => setForm(f => ({ ...f, customer_district: v }))} placeholder="Ornegin: KONAK" />
                      <div className="sm:col-span-2">
                        <Field label="Cadde / Sokak / Acik Adres *" value={form.customer_address} onChange={v => setForm(f => ({ ...f, customer_address: v }))} placeholder="Cadde, sokak, bina kapi no..." />
                      </div>
                      <Field label="Bina Adi" value={form.customer_building_name} onChange={v => setForm(f => ({ ...f, customer_building_name: v }))} placeholder="Opsiyonel" />
                      <Field label="Bina / Kapi No" value={form.customer_building_no} onChange={v => setForm(f => ({ ...f, customer_building_no: v }))} placeholder="Opsiyonel" />
                      <Field label="Posta Kodu" value={form.customer_postal_code} onChange={v => setForm(f => ({ ...f, customer_postal_code: v }))} placeholder="35000" />
                      <Field label="Tel" value={form.customer_phone} onChange={v => setForm(f => ({ ...f, customer_phone: v }))} placeholder="0232 xxx xx xx" />
                  </div>
                  
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>

        {/* Kaydet */}
        <div className="flex gap-3 pb-8">
          <button onClick={handleCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(148,163,184,0.15)' }}>
            İptal
          </button>
          <button onClick={handleSave} disabled={saving || !form.customer_name || !form.order_number}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: currentColor, opacity: saving || !form.customer_name || !form.order_number ? 0.6 : 1 }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isEdit ? 'Güncelle' : 'Sipariş Oluştur'}
          </button>
        </div>
      </div>
     </motion.div>
    </motion.div>

    {/* OrderForm kendi dialog'unu render eder */}
    <CustomDialog 
      {...dialog} 
      onClose={() => setDialog(d => ({ ...d, open: false }))}
      onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog(d => ({ ...d, open: false }))}
    />
  </>
  );
}


function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-slate-500" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SumRow({ label, value, bold, accent, color }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5"
      style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
      <span className={`text-xs ${bold ? 'font-bold text-slate-200' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-sm font-bold tabular-nums`}
        style={{ color: accent ? '#34d399' : (color || (bold ? '#f1f5f9' : '#94a3b8')) }}>
        {value}
      </span>
    </div>
  );
}

// ─── Sipariş Kartı ────────────────────────────────────────────────────────────
function OrderCard({ order, onEdit, onStatusChange, onSendToWorkOrders, currentColor, c }) {
  const urgent = isUrgent(order);
  const daysLeft = order.due_date
    ? Math.ceil((new Date(order.due_date) - new Date()) / 86400000)
    : null;

  const recipeLines    = (order.items || []).filter(l => l.recipe_note || l.recipe_key);
  const hasRecipeLines = recipeLines.length > 0;
  const onlyMaterial   = !hasRecipeLines;
  const canSendToWO    = hasRecipeLines && order.status !== 'completed' && order.status !== 'cancelled' && !order.work_orders_sent;
  const sentToWO       = order.work_orders_sent;
  // Tüm iş emirleri tamamlandı mı?
  const allWOsDone = order.allWOsDone && sentToWO && order.status !== 'completed';

  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
      className="rounded-2xl p-4 space-y-3 cursor-pointer transition-all"
      style={{ background: c.card, border: `1px solid ${urgent ? 'rgba(239,68,68,0.3)' : c.border}` }}
      onClick={() => onEdit(order)}>
      {/* Üst satır */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-bold" style={{ color: currentColor }}>{order.order_number}</p>
          <p className="text-sm font-bold text-slate-100 mt-0.5 truncate">{order.customer_name}</p>
        </div>
        <StatusBadge status={order.status} urgent={urgent} />
      </div>

      {/* Orta */}
      <div className="grid grid-cols-3 gap-2">
        <InfoChip icon={CreditCard} label="Toplam" value={fmt(order.grand_total, order.currency)} color="#34d399" />
        <InfoChip icon={Calendar} label="Teslim" value={fmtD(order.due_date)}
          color={daysLeft != null && daysLeft <= 3 ? '#ef4444' : (daysLeft != null && daysLeft <= 7 ? '#f59e0b' : '#94a3b8')} />
        <InfoChip icon={Package} label="Oluşturma" value={fmtD(order.created_at)} />
      </div>

      {order.notes && (
        <p className="text-xs text-slate-500 italic truncate">📝 {order.notes}</p>
      )}

      {/* ÜRETİM TAMAMLANDI banner */}
      {allWOsDone && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}
          onClick={e => e.stopPropagation()}>
          <span className="text-lg">🏭</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-400">Tüm üretim tamamlandı!</p>
            <p className="text-[10px] text-emerald-600">Siparişi tamamlandı olarak işaretleyebilirsiniz.</p>
          </div>
          <button onClick={e => { e.stopPropagation(); onStatusChange(order.id, 'completed'); }}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
            style={{ background: '#10b981' }}>
            Tamamla
          </button>
        </div>
      )}

      {/* Durum güncelle */}
      <div className="flex gap-1.5 pt-1 flex-wrap" onClick={e => e.stopPropagation()}>
        {Object.entries(STATUS)
          .filter(([k]) => {
            if (k === order.status) return false;
            if (onlyMaterial && k === 'processing') return false;
            return true;
          })
          .slice(0, 3)
          .map(([key, val]) => (
            <button key={key} onClick={() => onStatusChange(order.id, key)}
              className="flex-1 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{ background: val.bg, color: val.color }}>
              {val.label}
            </button>
          ))
        }
        {canSendToWO && (
          <button onClick={e => { e.stopPropagation(); onSendToWorkOrders(order); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            <Send size={9}/> İş Emrine Gönder
          </button>
        )}
        {sentToWO && !allWOsDone && (
          <span className="px-2 py-1 rounded-lg text-[10px] font-bold"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
            ✓ İş Emrinde
          </span>
        )}
      </div>
    </motion.div>
  );
}

function InfoChip({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon size={9} className="text-slate-600" />
        <p className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xs font-bold truncate" style={{ color: color || '#f1f5f9' }}>{value}</p>
    </div>
  );
}

// ─── Ana Satış Sayfası ────────────────────────────────────────────────────────
export default function Sales() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const location = useLocation();

  const [orders,    setOrders]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [allItems,  setAllItems]  = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);  // product_recipes + recipe_items
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [tab,       setTab]       = useState('current');
  const [showForm,  setShowForm]  = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [toast,     setToast]     = useState(null);
  // Tekliften sipariş oluşturma için durum yönetimi
  const [pendingQuoteId,       setPendingQuoteId]       = useState(null);
  const [pendingQuoteOriginal, setPendingQuoteOriginal] = useState(null); // geri alınabilir durum

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // İş emrine gönder
  const sendToWorkOrders = async (order) => {
    const recipeLines = (order.items || []).filter(l => l.recipe_note || l.recipe_key);
    if (!recipeLines.length) return;
    try {
      const payload = recipeLines.map(line => ({
        item_id:   line.item_id,
        order_id:  order.id,
        recipe_id: line.recipe_id || null,
        quantity:  Number(line.quantity || 1),
        status:    'pending',
        notes:     line.recipe_note || line.recipe_key || '',
        line_key:  String(line.id || ''),
        started_at: null,
      }));
      const { error } = await supabase.from('work_orders').insert(payload);
      if (error) throw error;
      await supabase.from('orders').update({ status: 'processing', work_orders_sent: true }).eq('id', order.id);
      showToast(`${recipeLines.length} iş emri oluşturuldu!`);
      loadAll();
    } catch (e) { showToast(e.message, 'error'); }
  };

  // İş emirleri tamamlanma kontrolü (polling yerine manuel refresh’ta)
  const checkWorkOrdersComplete = useCallback(async () => {
    // processing siparişleri al
    const processingOrders = orders.filter(o => o.status === 'processing' && o.work_orders_sent);
    if (!processingOrders.length) return;
    for (const ord of processingOrders) {
      const { data: wos } = await supabase
        .from('work_orders').select('status').eq('order_id', ord.id);
      if (!wos?.length) continue;
      const allDone = wos.every(w => w.status === 'completed');
      if (allDone) {
        await supabase.from('orders').update({ status: 'completed' }).eq('id', ord.id);
        showToast(`Sipariş #${ord.order_number} tamamlandı — tüm iş emirleri bitti!`, 'success');
      }
    }
    loadAll();
  }, [orders]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [ordRes, custRes, itemRes, recRes, woRes] = await Promise.all([
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name, vkntckn, tax_office, phone, email, address, city').order('name'),
      supabase.from('items').select('id, name, item_type, unit, sale_price, purchase_price, stock_count, sku, base_currency, vat_rate, category').order('name'),
      supabase.from('product_recipes').select('id, product_id, name, tags, recipe_items(id, item_id, item_name, quantity, unit)').order('name'),
      supabase.from('work_orders').select('id, order_id, status').order('created_at', { ascending: false }),
    ]);
    const allWOs = woRes.data || [];
    setOrders((ordRes.data || []).map(o => {
      const orderWOs = allWOs.filter(w => w.order_id === o.id);
      const allWOsDone = orderWOs.length > 0 && orderWOs.every(w => w.status === 'completed');
      return { ...o, items: o.order_items || [], orderWOs, allWOsDone };
    }));
    setCustomers(custRes.data || []);
    setAllItems(itemRes.data || []);
    setAllRecipes(recRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const initFromQuote = async () => {
      const state = location.state;
      if (state?.createFromQuote && customers.length > 0 && allItems.length > 0) {
        const q = state.createFromQuote;
        const cName = q.company_name || '';
        const matchedCust = customers.find(c => c.name.toLowerCase() === cName.toLowerCase());
        
        const num = await generateOrderNumber(cName);
        const parsed = parseTurkishAddress(matchedCust?.address || q.address);
        
        const newItems = (q.line_items || []).map(l => {
          const itemMatch = allItems.find(i => i.name === l.name || i.item_code === l.item_code) || {};
          return {
            _key: Math.random(),
            item_name: l.name,
            quantity: Number(l.quantity || 1),
            unit: l.unit || 'Adet',
            unit_price: Number(l.unit_price || 0),
            tax_rate: Number(q.vat_rate || 20),
            item_id: itemMatch.id || null,
            item_type: itemMatch.item_type || 'product',
            stock_count: itemMatch.stock_count || null,
            notes: l.description || ''
          };
        });

        setEditOrder({
          order_number: num,
          customer_name: cName,
          customer_id: matchedCust?.id || '',
          customer_vkntckn: matchedCust?.vkntckn || '',
          customer_tax_office: matchedCust?.tax_office || '',
          customer_address: parsed.address || matchedCust?.address || q.address || '',
          customer_district: parsed.district || matchedCust?.district || '',
          customer_city: parsed.city || matchedCust?.city || '',
          customer_email: matchedCust?.email || '',
          delivery_address: parsed.address || matchedCust?.address || q.address || '',
          billing_address:  parsed.address || matchedCust?.address || q.address || '',
          currency: q.currency || 'TRY',
          notes: q.notes || '',
          items: newItems,
          quote_id: q.id
        });
        // Teklif durumu yönetimi: kullanıcı iptal ederse geri alınabilecek
        setPendingQuoteId(q.id);
        setPendingQuoteOriginal(state.quoteOriginalStatus || q.status || 'sent');
        setShowForm(true);

        if (state.quoteMsg) showToast(state.quoteMsg);
        window.history.replaceState({}, '');
      }
    };
    initFromQuote();
  }, [location.state, customers, allItems]);

  const [dialog, setDialog] = useState({ open: false, title: '', message: '', type: 'confirm', onConfirm: null, loading: false });

  const updateStatus = async (orderId, status) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (status === 'cancelled') {
        setDialog({
            open: true,
            title: 'Siparişi İptal Et',
            message: `${order.order_number} numaralı siparişi iptal etmek istediğinize emin misiniz?\n\n` +
                     (order.quote_id ? "• Bağlı olduğu TEKLİF reddedildi olarak işaretlenecek.\n" : "") +
                     "• Varsa Uyumsoft üzerindeki taslak fatura SİLİNECEK.\n" +
                     "• Sipariş kaydı 'İptal' durumuna çekilecek.",
            type: 'danger',
            onConfirm: async () => {
                setDialog(d => ({ ...d, loading: true }));
                try {
                    // 1. Siparişi iptal et
                    const patch = { status: 'cancelled', completed_at: null };
                    await supabase.from('orders').update(patch).eq('id', orderId);

                    // 2. Bağlı teklif varsa reddet
                    if (order.quote_id) {
                        await supabase.from('quotes').update({ status: 'rejected' }).eq('id', order.quote_id);
                    }

                    // 3. Taslak fatura varsa bul ve iptal et (Uyumsoft CancelDraft)
                    try {
                        const { data: inv } = await supabase
                            .from('invoices')
                            .select('invoice_id')
                            .ilike('cari_name', `%${order.customer_name}%`)
                            .eq('status', 'Draft')
                            .limit(1)
                            .maybeSingle(); // 0 satır gelince null döner, hata fırlatmaz
                        if (inv?.invoice_id) {
                            await fetch('/api/invoices-api?action=cancelDraft', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invoiceIds: [inv.invoice_id] })
                            });
                            try { sessionStorage.removeItem('page_cache_invoices_outbox'); } catch(e){}
                        }
                    } catch (_invErr) {
                        // Taslak fatura silme başarısız olsa da siparişi iptal etmeye devam et
                        console.warn('[cancel] Draft invoice lookup/cancel failed:', _invErr);
                    }

                    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o));
                    showToast('Sipariş ve bağlı kayıtlar iptal edildi ✓');
                    setDialog({ open: false });
                } catch (err) {
                    setDialog({ open: true, title: 'Hata', message: 'İptal işlemi başarısız: ' + err.message, type: 'alert' });
                }
            }
        });
        return;
    }

    // ── Tamamlandı: satılan ürünlerin stoktan düş ──────────────────────────
    if (status === 'completed') {
      const patch = { status, completed_at: new Date().toISOString() };
      await supabase.from('orders').update(patch).eq('id', orderId);

      const orderItems = order.items || [];
      for (const line of orderItems) {
        if (!line.item_id) continue;
        const qty  = Number(line.quantity || 1);
        const note = `Sipariş #${order.order_number} tamamlandı — satış stok düşümü`;
        // Önce reçete bazlı stok düş, yoksa genel stok
        await supabase.rpc('decrement_stock', {
          p_item_id:   line.item_id,
          p_qty:       qty,
          p_source:    'sale',
          p_source_id: orderId,
          p_recipe_id: line.recipe_id || null,
          p_note:      note,
        }).catch(async () => {
          // RPC henüz çalışmıyorsa direkt güncelle
          const { data: itm } = await supabase.from('items').select('stock_count').eq('id', line.item_id).single();
          await supabase.from('items').update({ stock_count: (itm?.stock_count || 0) - qty }).eq('id', line.item_id);
        });
      }

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o));
      showToast('Sipariş tamamlandı — stoklar güncellendi ✓');
      return;
    }

    const patch = { status };
    await supabase.from('orders').update(patch).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o));
    showToast('Durum güncellendi ✓');
  };

  const openEdit = async (order) => {
    // Kalemleri çek
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    setEditOrder({ ...order, items: (items || []).map(i => ({ ...i, _key: Math.random() })) });
    setShowForm(true);
  };

  // Tab filtreleme
  const filtered = useMemo(() => {
    let list = orders;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q));
    }
    if (tab === 'current')  return list.filter(o => o.status === 'pending' || o.status === 'processing');
    if (tab === 'urgent')   return list.filter(o => isUrgent(o));
    if (tab === 'history')  return list.filter(o => o.status === 'completed' || o.status === 'cancelled');
    return list;
  }, [orders, tab, search]);

  const urgentCount  = orders.filter(isUrgent).length;
  const currentCount = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const historyCount = orders.filter(o => o.status === 'completed' || o.status === 'cancelled').length;
  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.grand_total, 0);

  const TABS = [
    { id:'current', label:'Mevcut',  icon: ShoppingCart, count: currentCount, color: currentColor },
    { id:'urgent',  label:'Acil',    icon: Zap,          count: urgentCount,  color: '#ef4444' },
    { id:'history', label:'Geçmiş',  icon: History,      count: historyCount, color: '#94a3b8' },
  ];

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl" style={{ background:`${currentColor}15`, color:currentColor }}>
              <ShoppingCart size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: c.text }}>Satış</h1>
              <p className="text-sm mt-0.5" style={{ color: c.muted }}>
                {orders.length} sipariş · Ciro: {fmt(totalRevenue)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Sipariş no / Müşteri..."
                className="pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
                style={{ background: c.card, borderColor: c.border, color: c.text }} />
            </div>
            <button onClick={() => { setEditOrder(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
              style={{ background: currentColor }}>
              <Plus size={15} />Yeni Sipariş
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { l:'Toplam Sipariş',  v: orders.length,  color: currentColor },
            { l:'Bekleyen',        v: currentCount,   color: '#f59e0b' },
            { l:'Acil (≤3 gün)',   v: urgentCount,    color: '#ef4444' },
            { l:'Toplam Ciro',     v: fmt(totalRevenue), color: '#10b981' },
          ].map(({l,v,color},i) => (
            <div key={i} className="rounded-2xl p-4" style={{ background: c.card, border:`1px solid ${c.border}` }}>
              <p className="text-xl font-bold" style={{ color }}>{v}</p>
              <p className="text-[10px] font-semibold mt-1" style={{ color: c.muted }}>{l}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b mb-5" style={{ borderColor: c.border }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all"
              style={{ color: tab===t.id ? t.color : c.muted, borderBottom: tab===t.id ? `2px solid ${t.color}` : '2px solid transparent' }}>
              <t.icon size={14} />
              {t.label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: tab===t.id ? `${t.color}20` : 'rgba(148,163,184,0.1)', color: tab===t.id ? t.color : c.muted }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Urgent banner */}
        {tab === 'urgent' && urgentCount > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-2xl mb-4"
            style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">
              <strong>{urgentCount} sipariş</strong> 3 gün içinde teslim edilmesi gerekiyor!
            </p>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2" style={{ color: c.muted }}>
            <Loader2 size={24} className="animate-spin" style={{ color: currentColor }} />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: c.muted }}>
            <ShoppingCart size={44} strokeWidth={1} className="opacity-20" />
            <p className="font-semibold">Bu sekmede sipariş yok.</p>
            {tab === 'current' && (
              <button onClick={() => { setEditOrder(null); setShowForm(true); }}
                className="btn-primary text-sm px-5 py-2">
                + İlk Siparişi Oluştur
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(order => (
              <OrderCard key={order.id} order={order}
                onEdit={openEdit}
                onStatusChange={updateStatus}
                onSendToWorkOrders={sendToWorkOrders}
                currentColor={currentColor}
                c={c} />
            ))}
          </div>
        )}

      </motion.div>

      {/* Form overlay */}
      <AnimatePresence>
        {showForm && (
          <OrderForm
            order={editOrder}
            customers={customers}
            allItems={allItems}
            allRecipes={allRecipes}
            currentColor={currentColor}
            // Tekliften sipariş oluşturma: quote_id + geri alınabilir durum
            quoteId={pendingQuoteId}
            quoteRevertFn={pendingQuoteId ? async () => {
              // İptal = teklif durum geri alınır
              if (pendingQuoteId && pendingQuoteOriginal) {
                try {
                  await fetch(`/api/quotes?id=${pendingQuoteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: pendingQuoteOriginal })
                  });
                } catch (_) {}
              }
              setPendingQuoteId(null);
              setPendingQuoteOriginal(null);
              setShowForm(false);
              setEditOrder(null);
            } : null}
            onClose={() => { 
              setPendingQuoteId(null);
              setPendingQuoteOriginal(null);
              setShowForm(false); 
              setEditOrder(null); 
            }}
            onSaved={() => { 
              setPendingQuoteId(null);
              setPendingQuoteOriginal(null);
              loadAll(); 
              showToast(editOrder?.id ? 'Sipariş güncellendi ✓' : 'Sipariş oluşturuldu ✓'); 
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:20 }}
            className="fixed bottom-6 right-6 z-[400] px-5 py-3 rounded-2xl shadow-xl text-white font-semibold text-sm"
            style={{ background: toast.type==='error' ? '#ef4444' : '#10b981' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Custom Dialogs */}
      <CustomDialog 
        {...dialog} 
        onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog({ ...dialog, open: false })}
      />
    </>
  );
}
