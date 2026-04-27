import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Plus, Trash2, Calculator, DollarSign, Calculator as CalcIcon } from 'lucide-react';
import { useStock } from '../../hooks/useStock';
import { useFxRates } from '../../hooks/useFxRates';

const CURRENCY_SYM = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

export default function QuickCostCalculator({ isDark, currentColor, onClose }) {
  const { rawItems, productItems, loading } = useStock();
  const { fxRates, convert } = useFxRates();
  
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [extraCosts, setExtraCosts] = useState([{ id: 1, name: '', amount: '' }]);
  const [baseQty, setBaseQty] = useState('1');

  const c = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? 'rgba(15,23,42,0.6)' : '#f1f5f9'
  };

  const allDbItems = useMemo(() => [...rawItems, ...productItems], [rawItems, productItems]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allDbItems.filter(i => 
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.sku && i.sku.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [allDbItems, search]);

  const addItem = (item) => {
    setLines(p => [
      ...p,
      {
        id: Math.random().toString(36).substr(2, 9),
        item_id: item.id,
        name: item.name,
        qty: '',
        unit: item.unit || 'Adet',
        price: item.purchase_price || 0,
        currency: item.base_currency || 'TRY'
      }
    ]);
    setSearch('');
  };

  const updateLine = (id, field, value) => {
    setLines(p => p.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLine = (id) => setLines(p => p.filter(l => l.id !== id));

  // Extra Costs
  const updateExtraCost = (id, field, value) => setExtraCosts(p => p.map(e => e.id === id ? { ...e, [field]: value } : e));
  const removeExtraCost = (id) => setExtraCosts(p => p.filter(e => e.id !== id));
  const addExtraCost = () => setExtraCosts(p => [...p, { id: Math.random(), name: '', amount: '' }]);

  // Compute Cost
  const parsedBaseQty = parseFloat(baseQty) || 1;
  const parsedOther = extraCosts.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const totalCostTRY = useMemo(() => {
    let sum = 0;
    lines.forEach(l => {
      const q = parseFloat(l.qty) || 0;
      const p = parseFloat(l.price) || 0;
      const c = l.currency || 'TRY';
      sum += convert(p * q, c, 'TRY');
    });
    return sum + parsedOther;
  }, [lines, parsedOther, convert]);

  const unitCostTRY = totalCostTRY / parsedBaseQty;
  const unitCostUSD = convert(unitCostTRY, 'TRY', 'USD');
  const unitCostEUR = convert(unitCostTRY, 'TRY', 'EUR');

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl flex flex-col shadow-2xl rounded-2xl overflow-hidden"
        style={{ background: c.card, border: `1px solid ${c.border}`, maxHeight: '90vh' }}>
        
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${currentColor}15`, color: currentColor }}>
              <CalcIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: c.text }}>Hızlı Maliyet Hesaplayıcı</h2>
              <p className="text-xs" style={{ color: c.muted }}>Stoktaki hammaddeleri ve giderleri ekleyip net maliyetinizi bulun</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-all hover:bg-black/5" style={{ color: c.muted }}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          
          {/* Sol: Ekleme & Liste */}
          <div className="flex-1 flex flex-col min-w-0 border-r" style={{ borderColor: c.border }}>
            {/* Arama */}
            <div className="p-4 border-b" style={{ borderColor: c.border }}>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Hammadde veya ürün ara..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all focus:ring-2"
                  style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text, '--tw-ring-color': currentColor }}
                />
                
                {search.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl shadow-xl z-50 border max-h-60 overflow-y-auto"
                    style={{ background: c.card, borderColor: c.border }}>
                    {filteredItems.length === 0 ? (
                      <div className="p-3 text-center text-sm" style={{ color: c.muted }}>Sonuç bulunamadı</div>
                    ) : (
                      filteredItems.map(item => (
                        <button key={item.id} onClick={() => addItem(item)}
                          className="w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors hover:bg-black/5"
                          style={{ color: c.text }}>
                          <div className="min-w-0 pr-3">
                            <p className="font-semibold text-sm truncate">{item.name}</p>
                            <p className="text-[10px] opacity-70">
                              {item.purchase_price} {CURRENCY_SYM[item.base_currency] || '₺'} / {item.unit}
                            </p>
                          </div>
                          <Plus size={16} style={{ color: currentColor }} />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Satırlar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {lines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                  <CalcIcon size={48} className="mb-4" />
                  <p className="text-sm font-semibold">Yukarıdan malzeme arayıp ekleyin</p>
                </div>
              ) : (
                lines.map((l, i) => (
                  <div key={l.id} className="p-3 rounded-xl border flex gap-3 relative" style={{ borderColor: c.border, background: isDark ? 'rgba(0,0,0,0.1)' : '#fff' }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold mt-1 shadow-sm"
                      style={{ background: `${currentColor}15`, color: currentColor }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate pr-6" style={{ color: c.text }}>{l.name}</p>
                      <div className="flex bg-transparent mt-2 gap-2 flex-wrap">
                        <div className="flex-1 min-w-[100px]">
                          <span className="text-[9px] uppercase tracking-wider mb-0.5 block" style={{ color: c.muted }}>Miktar</span>
                          <div className="flex">
                            <input type="number" step="0.01" value={l.qty} onChange={e => updateLine(l.id, 'qty', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-l-lg outline-none" placeholder="0"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text, borderRight: 0 }} />
                            <span className="px-2 py-1.5 text-[10px] font-semibold border border-l-0 rounded-r-lg flex items-center bg-black/5"
                              style={{ borderColor: c.border, color: c.muted }}>{l.unit}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <span className="text-[9px] uppercase tracking-wider mb-0.5 block" style={{ color: c.muted }}>Birim Fiyat</span>
                          <div className="flex">
                            <input type="number" step="0.01" value={l.price} onChange={e => updateLine(l.id, 'price', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-l-lg outline-none"
                              style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text, borderRight: 0 }} />
                            <select value={l.currency} onChange={e => updateLine(l.id, 'currency', e.target.value)}
                              className="px-1 py-1.5 text-[10px] font-bold border border-l-0 rounded-r-lg outline-none bg-black/5"
                              style={{ borderColor: c.border, color: c.muted }}>
                              {['TRY','USD','EUR','GBP'].map(cu => <option key={cu} value={cu}>{cu}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeLine(l.id)} className="absolute top-2 right-2 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sağ: Toplamlar & Kontroller */}
          <div className="w-full md:w-[360px] bg-black/5 flex flex-col p-5 overflow-y-auto">
            <h3 className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: c.muted }}>Hesaplama & Ek Gider</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase mb-1 flex justify-between" style={{ color: c.muted }}>
                  Üretilecek Adet <span style={{ color: currentColor }}>Birim Maliyeti Bul</span>
                </label>
                <input type="number" min="1" value={baseQty} onChange={e => setBaseQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl outline-none text-center"
                  style={{ background: c.card, border: `1px solid ${c.border}`, color: c.text }} />
              </div>

              {/* Multiple Extra Costs */}
              <div>
                <label className="text-[10px] font-bold uppercase mb-2 block" style={{ color: c.muted }}>Ek Giderler / İşçilik (₺)</label>
                <div className="space-y-2">
                  {extraCosts.map((ex, i) => (
                    <div key={ex.id} className="flex gap-2">
                      <input type="text" value={ex.name} onChange={e => updateExtraCost(ex.id, 'name', e.target.value)}
                        placeholder="Gider adı"
                        className="flex-1 px-2.5 py-1.5 text-[10px] sm:text-xs rounded-lg outline-none min-w-[70px]"
                        style={{ background: c.card, border: `1px solid ${c.border}`, color: c.text }} />
                      <input type="number" value={ex.amount} onChange={e => updateExtraCost(ex.id, 'amount', e.target.value)}
                        placeholder="Tutar ₺"
                        className="w-[80px] sm:w-[100px] px-2.5 py-1.5 text-xs font-bold rounded-lg outline-none text-right"
                        style={{ background: c.card, border: `1px solid ${c.border}`, color: c.text }} />
                      <button onClick={() => removeExtraCost(ex.id)} className="p-1.5 text-red-400 hover:text-red-500 rounded-lg">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={addExtraCost} className="text-[10px] font-bold px-2 py-1.5 rounded flex items-center gap-1 mt-1"
                    style={{ color: currentColor, background: `${currentColor}15` }}>
                    <Plus size={10} /> Başka Ekle
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t space-y-4" style={{ borderColor: c.border }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: c.muted }}>
                1 Birim İçin Net Maliyet
              </p>
              
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10"><DollarSign size={80} /></div>
                <div className="relative z-10">
                  <p className="text-3xl font-black mb-1">₺ {unitCostTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs font-semibold text-white/80">Türk Lirası</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 border" style={{ background: c.card, borderColor: c.border }}>
                  <p className="text-xs font-bold mb-0.5" style={{ color: c.muted }}>USD Karşılığı</p>
                  <p className="text-base font-black text-green-500">$ {unitCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[9px] mt-1 opacity-50" style={{ color: c.muted }}>Kur: {fxRates?.USD}</p>
                </div>
                <div className="rounded-xl p-3 border" style={{ background: c.card, borderColor: c.border }}>
                  <p className="text-xs font-bold mb-0.5" style={{ color: c.muted }}>EUR Karşılığı</p>
                  <p className="text-base font-black text-blue-500">€ {unitCostEUR.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[9px] mt-1 opacity-50" style={{ color: c.muted }}>Kur: {fxRates?.EUR}</p>
                </div>
              </div>
            </div>

            {/* Eylem butonları eklenebilir (Satış fiyatı tavsiyesi vs) */}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
