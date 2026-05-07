import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, ArrowRightLeft, Package, FlaskConical, 
  ChevronRight, AlertCircle, TrendingUp, TrendingDown, 
  ArrowRight, Info
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../contexts/ThemeContext';
import { trNorm } from '../../lib/trNorm';

import { useFxRates } from '../../hooks/useFxRates';

export default function RecipeComparisonModal({ isOpen, onClose }) {
  const { effectiveMode, currentColor } = useTheme();
  const { convert: fxConvert } = useFxRates();
  const isDark = effectiveMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');

  const [selectedA, setSelectedA] = useState(null); // { product, recipe }
  const [selectedB, setSelectedB] = useState(null);

  const [selectingFor, setSelectingFor] = useState(null); // 'A' or 'B'
  const [recipesForSelection, setRecipesForSelection] = useState([]);

  const c = {
    bg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    card: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? 'rgba(148, 163, 184, 0.1)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
  };

  // ── Veri Çekme ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    
    // Sadece reçetesi olan ürünleri çek
    (async () => {
      try {
        const { data: recipes, error } = await supabase
          .from('product_recipes')
          .select('product_id, items!inner(id, name, sku, base_currency, purchase_price)');
        
        if (error) throw error;

        // Benzersiz ürünleri filtrele
        const uniqueProducts = [];
        const seenIds = new Set();
        
        recipes?.forEach(r => {
          if (!seenIds.has(r.product_id)) {
            seenIds.add(r.product_id);
            uniqueProducts.push(r.items);
          }
        });

        setProducts(uniqueProducts);
      } catch (err) {
        console.error('Error fetching recipe products:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  // ── Reçete Seçimi ────────────────────────────────────────────────────────
  const handleProductSelect = async (product) => {
    try {
      const { data: recipes, error } = await supabase
        .from('product_recipes')
        .select('*, recipe_items(*, item:item_id(name, purchase_price, base_currency))')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (recipes?.length === 1) {
        // Tek reçete varsa direkt seç
        const selection = { product, recipe: recipes[0] };
        if (selectingFor === 'A') setSelectedA(selection);
        else setSelectedB(selection);
        setSelectingFor(null);
      } else {
        // Birden fazla varsa reçete seçtir
        setRecipesForSelection(recipes.map(r => ({ ...r, product })));
      }
    } catch (err) {
      console.error('Error fetching recipes:', err);
    }
  };

  // ── Karşılaştırma Mantığı ──────────────────────────────────────────────────
  const comparison = useMemo(() => {
    if (!selectedA?.recipe || !selectedB?.recipe) return null;

    const itemsA = selectedA.recipe.recipe_items || [];
    const itemsB = selectedB.recipe.recipe_items || [];

    // Tüm malzemeleri topla (Benzersiz isim bazlı)
    const allItemNames = Array.from(new Set([
      ...itemsA.map(i => i.item_name || i.item?.name),
      ...itemsB.map(i => i.item_name || i.item?.name)
    ])).filter(Boolean);

      const costA = (riA) => {
        const p = riA?.item?.purchase_price || 0;
        const cur = riA?.item?.base_currency || 'TRY';
        return fxConvert(p * (riA?.quantity || 0), cur, 'TRY');
      };
      const costB = (riB) => {
        const p = riB?.item?.purchase_price || 0;
        const cur = riB?.item?.base_currency || 'TRY';
        return fxConvert(p * (riB?.quantity || 0), cur, 'TRY');
      };

      const cA = costA(itemA);
      const cB = costB(itemB);

      return {
        name,
        qtyA,
        qtyB,
        diff: qtyB - qtyA,
        unit,
        price: itemA?.item?.purchase_price || itemB?.item?.purchase_price || 0,
        currency: itemA?.item?.base_currency || itemB?.item?.base_currency || 'TRY',
        costA: cA,
        costB: cB,
        costDiff: cB - cA
      };
    });

    // Maliyet hesaplama
    const getCost = (recipe) => {
      const materials = (recipe.recipe_items || []).reduce((sum, ri) => {
        const price = Number(ri.item?.purchase_price) || 0;
        const curr = ri.item?.base_currency || 'TRY';
        const tryPrice = fxConvert(price, curr, 'TRY');
        return sum + (Number(ri.quantity) * tryPrice);
      }, 0);
      const other = (recipe.other_costs || []).reduce((sum, oc) => {
        const price = Number(oc.amount || 0);
        const curr = oc.currency || 'TRY';
        return sum + fxConvert(price, curr, 'TRY');
      }, 0);
      return { materials, other, total: materials + other };
    };

    return {
      rows,
      costA: getCost(selectedA.recipe),
      costB: getCost(selectedB.recipe),
    };
  }, [selectedA, selectedB, fxConvert]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border"
        style={{ background: c.card, borderColor: c.border }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: c.text }}>Reçete Karşılaştırma</h2>
              <p className="text-xs" style={{ color: c.muted }}>İki farklı reçeteyi malzeme ve maliyet bazlı kıyaslayın</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors" style={{ color: c.muted }}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Seçim Alanı */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectionBox 
              label="Ürün A (Baz)"
              selection={selectedA}
              onClear={() => setSelectedA(null)}
              onOpen={() => setSelectingFor('A')}
              currentColor={currentColor}
              c={c}
            />
            <SelectionBox 
              label="Ürün B (Hedef)"
              selection={selectedB}
              onClear={() => setSelectedB(null)}
              onOpen={() => setSelectingFor('B')}
              currentColor={currentColor}
              c={c}
            />
          </div>

          {/* Karşılaştırma Tablosu */}
          {comparison ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Maliyet Özeti */}
              <div className="grid grid-cols-2 gap-4">
                <CostSummary cardLabel="A Maliyeti" cost={comparison.costA} c={c} currentColor={currentColor} />
                <CostSummary cardLabel="B Maliyeti" cost={comparison.costB} c={c} currentColor={currentColor} />
              </div>

              {/* Malzeme Detayları */}
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: c.border }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase font-bold tracking-wider" style={{ background: c.inputBg, color: c.muted, borderBottom: `1px solid ${c.border}` }}>
                        <th className="px-4 py-3 text-left">Malzeme</th>
                        <th className="px-4 py-3 text-center">Reçete A (Mly)</th>
                        <th className="px-4 py-3 text-center">Reçete B (Mly)</th>
                        <th className="px-4 py-3 text-right">Fark (Mly)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: c.border }}>
                      {comparison.rows.map((row, i) => {
                        const hasDiff = row.diff !== 0;
                        return (
                          <tr key={i} className="hover:bg-black/5 transition-colors">
                            <td className="px-4 py-3 font-medium" style={{ color: c.text }}>
                              <div>{row.name}</div>
                              <div className="text-[9px] opacity-50">{row.price.toFixed(2)} {row.currency} / {row.unit}</div>
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              <div className="text-xs font-mono" style={{ color: c.text }}>{row.qtyA > 0 ? `${row.qtyA} ${row.unit}` : '—'}</div>
                              {row.qtyA > 0 && <div className="text-[10px]" style={{ color: c.muted }}>₺{row.costA.toFixed(2)}</div>}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              <div className="text-xs font-mono" style={{ color: c.text }}>{row.qtyB > 0 ? `${row.qtyB} ${row.unit}` : '—'}</div>
                              {row.qtyB > 0 && <div className="text-[10px]" style={{ color: c.muted }}>₺{row.costB.toFixed(2)}</div>}
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums font-bold text-xs ${row.costDiff > 0 ? 'text-red-500' : row.costDiff < 0 ? 'text-green-500' : 'opacity-20'}`}>
                              <div>{row.diff > 0 ? `+${row.diff}` : row.diff === 0 ? '—' : row.diff} {row.unit}</div>
                              {row.costDiff !== 0 && <div className="text-[10px]">₺{row.costDiff.toFixed(2)}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Toplam Fark Notu */}
              <div className={`p-4 rounded-2xl flex items-center gap-3 border ${comparison.costB.total > comparison.costA.total ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                {comparison.costB.total > comparison.costA.total ? (
                  <TrendingUp className="text-red-500" size={20} />
                ) : (
                  <TrendingDown className="text-green-500" size={20} />
                )}
                <p className="text-sm font-semibold">
                  B ürünü, A ürününe göre 
                  <span className={comparison.costB.total > comparison.costA.total ? 'text-red-500 mx-1' : 'text-green-500 mx-1'}>
                    ₺{Math.abs(comparison.costB.total - comparison.costA.total).toFixed(2)}
                  </span> 
                  {comparison.costB.total > comparison.costA.total ? 'daha pahalı.' : 'daha ucuz.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center" style={{ color: c.muted }}>
                <FlaskConical size={32} strokeWidth={1} />
              </div>
              <div className="max-w-xs">
                <p className="text-sm font-bold" style={{ color: c.text }}>Karşılaştırmak için ürün seçin</p>
                <p className="text-xs mt-1" style={{ color: c.muted }}>Yukarıdaki kutucukları kullanarak iki farklı ürün veya reçete seçerek farkları görün.</p>
              </div>
            </div>
          )}
        </div>

        {/* Ürün Seçim Listesi (Modal içinde Modal gibi) */}
        <AnimatePresence>
          {selectingFor && (
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="absolute inset-0 z-[110] flex flex-col"
              style={{ background: c.card }}
            >
              <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: c.border }}>
                <button onClick={() => setSelectingFor(null)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
                  <X size={20} style={{ color: c.muted }} />
                </button>
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
                  <input 
                    autoFocus
                    placeholder="Ürün veya SKU ara..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm pl-10"
                    style={{ color: c.text }}
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {products
                  .filter(p => !search || trNorm(p.name).includes(trNorm(search)) || trNorm(p.sku || '').includes(trNorm(search)))
                  .map(p => (
                    <button 
                      key={p.id}
                      onClick={() => handleProductSelect(p)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border hover:shadow-lg transition-all text-left"
                      style={{ background: c.inputBg, borderColor: c.border }}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: c.text }}>{p.name}</p>
                        {p.sku && <p className="text-[10px] font-mono mt-1" style={{ color: c.muted }}>{p.sku}</p>}
                      </div>
                      <ChevronRight size={16} style={{ color: c.muted }} />
                    </button>
                  ))
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reçete Seçim Listesi */}
        <AnimatePresence>
          {recipesForSelection.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[120] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            >
              <div className="w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl" style={{ background: c.card }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold" style={{ color: c.text }}>Reçete Seçin</h3>
                  <button onClick={() => setRecipesForSelection([])} className="p-1 rounded-full hover:bg-black/5">
                    <X size={18} style={{ color: c.muted }} />
                  </button>
                </div>
                <p className="text-xs" style={{ color: c.muted }}>Bu ürünün birden fazla reçetesi var, karşılaştırmak istediğinizi seçin:</p>
                <div className="space-y-2">
                  {recipesForSelection.map(r => (
                    <button 
                      key={r.id}
                      onClick={() => {
                        const selection = { product: r.product, recipe: r };
                        if (selectingFor === 'A') setSelectedA(selection);
                        else setSelectedB(selection);
                        setRecipesForSelection([]);
                        setSelectingFor(null);
                      }}
                      className="w-full p-4 rounded-2xl border text-left font-semibold text-sm hover:border-blue-500 transition-all"
                      style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function SelectionBox({ label, selection, onClear, onOpen, currentColor, c }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: c.muted }}>{label}</label>
      {selection ? (
        <div className="relative group p-4 rounded-2xl border flex items-center gap-4 transition-all" style={{ background: c.card, borderColor: currentColor }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: currentColor }}>
            <Package size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: c.text }}>{selection.product.name}</p>
            <p className="text-[10px] mt-1 font-semibold" style={{ color: c.muted }}>{selection.recipe.name}</p>
          </div>
          <button onClick={onClear} className="p-2 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <button 
          onClick={onOpen}
          className="w-full p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:bg-black/5"
          style={{ borderColor: c.border, color: c.muted }}
        >
          <Plus size={20} />
          <span className="text-xs font-bold">Seçmek için tıkla</span>
        </button>
      )}
    </div>
  );
}

function CostSummary({ cardLabel, cost, c, currentColor }) {
  return (
    <div className="p-4 rounded-2xl border space-y-3" style={{ background: c.card, borderColor: c.border }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>{cardLabel}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span style={{ color: c.muted }}>Malzeme:</span>
          <span className="font-bold" style={{ color: c.text }}>₺{cost.materials.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: c.muted }}>Giderler:</span>
          <span className="font-bold" style={{ color: c.text }}>₺{cost.other.toFixed(2)}</span>
        </div>
        <div className="pt-2 mt-2 border-t flex justify-between" style={{ borderColor: c.border }}>
          <span className="text-xs font-bold" style={{ color: c.text }}>Toplam (TRY):</span>
          <span className="text-sm font-extrabold" style={{ color: currentColor }}>₺{cost.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// Minimal icons local proxy
function Trash2({ size, className }) { return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 9 2 2 4-4"/></svg>; }
function Plus({ size, className }) { return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7h14"/></svg>; }
