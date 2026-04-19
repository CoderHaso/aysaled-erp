/**
 * InvoiceStockModal.jsx
 *
 * Faturadan stoğa işleme modalı.
 * Her fatura kalemi → stok eşleştirme → miktar → fiyat güncelleme
 *
 * Props:
 *  inv         — invoice row (cari_name, currency, issue_date, line_items[])
 *  allItems    — items[] from supabase
 *  supabase    — supabase client
 *  onClose     — () => void
 *  onDone      — (invoiceId) => void  (işlem tamamlandı)
 *  currentColor
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Check, Package, AlertCircle, Loader2,
  ArrowRight, Edit2, Plus, Info,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const fmt = (n) =>
  n != null ? Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

export default function InvoiceStockModal({
  inv, allItems = [], supabase, onClose, onDone, currentColor = '#f59e0b',
}) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const lines = inv.line_items || [];

  // Her fatura kalemi için mapping state: { stockItemId, qtyOverride, updatePrice, priceVal }
  const [mappings, setMappings] = useState(() =>
    lines.map(l => ({
      invoiceLine: l,
      stockItemId: null,
      qtyOverride: String(l.quantity || 1),
      updatePrice: true,
      priceVal:    String(l.unit_price || ''),
      currencyVal: inv.currency || 'TRY',
      stockPrice:  '',
      stockCurrency: 'TRY',
    }))
  );

  // Item search state per satır
  const [searches, setSearches] = useState(() => lines.map(() => ''));
  const [openRow,  setOpenRow]  = useState(null); // hangi satırın dropdown'u açık
  const [dropPos,  setDropPos]  = useState({ top: 0, left: 0, width: 0 });
  const btnRefs                 = useRef({});
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [done,     setDone]     = useState(false);

  const updateMapping = (idx, key, val) =>
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, [key]: val } : m));

  // Stok arama sonuçları
  const searchResults = (idx) => {
    const q = (searches[idx] || '').toLowerCase().trim();
    if (!q) return allItems.slice(0, 12);
    return allItems.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q)
    ).slice(0, 12);
  };

  const selectedItem = (idx) =>
    allItems.find(i => i.id === mappings[idx]?.stockItemId) || null;

  // ── Kaydet ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const toProcess = mappings.filter(m => m.stockItemId);
    if (!toProcess.length) { setErr('En az bir stok eşleştirmesi yapın.'); return; }

    setSaving(true); setErr('');
    try {
      for (const m of toProcess) {
        const qty   = Number(m.qtyOverride || 1);
        const price = Number(m.priceVal || 0);
        const note  = `Fatura ${inv.invoice_id || ''} — ${inv.cari_name || ''}`;

        // 1. Stok artır (gelen fatura = tedarikçiden alım = giriş)
        const isInbox = inv.type === 'inbox';
        if (isInbox) {
          // Gelen fatura: stoğa giriş
          const res = await supabase.rpc('increment_stock', {
            p_item_id:   m.stockItemId,
            p_qty:       qty,
            p_source:    'invoice',
            p_source_id: inv.id || null,
            p_note:      note,
          });
          // RPC yoksa fallback
          if (res.error) {
            const { data: itm } = await supabase.from('items').select('stock_count').eq('id', m.stockItemId).single();
            await supabase.from('items').update({ stock_count: (itm?.stock_count || 0) + qty }).eq('id', m.stockItemId);
          }
        } else {
          // Giden fatura: yazdık ama stok işlemi kullanıcıya bağlı — burada sadece fiyat kaydı
          // (stok düşümü sipariş tamamlanınca yapılır)
        }

        // 2. Fiyat güncelle (alış fiyatı — gelen fatura için)
        if (m.updatePrice && price > 0) {
          const priceRes = await supabase.rpc('update_item_price', {
            p_item_id:        m.stockItemId,
            p_purchase_price: isInbox ? price : null,
            p_sale_price:     isInbox ? null  : price,
            p_currency:       m.currencyVal || 'TRY',
            p_source:         'invoice',
            p_source_ref:     inv.invoice_id || null,
            p_note:           note,
          });
          // Fallback direkt güncelle
          if (priceRes.error) {
            const upd = {};
            if (isInbox) { upd.purchase_price = price; upd.base_currency = m.currencyVal || 'TRY'; }
            else { upd.sale_price = price; upd.sale_currency = m.currencyVal || 'TRY'; }
            await supabase.from('items').update(upd).eq('id', m.stockItemId);
          }
        }
      }

      // 3. Faturayı stoğa işlendi olarak işaretle
      await supabase.from('invoices').update({
        is_stock_islendi: true,
        stock_islendi_at: new Date().toISOString(),
      }).eq('invoice_id', inv.invoice_id);

      setDone(true);
      setTimeout(() => onDone(inv.invoice_id), 1000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isInbox = inv.type === 'inbox';
  const currency = inv.currency || 'TRY';

  if (done) {
    return (
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="relative rounded-2xl p-8 text-center"
        style={{ background: isDark ? '#0d1b2e' : '#ffffff', border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#e2e8f0'}` }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(16,185,129,0.15)' }}>
            <Check size={28} className="text-emerald-400"/>
          </div>
          <p className="text-sm font-bold text-emerald-400">Stok başarıyla güncellendi!</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        style={{ background: isDark ? '#0b1729' : '#ffffff', border: `1px solid ${currentColor}35`, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)', background: `${currentColor}08` }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
              {isInbox ? 'Gelen Fatura' : 'Giden Fatura'} → Stoğa İşle
            </p>
            <h3 className="text-sm font-bold mt-0.5 break-words whitespace-normal pr-4" style={{ color: isDark ? '#ffffff' : '#1e293b' }}>{inv.cari_name || inv.invoice_id}</h3>
            <p className="text-xs text-slate-500">{fmt(inv.amount)} {currency} · {inv.issue_date?.slice(0,10)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <X size={15} className="text-slate-500"/>
          </button>
        </div>

        {/* Bilgi bandı */}
        <div className="px-5 py-2.5 flex-shrink-0 flex items-start gap-2"
          style={{ background: isInbox ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
                   borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: isInbox ? '#f59e0b' : '#10b981' }}/>
          <p className="text-[11px]" style={{ color: isInbox ? '#fbbf24' : '#34d399' }}>
            {isInbox
              ? 'Gelen fatura: eşleştirilen kalemlerin stok sayısı artacak ve alış fiyatı güncellenebilecek.'
              : 'Giden fatura: stok değişikliği yapılmaz (sipariş tamamlanınca düşülür). Sadece fiyat güncellemesi mümkün.'}
          </p>
        </div>

        {/* Başlık satırı */}
        <div className="px-5 py-1.5 flex-shrink-0 grid text-[10px] font-bold uppercase tracking-wider text-slate-600"
          style={{ gridTemplateColumns: '1fr 16px 1fr 80px 80px 28px', gap: 8,
                   borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
          <span>Fatura Kalemi</span>
          <span/>
          <span>Stok Karşılığı</span>
          <span className="text-center">Miktar</span>
          <span className="text-center">{isInbox ? 'Alış Fiyatı' : 'Satış Fiyatı'}</span>
          <span/>
        </div>

        {/* Satırlar */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'rgba(148,163,184,0.07)' }}>
          {mappings.map((m, idx) => {
            const selItem = selectedItem(idx);
            const results = searchResults(idx);
            return (
              <div key={idx} className="px-5 py-3 space-y-2">
                <div className="grid items-center gap-2"
                  style={{ gridTemplateColumns: '1fr 16px 1fr 80px 80px 28px' }}>

                  {/* Fatura kalemi */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{m.invoiceLine.name}</p>
                    <p className="text-[10px] text-slate-600">
                      {fmt(m.invoiceLine.quantity)} {m.invoiceLine.unit} · {fmt(m.invoiceLine.unit_price)} {currency}
                    </p>
                  </div>

                  <ArrowRight size={12} className="text-slate-700 flex-shrink-0"/>

                  {/* Stok eşleştirme */}
                  <div className="relative">
                    <button ref={el => { btnRefs.current[idx] = el; }}
                      onClick={(e) => {
                        if (openRow === idx) {
                          setOpenRow(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 288) });
                          setOpenRow(idx);
                        }
                      }}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all"
                      style={{
                        background: selItem ? `${currentColor}15` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selItem ? currentColor + '40' : 'rgba(148,163,184,0.12)'}`,
                        color: selItem ? '#e2e8f0' : '#475569',
                      }}>
                      <Package size={10} style={{ color: selItem ? currentColor : '#475569', flexShrink: 0 }}/>
                      <span className="truncate flex-1">
                        {selItem ? selItem.name : 'Seç...'}
                      </span>
                    </button>

                    {/* Dropdown via Portal */}
                    {openRow === idx && typeof document !== 'undefined' && createPortal(
                      <div
                        className="rounded-xl overflow-hidden shadow-2xl"
                        style={{
                          position: 'fixed',
                          top: dropPos.top,
                          left: dropPos.left,
                          width: dropPos.width,
                          zIndex: 99999,
                          background: isDark ? '#0f1e36' : '#ffffff',
                          border: `1px solid ${currentColor}40`,
                        }}>
                        <div className="flex items-center gap-2 px-3 py-2"
                          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                          <Search size={11} className="text-slate-500"/>
                          <input autoFocus value={searches[idx] || ''}
                            onChange={e => setSearches(prev => prev.map((s, i) => i === idx ? e.target.value : s))}
                            placeholder="Stokta ara..."
                            className="flex-1 bg-transparent outline-none text-xs"
                            style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}/>
                        </div>
                        {/* Eşleştirme yok seçeneği */}
                        <button onClick={() => {
                          updateMapping(idx, 'stockItemId', null);
                          setOpenRow(null);
                        }} className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-white/5 transition-colors">
                          — Bu kalemi işleme alma —
                        </button>
                        <div className="max-h-48 overflow-y-auto">
                          {results.map(item => (
                            <button key={item.id}
                              onClick={() => {
                                const stP = isInbox ? (item.purchase_price || 0) : (item.sale_price || 0);
                                const stC = isInbox ? (item.base_currency || 'TRY') : (item.sale_currency || 'TRY');
                                setMappings(prev => prev.map((mapping, i) => {
                                  if (i !== idx) return mapping;
                                  return {
                                    ...mapping,
                                    stockItemId: item.id,
                                    stockPrice: String(stP),
                                    stockCurrency: stC,
                                    priceVal: mapping.updatePrice ? String(mapping.invoiceLine.unit_price || '') : String(stP || ''),
                                    currencyVal: mapping.updatePrice ? (inv.currency || 'TRY') : stC
                                  };
                                }));
                                setOpenRow(null);
                              }}
                              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-white/5">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{item.name}</p>
                                <p className="text-[10px] text-slate-600">
                                  {item.unit} · Stok: {item.stock_count ?? '—'}
                                </p>
                              </div>
                              <span className="text-[10px] text-emerald-500 flex-shrink-0">
                                {isInbox ? (item.purchase_price ? `₺${fmt(item.purchase_price)}` : '') : (item.sale_price ? `₺${fmt(item.sale_price)}` : '')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>

                  {/* Miktar */}
                  <input type="number" min="0" step="0.001" value={m.qtyOverride}
                    onChange={e => updateMapping(idx, 'qtyOverride', e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs text-right font-bold outline-none bg-transparent"
                    style={{ color: isDark ? '#e2e8f0' : '#1e293b', border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}` }}/>

                  {/* Fiyat */}
                  <div className="flex border rounded-lg overflow-hidden transition-all" style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
                    <input type="number" min="0" step="0.01" value={m.priceVal}
                      disabled={!m.updatePrice}
                      onChange={e => updateMapping(idx, 'priceVal', e.target.value)}
                      placeholder="Fiyat"
                      className="w-full px-2 py-1.5 text-xs text-right font-bold text-emerald-400 outline-none bg-transparent" />
                    <select
                      disabled={!m.updatePrice}
                      value={m.currencyVal} onChange={e => updateMapping(idx, 'currencyVal', e.target.value)}
                      className="bg-transparent border-l outline-none text-[10px] text-slate-500 font-bold px-1"
                      style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
                      <option value="TRY">₺</option>
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                    </select>
                  </div>

                  {/* Fiyat güncelle toggle */}
                  <button onClick={() => {
                      const nextUpdate = !m.updatePrice;
                      setMappings(prev => prev.map((mapping, i) => {
                        if (i !== idx) return mapping;
                        return {
                          ...mapping,
                          updatePrice: nextUpdate,
                          priceVal: nextUpdate ? String(mapping.invoiceLine.unit_price || '') : String(mapping.stockPrice || ''),
                          currencyVal: nextUpdate ? (inv.currency || 'TRY') : (mapping.stockCurrency || 'TRY')
                        };
                      }));
                    }}
                    title="Faturadaki fiyat ile güncelle"
                    className="w-6 h-6 rounded-md flex items-center justify-center transition-all flex-shrink-0 cursor-pointer"
                    style={{
                      background: m.updatePrice ? `${currentColor}20` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${m.updatePrice ? currentColor + '50' : 'rgba(148,163,184,0.1)'}`,
                    }}>
                    <Edit2 size={10} style={{ color: m.updatePrice ? currentColor : '#475569' }}/>
                  </button>
                </div>

                {/* Fiyat güncelle bilgisi ve Stok Mevcut Fiyatı */}
                {selItem && (
                  <div className="flex flex-col gap-1 pl-1 mt-1">
                    <p className="text-[10px] text-slate-400 font-medium">
                      Stoktaki Halihazır Mevcut Fiyatı: <strong className="text-emerald-500/80">{fmt(m.stockPrice)} {m.stockCurrency}</strong>
                    </p>
                    {m.updatePrice && (
                      <p className="text-[10px] text-slate-500">
                        💡 {selItem.name} için {isInbox ? 'alış' : 'satış'} fiyatı <strong className="text-emerald-400">{m.priceVal || '—'} {m.currencyVal}</strong> olarak faturadaki değer baz alınarak güncellenecek
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Kaç kalemi eşleştirdi */}
        {err && (
          <div className="px-5 py-2 flex-shrink-0">
            <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11}/>{err}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0'}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
          <div className="text-xs text-slate-500">
            {mappings.filter(m => m.stockItemId).length} / {mappings.length} kalem eşleştirildi
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
              İptal
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: currentColor, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
              {saving ? 'Kaydediliyor...' : 'Stoğa İşle'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
