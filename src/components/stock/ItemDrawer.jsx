/**
 * ItemDrawer.jsx  — DRAFT PATTERN
 *
 * Yeni kayıt açılınca arka planda sessizce is_draft=true item oluşturulur.
 * Reçete dahil tüm işlemler bu taslak üzerinde yapılır.
 * "Kaydet" → is_draft=false (gerçek kayıt)
 * Sayfadan ayrılma (geri, router, yenile, kapat) → taslak DB'den silinir.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../contexts/ThemeContext';
import { Save, Loader2, Trash2, ArrowLeft, AlertCircle, X } from 'lucide-react';
import RecipeEditor from './RecipeEditor';
import { useFxRates } from '../../hooks/useFxRates';
import MediaPickerModal from '../MediaPickerModal';
import { Image as ImageIcon } from 'lucide-react';

const UNITS       = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','m³','Rulo','Paket','Kutu','Set','Takım','Saat','Gün'];
const CURRENCIES  = ['TRY','USD','EUR'];
const VAT_OPTS    = [0,1,8,10,18,20];

// Çevre değişkenleri (beforeunload fetch için)
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ItemDrawer({ item, defaultType = 'raw', onBack, onSave, onDelete, saving }) {
  const { effectiveMode, currentColor } = useTheme();
  const { convert: fxConvert } = useFxRates();
  const isDark = effectiveMode === 'dark';
  const isEdit    = !!item?.id;
  const isProduct = defaultType === 'product' || item?.item_type === 'product';

  const c = {
    bg:      isDark ? '#0f172a' : '#f8fafc',
    card:    isDark ? 'rgba(30,41,59,0.95)' : '#ffffff',
    border:  isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:    isDark ? '#f1f5f9' : '#0f172a',
    muted:   isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc',
    section: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
  };

  // ── Form state ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:           item?.name           || '',
    sku:            item?.sku            || '',
    category_id:    item?.category_id    || '',
    unit:           item?.unit           || 'Adet',
    supplier_name:  item?.supplier_name  || '',
    supplier_id:    item?.supplier_id    || null,
    description:    item?.description    || '',
    purchase_price: item?.purchase_price || '',
    sale_price:     item?.sale_price     || '',
    base_currency:  item?.base_currency  || 'TRY',
    sale_currency:  item?.sale_currency  || 'TRY',
    vat_rate:       item?.vat_rate       ?? 20,
    stock_count:    item?.stock_count    ?? 0,
    critical_limit: item?.critical_limit || 0,
    location:       item?.location       || '',
    is_active:      item?.is_active      ?? true,
    item_type:      isProduct ? 'product' : 'raw',
    technical_specs: item?.technical_specs || {},
    image_url:      item?.image_url      || '',
  });

  const [section,     setSection]     = useState('info');
  const [categories,  setCategories]  = useState([]);
  const [suppliers,   setSuppliers]   = useState([]);
  const [errors,      setErrors]      = useState({});
  const [isSaving,    setIsSaving]    = useState(false);
  const [suppSearch,  setSuppSearch]  = useState('');
  const [suppOpen,    setSuppOpen]    = useState(false);
  const [draftReady,  setDraftReady]  = useState(isEdit); // true = draft/item ID var
  const [imgModalOpen,setImgModalOpen] = useState(false);
  const [fullImg,     setFullImg]     = useState(null);

  // ── Draft refs (closure-safe) ────────────────────────────────────────────
  // draftId: taslak veya mevcut item ID'si
  const draftIdRef   = useRef(item?.id || null);
  // confirmedRef: true ise çıkışta silme
  const confirmedRef = useRef(isEdit);
  const [draftId, setDraftId] = useState(item?.id || null);

  const setDraft = useCallback((id) => {
    draftIdRef.current = id;
    setDraftId(id);
  }, []);

  // ── Draft oluştur (yeni kayıt için mount'da) ─────────────────────────────
  useEffect(() => {
    if (isEdit) return; // Düzenleme: taslak gerekmez
    let alive = true;

    (async () => {
      const { data, error } = await supabase.from('items').insert({
        name: '',
        unit: 'Adet',
        item_type: isProduct ? 'product' : 'raw',
        is_draft: true,
        is_active: false,
      }).select('id').single();

      if (alive && data?.id) {
        setDraft(data.id);
        setDraftReady(true);
      }
    })();

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Çıkış temizliği: unmount (React router, geri tuşu) ─────────────────
  useEffect(() => {
    return () => {
      if (!isEdit && draftIdRef.current && !confirmedRef.current) {
        supabase.from('items').delete()
          .eq('id', draftIdRef.current)
          .eq('is_draft', true)
          .then(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Çıkış temizliği: sayfa yenile / kapat (beforeunload) ─────────────────
  useEffect(() => {
    if (isEdit) return;

    const cleanup = () => {
      const id = draftIdRef.current;
      if (id && !confirmedRef.current && SUPA_URL && SUPA_KEY) {
        fetch(`${SUPA_URL}/rest/v1/items?id=eq.${id}&is_draft=eq.true`, {
          method: 'DELETE',
          keepalive: true,
          headers: {
            'apikey':        SUPA_KEY,
            'Authorization': `Bearer ${SUPA_KEY}`,
          },
        });
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kategoriler + tedarikçiler ────────────────────────────────────────────
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
  const setSpec = (field, val) =>
    setForm(f => ({ ...f, technical_specs: { ...f.technical_specs, [field]: val } }));

  const currentCategory = categories.find(cat => cat.id === form.category_id);
  const catFields       = currentCategory?.fields || [];

  const filteredSupp = suppSearch
    ? suppliers.filter(s => s.name.toLowerCase().includes(suppSearch.toLowerCase()))
    : suppliers.slice(0, 8);

  // ── Kaydet ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = 'Ad zorunlu';
    if (!form.unit)         errs.unit = 'Birim seçin';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      ...form,
      name:           form.name.trim(),
      sku:            form.sku?.trim()  || null,   // boş → NULL (UNIQUE constraint)
      location:       form.location?.trim()        || null,
      supplier_name:  form.supplier_name?.trim()   || null,
      description:    form.description?.trim()     || null,
      purchase_price:  parseFloat(form.purchase_price)  || 0,
      sale_price:      parseFloat(form.sale_price)      || 0,
      base_currency:   form.base_currency,
      sale_currency:   form.sale_currency,
      stock_count:     parseFloat(form.stock_count)     || 0,
      critical_limit:  parseFloat(form.critical_limit)  || 0,
      vat_rate:        parseFloat(form.vat_rate)        || 0,
      category_id:     form.category_id || null,
      supplier_id:     form.supplier_id || null,
      is_active:       form.is_active ?? true,
      image_url:       form.image_url || null,
    };

    setIsSaving(true);
    try {
      if (isEdit) {
        // Düzenleme: normal güncelle
        const { error } = await supabase.from('items').update(payload).eq('id', item.id);
        if (error) throw new Error(error.message);
      } else {
        // Yeni: taslak kaydı gerçeğe dönüştür
        const id = draftIdRef.current;
        if (!id) throw new Error('Taslak ID bulunamadı, lütfen tekrar deneyin.');
        const { error } = await supabase.from('items')
          .update({ ...payload, is_draft: false, is_active: payload.is_active })
          .eq('id', id);
        if (error) throw new Error(error.message);
        confirmedRef.current = true; // Artık silme
      }
      onSave(); // Parent'a sinyal: listeye dön + yenile
    } catch (e) {
      setErrors({ _global: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Geri tuşu: taslak sil + geri git ────────────────────────────────────
  const handleBack = () => {
    if (!isEdit && draftIdRef.current && !confirmedRef.current) {
      supabase.from('items').delete()
        .eq('id', draftIdRef.current)
        .eq('is_draft', true)
        .then(() => {});
      draftIdRef.current = null; // unmount cleanup'ı önle
    }
    onBack();
  };

  // ── Reçete sekmesine tıklanınca: taslak zaten hazır ─────────────────────
  // (draft mount'da oluşturuldu, ID var — kaydetmeye gerek yok)
  const handleSectionClick = (s) => {
    if (s === 'recipe' && !draftReady) {
      // Çok nadir: draft henüz oluşmadı (yavaş bağlantı)
      setErrors({ _global: 'Taslak hazırlanıyor, bir saniye bekleyin...' });
      return;
    }
    setSection(s);
  };

  // ── Sekme tanımları ──────────────────────────────────────────────────────
  const SECS_RAW  = ['info','price','stock'];
  const SECS_PROD = ['info','price','stock','recipe'];
  const SECTIONS  = isProduct ? SECS_PROD : SECS_RAW;
  const SEC_LABEL = { info:'Bilgiler', price:'Fiyat', stock:'Stok', recipe:'Reçeteler' };
  const SEC_ICON  = { info:'📋', price:'💰', stock:'📦', recipe:'🧪' };

  return (
    <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }} className="min-h-screen" style={{ background: c.bg }}>

      {/* ── Üst bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: c.card, borderColor: c.border }}>
        <button onClick={handleBack}
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
          {!isEdit && !draftReady && (
            <p className="text-[10px]" style={{ color: c.muted }}>Taslak hazırlanıyor...</p>
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
          <button onClick={handleSave} disabled={isSaving || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: isSaving || saving ? '#64748b' : currentColor }}>
            {isSaving || saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isSaving || saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* ── Sekme barı ───────────────────────────────────────────────────── */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: c.border, background: c.card }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => handleSectionClick(s)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all"
            style={{
              color:        section === s ? currentColor : c.muted,
              borderBottom: section === s ? `2px solid ${currentColor}` : '2px solid transparent',
            }}>
            <span>{SEC_ICON[s]}</span>
            {SEC_LABEL[s]}
            {s === 'recipe' && draftReady && draftId && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: `${currentColor}20`, color: currentColor }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Global hata ──────────────────────────────────────────────────── */}
      {errors._global && (
        <div className="mx-4 mt-4 rounded-xl p-3 flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle size={14} style={{ color: '#ef4444' }} />
          <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{errors._global}</p>
        </div>
      )}

      {/* ── İçerik ───────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 pb-12">

        {/* ━━ BİLGİLER ━━ */}
        {section === 'info' && (
          <>
            <FField label="Ad *" error={errors.name}>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="form-input"
                style={{ background: c.inputBg, borderColor: errors.name ? '#ef4444' : c.border, color: c.text }}
                placeholder={isProduct ? 'Örn: 100cm Lineer Aydınlatma' : 'Örn: 5X3 Profil'} />
            </FField>

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

            <FField label="Kategori">
              <select value={form.category_id} onChange={e => { set('category_id', e.target.value); set('technical_specs', {}); }}
                className="form-input"
                style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
                <option value="">— Kategori Seç —</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </FField>

            <FField label="Görsel">
              <div className="flex items-center gap-4">
                <div 
                  onClick={() => form.image_url ? setFullImg(form.image_url) : setImgModalOpen(true)}
                  className="w-16 h-16 rounded-xl flex items-center justify-center cursor-pointer border-2 border-dashed transition-colors"
                  title={form.image_url ? "Tam boyutu gör" : "Resim ekle"}
                  style={{ borderColor: c.border, background: c.inputBg }}>
                  {form.image_url ? (
                    <img src={form.image_url} alt="Görsel" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <ImageIcon size={24} style={{ color: c.muted }} />
                  )}
                </div>
                <button type="button" onClick={() => setImgModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: c.border, color: c.text, background: c.inputBg }}>
                  {form.image_url ? 'Görseli Değiştir' : 'Galeriden Seç'}
                </button>
              </div>
            </FField>

            {/* Tedarikçi autocomplete */}
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

            {/* Kategori bazlı teknik alanlar */}
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
                        <select value={form.technical_specs[field.name] || ''}
                          onChange={e => setSpec(field.name, e.target.value)}
                          className="form-input"
                          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
                          <option value="">— Seç —</option>
                          {(field.options || []).map(opt => <option key={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type={field.type === 'number' ? 'number' : 'text'}
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

            <FField label="Açıklama">
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} className="form-input resize-none"
                style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                placeholder="Notlar, özellikler..." />
            </FField>

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

            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: isDark ? 'rgba(234,179,8,0.08)' : '#fefce8', border: '1px solid rgba(234,179,8,0.25)' }}>
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#d97706' }} />
              <p className="text-xs leading-relaxed" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                <strong>SKU</strong> — Uyumsoft faturalarındaki ürün kodunun aynısını girin.
                Gelen faturalar bu kod ile stoğa otomatik işlenir.
              </p>
            </div>
          </>
        )}

        {/* ━━ FİYAT ━━ */}
        {section === 'price' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <FField label="Alış Para Birimi">
                <div className="flex gap-1.5 mt-1">
                  {CURRENCIES.map(cur => (
                    <button key={cur} onClick={() => {
                        if (form.base_currency === cur) return;
                        const oldPrice = parseFloat(form.purchase_price) || 0;
                        const converted = oldPrice > 0 ? fxConvert(oldPrice, form.base_currency, cur) : 0;
                        setForm(f => ({ ...f, base_currency: cur, purchase_price: converted ? converted.toFixed(2) : '0' }));
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all"
                      style={{
                        background:  form.base_currency === cur ? currentColor : 'transparent',
                        color:       form.base_currency === cur ? 'white' : c.muted,
                        borderColor: form.base_currency === cur ? currentColor : c.border,
                      }}>
                      {cur}
                    </button>
                  ))}
                </div>
              </FField>
              <FField label="Satış Para Birimi">
                <div className="flex gap-1.5 mt-1">
                  {CURRENCIES.map(cur => (
                    <button key={cur} onClick={() => {
                        if (form.sale_currency === cur) return;
                        const oldPrice = parseFloat(form.sale_price) || 0;
                        const converted = oldPrice > 0 ? fxConvert(oldPrice, form.sale_currency, cur) : 0;
                        setForm(f => ({ ...f, sale_currency: cur, sale_price: converted ? converted.toFixed(2) : '0' }));
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all"
                      style={{
                        background:  form.sale_currency === cur ? currentColor : 'transparent',
                        color:       form.sale_currency === cur ? 'white' : c.muted,
                        borderColor: form.sale_currency === cur ? currentColor : c.border,
                      }}>
                      {cur}
                    </button>
                  ))}
                </div>
              </FField>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <FField label={`Alış (${form.base_currency})`}>
                <input type="number" min="0" step="0.01" value={form.purchase_price}
                  onChange={e => set('purchase_price', e.target.value)}
                  className="form-input" style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                  placeholder="0.00" />
              </FField>
              <FField label={`Satış (${form.sale_currency})`}>
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
                      background:  form.vat_rate === v ? currentColor : 'transparent',
                      color:       form.vat_rate === v ? 'white' : c.muted,
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
                  { label: 'Fark (Brüt)', val: `${(form.sale_price - form.purchase_price).toFixed(2)}` },
                  { label: 'Margin', val: `%${(((form.sale_price - form.purchase_price) / form.purchase_price) * 100).toFixed(1)}` },
                  { label: "KDV'li Satış", val: `${(form.sale_price * (1 + form.vat_rate / 100)).toFixed(2)} ${form.sale_currency}` },
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

        {/* ━━ STOK ━━ */}
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
                  <span style={{ color: stkColor(form.stock_count, form.critical_limit) }}>
                    {stkLabel(form.stock_count, form.critical_limit)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: c.border }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100,(form.stock_count/(form.critical_limit*3))*100)}%`,
                    background: stkColor(form.stock_count, form.critical_limit),
                  }} />
                </div>
                <p className="text-xs mt-2" style={{ color: c.muted }}>
                  {form.stock_count} / {form.critical_limit * 3} {form.unit} (Kritik: {form.critical_limit})
                </p>
              </div>
            )}
          </>
        )}

        {/* ━━ REÇETE (sadece ürünler) ━━ */}
        {section === 'recipe' && isProduct && (
          <RecipeEditor
            productId={draftId}
            productName={form.name}
            productCurrency={form.base_currency}
            c={c}
            currentColor={currentColor}
          />
        )}

      </div>{/* /content */}

      {imgModalOpen && (
        <MediaPickerModal
          isOpen={true}
          onClose={() => setImgModalOpen(false)}
          onSelect={(mediaItem) => { set('image_url', mediaItem.url || mediaItem.file_url); setImgModalOpen(false); }}
          multiple={false}
        />
      )}

      {fullImg && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80" onClick={() => setFullImg(null)}>
          <img src={fullImg} alt="Original" className="max-w-full max-h-full rounded-lg object-contain shadow-2xl" />
          <button className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full hover:bg-black/70">
            <X size={24}/>
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Yardımcı bileşenler ──────────────────────────────────────────────────────
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
function stkColor(c, l) {
  if (c <= 0)        return '#ef4444';
  if (l > 0 && c <= l) return '#f59e0b';
  return '#10b981';
}
function stkLabel(c, l) {
  if (c <= 0) return '🔴 Stok Yok';
  if (c <= l) return '🟡 Kritik';
  return '🟢 Normal';
}
