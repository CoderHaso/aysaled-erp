import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Loader2, Package, Cpu, DollarSign,
  Boxes, BookOpen, QrCode, ChevronLeft, Trash2, Tag
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from '../../contexts/ThemeContext';
import Select from '../ui/Select';
import BOMEditor from './BOMEditor';

const UNITS      = ['pcs', 'adet', 'kg', 'm', 'lt', 'm²', 'm³', 'kutu', 'rulo'];
const CURRENCIES = ['TRY', 'USD', 'EUR'];
const VAT_OPTS   = [0, 1, 8, 10, 18, 20].map(v => ({ value: v, label: `%${v}` }));
const IP_OPTS    = ['—', 'IP20', 'IP40', 'IP44', 'IP54', 'IP65', 'IP67', 'IP68'];
const VOLTAGE_OPTS = ['—', '12V', '24V', '36V', '48V', '220V', '220V AC'];
const KELVIN_OPTS  = ['—', '2700K', '3000K', '4000K', '5000K', '6500K'];
const SERIES_OPTS  = ['—', 'Lineer', 'Simit', 'Davul', 'Magnet', 'Panel', 'Özel'];
const COLOR_OPTS   = ['—', 'Beyaz', 'Siyah', 'Antrasit', 'Altın', 'Krom', 'Bakır'];
const CAT_RAW    = ['Hammadde', 'LED & Optik', 'Profil & Difüzör', 'Driver & Güç', 'Kablo & Bağlantı', 'Ambalaj', 'Sarf'];
const CAT_PROD   = ['Lineer Armatür', 'Simit/Davul', 'Magnet', 'Panel', 'Özel Ölçü', 'Dış Mekan', 'Diğer'];

const EMPTY = {
  name: '', sku: '', barcode: '', category: '', description: '',
  supplier_name: '', location: '', item_type: 'raw', is_active: true,
  unit: 'pcs', base_currency: 'TRY',
  purchase_price: '', sale_price: '', vat_rate: 18, margin_rate: 30,
  stock_count: 0, critical_limit: 10,
  specs: { lumen: '', watt: '', kelvin: '', ip_rating: '', length_cm: '', series: '', color: '', voltage: '' },
};

const TABS = [
  { id: 'general', label: 'Genel',      icon: Tag },
  { id: 'tech',    label: 'Teknik',     icon: Cpu },
  { id: 'pricing', label: 'Fiyat',      icon: DollarSign },
  { id: 'stock',   label: 'Stok',       icon: Boxes },
  { id: 'bom',     label: 'Reçete',     icon: BookOpen, productOnly: true },
  { id: 'qr',      label: 'QR',         icon: QrCode },
];

export default function StockDrawer({ item, defaultType, onClose, onSave, onDelete, saving }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const isEdit = !!item?.id;

  const [form, setForm]     = useState(() => {
    const base = item ? { ...EMPTY, ...item, specs: { ...EMPTY.specs, ...(item.specs || {}) } } : { ...EMPTY };
    if (!isEdit && defaultType) base.item_type = defaultType;
    return base;
  });
  const [tab,    setTab]    = useState('general');
  const [errors, setErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isProduct = form.item_type === 'product';

  const bg      = isDark ? '#1e293b' : '#fff';
  const panelBg = isDark ? '#0f172a' : '#f8fafc';
  const border  = isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#94a3b8' : '#64748b';
  const tabBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9';

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };
  const setSpec = (k, v) => setForm(f => ({ ...f, specs: { ...f.specs, [k]: v } }));

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = 'Ad zorunlu';
    if (!form.unit)         e.unit = 'Birim seçin';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { setTab('general'); return; }
    const payload = {
      ...form,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price:     parseFloat(form.sale_price)     || 0,
      vat_rate:       parseFloat(form.vat_rate)       || 0,
      margin_rate:    parseFloat(form.margin_rate)    || 0,
      stock_count:    parseFloat(form.stock_count)    || 0,
      critical_limit: parseFloat(form.critical_limit) || 0,
    };
    await onSave(payload);
  };

  // Önerilen satış fiyatı hesabı
  const salePrice    = parseFloat(form.sale_price)     || 0;
  const purchPrice   = parseFloat(form.purchase_price) || 0;
  const marginPct    = salePrice > 0 && purchPrice > 0
    ? (((salePrice - purchPrice) / purchPrice) * 100).toFixed(1) : null;
  const vatIncluded  = salePrice * (1 + (parseFloat(form.vat_rate) || 0) / 100);
  const suggestedSale = purchPrice * (1 + (parseFloat(form.margin_rate) || 0) / 100);

  // Stok seviyesi
  const stockPct  = form.critical_limit > 0
    ? Math.min(100, (form.stock_count / (form.critical_limit * 3)) * 100) : 100;
  const stockClr  = form.stock_count <= 0 ? '#ef4444' : form.stock_count <= form.critical_limit ? '#f59e0b' : '#10b981';

  // Tablarda görünecek sekmeler
  const visibleTabs = TABS.filter(t => !t.productOnly || isProduct);

  // QR değeri
  const qrValue = item?.id ? `${window.location.origin}/stock/${item.id}` : `aerp://new`;

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,42,0.35)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl"
        style={{
          width: 'min(720px, 100vw)',
          background: bg,
          borderLeft: `1px solid ${border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Drawer Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: border }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: muted }}
              onMouseEnter={e => e.currentTarget.style.background = tabBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft size={20} />
            </button>

            {/* Tür badge */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: isProduct ? `${currentColor}20` : '#f59e0b20',
                  color:      isProduct ? currentColor          : '#d97706',
                }}>
                {isProduct ? '⚡ Mamül' : '🔩 Hammadde'}
              </span>
              <h2 className="font-bold text-base truncate" style={{ color: text }}>
                {form.name || (isEdit ? 'Ürün Detayı' : 'Yeni Ürün')}
              </h2>
              {form.sku && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{ background: `${currentColor}15`, color: currentColor }}>
                  {form.sku}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isEdit && (
              <button onClick={() => setDeleteConfirm(true)}
                className="p-2 rounded-xl transition-colors"
                style={{ color: '#ef4444' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ef444415'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition-all"
              style={{ background: saving ? muted : currentColor }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>

        {/* ── Tür Seçimi (sadece yeni kayıtta) ──────────────────────────── */}
        {!isEdit && (
          <div className="flex gap-2 px-6 py-3 border-b" style={{ borderColor: border, background: panelBg }}>
            <p className="text-xs font-bold uppercase tracking-wider self-center" style={{ color: muted }}>
              Tür:
            </p>
            {[
              { v: 'raw',     label: '🔩 Hammadde' },
              { v: 'product', label: '⚡ Mamül' },
            ].map(({ v, label }) => (
              <button key={v} onClick={() => set('item_type', v)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold border transition-all"
                style={{
                  background:  form.item_type === v ? currentColor : 'transparent',
                  color:       form.item_type === v ? 'white' : muted,
                  borderColor: form.item_type === v ? currentColor : border,
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab Bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-4 border-b flex-shrink-0 overflow-x-auto"
          style={{ borderColor: border }}>
          {visibleTabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  color:        active ? currentColor : muted,
                  borderBottom: active ? `2px solid ${currentColor}` : '2px solid transparent',
                }}>
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── İçerik ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-5">

            {/* ── GENEL ──────────────────────────────────────────────────── */}
            {tab === 'general' && (
              <>
                <DrawerField label="Ürün Adı *" error={errors.name} muted={muted}>
                  <input className="modal-input" value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder={isProduct ? 'Örn: 150cm Lineer Armatür' : 'Örn: LED Chip 24V 4000K'}
                    style={errors.name ? { borderColor: '#ef4444' } : {}}
                  />
                </DrawerField>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="SKU / Ürün Kodu" muted={muted}>
                    <input className="modal-input" value={form.sku || ''}
                      onChange={e => set('sku', e.target.value)}
                      placeholder={isProduct ? 'Örn: LSU6005X3' : 'Örn: AYS-24V-LED-4K'}
                    />
                  </DrawerField>
                  <DrawerField label="Barkod / QR" muted={muted}>
                    <input className="modal-input" value={form.barcode || ''}
                      onChange={e => set('barcode', e.target.value)} placeholder="EAN-13 / QR" />
                  </DrawerField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="Kategori" muted={muted}>
                    <Select
                      value={form.category || ''}
                      onChange={v => set('category', v)}
                      options={[{ value: '', label: '— Seç —' }, ...(isProduct ? CAT_PROD : CAT_RAW).map(c => ({ value: c, label: c }))]}
                    />
                  </DrawerField>
                  <DrawerField label="Birim *" error={errors.unit} muted={muted}>
                    <Select value={form.unit} onChange={v => set('unit', v)} options={UNITS} error={errors.unit} />
                  </DrawerField>
                </div>

                <DrawerField label="Açıklama" muted={muted}>
                  <textarea className="modal-input" rows={3}
                    value={form.description || ''}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Teknik detaylar, kullanım notu..." />
                </DrawerField>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label={isProduct ? 'Üretici / Marka' : 'Tedarikçi'} muted={muted}>
                    <input className="modal-input" value={form.supplier_name || ''}
                      onChange={e => set('supplier_name', e.target.value)}
                      placeholder={isProduct ? 'Aysaled' : 'Ledim, Meanwell...'} />
                  </DrawerField>
                  <DrawerField label="Raf / Depo Yeri" muted={muted}>
                    <input className="modal-input" value={form.location || ''}
                      onChange={e => set('location', e.target.value)} placeholder="A-3-2" />
                  </DrawerField>
                </div>

                {/* Aktif toggle */}
                <div className="flex items-center justify-between py-3 px-4 rounded-xl border"
                  style={{ background: tabBg, borderColor: border }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: text }}>Aktif Kayıt</p>
                    <p className="text-xs" style={{ color: muted }}>Listede görünsün / gizlensin</p>
                  </div>
                  <button onClick={() => set('is_active', !form.is_active)}
                    className="relative w-11 h-6 rounded-full transition-all"
                    style={{ background: form.is_active ? currentColor : border }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: form.is_active ? '22px' : '4px' }} />
                  </button>
                </div>
              </>
            )}

            {/* ── TEKNİK ─────────────────────────────────────────────────── */}
            {tab === 'tech' && (
              <>
                <div className="p-3 rounded-xl border text-xs" style={{ borderColor: '#3b82f620', background: '#3b82f610', color: '#3b82f6' }}>
                  Teknik özellikler aydınlatma ürün kartında, QR okutulduğunda ve raporlarda görünür.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="Güç (Watt)" muted={muted}>
                    <input type="number" min="0" className="modal-input"
                      value={form.specs.watt || ''} onChange={e => setSpec('watt', e.target.value)} placeholder="36" />
                  </DrawerField>
                  <DrawerField label="Lümen (lm)" muted={muted}>
                    <input type="number" min="0" className="modal-input"
                      value={form.specs.lumen || ''} onChange={e => setSpec('lumen', e.target.value)} placeholder="3600" />
                  </DrawerField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="Renk Sıcaklığı" muted={muted}>
                    <Select value={form.specs.kelvin || '—'} onChange={v => setSpec('kelvin', v === '—' ? '' : v)} options={KELVIN_OPTS} />
                  </DrawerField>
                  <DrawerField label="IP Koruma" muted={muted}>
                    <Select value={form.specs.ip_rating || '—'} onChange={v => setSpec('ip_rating', v === '—' ? '' : v)} options={IP_OPTS} />
                  </DrawerField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="Voltaj / Besleme" muted={muted}>
                    <Select value={form.specs.voltage || '—'} onChange={v => setSpec('voltage', v === '—' ? '' : v)} options={VOLTAGE_OPTS} />
                  </DrawerField>
                  <DrawerField label="Uzunluk (cm)" muted={muted}>
                    <input type="number" min="0" className="modal-input"
                      value={form.specs.length_cm || ''} onChange={e => setSpec('length_cm', e.target.value)} placeholder="150" />
                  </DrawerField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="Seri" muted={muted}>
                    <Select value={form.specs.series || '—'} onChange={v => setSpec('series', v === '—' ? '' : v)} options={SERIES_OPTS} />
                  </DrawerField>
                  <DrawerField label="Gövde Rengi" muted={muted}>
                    <Select value={form.specs.color || '—'} onChange={v => setSpec('color', v === '—' ? '' : v)} options={COLOR_OPTS} />
                  </DrawerField>
                </div>

                {/* Teknik özet kartı */}
                {(form.specs.watt || form.specs.lumen || form.specs.kelvin) && (
                  <div className="rounded-2xl p-4 grid grid-cols-3 gap-3"
                    style={{ background: panelBg, border: `1px solid ${border}` }}>
                    {[
                      { label: 'Verimlilik', value: form.specs.watt && form.specs.lumen ? `${(form.specs.lumen / form.specs.watt).toFixed(0)} lm/W` : '—' },
                      { label: 'Renk',       value: form.specs.kelvin || '—' },
                      { label: 'IP',         value: form.specs.ip_rating || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                        <p className="text-base font-bold mt-0.5" style={{ color: currentColor }}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── FİYAT ──────────────────────────────────────────────────── */}
            {tab === 'pricing' && (
              <>
                <DrawerField label="Para Birimi" muted={muted}>
                  <div className="flex gap-2">
                    {CURRENCIES.map(cur => (
                      <button key={cur} onClick={() => set('base_currency', cur)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all"
                        style={{
                          background:  form.base_currency === cur ? currentColor : 'var(--input-bg)',
                          color:       form.base_currency === cur ? 'white' : muted,
                          borderColor: form.base_currency === cur ? currentColor : border,
                        }}>
                        {cur}
                      </button>
                    ))}
                  </div>
                </DrawerField>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label={`Alış Fiyatı (${form.base_currency})`} muted={muted}>
                    <input type="number" min="0" step="0.01" className="modal-input"
                      value={form.purchase_price || ''} onChange={e => set('purchase_price', e.target.value)} placeholder="0.00" />
                  </DrawerField>
                  <DrawerField label={`Satış Fiyatı (${form.base_currency})`} muted={muted}>
                    <input type="number" min="0" step="0.01" className="modal-input"
                      value={form.sale_price || ''} onChange={e => set('sale_price', e.target.value)} placeholder="0.00" />
                  </DrawerField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label="KDV Oranı" muted={muted}>
                    <Select value={form.vat_rate} onChange={v => set('vat_rate', v)} options={VAT_OPTS} />
                  </DrawerField>
                  <DrawerField label="Hedef Kâr Marjı (%)" muted={muted}>
                    <input type="number" min="0" max="999" className="modal-input"
                      value={form.margin_rate || ''} onChange={e => set('margin_rate', e.target.value)} placeholder="30" />
                  </DrawerField>
                </div>

                {/* Kâr analizi */}
                {purchPrice > 0 && (
                  <div className="rounded-2xl p-5 grid grid-cols-2 gap-4"
                    style={{ background: panelBg, border: `1px solid ${border}` }}>
                    {[
                      { label: 'Kâr Tutarı',       value: salePrice > 0 ? `${form.base_currency} ${(salePrice - purchPrice).toFixed(2)}` : '—' },
                      { label: 'Kâr Marjı',         value: marginPct ? `%${marginPct}` : '—' },
                      { label: 'KDV\'li Satış Fiyatı', value: salePrice > 0 ? `${form.base_currency} ${vatIncluded.toFixed(2)}` : '—' },
                      { label: `Önerilen Satış (%${form.margin_rate})`, value: `${form.base_currency} ${suggestedSale.toFixed(2)}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl p-3" style={{ background: bg }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                        <p className="text-lg font-bold mt-0.5" style={{ color: currentColor }}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── STOK ───────────────────────────────────────────────────── */}
            {tab === 'stock' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <DrawerField label={`Mevcut Stok (${form.unit})`} muted={muted}>
                    <input type="number" min="0" step="0.001" className="modal-input"
                      value={form.stock_count} onChange={e => set('stock_count', e.target.value)} />
                  </DrawerField>
                  <DrawerField label={`Kritik Limit (${form.unit})`} muted={muted}>
                    <input type="number" min="0" step="0.001" className="modal-input"
                      value={form.critical_limit} onChange={e => set('critical_limit', e.target.value)} />
                  </DrawerField>
                </div>

                {/* Stok göstergesi */}
                <div className="rounded-2xl p-5" style={{ background: panelBg, border: `1px solid ${border}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold" style={{ color: text }}>Stok Durumu</span>
                    <span className="text-sm font-bold" style={{ color: stockClr }}>
                      {form.stock_count <= 0 ? '🔴 Stok Yok' : form.stock_count <= form.critical_limit ? '🟡 Kritik' : '🟢 Normal'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: border }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${stockPct}%`, background: stockClr }} />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs" style={{ color: muted }}>0</span>
                    <span className="text-xs font-semibold" style={{ color: stockClr }}>
                      {form.stock_count} {form.unit}
                    </span>
                    <span className="text-xs" style={{ color: muted }}>
                      Kritik: {form.critical_limit} {form.unit}
                    </span>
                  </div>
                </div>

                {/* Son alış */}
                {item?.last_purchase_date && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{ borderColor: border, background: tabBg }}>
                    <div>
                      <p className="text-xs font-bold" style={{ color: muted }}>Son Alış Tarihi</p>
                      <p className="text-sm font-semibold" style={{ color: text }}>{item.last_purchase_date}</p>
                    </div>
                    {item.supplier_name && (
                      <div className="border-l pl-3" style={{ borderColor: border }}>
                        <p className="text-xs font-bold" style={{ color: muted }}>Tedarikçi</p>
                        <p className="text-sm font-semibold" style={{ color: text }}>{item.supplier_name}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── REÇETE (BOM) — sadece mamül ───────────────────────────── */}
            {tab === 'bom' && isProduct && (
              <BOMEditor parentId={item?.id} isDark={isDark} currentColor={currentColor} />
            )}

            {/* ── QR KOD ─────────────────────────────────────────────────── */}
            {tab === 'qr' && (
              <div className="flex flex-col items-center gap-6">
                <p className="text-xs text-center font-bold uppercase tracking-widest" style={{ color: muted }}>
                  A-ERP · RAF KARTI
                </p>

                <div className="p-5 rounded-2xl shadow-inner" style={{ background: '#fff' }}>
                  <QRCodeSVG value={qrValue} size={200} fgColor="#0f172a" bgColor="#fff" level="M" />
                </div>

                {/* Raf bilgi kartı */}
                <div className="w-full rounded-2xl p-5 space-y-3"
                  style={{ background: panelBg, border: `1px solid ${border}` }}>
                  <div className="text-center border-b pb-3" style={{ borderColor: border }}>
                    <h3 className="font-bold text-lg" style={{ color: text }}>{form.name || '—'}</h3>
                    {form.sku && <p className="text-sm font-mono" style={{ color: currentColor }}>{form.sku}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Stok', value: `${form.stock_count} ${form.unit}`, color: stockClr },
                      { label: 'Kritik Limit', value: `${form.critical_limit} ${form.unit}` },
                      { label: 'Son Alış', value: form.purchase_price > 0 ? `${form.base_currency} ${form.purchase_price}` : '—' },
                      { label: 'Tedarikçi', value: form.supplier_name || '—' },
                      { label: 'Raf / Depo', value: form.location || '—' },
                      { label: 'Kategori', value: form.category || '—' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl p-3" style={{ background: bg }}>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: color || text }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-center font-mono break-all" style={{ color: muted }}>{qrValue}</p>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      const win = window.open('', '_blank');
                      win.document.write(`<html><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fff;font-family:sans-serif">
                        <div style="border:2px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;max-width:280px">
                          <p style="font-size:10px;font-weight:800;letter-spacing:0.15em;color:#94a3b8;text-transform:uppercase;margin-bottom:16px">A-ERP · RAF KARTI</p>
                          <svg xmlns="http://www.w3.org/2000/svg">${document.querySelector('#qr-svg')?.innerHTML || ''}</svg>
                          <h3 style="font-size:15px;font-weight:700;margin:12px 0 4px;color:#0f172a">${form.name}</h3>
                          <p style="font-size:11px;font-family:monospace;color:#64748b">${form.sku || ''}</p>
                          <hr style="margin:12px 0;border:none;border-top:1px solid #e2e8f0">
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left">
                            <div><label style="font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8">Stok</label><p style="font-size:13px;font-weight:700;color:${stockClr}">${form.stock_count} ${form.unit}</p></div>
                            <div><label style="font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8">Tedarikçi</label><p style="font-size:13px;font-weight:700;color:#0f172a">${form.supplier_name || '—'}</p></div>
                          </div>
                        </div>
                      </body></html>`);
                      win.print();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
                    style={{ background: currentColor }}>
                    Raf Kartı Yazdır
                  </button>
                </div>

                {/* Hidden SVG for print */}
                <div id="qr-svg" style={{ display: 'none' }}>
                  <QRCodeSVG value={qrValue} size={180} fgColor="#0f172a" bgColor="#fff" level="M" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Silme onayı ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 left-0 right-0 p-5 border-t shadow-2xl"
              style={{ background: bg, borderColor: '#ef4444' }}>
              <p className="text-sm font-bold mb-3" style={{ color: text }}>
                "{form.name}" silinsin mi?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-xl border font-semibold text-sm"
                  style={{ borderColor: border, color: muted }}>
                  İptal
                </button>
                <button onClick={() => { onDelete(item.id); setDeleteConfirm(false); }}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-sm"
                  style={{ background: '#ef4444' }}>
                  Evet, Sil
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function DrawerField({ label, error, children, muted }) {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: muted }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}
