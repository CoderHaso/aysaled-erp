import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, Tag, Cpu, DollarSign, Boxes, BookOpen, QrCode, Trash2, Settings } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from '../../contexts/ThemeContext';
import Select from '../ui/Select';
import BOMEditor from './BOMEditor';
import SupplierAutocomplete from './SupplierAutocomplete';
import { useCategories } from '../../hooks/useCategories';
import { useUnits } from '../../hooks/useUnits';

const CURRENCIES   = ['TRY', 'USD', 'EUR'];
const VAT_OPTS     = [0, 1, 8, 10, 18, 20].map(v => ({ value: v, label: `%${v}` }));
const IP_OPTS      = ['—', 'IP20', 'IP40', 'IP44', 'IP54', 'IP65', 'IP67', 'IP68'];
const VOLTAGE_OPTS = ['—', '12V', '24V', '36V', '48V', '220V', '220V AC'];
const KELVIN_OPTS  = ['—', '2700K', '3000K', '4000K', '5000K', '6500K'];
const SERIES_OPTS  = ['—', 'Lineer', 'Simit', 'Davul', 'Magnet', 'Panel', 'Özel'];
const COLOR_OPTS   = ['—', 'Beyaz', 'Siyah', 'Antrasit', 'Altın', 'Krom', 'Bakır'];

const EMPTY = {
  name: '', sku: '', category: '', description: '',
  supplier_name: '', location: '', item_type: 'raw', is_active: true, has_bom: true,
  unit: 'pcs', base_currency: 'TRY',
  purchase_price: '', sale_price: '', vat_rate: 18, margin_rate: 30,
  stock_count: 0, critical_limit: 10,
  specs: { lumen: '', watt: '', kelvin: '', ip_rating: '', length_cm: '', series: '', color: '', voltage: '' },
};

const FORM_TABS = [
  { id: 'general', label: 'Genel',    icon: Tag        },
  { id: 'tech',    label: 'Teknik',   icon: Cpu        },
  { id: 'pricing', label: 'Fiyat',    icon: DollarSign },
  { id: 'stock',   label: 'Stok',     icon: Boxes      },
  { id: 'bom',     label: 'Reçete',   icon: BookOpen   },
  { id: 'qr',      label: 'QR',       icon: QrCode,    editOnly: true   },
];

export default function StockForm({ item, defaultType, onBack, onSave, onDelete, saving }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const isEdit = !!item?.id;

  const [form, setForm] = useState(() => {
    // F5'ten kurtarma işlemi
    const draft = sessionStorage.getItem('aerp_stock_draft');
    if (!isEdit && draft) {
      try { return JSON.parse(draft); } catch (e) {}
    }
    const base = item
      ? { ...EMPTY, ...item, specs: { ...EMPTY.specs, ...(item.specs || {}) } }
      : { ...EMPTY };
    if (!isEdit && defaultType) base.item_type = defaultType;
    return base;
  });
  const [tab,        setTab]        = useState('general');
  const [errors,     setErrors]     = useState({});
  const [pendingBOM, setPendingBOM] = useState(() => {
    const s = sessionStorage.getItem('aerp_pending_bom'); try { return s ? JSON.parse(s) : []; } catch(e){ return []; }
  });
  const [deleteConf, setDeleteConf] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showUnitMgr, setShowUnitMgr] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const isProduct = form.item_type === 'product';
  const { categories, add: addCat, remove: removeCat } = useCategories(isProduct ? 'product' : 'raw');
  const { units, addUnit, removeUnit } = useUnits();

  // Form değiştikçe sessionStorage'a yedekle
  React.useEffect(() => {
    if (!isEdit) {
      sessionStorage.setItem('aerp_stock_draft', JSON.stringify(form));
      sessionStorage.setItem('aerp_pending_bom', JSON.stringify(pendingBOM));
    }
  }, [form, pendingBOM, isEdit]);

  const clearDraft = () => { sessionStorage.removeItem('aerp_stock_draft'); sessionStorage.removeItem('aerp_pending_bom'); };

  const onBackClick = () => { clearDraft(); onBack(); };

  const bg     = isDark ? '#0f172a' : '#f8fafc';
  const card   = isDark ? 'rgba(30,41,59,0.97)' : '#ffffff';
  const border = isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0';
  const text   = isDark ? '#f1f5f9' : '#0f172a';
  const muted  = isDark ? '#94a3b8' : '#64748b';
  const tabBg  = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9';

  const set     = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };
  const setSpec = (k, v) => setForm(f => ({ ...f, specs: { ...f.specs, [k]: v } }));

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = 'Ad zorunlu';
    if (!form.unit)         e.unit = 'Birim seçin';
    setErrors(e);
    if (Object.keys(e).length > 0) setTab('general');
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      ...form,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price:     parseFloat(form.sale_price)     || 0,
      vat_rate:       parseFloat(form.vat_rate)       || 0,
      margin_rate:    parseFloat(form.margin_rate)    || 0,
      stock_count:    parseFloat(form.stock_count)    || 0,
      critical_limit: parseFloat(form.critical_limit) || 0,
    };
    await onSave(payload, pendingBOM);
    clearDraft();
  };

  const pp  = parseFloat(form.purchase_price) || 0;
  const sp  = parseFloat(form.sale_price)     || 0;
  const vat = parseFloat(form.vat_rate)       || 0;
  const mgn = parseFloat(form.margin_rate)    || 0;
  const stockClr = form.stock_count <= 0 ? '#ef4444'
    : form.critical_limit > 0 && form.stock_count <= form.critical_limit ? '#f59e0b' : '#10b981';
  const stockPct = form.critical_limit > 0
    ? Math.min(100, (form.stock_count / (form.critical_limit * 3)) * 100) : 80;

  // Yeni oluşturulan (veya eski) barkodlarda PWA uyumu için HashRouter formatı:
  const qrValue     = item?.id ? `${window.location.origin}/#/stock/${item.id}` : 'aerp://new';
  const visibleTabs = FORM_TABS.filter(t => {
    if (t.productOnly && !isProduct) return false; // Sadece Hammadde için BOM tamamen gizlenir
    if (t.editOnly && !isEdit) return false;
    return true; // Mamül ise pricing de bom da kalır (tab bar'da disabled stili verilecek)
  });
  const catOptions = [{ value: '', label: '— Seç —' }, ...categories.map(c => ({ value: c.name, label: c.name }))];
  const unitOptions = units.map(u => ({ value: u.name, label: u.name }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{ background: bg, minHeight: '100%' }}
    >
      {/* ── Sticky Header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20" style={{ background: card, borderBottom: `1px solid ${border}` }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={onBackClick}
              className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition-all flex-shrink-0"
              style={{ borderColor: border, color: muted, background: tabBg }}>
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Geri</span>
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="hidden xs:inline text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: isProduct ? `${currentColor}20` : '#f59e0b20', color: isProduct ? currentColor : '#d97706' }}>
                {isProduct ? '⚡ Mamül' : '🔩 Ham'}
              </span>
              <h2 className="font-bold text-sm sm:text-base truncate" style={{ color: text }}>
                {form.name || (isEdit ? 'Düzenle' : 'Yeni Kayıt')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isEdit && (
              <button onClick={() => setDeleteConf(true)}
                className="p-1.5 sm:p-2 rounded-xl transition-all" style={{ color: '#ef4444' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ef444415'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl text-white text-xs sm:text-sm font-bold"
              style={{ background: saving ? muted : currentColor }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? '...' : isEdit ? 'Güncelle' : 'Kaydet'}</span>
            </button>
          </div>
        </div>

        {/* Tür seçimi — yeni kayıtta */}
        {!isEdit && (
          <div className="flex items-center gap-2 px-3 sm:px-6 py-2 border-t" style={{ borderColor: border }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Tür:</span>
            {[{ v: 'raw', l: '🔩 Hammadde' }, { v: 'product', l: '⚡ Mamül' }].map(({ v, l }) => (
              <button key={v}
                onClick={() => { set('item_type', v); if (tab === 'bom' && v !== 'product') setTab('general'); }}
                className="px-3 py-1 rounded-xl text-xs font-bold border transition-all"
                style={{
                  background:  form.item_type === v ? currentColor : 'transparent',
                  color:       form.item_type === v ? 'white' : muted,
                  borderColor: form.item_type === v ? currentColor : border,
                }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex items-center overflow-x-auto border-t" style={{ borderColor: border }}>
          {visibleTabs.map(t => {
            const active = tab === t.id;
            const disabled = isProduct && (
              (t.id === 'pricing' && form.has_bom) || 
              (t.id === 'bom' && !form.has_bom)
            );
            
            return (
              <button key={t.id} onClick={() => { if (!disabled) setTab(t.id); }}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all"
                style={{ 
                  color: active ? currentColor : disabled ? (isDark ? '#334155' : '#cbd5e1') : muted, 
                  borderBottom: active ? `2px solid ${currentColor}` : '2px solid transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}>
                <t.icon size={12} />
                {t.label}
                {t.id === 'bom' && pendingBOM.length > 0 && !isEdit && !disabled && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: `${currentColor}20`, color: currentColor }}>
                    {pendingBOM.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Form İçeriği (tek scroll → main) ─────────────────────────────── */}
      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-8 gap-y-4 sm:gap-y-5 max-w-5xl">

        {/* ── GENEL ──────────────────────────────────────────────────────── */}
        {tab === 'general' && (
          <>
            <div className="sm:col-span-2">
              <FF label="Ürün Adı *" error={errors.name} muted={muted}>
                <input autoFocus className="modal-input" value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder={isProduct ? 'Örn: 150cm Lineer Armatür' : 'Örn: LED Chip 24V 4000K'}
                  style={errors.name ? { borderColor: '#ef4444' } : {}} />
              </FF>
            </div>

            <FF label="SKU / Ürün Kodu" muted={muted}>
              <div className="flex gap-2">
                <input className="modal-input flex-1" value={form.sku || ''}
                  onChange={e => set('sku', e.target.value)} placeholder={isProduct ? 'LSU6005X3' : 'AYS-24V-LED-4K'} />
                
                {/* Reçeteli Üretim Toggle SADECE ÜRÜN (Mamül) İSE ÇIKAR */}
                {isProduct && (
                  <button type="button" onClick={() => {
                    const nextBom = !form.has_bom;
                    set('has_bom', nextBom);
                    if (nextBom && tab === 'pricing') setTab('general');
                    if (!nextBom && tab === 'bom') setTab('general');
                  }}
                    className="px-3 sm:px-4 rounded-xl text-[10px] sm:text-xs font-bold transition-all border whitespace-nowrap"
                    style={{
                      background: form.has_bom ? currentColor : 'transparent',
                      color: form.has_bom ? 'white' : muted,
                      borderColor: form.has_bom ? currentColor : border
                    }}>
                    {form.has_bom ? '✓ Reçeteli (BOM)' : 'Al-Sat (BOM Yok)'}
                  </button>
                )}
              </div>
            </FF>

            {/* Kategori + yönetim */}
            <FF label="Kategori" muted={muted}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={form.category || ''} onChange={v => set('category', v)} options={catOptions} />
                </div>
                <button type="button" onClick={() => setShowCatMgr(v => !v)} title="Kategorileri Yönet"
                  className="p-2 rounded-xl border transition-all flex-shrink-0"
                  style={{ borderColor: showCatMgr ? currentColor : border, color: showCatMgr ? currentColor : muted, background: showCatMgr ? `${currentColor}15` : 'transparent' }}>
                  <Settings size={14} />
                </button>
              </div>
              {showCatMgr && (
                <div className="mt-2 rounded-xl border p-3 space-y-2"
                  style={{ borderColor: currentColor, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Kategoriler</p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                    {categories.map(c => (
                      <span key={c.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                        style={{ borderColor: border, color: text }}>
                        {c.name}
                        <button onClick={() => removeCat(c.id)} style={{ color: '#ef4444', lineHeight: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input className="modal-input flex-1" placeholder="Yeni kategori..."
                      value={newCatName} onChange={e => setNewCatName(e.target.value)}
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onKeyDown={async e => { if (e.key === 'Enter' && newCatName.trim()) { const cat = newCatName.trim(); await addCat(cat, isProduct ? 'product' : 'raw'); set('category', cat); setNewCatName(''); } }} />
                    <button onClick={async () => { if (newCatName.trim()) { const cat = newCatName.trim(); await addCat(cat, isProduct ? 'product' : 'raw'); set('category', cat); setNewCatName(''); } }}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold"
                      style={{ background: currentColor }}>
                      Ekle
                    </button>
                  </div>
                </div>
              )}
            </FF>

            <FF label="Birim *" error={errors.unit} muted={muted}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={form.unit} onChange={v => set('unit', v)} options={unitOptions.length ? unitOptions : ['yükleniyor...']} error={errors.unit} />
                </div>
                <button type="button" onClick={() => setShowUnitMgr(v => !v)} title="Birimleri Yönet"
                  className="p-2 rounded-xl border transition-all flex-shrink-0"
                  style={{ borderColor: showUnitMgr ? currentColor : border, color: showUnitMgr ? currentColor : muted, background: showUnitMgr ? `${currentColor}15` : 'transparent' }}>
                  <Settings size={14} />
                </button>
              </div>
              {showUnitMgr && (
                <div className="mt-2 rounded-xl border p-3 space-y-2"
                  style={{ borderColor: currentColor, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Birimler</p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                    {units.map(u => (
                      <span key={u.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                        style={{ borderColor: border, color: text }}>
                        {u.name}
                        <button onClick={() => removeUnit(u.id)} style={{ color: '#ef4444', lineHeight: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input className="modal-input flex-1" placeholder="Yeni birim (Örn: kg, adet)..."
                      value={newUnitName} onChange={e => setNewUnitName(e.target.value)}
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onKeyDown={async e => { if (e.key === 'Enter' && newUnitName.trim()) { const unt = newUnitName.trim(); await addUnit(unt); set('unit', unt); setNewUnitName(''); } }} />
                    <button onClick={async () => { if (newUnitName.trim()) { const unt = newUnitName.trim(); await addUnit(unt); set('unit', unt); setNewUnitName(''); } }}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold"
                      style={{ background: currentColor }}>
                      Ekle
                    </button>
                  </div>
                </div>
              )}
            </FF>

            <FF label={isProduct ? 'Üretici / Marka' : 'Tedarikçi'} muted={muted}>
              <SupplierAutocomplete value={form.supplier_name || ''} onChange={v => set('supplier_name', v)} />
            </FF>

            <FF label="Raf / Depo Yeri" muted={muted}>
              <input className="modal-input" value={form.location || ''}
                onChange={e => set('location', e.target.value)} placeholder="A-3-2" />
            </FF>

            <div className="sm:col-span-2">
              <FF label="Açıklama" muted={muted}>
                <textarea className="modal-input" rows={3} value={form.description || ''}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Teknik detaylar, ek notlar..." />
              </FF>
            </div>

            <div className="sm:col-span-2">
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
            </div>
          </>
        )}

        {/* ── TEKNİK ─────────────────────────────────────────────────────── */}
        {tab === 'tech' && (
          <>
            <FF label="Güç (Watt)" muted={muted}>
              <input type="number" min="0" className="modal-input"
                value={form.specs.watt || ''} onChange={e => setSpec('watt', e.target.value)} placeholder="36" />
            </FF>
            <FF label="Lümen (lm)" muted={muted}>
              <input type="number" min="0" className="modal-input"
                value={form.specs.lumen || ''} onChange={e => setSpec('lumen', e.target.value)} placeholder="3600" />
            </FF>
            <FF label="Renk Sıcaklığı" muted={muted}>
              <Select value={form.specs.kelvin || '—'} onChange={v => setSpec('kelvin', v === '—' ? '' : v)} options={KELVIN_OPTS} />
            </FF>
            <FF label="IP Koruma" muted={muted}>
              <Select value={form.specs.ip_rating || '—'} onChange={v => setSpec('ip_rating', v === '—' ? '' : v)} options={IP_OPTS} />
            </FF>
            <FF label="Voltaj / Besleme" muted={muted}>
              <Select value={form.specs.voltage || '—'} onChange={v => setSpec('voltage', v === '—' ? '' : v)} options={VOLTAGE_OPTS} />
            </FF>
            <FF label="Uzunluk (cm)" muted={muted}>
              <input type="number" min="0" className="modal-input"
                value={form.specs.length_cm || ''} onChange={e => setSpec('length_cm', e.target.value)} placeholder="150" />
            </FF>
            <FF label="Seri" muted={muted}>
              <Select value={form.specs.series || '—'} onChange={v => setSpec('series', v === '—' ? '' : v)} options={SERIES_OPTS} />
            </FF>
            <FF label="Gövde Rengi" muted={muted}>
              <Select value={form.specs.color || '—'} onChange={v => setSpec('color', v === '—' ? '' : v)} options={COLOR_OPTS} />
            </FF>
            {(form.specs.watt || form.specs.lumen) && (
              <div className="sm:col-span-2 rounded-2xl p-4 grid grid-cols-3 gap-4"
                style={{ background: tabBg, border: `1px solid ${border}` }}>
                {[
                  { label: 'Verimlilik', value: form.specs.watt && form.specs.lumen ? `${Math.round(form.specs.lumen / form.specs.watt)} lm/W` : '—' },
                  { label: 'Renk',       value: form.specs.kelvin || '—' },
                  { label: 'IP / V',     value: [form.specs.ip_rating, form.specs.voltage].filter(Boolean).join(' · ') || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                    <p className="text-lg font-bold mt-0.5" style={{ color: currentColor }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── FİYAT ──────────────────────────────────────────────────────── */}
        {tab === 'pricing' && (
          <>
            <div className="sm:col-span-2">
              <FF label="Para Birimi" muted={muted}>
                <div className="flex gap-2">
                  {CURRENCIES.map(cur => (
                    <button key={cur} onClick={() => set('base_currency', cur)}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl text-sm font-bold border transition-all"
                      style={{
                        background:  form.base_currency === cur ? currentColor : 'var(--input-bg)',
                        color:       form.base_currency === cur ? 'white' : muted,
                        borderColor: form.base_currency === cur ? currentColor : border,
                      }}>
                      {cur}
                    </button>
                  ))}
                </div>
              </FF>
            </div>
            <FF label={`Alış Fiyatı (${form.base_currency})`} muted={muted}>
              <input type="number" min="0" step="0.01" className="modal-input"
                value={form.purchase_price || ''} onChange={e => set('purchase_price', e.target.value)} placeholder="0.00" />
            </FF>
            <FF label={`Satış Fiyatı (${form.base_currency})`} muted={muted}>
              <input type="number" min="0" step="0.01" className="modal-input"
                value={form.sale_price || ''} onChange={e => set('sale_price', e.target.value)} placeholder="0.00" />
            </FF>
            <FF label="KDV Oranı" muted={muted}>
              <Select value={form.vat_rate} onChange={v => set('vat_rate', v)} options={VAT_OPTS} />
            </FF>
            <FF label="Hedef Kâr Marjı (%)" muted={muted}>
              <input type="number" min="0" className="modal-input"
                value={form.margin_rate || ''} onChange={e => set('margin_rate', e.target.value)} placeholder="30" />
            </FF>
            {pp > 0 && (
              <div className="sm:col-span-2 rounded-2xl p-4 sm:p-5 grid grid-cols-2 gap-3 sm:gap-4"
                style={{ background: tabBg, border: `1px solid ${border}` }}>
                {[
                  { label: 'Kâr Tutarı',           value: sp > 0 ? `${form.base_currency} ${(sp - pp).toFixed(2)}` : '—' },
                  { label: 'Kâr Marjı',             value: sp > 0 ? `%${(((sp - pp) / pp) * 100).toFixed(1)}` : '—' },
                  { label: "KDV'li Satış",          value: sp > 0 ? `${form.base_currency} ${(sp * (1 + vat / 100)).toFixed(2)}` : '—' },
                  { label: `Önerilen (%${mgn})`,    value: `${form.base_currency} ${(pp * (1 + mgn / 100)).toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: isDark ? '#0f172a' : '#fff' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                    <p className="text-base sm:text-lg font-bold mt-0.5" style={{ color: currentColor }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STOK ───────────────────────────────────────────────────────── */}
        {tab === 'stock' && (
          <>
            <FF label={`Mevcut Stok (${form.unit})`} muted={muted}>
              <input type="number" min="0" step="0.001" className="modal-input"
                value={form.stock_count} onChange={e => set('stock_count', e.target.value)} />
            </FF>
            <FF label={`Kritik Limit (${form.unit})`} muted={muted}>
              <input type="number" min="0" step="0.001" className="modal-input"
                value={form.critical_limit} onChange={e => set('critical_limit', e.target.value)} />
            </FF>
            <div className="sm:col-span-2 rounded-2xl p-4 sm:p-5" style={{ background: tabBg, border: `1px solid ${border}` }}>
              <div className="flex justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: text }}>Stok Seviyesi</span>
                <span className="text-sm font-bold" style={{ color: stockClr }}>
                  {form.stock_count <= 0 ? '🔴 Stok Yok'
                    : parseFloat(form.critical_limit) > 0 && parseFloat(form.stock_count) <= parseFloat(form.critical_limit)
                    ? '🟡 Kritik' : '🟢 Normal'}
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: border }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${stockPct}%`, background: stockClr }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs" style={{ color: muted }}>0</span>
                <span className="text-xs font-bold" style={{ color: stockClr }}>{form.stock_count} {form.unit}</span>
                <span className="text-xs" style={{ color: muted }}>Kritik: {form.critical_limit} {form.unit}</span>
              </div>
            </div>
          </>
        )}

        {/* ── REÇETE (BOM) ───────────────────────────────────────────────── */}
        {tab === 'bom' && isProduct && form.has_bom && (
          <div className="sm:col-span-2">
            <BOMEditor
              parentId={isEdit ? item.id : null}
              pendingLines={!isEdit ? pendingBOM : undefined}
              onPendingChange={!isEdit ? setPendingBOM : undefined}
              form={form}
              setForm={set}
            />
          </div>
        )}

        {/* ── QR ─────────────────────────────────────────────────────────── */}
        {tab === 'qr' && (
          <div className="sm:col-span-2 flex flex-col items-center gap-5">
            <div className="p-5 rounded-2xl" style={{ background: '#fff' }}>
              <QRCodeSVG value={qrValue} size={180} fgColor="#0f172a" bgColor="#fff" level="M" />
            </div>
            <div className="w-full rounded-2xl p-4 sm:p-5 grid grid-cols-2 gap-3"
              style={{ background: tabBg, border: `1px solid ${border}` }}>
              {[
                { label: 'Stok',      value: `${form.stock_count} ${form.unit}`, color: stockClr },
                { label: 'Son Alış',  value: form.purchase_price > 0 ? `${form.base_currency} ${form.purchase_price}` : '—' },
                { label: 'Tedarikçi', value: form.supplier_name || '—' },
                { label: 'Raf',       value: form.location || '—' },
                { label: 'Kritik',    value: `${form.critical_limit} ${form.unit}` },
                { label: 'SKU',       value: form.sku || '—' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: isDark ? '#0f172a' : '#fff' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: color || text }}>{value}</p>
                </div>
              ))}
              <p className="col-span-2 text-[9px] text-center font-mono break-all" style={{ color: muted }}>{qrValue}</p>
            </div>
          </div>
        )}

        {/* Boşluk */}
        <div className="sm:col-span-2 h-16" />
      </div>

      {/* ── Silme onayı (sticky bottom) ─────────────────────────────────── */}
      {deleteConf && (
        <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ borderColor: '#ef4444', background: isDark ? '#1e293b' : '#fff5f5' }}>
          <p className="text-sm font-bold" style={{ color: text }}>"{form.name}" silinsin mi?</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setDeleteConf(false)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl border text-sm font-semibold"
              style={{ borderColor: border, color: muted }}>
              İptal
            </button>
            <button onClick={() => { onDelete(item.id); setDeleteConf(false); }}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-white text-sm font-bold"
              style={{ background: '#ef4444' }}>
              Sil
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function FF({ label, error, children, muted }) {
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
