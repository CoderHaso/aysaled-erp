import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Package, Save, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const UNITS      = ['pcs', 'kg', 'm', 'lt', 'm²', 'm³', 'adet', 'kutu', 'rulo'];
const CURRENCIES = ['TRY', 'USD', 'EUR'];
const VAT_RATES  = [0, 1, 8, 10, 18, 20];
const CATEGORIES = ['Hammadde', 'Mamül', 'Yarı Mamül', 'Sarf Malzeme', 'Ambalaj', 'Diğer'];

const EMPTY = {
  name: '', sku: '', barcode: '', description: '', category: '',
  unit: 'pcs', base_currency: 'TRY',
  purchase_price: '', sale_price: '', vat_rate: 18,
  stock_count: 0, critical_limit: 10,
  is_active: true,
};

export default function StockModal({ item, onClose, onSave, saving }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const isEdit = !!item?.id;

  const [form, setForm]     = useState(item ? { ...EMPTY, ...item } : { ...EMPTY });
  const [tab, setTab]       = useState('general');
  const [errors, setErrors] = useState({});

  // CSS değişkenleri — modal renkleri
  const bg      = isDark ? '#1e293b' : '#ffffff';
  const border  = isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#94a3b8' : '#64748b';
  const tabBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9';
  const overlay = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)';

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = 'Ürün adı zorunlu';
    if (!form.unit)         e.unit = 'Birim seçin';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave({
      ...form,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price:     parseFloat(form.sale_price)     || 0,
      vat_rate:       parseFloat(form.vat_rate)       || 0,
      stock_count:    parseFloat(form.stock_count)    || 0,
      critical_limit: parseFloat(form.critical_limit) || 0,
    });
  };

  const TABS = [
    { id: 'general', label: 'Genel' },
    { id: 'pricing', label: 'Fiyatlandırma' },
    { id: 'stock',   label: 'Stok & Depo' },
  ];

  /* ---------- Ortak input / select / textarea inline override ------------ *
   * CSS class 'modal-input' (index.css) full-width, border-radius, padding,
   * background ve color'u zaten sağlıyor.
   * Burada sadece validasyon hata kırmızısını override ediyoruz.
   * -----------------------------------------------------------------------*/
  const errBorder = (key) => errors[key] ? { borderColor: '#ef4444' } : {};

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: overlay }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{    scale: 0.95, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ background: bg, border: `1px solid ${border}`, maxHeight: '90vh' }}
        >
          {/* ── Başlık ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
            style={{ borderColor: border }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: currentColor }}>
                <Package size={18} />
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: text }}>
                  {isEdit ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                </h2>
                {isEdit && (
                  <p className="text-xs" style={{ color: muted }}>
                    #{item.sku || item.id?.slice(0, 8)}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: muted }}
              onMouseEnter={e => e.currentTarget.style.background = tabBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X size={18} />
            </button>
          </div>

          {/* ── Sekmeler ──────────────────────────────────────────── */}
          <div className="flex gap-1 px-6 pt-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${border}` }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-all"
                style={{
                  color:        tab === t.id ? currentColor : muted,
                  background:   tab === t.id ? tabBg        : 'transparent',
                  borderBottom: tab === t.id ? `2px solid ${currentColor}` : '2px solid transparent',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Form gövdesi ──────────────────────────────────────── */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

            {/* GENEL */}
            {tab === 'general' && (
              <>
                <Field label="Ürün Adı *" error={errors.name} muted={muted}>
                  <input
                    className="modal-input"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Örn: Çelik Boru Ø32"
                    style={errBorder('name')}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="SKU (Eşleştirme Anahtarı)" muted={muted}>
                    <input
                      className="modal-input"
                      value={form.sku || ''}
                      onChange={e => set('sku', e.target.value)}
                      placeholder="Örn: CEL-BOR-32"
                    />
                  </Field>
                  <Field label="Barkod" muted={muted}>
                    <input
                      className="modal-input"
                      value={form.barcode || ''}
                      onChange={e => set('barcode', e.target.value)}
                      placeholder="EAN-13 / QR"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kategori" muted={muted}>
                    <select
                      className="modal-input"
                      value={form.category || ''}
                      onChange={e => set('category', e.target.value)}
                    >
                      <option value="">— Seç —</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Birim *" error={errors.unit} muted={muted}>
                    <select
                      className="modal-input"
                      value={form.unit}
                      onChange={e => set('unit', e.target.value)}
                      style={errBorder('unit')}
                    >
                      {UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Açıklama" muted={muted}>
                  <textarea
                    className="modal-input"
                    rows={3}
                    value={form.description || ''}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Ürün hakkında notlar, özellikler..."
                  />
                </Field>

                {/* SKU Uyarı kutusu */}
                <div className="rounded-xl p-3 flex items-start gap-2.5"
                  style={{
                    background: isDark ? 'rgba(234,179,8,0.1)' : '#fefce8',
                    border: `1px solid ${isDark ? 'rgba(234,179,8,0.22)' : '#fde047'}`,
                  }}>
                  <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: '#d97706' }} />
                  <p className="text-xs leading-relaxed" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                    <strong>SKU = Uyumsoft Eşleştirme Anahtarı</strong><br />
                    Uyumsoft'tan gelen faturalardaki ürün kodunun aynısını girin.
                    Bu sayede gelen faturalar otomatik stoğa işlenecek.
                  </p>
                </div>
              </>
            )}

            {/* FİYATLANDIRMA */}
            {tab === 'pricing' && (
              <>
                <Field label="Para Birimi" muted={muted}>
                  <div className="flex gap-2">
                    {CURRENCIES.map(cur => (
                      <button key={cur}
                        onClick={() => set('base_currency', cur)}
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
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Alış Fiyatı (${form.base_currency})`} muted={muted}>
                    <input
                      type="number" min="0" step="0.01"
                      className="modal-input"
                      value={form.purchase_price || ''}
                      onChange={e => set('purchase_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label={`Satış Fiyatı (${form.base_currency})`} muted={muted}>
                    <input
                      type="number" min="0" step="0.01"
                      className="modal-input"
                      value={form.sale_price || ''}
                      onChange={e => set('sale_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                </div>

                <Field label="KDV Oranı" muted={muted}>
                  <div className="flex gap-2 flex-wrap">
                    {VAT_RATES.map(v => (
                      <button key={v}
                        onClick={() => set('vat_rate', v)}
                        className="px-3 py-2 rounded-xl text-sm font-bold border transition-all"
                        style={{
                          background:  form.vat_rate === v ? currentColor : 'var(--input-bg)',
                          color:       form.vat_rate === v ? 'white' : muted,
                          borderColor: form.vat_rate === v ? currentColor : border,
                        }}>
                        %{v}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Anlık kâr hesabı */}
                {parseFloat(form.purchase_price) > 0 && parseFloat(form.sale_price) > 0 && (
                  <div className="rounded-xl p-3 grid grid-cols-3 gap-3"
                    style={{ background: tabBg, border: `1px solid ${border}` }}>
                    {[
                      {
                        label: 'Kâr',
                        value: `${(form.sale_price - form.purchase_price).toFixed(2)} ${form.base_currency}`,
                      },
                      {
                        label: 'Kâr Marjı',
                        value: `%${(((form.sale_price - form.purchase_price) / form.purchase_price) * 100).toFixed(1)}`,
                      },
                      {
                        label: "KDV'li Satış",
                        value: `${(form.sale_price * (1 + form.vat_rate / 100)).toFixed(2)} ${form.base_currency}`,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="text-xs font-medium" style={{ color: muted }}>{label}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: currentColor }}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* STOK & DEPO */}
            {tab === 'stock' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Mevcut Stok (${form.unit})`} muted={muted}>
                    <input
                      type="number" min="0" step="0.001"
                      className="modal-input"
                      value={form.stock_count}
                      onChange={e => set('stock_count', e.target.value)}
                    />
                  </Field>
                  <Field label={`Kritik Limit (${form.unit})`} muted={muted}>
                    <input
                      type="number" min="0" step="0.001"
                      className="modal-input"
                      value={form.critical_limit}
                      onChange={e => set('critical_limit', e.target.value)}
                    />
                  </Field>
                </div>

                {/* Stok önizleme */}
                {parseFloat(form.critical_limit) > 0 && (
                  <div className="rounded-xl p-4"
                    style={{ background: tabBg, border: `1px solid ${border}` }}>
                    <div className="flex justify-between text-xs font-semibold mb-2"
                      style={{ color: muted }}>
                      <span>Stok Seviyesi</span>
                      <span style={{ color: stockColor(form.stock_count, form.critical_limit) }}>
                        {stockLabel(form.stock_count, form.critical_limit)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden"
                      style={{ background: border }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (form.stock_count / (form.critical_limit * 3)) * 100)}%`,
                          background: stockColor(form.stock_count, form.critical_limit),
                        }} />
                    </div>
                    <p className="text-xs mt-2" style={{ color: muted }}>
                      {form.stock_count} / {form.critical_limit * 3} {form.unit}
                      &nbsp;(Kritik: {form.critical_limit} {form.unit})
                    </p>
                  </div>
                )}

                {/* Aktif toggle */}
                <div className="flex items-center justify-between py-3 px-4 rounded-xl border"
                  style={{ background: tabBg, borderColor: border }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: text }}>Aktif Ürün</p>
                    <p className="text-xs" style={{ color: muted }}>Listede görünsün / gizlensin</p>
                  </div>
                  <button
                    onClick={() => set('is_active', !form.is_active)}
                    className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                    style={{ background: form.is_active ? currentColor : border }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: form.is_active ? '22px' : '4px' }} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: border }}>
            <button onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-semibold border transition-all"
              style={{ color: muted, borderColor: border, background: tabBg }}>
              İptal
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all"
              style={{ background: saving ? muted : currentColor, opacity: saving ? 0.8 : 1 }}>
              {saving
                ? <Loader2 size={15} className="animate-spin" />
                : <Save size={15} />}
              {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Yardımcı bileşen ──────────────────────────────────────────────────────── */
function Field({ label, error, children, muted }) {
  return (
    <div className="w-full">
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
        style={{ color: muted }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}

/* ── Stok yardımcıları ──────────────────────────────────────────────────────── */
function stockColor(count, limit) {
  if (count <= 0)     return '#ef4444';
  if (count <= limit) return '#f59e0b';
  return '#10b981';
}
function stockLabel(count, limit) {
  if (count <= 0)     return '🔴 Stok Yok';
  if (count <= limit) return '🟡 Kritik Seviye';
  return '🟢 Normal';
}
