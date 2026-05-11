import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Package, FlaskConical, Plus, Trash2,
  ChevronRight, ArrowLeftRight, Search, AlertCircle,
  ShoppingBag, DollarSign, Tag,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { useFxRates } from '../hooks/useFxRates';
import { trNorm } from '../lib/trNorm';

const UNITS = ['Adet','Metre','cm','mm','Kg','g','Litre','ml','m²','Rulo','Paket','Kutu','Set','Takım'];
const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];
const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

export default function RecipePickerModal({
  productId, productName, allRecipes, allItems = [],
  onSelect, onClose, currentColor = '#8b5cf6',
  selectedRecipeId = null,
  customRecipeItems = null,
  hideSkipWorkOrder = false,
  hideCosts = false,
  adHocMode = false,
}) {
  const { effectiveMode } = useTheme();
  const { convert: fxConvert } = useFxRates();
  const isDark = effectiveMode === 'dark';

  const [costTypes, setCostTypes] = useState([]);
  const [expenseDrop, setExpenseDrop] = useState(false);
  const expenseDropRef = React.useRef(null);
  React.useEffect(() => {
    supabase.from('app_settings').select('value').eq('id', 'recipe_costs').maybeSingle()
      .then(res => setCostTypes(res.data?.value || []));
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (expenseDropRef.current && !expenseDropRef.current.contains(e.target)) {
        setExpenseDrop(false);
      }
    };
    if (expenseDrop) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expenseDrop]);

  const productRecipes = useMemo(
    () => adHocMode ? [] : (allRecipes || []).filter(r => r.product_id === productId),
    [allRecipes, productId, adHocMode]
  );

  const [activeTag,  setActiveTag]  = useState('Tümü');
  const initialRecipe = adHocMode ? null : (selectedRecipeId
    ? productRecipes.find(r => r.id === selectedRecipeId) || productRecipes[0]
    : productRecipes[0]);
  const [selectedId, setSelectedId] = useState(() => initialRecipe?.id || null);

  // customRecipeItems varsa (geçici reçete), base yerine onu kullan
  const hasCustomInit = customRecipeItems && Array.isArray(customRecipeItems) && customRecipeItems.length > 0;
  const [localItems, setLocalItems] = useState(() =>
    hasCustomInit
      ? cloneItems(customRecipeItems)
      : (adHocMode ? [] : cloneRecipeData(initialRecipe))
  );
  // ItemPickerModal: 'add' | idx (swap) | null
  const [pickerTarget, setPickerTarget] = useState(null);

  // Stok bilgisi: base + özel reçete stokları
  const [recipeStocks, setRecipeStocks] = useState([]);
  const [customVirtualRecipes, setCustomVirtualRecipes] = useState([]); // özel reçeteler sanal giriş
  const [skipWorkOrder, setSkipWorkOrder] = useState(false);
  React.useEffect(() => {
    if (!productId) return;
    Promise.all([
      supabase.from('product_recipe_stock').select('*').eq('product_id', productId),
      // Özel reçete üretimleri
      supabase.from('stock_movements')
        .select('*')
        .eq('item_id', productId)
        .not('custom_recipe_data', 'is', null)
        .order('created_at', { ascending: false }),
    ]).then(([sRes, mvRes]) => {
      console.log('[RECIPE PICKER] product_recipe_stock:', sRes.data);
      console.log('[RECIPE PICKER] stock_movements with custom_recipe_data:', mvRes.data);
      setRecipeStocks(sRes.data || []);
      // Özel reçeteleri grupla
      const customMap = {};
      (mvRes.data || []).forEach(mv => {
        let crd = mv.custom_recipe_data;
        if (typeof crd === 'string') try { crd = JSON.parse(crd); } catch(_) { crd = null; }
        if (!crd || !Array.isArray(crd) || crd.length === 0) return;
        const key = JSON.stringify(crd.map(c => `${c.item_name}:${c.quantity}`).sort());
        if (!customMap[key]) {
          customMap[key] = { items: crd, recipe_id: mv.recipe_id, count: 0, key };
        }
        // delta zaten işaretli: + üretim, - satış
        customMap[key].count += Number(mv.delta) || 0;
      });
      // Stok > 0 olan özel reçeteleri sanal reçete olarak oluştur
      const virtuals = Object.values(customMap)
        .filter(c => c.count > 0)
        .map((c, idx) => {
          const baseRecipe = (allRecipes || []).find(r => r.id === c.recipe_id);
          return {
            id: `custom_${idx}_${c.key.slice(0, 20)}`, // sanal ID
            _isCustomVirtual: true,
            _customKey: c.key,
            _customItems: c.items,
            _customStock: c.count,
            _baseRecipeId: c.recipe_id,
            product_id: productId,
            name: baseRecipe ? `${baseRecipe.name} (Özel)` : `Özel Reçete ${idx + 1}`,
            tags: ['Özel'],
            recipe_items: c.items.map((it, j) => ({
              id: `cvi_${idx}_${j}`,
              item_id: it.item_id,
              item_name: it.item_name,
              quantity: it.quantity,
              unit: it.unit || 'Adet',
            })),
          };
        });
      console.log('[RECIPE PICKER] virtual custom recipes:', virtuals);
      setCustomVirtualRecipes(virtuals);
    });
  }, [productId]);
  const getRecipeStock = (recipeId) => {
    // Önce sanal özel reçete mi kontrol et
    const vr = customVirtualRecipes.find(v => v.id === recipeId);
    if (vr) return vr._customStock || 0;
    return recipeStocks.find(s => s.recipe_id === recipeId)?.stock_count || 0;
  };
  const activeStock = getRecipeStock(selectedId);

  /* ── Etiketler ─────────────────────────────────────────────── */
  // Mevcut + özel sanal reçeteleri birleştir
  const allCombinedRecipes = useMemo(() =>
    [...productRecipes, ...customVirtualRecipes],
    [productRecipes, customVirtualRecipes]
  );

  const allTags = useMemo(() => {
    const s = new Set(['Tümü']);
    allCombinedRecipes.forEach(r => (r.tags || []).forEach(t => s.add(t)));
    return [...s];
  }, [allCombinedRecipes]);

  const filteredRecipes = useMemo(() =>
    allCombinedRecipes.filter(r => activeTag === 'Tümü' || (r.tags || []).includes(activeTag)),
    [allCombinedRecipes, activeTag]
  );

  const activeRecipe = filteredRecipes.find(r => r.id === selectedId) || filteredRecipes[0];

  /* ── Maliyet ───────────────────────────────────────────────── */
  const totalCost = useMemo(() => localItems.reduce((sum, it) => {
    const item  = (allItems || []).find(i => i.id === it.item_id) || {};
    const price = Number(it.purchase_price ?? item.purchase_price ?? 0);
    const curr  = it.base_currency || item.base_currency || 'TRY';
    const tryPrice = fxConvert(price, curr, 'TRY');
    return sum + tryPrice * Number(it.quantity || 1);
  }, 0), [localItems, allItems, fxConvert]);

  const addOtherCost = (type) => {
    setLocalItems(prev => [...prev, {
      _new: true,
      item_id: null,
      item_name: type,
      unit: 'Adet',
      quantity: 1,
      purchase_price: 0,
      base_currency: 'TRY',
      _isOtherCost: true
    }]);
    setExpenseDrop(false);
  };

  /* ── Değişti mi? (localItems vs base recipe items) ──────────── */
  const changed = useMemo(() =>
    JSON.stringify(localItems.map(i => ({ n: i.item_name, q: String(i.quantity), u: i.unit }))) !==
    JSON.stringify(cloneRecipeData(activeRecipe).map(i => ({ n: i.item_name, q: String(i.quantity), u: i.unit }))),
    [localItems, activeRecipe]
  );

  // Stoktan kullan: sanal özel reçete seçiliyse izin ver, elle değiştirme yapıldıysa devre dışı
  const isVirtualSelected = !!activeRecipe?._isCustomVirtual;
  const canSkipWorkOrder = !hideSkipWorkOrder && activeStock > 0 && (!changed || isVirtualSelected);
  React.useEffect(() => {
    // Elle değişiklik yapıldıysa ve sanal reçete değilse skip kapat
    if (changed && skipWorkOrder && !isVirtualSelected) setSkipWorkOrder(false);
  }, [changed, isVirtualSelected]);

  /* ── Reçete seç ────────────────────────────────────────────── */
  const selectRecipe = useCallback(recipe => {
    setSelectedId(recipe.id);
    // Eğer seçilen reçete, ilk açılıştaki custom reçete ise custom items'ı koru
    if (hasCustomInit && recipe.id === initialRecipe?.id) {
      setLocalItems(cloneItems(customRecipeItems));
    } else {
      setLocalItems(cloneRecipeData(recipe));
    }
    setSkipWorkOrder(false);
  }, [hasCustomInit, initialRecipe, customRecipeItems]);

  /* ── CRUD ──────────────────────────────────────────────────── */
  const updateItem = (idx, key, val) =>
    setLocalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  const removeItem = idx =>
    setLocalItems(prev => prev.filter((_, i) => i !== idx));

  /* ── ItemPickerModal callback ──────────────────────────────── */
  const handleItemPick = useCallback(({ item, custom }) => {
    if (pickerTarget === 'add') {
      setLocalItems(prev => [...prev, {
        _new: true,
        item_id:   item?.id   || null,
        item_name: item?.name || custom || '',
        unit:      item?.unit || 'Adet',
        quantity:  1,
        purchase_price: item?.purchase_price ?? null,
        base_currency: item?.base_currency || 'TRY',
      }]);
    } else if (pickerTarget != null) {
      setLocalItems(prev => prev.map((it, i) => i === pickerTarget ? {
        ...it,
        item_id:   item?.id   || null,
        item_name: item?.name || custom || it.item_name,
        unit:      item?.unit || it.unit || 'Adet',
        purchase_price: item?.purchase_price ?? it.purchase_price,
        base_currency: item?.base_currency || it.base_currency || 'TRY',
      } : it));
    }
    setPickerTarget(null);
  }, [pickerTarget]);

  /* ── Onayla ────────────────────────────────────────────────── */
  const handleConfirm = () => {
    // adHocMode: activeRecipe olmadan da devam edebilir
    if (!adHocMode && !activeRecipe) return;
    const isVirtual = !!activeRecipe?._isCustomVirtual;
    const components = localItems
      .filter(it => it.item_name?.trim())
      .map(it => ({
        recipe_item_id: it.id || null,
        item_id:        it.item_id || null,
        item_name:      it.item_name || '—',
        quantity:       Number(it.quantity) || 1,
        unit:           it.unit || 'Adet',
        purchase_price: it.purchase_price ?? null,
        base_currency:  it.base_currency || 'TRY',
        _isOtherCost:   !!it._isOtherCost,
      }));

    if (adHocMode) {
      // Kayıtsız reçeteli ürün — sanal reçete bilgisi oluştur
      const adHocKey = `${productName} - Özel Reçete`;
      onSelect({
        recipe_id:   null,
        recipe_key:  adHocKey,
        recipe_note: `${adHocKey}: ${components.filter(c => !c._isOtherCost).map(c => `${c.quantity}x ${c.item_name}`).join(', ')}`,
        components,
        changed: true,
        skip_work_order: false,
        recipe_stock: 0,
        is_custom_virtual: false,
        custom_recipe_key: null,
      });
      return;
    }

    onSelect({
      // Sanal özel reçete ise base recipe_id'yi kullan
      recipe_id:   isVirtual ? activeRecipe._baseRecipeId : activeRecipe.id,
      recipe_key:  activeRecipe.name,
      recipe_note: `${activeRecipe.name}: ${components.map(c => `${c.quantity}x ${c.item_name}`).join(', ')}`,
      components,
      changed: changed || isVirtual,             // özel reçete HER ZAMAN custom
      skip_work_order: skipWorkOrder,
      recipe_stock: activeStock,
      is_custom_virtual: isVirtual,              // sanal özel reçete mi
      custom_recipe_key: isVirtual ? activeRecipe._customKey : null,
    });
  };

  const hasSingleRecipe = allCombinedRecipes.length <= 1;

  return (
    <>
    <div className="fixed inset-0 z-[199] flex items-center justify-center p-3 sm:p-5">
      <motion.div
        className="absolute inset-0 bg-black/85 backdrop-blur-lg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={pickerTarget !== null ? undefined : onClose}
      />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full flex flex-col rounded-3xl overflow-hidden shadow-2xl"
        style={{
          maxWidth: 780, maxHeight: '92vh',
          background: isDark ? 'linear-gradient(145deg, #0d1b2e 0%, #0a1628 100%)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : '#e2e8f0'}`,
          boxShadow: `0 0 60px ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(0,0,0,0.1)'}, 0 25px 50px rgba(0,0,0,0.5)`,
        }}>

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, rgba(139,92,246,0.12) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(148,163,184,0.08)',
          }}>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <FlaskConical size={17} style={{ color: '#c4b5fd' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-400">{adHocMode ? '🔬 Özel Reçete Oluştur' : 'Reçete Seç & Düzenle'}</p>
            <h3 className="text-sm font-bold truncate mt-0.5" style={{ color: isDark ? '#ffffff' : '#1e293b' }}>{productName}</h3>
          </div>
          {changed && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>
              <p className="text-[10px] font-bold text-amber-400">Siparişe özel</p>
            </div>
          )}
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"
            style={{ color: '#64748b' }}>
            <X size={15}/>
          </button>
        </div>

        {/* ═══ BODY ═══ */}
        {!adHocMode && allCombinedRecipes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0'}` }}>
              <Package size={24} className="text-slate-500"/>
            </div>
            <p className="text-sm font-semibold" style={{ color: isDark ? '#94a3b8' : '#475569' }}>Bu ürün için reçete tanımlanmamış</p>
            <p className="text-[11px] mt-2" style={{ color: '#64748b' }}>Stok → Mamül → Reçeteler sekmesinden ekleyebilirsiniz</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">

            {/* ── SOL: Reçete listesi (birden fazla varsa) ── */}
            {!hasSingleRecipe && (
              <div className="w-48 flex-shrink-0 flex flex-col overflow-hidden"
                style={{ borderRight: '1px solid rgba(148,163,184,0.07)' }}>

                {/* Etiket filtresi */}
                {allTags.length > 1 && (
                  <div className="p-3 flex flex-wrap gap-1.5 flex-shrink-0"
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => setActiveTag(tag)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                        style={{
                          background: activeTag === tag ? `${currentColor}25` : 'rgba(255,255,255,0.03)',
                          color:      activeTag === tag ? currentColor : '#475569',
                          border:     `1px solid ${activeTag === tag ? currentColor + '45' : 'rgba(148,163,184,0.1)'}`,
                        }}>
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Liste */}
                <div className="flex-1 overflow-y-auto">
                  {filteredRecipes.map(r => {
                    const active = (activeRecipe?.id === r.id);
                    const rStock = getRecipeStock(r.id);
                    const isCustom = !!r._isCustomVirtual;
                    const accentColor = isCustom ? '#f59e0b' : currentColor;
                    return (
                      <button key={r.id} onClick={() => selectRecipe(r)}
                        className="w-full text-left px-4 py-3 flex items-start gap-2 transition-all group"
                        style={{
                          background: active ? `${accentColor}15` : 'transparent',
                          borderLeft: `2px solid ${active ? accentColor : 'transparent'}`,
                        }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate"
                            style={{ color: active ? (isCustom ? '#fbbf24' : (isDark ? '#c4b5fd' : '#8b5cf6')) : (isDark ? '#94a3b8' : '#64748b') }}>
                            {isCustom && '🔧 '}{r.name}
                          </p>
                          <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: isDark ? '#475569' : '#94a3b8'}}>
                            <Package size={8}/> {(r.recipe_items || []).length} kalem{(r.other_costs || []).length > 0 ? ` + ${(r.other_costs || []).length} gider` : ''}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {active && <ChevronRight size={11} style={{ color: accentColor }}/>}
                          {rStock > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: isCustom ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: isCustom ? '#f59e0b' : '#10b981' }}>
                              {rStock} stokta
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SAĞ: Malzeme paneli ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

              {/* Reçete başlığı + Ekle */}
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>
                      {adHocMode ? `${productName} - Özel Reçete` : activeRecipe?.name}
                    </p>
                    {(activeRecipe?.tags || []).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                        style={{ background: `${currentColor}20`, color: currentColor }}>
                        <Tag size={8}/> {tag}
                      </span>
                    ))}
                  </div>
                  {changed && (
                    <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                      <AlertCircle size={9}/> Yalnızca bu sipariş için özelleştirildi
                    </p>
                  )}
                </div>
                <button onClick={() => setPickerTarget('add')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: `${currentColor}18`,
                    color: currentColor,
                    border: `1px solid ${currentColor}35`,
                  }}>
                  <Plus size={12}/> Malzeme Ekle
                </button>
              </div>

              {/* Tablo başlığı */}
              <div className="px-4 py-1.5 flex-shrink-0 grid text-[10px] font-bold uppercase tracking-widest text-slate-600"
                style={{ gridTemplateColumns: hideCosts ? '1fr 64px 68px 56px' : '1fr 64px 68px 80px 56px', borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                <span>Malzeme</span>
                <span className="text-center">Miktar</span>
                <span className="text-center">Birim</span>
                {!hideCosts && <span className="text-right">Birim Fiyat</span>}
                <span/>
              </div>

              {/* Malzeme satırları */}
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {localItems.filter(i => !i._isOtherCost).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                    <Package size={26} className="mb-2 opacity-30"/>
                    <p className="text-xs">Malzeme yok — Ekle ile başlayın</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {localItems.map((it, idx) => {
                    if (it._isOtherCost) return null;
                    const stockItem = (allItems || []).find(i => i.id === it.item_id);
                    const linePrice = Number(it.purchase_price ?? stockItem?.purchase_price ?? 0);
                    const lineTotal = linePrice * Number(it.quantity || 1);
                    return (
                      <motion.div key={idx}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group">
                        <div className="grid items-center gap-2 px-3 py-2.5 rounded-2xl transition-colors"
                          style={{
                            gridTemplateColumns: hideCosts ? '1fr 64px 68px 56px' : '1fr 64px 68px 80px 56px',
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(148,163,184,0.07)',
                          }}>

                          {/* Ad + stock bilgisi */}
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: it.item_id ? `${currentColor}18` : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9') }}>
                              <ShoppingBag size={10}
                                style={{ color: it.item_id ? currentColor : '#475569' }}/>
                            </div>
                            <div className="flex-1 min-w-0">
                               <input
                                value={it.item_name || ''}
                                onChange={e => updateItem(idx, 'item_name', e.target.value)}
                                placeholder="Malzeme adı..."
                                className="w-full bg-transparent outline-none text-xs font-semibold"
                                style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}/>
                              {stockItem && (
                                <p className="text-[9px] truncate" style={{ color: '#64748b' }}>
                                  Stok: {stockItem.stock_count} {stockItem.unit}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Miktar */}
                          <input type="number" min="0" step="0.01"
                            value={it.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full bg-transparent outline-none text-xs text-center font-bold rounded-lg px-1 py-1"
                            style={{ color: isDark ? '#e2e8f0' : '#1e293b', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}` }}/>

                          {/* Birim */}
                          <select value={it.unit || 'Adet'}
                            onChange={e => updateItem(idx, 'unit', e.target.value)}
                            className="bg-transparent outline-none text-[11px] text-center rounded-lg px-1 py-1 w-full"
                            style={{ color: '#94a3b8', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`, background: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc' }}>
                            {UNITS.map(u => <option key={u} value={u} style={{ background: isDark ? '#0d1b2e' : '#ffffff' }}>{u}</option>)}
                          </select>

                          {/* Birim Fiyat */}
                          {!hideCosts && (() => {
                            const isOverridden = it.purchase_price !== null && it.purchase_price !== stockItem?.purchase_price;
                            return (
                              <div className="flex items-center justify-end gap-0.5">
                                <span className="text-[10px] text-slate-600">
                                  {CURRENCY_SYM[it.base_currency || stockItem?.base_currency || 'TRY']}
                                </span>
                                <div className="relative">
                                  <input type="number" min="0" step="0.00001"
                                    value={it.purchase_price ?? (stockItem?.purchase_price ?? '')}
                                    onChange={e => updateItem(idx, 'purchase_price', e.target.value === '' ? null : Number(e.target.value))}
                                    placeholder={stockItem?.purchase_price ? String(stockItem.purchase_price) : '0'}
                                    className={`w-14 bg-transparent outline-none text-xs text-right font-bold transition-colors ${isOverridden ? 'text-amber-400' : 'text-emerald-400'} placeholder-slate-700`}/>
                                  {isOverridden && (
                                    <div className="absolute -right-2 -top-1" title="Manuel fiyat müdahalesi">
                                      <AlertCircle size={8} className="text-amber-500 fill-amber-500/20"/>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Aksiyonlar */}
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setPickerTarget(idx)} title="Malzeme değiştir (stoktan)"
                              className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10">
                              <ArrowLeftRight size={10} className="text-blue-400"/>
                            </button>
                            <button onClick={() => removeItem(idx)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                              <Trash2 size={10} className="text-red-400"/>
                            </button>
                          </div>
                        </div>

                        {/* Satır toplam */}
                        {!hideCosts && linePrice > 0 && (
                          <p className="text-right text-[10px] text-slate-600 pr-3 -mt-0.5 pb-0.5">
                            {Number(it.quantity || 1).toFixed(2)} × {CURRENCY_SYM[it.base_currency || stockItem?.base_currency || 'TRY']}{linePrice.toFixed(4)} 
                            {(it.base_currency || stockItem?.base_currency) && (it.base_currency || stockItem?.base_currency) !== 'TRY' && (
                                <span className="ml-1 opacity-70">(≈ ₺{fxConvert(lineTotal, it.base_currency || stockItem?.base_currency, 'TRY').toFixed(2)})</span>
                            )}
                            {' '} = <span className="text-slate-400 font-semibold">
                                {CURRENCY_SYM[it.base_currency || stockItem?.base_currency || 'TRY']}{lineTotal.toFixed(2)}
                            </span>
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* DİĞER GİDERLER */}
                <div className="pt-3 pb-1 flex items-center justify-between" style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Diğer Giderler</p>
                  <div className="relative" ref={expenseDropRef}>
                    <button onClick={() => setExpenseDrop(!expenseDrop)}
                      className="flex items-center gap-1 text-[11px] font-bold transition-all px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <Plus size={10}/> Gider Ekle
                    </button>
                    {expenseDrop && (
                      <div className="absolute right-0 bottom-full mb-1 w-40 rounded-xl shadow-lg border z-10 overflow-hidden"
                        style={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0' }}>
                        <div className="py-1">
                          {costTypes.map(ct => (
                            <button key={ct} onClick={() => addOtherCost(ct)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                              style={{ color: isDark ? '#cbd5e1' : '#334155', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#f1f5f9'}` }}>
                              + {ct}
                            </button>
                          ))}
                          {costTypes.length === 0 && <span className="block px-3 py-2 text-[10px] text-center" style={{ color: '#94a3b8' }}>Ayarlardan tip ekleyin</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {localItems.map((it, idx) => {
                    if (!it._isOtherCost) return null;
                    const linePrice = Number(it.purchase_price ?? 0);
                    const lineTotal = linePrice * Number(it.quantity || 1);
                    return (
                      <motion.div key={idx}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group">
                        <div className="grid items-center gap-2 px-3 py-2.5 rounded-2xl transition-colors"
                          style={{
                            gridTemplateColumns: hideCosts ? '1fr 64px 68px 56px' : '1fr 64px 68px 80px 56px',
                            background: 'rgba(245,158,11,0.04)',
                            border: '1px solid rgba(245,158,11,0.15)',
                          }}>
                          
                          {/* İsim */}
                          <div className="min-w-0 flex items-center gap-2">
                             <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(245,158,11,0.1)' }}>
                              <DollarSign size={10} style={{ color: '#f59e0b' }}/>
                            </div>
                            <input
                              value={it.item_name || ''}
                              onChange={e => updateItem(idx, 'item_name', e.target.value)}
                              placeholder="Gider adı..."
                              className="w-full bg-transparent outline-none text-xs font-bold"
                              style={{ color: '#f59e0b' }}/>
                          </div>

                          {/* Miktar */}
                          <input type="number" min="0" step="0.01"
                            value={it.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full bg-transparent outline-none text-xs text-center font-bold rounded-lg px-1 py-1"
                            style={{ color: isDark ? '#e2e8f0' : '#1e293b', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}` }}/>

                          {/* Birim */}
                          <select value={it.unit || 'Adet'}
                            onChange={e => updateItem(idx, 'unit', e.target.value)}
                            className="bg-transparent outline-none text-[11px] text-center rounded-lg px-1 py-1 w-full"
                            style={{ color: '#94a3b8', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`, background: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc' }}>
                            {UNITS.map(u => <option key={u} value={u} style={{ background: isDark ? '#0d1b2e' : '#ffffff' }}>{u}</option>)}
                          </select>

                          {/* Birim Fiyat */}
                          {!hideCosts && (
                            <div className="flex items-center justify-end gap-0.5">
                              <select value={it.base_currency || 'TRY'}
                                onChange={e => updateItem(idx, 'base_currency', e.target.value)}
                                className="bg-transparent text-[10px] text-amber-600 outline-none p-0 pr-1 border-none cursor-pointer">
                                {CURRENCIES.map(c => <option key={c} value={c} className="text-black">{CURRENCY_SYM[c] || c}</option>)}
                              </select>
                              <input type="number" min="0" step="0.01"
                                value={it.purchase_price ?? ''}
                                onChange={e => updateItem(idx, 'purchase_price', e.target.value === '' ? null : Number(e.target.value))}
                                placeholder="0"
                                className="w-14 bg-transparent outline-none text-xs text-right font-bold text-amber-500 placeholder-slate-700"/>
                            </div>
                          )}

                          {/* Aksiyonlar */}
                          <div className="flex items-center justify-end gap-1">
                             <div className="w-7"/> {/* Placeholder for swap */}
                             <button onClick={() => removeItem(idx)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                              <Trash2 size={10} className="text-red-400"/>
                             </button>
                          </div>
                        </div>

                        {!hideCosts && linePrice > 0 && (
                          <p className="text-right text-[10px] text-amber-600/70 pr-3 -mt-0.5 pb-0.5">
                            {Number(it.quantity || 1).toFixed(2)} × ₺{linePrice.toFixed(2)} = <span className="text-amber-500 font-bold">₺{lineTotal.toFixed(2)}</span>
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Sipariş özel uyarı */}
              {changed && (
                <div className="mx-4 mb-2 flex-shrink-0 flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5"/>
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Bu değişiklikler <strong>yalnızca bu sipariş</strong> için geçerli — asıl reçete değişmez.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        {(adHocMode || allCombinedRecipes.length > 0) && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(148,163,184,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Package size={12} className="text-slate-600"/>
                  <span className="text-xs text-slate-500">{localItems.filter(i => i.item_name?.trim()).length} malzeme</span>
                </div>
                {totalCost > 0 && !hideCosts && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <DollarSign size={11} className="text-emerald-400"/>
                    <span className="text-xs font-bold text-emerald-400">₺{totalCost.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-600">toplam maliyet</span>
                  </div>
                )}
                {activeStock > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <ShoppingBag size={11} className="text-blue-400"/>
                    <span className="text-xs font-bold text-blue-400">{activeStock} adet stokta</span>
                  </div>
                )}
              </div>
              {/* Stoktan kullan checkbox — sadece stok > 0 && özel reçete değilse && hideSkipWorkOrder değilse */}
              {!hideSkipWorkOrder && activeStock > 0 && (
                <label className={`flex items-center gap-2 select-none px-2.5 py-2 rounded-xl transition-all ${canSkipWorkOrder ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                  style={{ background: skipWorkOrder ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${skipWorkOrder ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.08)'}` }}>
                  <input type="checkbox" checked={skipWorkOrder} disabled={!canSkipWorkOrder}
                    onChange={e => setSkipWorkOrder(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-emerald-500"/>
                  <span className="text-[11px] font-semibold" style={{ color: skipWorkOrder ? '#10b981' : '#94a3b8' }}>
                    {!canSkipWorkOrder ? 'Elle değiştirildi — stoktan kullanılamaz' : (isVirtualSelected ? 'Özel reçete stoktan kullan' : 'Stoktan kullan — İş emrine gönderme')}
                  </span>
                  {skipWorkOrder && (
                    <span className="text-[9px] ml-auto px-2 py-0.5 rounded-full font-bold"
                      style={{ background:'rgba(16,185,129,0.12)', color:'#10b981' }}>
                      ✓ Doğrudan satış
                    </span>
                  )}
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 transition-all hover:text-slate-300"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                İptal
              </button>
              <button onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{
                  background: `linear-gradient(135deg, ${currentColor}, ${currentColor}cc)`,
                  boxShadow: `0 4px 15px ${currentColor}40`,
                }}>
                <Check size={14}/> Reçeteyi Uygula
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>

    {/* ═══ ITEM PICKER MODAL ═══ */}
    <AnimatePresence>
      {pickerTarget !== null && (
        <ItemPickerModal
          allItems={allItems}
          onPick={handleItemPick}
          onClose={() => setPickerTarget(null)}
          currentColor={currentColor}
          isSwap={pickerTarget !== 'add'}
        />
      )}
    </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ItemPickerModal — Ayrı tam modal: stok araması + kayıtsız seçim
═══════════════════════════════════════════════════════════════ */
function ItemPickerModal({ allItems, onPick, onClose, currentColor, isSwap }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = trNorm(search).trim();
    if (!q) return (allItems || []).slice(0, 40);
    return (allItems || []).filter(i =>
      trNorm(i.name).includes(q) ||
      trNorm(i.sku).includes(q)
    ).slice(0, 40);
  }, [allItems, search]);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? '#0c1829' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : '#e2e8f0'}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          maxHeight: '80vh',
        }}>

        {/* Başlık */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <Search size={15} style={{ color: currentColor }}/>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
              {isSwap ? 'Malzeme Değiştir' : 'Malzeme Ekle'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        {/* Arama */}
        <div className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}` }}>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', border: `1px solid ${isDark ? `${currentColor}30` : '#e2e8f0'}` }}>
            <Search size={12} style={{ color: '#64748b' }}/>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ad veya SKU ile ara..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}/>
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300">
                <X size={12}/>
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {/* Kayıtsız devam et */}
          {search.trim() && (
            <button
              onClick={() => onPick({ custom: search.trim() })}
              className="w-full text-left px-4 py-3 flex items-center gap-3 transition-all hover:bg-white/5"
              style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <Plus size={14} className="text-amber-400"/>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-300">"{search.trim()}" — Kayıtsız olarak ekle</p>
                <p className="text-[10px] text-amber-600">Stok bağlantısı olmadan sadece isimle eklenir</p>
              </div>
            </button>
          )}

          {/* Stok listesi */}
          {filtered.length === 0 && !search.trim() && (
            <p className="text-center text-sm text-slate-700 py-8">Stok bulunamadı</p>
          )}
          {filtered.map(item => (
            <button key={item.id}
              onClick={() => onPick({ item })}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all hover:bg-white/4 group"
              style={{ borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${currentColor}12`, border: `1px solid ${currentColor}25` }}>
                <Package size={12} style={{ color: currentColor }}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate group-hover:text-amber-500 transition-colors"
                   style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px]" style={{ color: '#64748b' }}>{item.unit}</span>
                  {item.sku && <span className="text-[10px] text-slate-700">· #{item.sku}</span>}
                  {item.stock_count != null && (
                    <span className="text-[10px]"
                      style={{ color: item.stock_count > 0 ? '#64748b' : '#ef4444' }}>
                      Stok: {item.stock_count}
                    </span>
                  )}
                </div>
              </div>
              {item.purchase_price > 0 && (
                <span className="text-xs font-bold text-emerald-400 flex-shrink-0">
                  ₺{Number(item.purchase_price).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 flex-shrink-0 text-center"
          style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          <p className="text-[10px] text-slate-700">
            {filtered.length} sonuç · Kayıtsız eklemek için adı yazın ve ilk seçeneğe tıklayın
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function cloneItems(items) {
  return (items || []).map(it => ({ ...it }));
}

function cloneRecipeData(recipe) {
  if (!recipe) return [];
  const items = cloneItems(recipe.recipe_items || []);
  const costs = (recipe.other_costs || []).map(oc => ({
    _new: true,
    item_id: null,
    item_name: oc.type,
    quantity: 1,
    unit: 'Adet',
    purchase_price: oc.amount,
    base_currency: oc.currency || 'TRY',
    _isOtherCost: true,
  }));
  return [...items, ...costs];
}
