/**
 * ItemDrawer.jsx
 * Hammadde ve Ürün ekleme/düzenleme drawer'ı.
 * - Tek sayfa (no tabs for raw materials)
 * - Kategori seçince o kategoriye özel teknik alanlar dinamik çıkar
 * - Ürünlerde + "Reçete" bölümü (RecipeEditor embed)
 * - Fiyat, stok, kritik limit alt bölümde
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../contexts/ThemeContext';
import {
  X, Save, Loader2, Trash2, ArrowLeft,
  Package, Layers, AlertCircle, ChevronDown,
} from 'lucide-react';
import RecipeEditor from './RecipeEditor';

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','m³','Rulo','Paket','Kutu','Set','Takım','Saat','Gün'];
const CURRENCIES = ['TRY','USD','EUR'];
const VAT_OPTS   = [0,1,8,10,18,20];

export default function ItemDrawer({ item, defaultType = 'raw', onBack, onSave, onDelete, saving }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const isEdit = !!item?.id;
  const isProduct = defaultType === 'product' || item?.item_type === 'product';

  // ── Renkler ────────────────────────────────────────────────────────────────
  const c = {
    bg:      isDark ? '#0f172a' : '#f8fafc',
    card:    isDark ? 'rgba(30,41,59,0.95)' : '#ffffff',
    border:  isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:    isDark ? '#f1f5f9' : '#0f172a',
    muted:   isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc',
    section: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:          item?.name          || '',
    sku:           item?.sku           || '',
    category_id:   item?.category_id   || '',
    unit:          item?.unit          || 'Adet',
    supplier_name: item?.supplier_name || '',
    supplier_id:   item?.supplier_id   || null,
    description:   item?.description   || '',
    purchase_price:item?.purchase_price|| '',
    sale_price:    item?.sale_price    || '',
    base_currency: item?.base_currency || 'TRY',
    vat_rate:      item?.vat_rate      ?? 20,
    stock_count:   item?.stock_count   ?? 0,
    critical_limit:item?.critical_limit|| 0,
    location:      item?.location      || '',
    is_active:     item?.is_active     ?? true,
    item_type:     isProduct ? 'product' : 'raw',
    technical_specs: item?.technical_specs || {},
  });

  const [section, setSection]         = useState('info'); // 'info' | 'price' | 'stock' | 'recipe'
  const [categories, setCategories]   = useState([]);
  const [suppliers,  setSuppliers]    = useState([]);
  const [errors,     setErrors]       = useState({});
  const [savedId,    setSavedId]      = useState(item?.id || null);
  const [suppSearch, setSuppSearch]   = useState('');
  const [suppOpen,   setSuppOpen]     = useState(false);

  // ── Kategorileri ve tedarikçileri yükle ────────────────────────────────────
  useEffect(() => {
    const scope = isProduct ? 'product' : 'rawmaterial';
    supabase.from('item_categories').select('*').eq('item_scope', scope).order('name')
      .then(({ data }) => setCategories(data || []));
    supabase.from('suppliers').select('id,name').order('name')
      .then(({ data }) => setSuppliers(data || []));
  }, [isProduct]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  };
  const setSpec = (fieldName, val) =>
    setForm(f => ({ ...f, technical_specs: { ...f.technical_specs, [fieldName]: val } }));

  const currentCategory = categories.find(c => c.id === form.category_id);
  const catFields       = currentCategory?.fields || [];

  // ── Tedarikçi filtre ────────────────────────────────────────────────────────
  const filteredSupp = suppSearch
    ? suppliers.filter(s => s.name.toLowerCase().includes(suppSearch.toLowerCase()))
    : suppliers.slice(0, 8);

  // ── Kaydet ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = {};
    if (!form.name?.trim())   errs.name = 'Ad zorunlu';
    if (!form.unit)           errs.unit = 'Birim seçin';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      ...form,
      purchase_price:  parseFloat(form.purchase_price)  || 0,
      sale_price:      parseFloat(form.sale_price)      || 0,
      stock_count:     parseFloat(form.stock_count)     || 0,
      critical_limit:  parseFloat(form.critical_limit)  || 0,
      vat_rate:        parseFloat(form.vat_rate)        || 0,
      category_id:     form.category_id || null,
      supplier_id:     form.supplier_id || null,
    };

    // Eğer yeni ürünse önce kaydet, ID al (reçete için lazım)
    if (!savedId && isProduct) {
      const { data, error } = await supabase.from('items').insert([payload]).select().single();
      if (!error) {
        setSavedId(data.id);
        setSection('recipe'); // Reçete sekmesine geç
      }
      return;
    }

    await onSave(payload);
  };

  const SECTIONS_RAW     = ['info','price','stock'];
  const SECTIONS_PRODUCT = ['info','price','stock','recipe'];
  const SECTIONS = isProduct ? SECTIONS_PRODUCT : SECTIONS_RAW;

  const sectionLabel = { info: 'Bilgiler', price: 'Fiyat', stock: 'Stok', recipe: 'Reçeteler' };
  const sectionIcon  = { info: '📋', price: '💰', stock: '📦', recipe: '🧪' };

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      className="min-h-screen"
      style={{ background: c.bg }}>
      {/* ── Üst bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: c.card, borderColor: c.border }}>
        <button onClick={onBack}
          className="p-2 rounded-xl border transition-colors"
          style={{ borderColor: c.border, color: c.muted }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{isProduct ? '⚡' : '🔩'}</span>
            <h1 className="font-bold text-sm truncate" style={{ color: c.text }}>
              {isEdit ? (item?.name || 'Düzenle') : (isProduct ? 'Yeni Ürün' : 'Yeni Hammadde')}
            </h1>
          </div>
          {isEdit && item?.sku && (
            <p className="text-[11px] font-mono" style={{ color: c.muted }}>#{item.sku}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <button onClick={() => onDelete(item.id)}
              className="p-2 rounded-xl border transition-colors"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: saving ? '#64748b' : currentColor }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : (isProduct && !savedId ? 'Kaydet & Reçete' : 'Kaydet')}
          </button>
        </div>
      </div>

      {/* ── Sekme barı ─────────────────────────────────────────────────── */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: c.border, background: c.card }}>
        {SECTIONS.map(s => (
          <button key={s}
            onClick={() => {
              if (s === 'recipe' && !savedId && !isEdit) {
                alert('Önce kaydedin, sonra reçete ekleyebilirsiniz.');
                return;
              }
              setSection(s);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all"
            style={{
              color: section === s ? currentColor : c.muted,
              borderBottom: section === s ? `2px solid ${currentColor}` : '2px solid transparent',
            }}>
            <span>{sectionIcon[s]}</span>
            {sectionLabel[s]}
            {s === 'recipe' && savedId && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: `${currentColor}20`, color: currentColor }}>
                ✓
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── İçerik ─────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 pb-20">

        {/* ━━━━━━ BİLGİLER ━━━━━━ */}
        {section === 'info' && (
          <>
            {/* Ad */}
            <FField label="Ad *" error={errors.name}>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="form-input"
                style={{ background: c.inputBg, borderColor: errors.name ? '#ef4444' : c.border, color: c.text }}
                placeholder={isProduct ? 'Örn: 100cm Lineer Aydınlatma' : 'Örn: 5X3 Profil'} />
            </FField>

            {/* SKU + Birim */}
            <div className="grid grid-cols-2 gap-3">
              <FField label="SKU / Ürün Kodu">
                <input value={form.sku} onChange={e => set('sku', e.target.value)}
                  className="form-input"
                  style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                  placeholder="Örn: LED-3W-3000K" />
              </FField>
              <FField label="Birim *" error={errors.unit}>
                <select value={form.unit} onChange={e => set('unit', e.target.value)}
                  className="form-input"
                  style={{ background: c.inputBg, borderColor: errors.unit ? '#ef4444' : c.border, color: c.text }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </FField>
            </div>

            {/* Kategori */}
            <FField label="Kategori">
              <select value={form.category_id} onChange={e => {
                set('category_id', e.target.value);
                set('technical_specs', {}); // kategori değişince teknik alanları sıfırla
              }}
                className="form-input"
                style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
                <option value="">— Kategori Seç —</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </FField>

            {/* Tedarikçi */}
            <FField label="Tedarikçi">
              <div className="relative">
                <input value={form.supplier_name}
                  onChange={e => { set('supplier_name', e.target.value); setSuppSearch(e.target.value); setSuppOpen(true); }}
                  onFocus={() => setSuppOpen(true)}
                  onBlur={() => setTimeout(() => setSuppOpen(false), 200)}
                  className="form-input"
                  style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                  placeholder="Tedarikçi ara veya yaz..." />
                {suppOpen && filteredSupp.length > 0 && (
                  <div className="absolute left-0 right-0 top-10 z-50 rounded-xl overflow-hidden shadow-2xl"
                    style={{ background: isDark ? '#0f1f38' : '#fff', border: `1px solid ${c.border}` }}>
                    {filteredSupp.map(s => (
                      <div key={s.id}
                        className="px-4 py-2.5 cursor-pointer text-sm transition-colors"
                        onMouseDown={() => { set('supplier_name', s.name); set('supplier_id', s.id); setSuppOpen(false); }}
                        style={{ color: c.text, borderBottom: `1px solid ${c.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {s.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FField>

            {/* ── Kategori bazlı teknik alanlar ─────────────────────────── */}
            {catFields.length > 0 && (
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: `${currentColor}06`, border: `1px solid ${currentColor}25` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                  ⚙ {currentCategory?.name} — Teknik Özellikler
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {catFields.map(field => (
                    <FField key={field.name} label={field.name}>
                      {field.type === 'select' ? (
                        <select
                          value={form.technical_specs[field.name] || ''}
                          onChange={e => setSpec(field.name, e.target.value)}
                          className="form-input"
                          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
                          <option value="">— Seç —</option>
                          {(field.options || []).map(opt => <option key={opt}>{opt}</option>)}
                        </select>
                      ) : field.type === 'number' ? (
                        <input type="number"
                          value={form.technical_specs[field.name] || ''}
                          onChange={e => setSpec(field.name, e.target.value)}
                          className="form-input"
                          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                          placeholder={field.name} />
                      ) : (
                        <input type="text"
                          value={form.technical_specs[field.name] || ''}
                          onChange={e => setSpec(field.name, e.target.value)}
                          className="form-input"
                          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                          placeholder={field.name} />
                      )}
                    </FField>
                  ))}
                </div>
              </div>
            )}

            {/* Açıklama */}
            <FField label="Açıklama">
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} className="form-input resize-none"
                style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                placeholder="Notlar, özellikler..." />
            </FField>

            {/* Aktif toggle */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border"
              style={{ borderColor: c.border, background: c.section }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: c.text }}>Aktif</p>
                <p className="text-xs" style={{ color: c.muted }}>Listede görünsün</p>
              </div>
              <button onClick={() => set('is_active', !form.is_active)}
                className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                style={{ background: form.is_active ? currentColor : c.border }}>
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: form.is_active ? '22px' : '4px' }} />
              </button>
            </div>

            {/* SKU uyarı */}
            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: isDark ? 'rgba(234,179,8,0.08)' : '#fefce8', border: `1px solid rgba(234,179,8,0.25)` }}>
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#d97706' }} />
              <p className="text-xs leading-relaxed" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                <strong>SKU</strong> — Uyumsoft faturalarındaki ürün kodunun aynısını girin. Gelen faturalar bu kod ile stoğa otomatik işlenir.
              </p>
            </div>
          </>
        )}

        {/* ━━━━━━ FİYAT ━━━━━━ */}
        {section === 'price' && (
          <>
            <FField label="Para Birimi">
              <div className="flex gap-2">
                {CURRENCIES.map(cur => (
                  <button key={cur} onClick={() => set('base_currency', cur)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all"
                    style={{
                      background: form.base_currency === cur ? currentColor : 'transparent',
                      color: form.base_currency === cur ? 'white' : c.muted,
                      borderColor: form.base_currency === cur ? currentColor : c.border,
                    }}>
                    {cur}
                  </button>
                ))}
              </div>
            </FField>
            <div className="grid grid-cols-2 gap-3">
              <FField label={`Alış Fiyatı (${form.base_currency})`}>
                <input type="number" min="0" step="0.01" value={form.purchase_price}
                  onChange={e => set('purchase_price', e.target.value)}
                  className="form-input" style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                  placeholder="0.00" />
              </FField>
              <FField label={`Satış Fiyatı (${form.base_currency})`}>
                <input type="number" min="0" step="0.01" value={form.sale_price}
                  onChange={e => set('sale_price', e.target.value)}
                  className="form-input" style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                  placeholder="0.00" />
              </FField>
            </div>
            <FField label="KDV Oranı">
              <div className="flex flex-wrap gap-2">
                {VAT_OPTS.map(v => (
                  <button key={v} onClick={() => set('vat_rate', v)}
                    className="px-4 py-2 rounded-xl text-sm font-bold border transition-all"
                    style={{
                      background: form.vat_rate === v ? currentColor : 'transparent',
                      color: form.vat_rate === v ? 'white' : c.muted,
                      borderColor: form.vat_rate === v ? currentColor : c.border,
                    }}>
                    %{v}
                  </button>
                ))}
              </div>
            </FField>
            {parseFloat(form.purchase_price) > 0 && parseFloat(form.sale_price) > 0 && (
              <div className="grid grid-cols-3 gap-3 rounded-2xl p-4"
                style={{ background: c.section, border: `1px solid ${c.border}` }}>
                {[
                  { label: 'Kâr', val: `${(form.sale_price - form.purchase_price).toFixed(2)} ${form.base_currency}` },
                  { label: 'Margin', val: `%${(((form.sale_price - form.purchase_price) / form.purchase_price) * 100).toFixed(1)}` },
                  { label: "KDV'li", val: `${(form.sale_price * (1 + form.vat_rate / 100)).toFixed(2)}` },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs font-semibold" style={{ color: c.muted }}>{label}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: currentColor }}>{val}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ━━━━━━ STOK ━━━━━━ */}
        {section === 'stock' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FField label={`Mevcut Stok (${form.unit})`}>
                <input type="number" min="0" step="0.001" value={form.stock_count}
                  onChange={e => set('stock_count', e.target.value)}
                  className="form-input" style={{ background: c.inputBg, borderColor: c.border, color: c.text }} />
              </FField>
              <FField label={`Kritik Limit (${form.unit})`}>
                <input type="number" min="0" step="0.001" value={form.critical_limit}
                  onChange={e => set('critical_limit', e.target.value)}
                  className="form-input" style={{ background: c.inputBg, borderColor: c.border, color: c.text }} />
              </FField>
            </div>
            <FField label="Depo Konumu">
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="form-input" style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                placeholder="Örn: Raf A-3, Depo 2..." />
            </FField>
            {parseFloat(form.critical_limit) > 0 && (
              <div className="rounded-xl p-4" style={{ background: c.section, border: `1px solid ${c.border}` }}>
                <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: c.muted }}>
                  <span>Stok Seviyesi</span>
                  <span style={{ color: stockColor(form.stock_count, form.critical_limit) }}>
                    {stockLabel(form.stock_count, form.critical_limit)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: c.border }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (form.stock_count / (form.critical_limit * 3)) * 100)}%`,
                      background: stockColor(form.stock_count, form.critical_limit),
                    }} />
                </div>
                <p className="text-xs mt-2" style={{ color: c.muted }}>
                  {form.stock_count} / {form.critical_limit * 3} {form.unit} (Kritik: {form.critical_limit})
                </p>
              </div>
            )}
          </>
        )}

        {/* ━━━━━━ REÇETE (sadece ürünler) ━━━━━━ */}
        {section === 'recipe' && isProduct && (
          <RecipeEditor
            productId={savedId || item?.id || null}
            productName={form.name}
            c={c}
            currentColor={currentColor}
          />
        )}

      </div>

      {/* Kaydet butonu (alt sticky) */}
      {section !== 'recipe' && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 border-t"
          style={{ background: c.card, borderColor: c.border }}>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: saving ? '#64748b' : currentColor }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : (isProduct && !savedId ? 'Kaydet & Reçete Ekle' : 'Kaydet')}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function FField({ label, error, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: error ? '#f87171' : 'rgba(148,163,184,0.8)' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}
function stockColor(c, l) {
  if (c <= 0) return '#ef4444';
  if (l > 0 && c <= l) return '#f59e0b';
  return '#10b981';
}
function stockLabel(c, l) {
  if (c <= 0) return '🔴 Stok Yok';
  if (c <= l) return '🟡 Kritik';
  return '🟢 Normal';
}
