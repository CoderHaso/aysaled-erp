import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Image as ImageIcon, Printer, Save, X, Package,
  Eye, ArrowLeft, Upload, UserPlus, Loader2, Check
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = (n, d = 2) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const today   = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '';

function emptyLine() {
  return {
    id: Math.random().toString(36).slice(2),
    image_url: '', item_code: '', power_w: '', name: '',
    description: '', quantity: 1, unit: 'Adet', unit_price: 0, total: 0,
  };
}

// ── Ürün satırı ────────────────────────────────────────────────────────────────
function QuoteLine({ line, idx, allItems, onUpdate, onDelete, onAddImage, rowHeight = 58, imgWidth = 68 }) {
  const [showSugg, setShowSugg] = useState(false);
  const [q, setQ]               = useState(line.name || '');

  // allItems değişince q'yu başlatma (edit modunda)
  useEffect(() => { setQ(line.name || ''); }, []);

  const suggestions = q.trim().length >= 1
    ? allItems.filter(i =>
        (i.name || '').toLowerCase().includes(q.toLowerCase()) ||
        (i.item_code || '').toLowerCase().includes(q.toLowerCase())
      ).slice(0, 10)
    : [];

  const selectItem = (item) => {
    const total = Number(item.sale_price || item.purchase_price || 0) * Number(line.quantity || 1);
    onUpdate(line.id, {
      item_code: item.item_code || '',
      name:     item.name || '',
      description: item.description || '',
      unit_price: item.sale_price || item.purchase_price || 0,
      unit:     item.unit || 'Adet',
      image_url: item.image_url || '',
      power_w:  item.power_w || '',
      total,
    });
    setQ(item.name || '');
    setShowSugg(false);
  };

  const upd = (field, val) => {
    const updated = { ...line, [field]: val };
    if (field === 'quantity' || field === 'unit_price') {
      updated.total = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0);
    }
    if (field === 'name') setQ(val);
    onUpdate(line.id, updated);
  };

  const cell  = 'border border-gray-300 px-1.5 py-1 text-xs align-middle';
  const inp   = 'w-full bg-transparent outline-none text-xs text-gray-800';

  return (
    <tr className="hover:bg-gray-50 group relative" style={{ height: rowHeight }}>
      {/* No */}
      <td className={cell} style={{ textAlign: 'center', color: '#9ca3af', fontWeight: 500, overflow: 'hidden' }}>{idx + 1}</td>

      {/* Görsel */}
      <td className={cell} style={{ padding: 2, overflow: 'hidden' }}>
        <div onClick={() => onAddImage(line.id)}
          style={{ width: Math.max(24, imgWidth - 8), height: Math.max(24, rowHeight - 8) }}
          className="mx-auto flex items-center justify-center rounded-lg overflow-hidden cursor-pointer border-2 border-dashed border-gray-300 hover:border-green-500 transition-colors">
          {line.image_url
            ? <img src={line.image_url} alt="" className="w-full h-full object-cover" />
            : <ImageIcon size={14} className="text-gray-400" />}
        </div>
      </td>

      {/* Ürün Kodu */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <input value={line.item_code} onChange={e => upd('item_code', e.target.value)} className={inp} placeholder="KOD" />
      </td>

      {/* Güç */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <input value={line.power_w} onChange={e => upd('power_w', e.target.value)} className={inp} placeholder="W" />
      </td>

      {/* Ürün Adı — arama dropdown */}
      <td className={cell} style={{ overflow: 'visible' }}>
        <input
          value={q}
          onChange={e => { upd('name', e.target.value); setShowSugg(true); }}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          className={inp}
          placeholder="Ürün yaz veya seç..."
        />
        {showSugg && suggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-0.5 z-[200] w-72 shadow-2xl rounded-xl overflow-hidden border border-gray-200 bg-white">
            {suggestions.map(s => (
              <div key={s.id} onMouseDown={() => selectItem(s)}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                {s.image_url
                  ? <img src={s.image_url} alt="" className="w-9 h-9 object-cover rounded-lg flex-shrink-0" />
                  : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-gray-400" />
                    </div>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.item_code}{s.power_w ? ` · ${s.power_w}W` : ''}</p>
                </div>
                <span className="text-[10px] text-green-700 font-semibold whitespace-nowrap">
                  {fmt(s.sale_price || s.purchase_price)} ₺
                </span>
              </div>
            ))}
          </div>
        )}
      </td>

      {/* Açıklama */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <input value={line.description} onChange={e => upd('description', e.target.value)} className={inp} placeholder="Açıklama" />
      </td>

      {/* Miktar */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <input type="number" value={line.quantity} min={1}
          onChange={e => upd('quantity', e.target.value)} className={`${inp} text-center`} />
      </td>

      {/* BR */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <select value={line.unit} onChange={e => upd('unit', e.target.value)} className={`${inp} cursor-pointer`}>
          {['Adet','Mt','Kg','M²','Rulo','Paket','Set'].map(u => <option key={u}>{u}</option>)}
        </select>
      </td>

      {/* Birim Fiyat */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <input type="number" value={line.unit_price} min={0} step="0.01"
          onChange={e => upd('unit_price', e.target.value)} className={`${inp} text-right`} />
      </td>

      {/* Toplam */}
      <td className={cell} style={{ textAlign: 'right', fontWeight: 600, color: '#374151', overflow: 'hidden' }}>
        {fmt(line.total)}
      </td>

      {/* Sil */}
      <td style={{ textAlign: 'center', borderRight: 'none', width: 28, padding: '2px 4px', borderBottom: '1px solid #d1d5db' }}>
        <button onClick={() => onDelete(line.id)}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
          <X size={13} />
        </button>
      </td>
    </tr>
  );
}

// ── Teklif Önizleme (A4 Dikey) ────────────────────────────────────────────
export function QuotePreview({ quote, onClose, colWidths = {}, rowHeight = 58 }) {
  const lines      = quote.line_items || [];
  const subtotal   = lines.reduce((s, l) => s + Number(l.total || 0), 0);
  const vatAmt     = quote.vat_rate ? subtotal * Number(quote.vat_rate) / 100 : 0;
  const grandTotal = subtotal + vatAmt;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="bg-white w-full max-w-4xl max-h-[97vh] overflow-auto rounded-2xl shadow-2xl">

        {/* Araç çubuğu */}
        <div className="no-print flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
          <p className="font-bold text-gray-700">Teklif Önizleme · {quote.quote_no}</p>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800">
              <Printer size={15} /> Yazdır / PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200"><X size={18} /></button>
          </div>
        </div>

        {/* A4 içerik — 210mm genislik baz, dikey */}
        <div id="quote-print" style={{
          fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          fontSize: 11,
          color: '#1a1a1a',
          padding: '12mm 14mm',
          minWidth: 680,
          maxWidth: 794,  /* 210mm @ 96dpi ≈8.27in × 96 ≈ 794px */
          margin: '0 auto',
          boxSizing: 'border-box',
        }}>

          {/* ── Logo — ortalanmış, tam genişlik ── */}
          <div style={{ borderBottom: '2px solid #1a6b2c', marginBottom: 8, paddingBottom: 6, textAlign: 'center' }}>
            <img src="/firmalogo.jpg" alt="AYSALED"
              style={{ height: 56, objectFit: 'contain', display: 'inline-block' }}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>

          {/* ── Müşteri + Teklif bilgileri (eşit genislikte, aynı hızada) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {/* Sol: Müşteri */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: '#1a6b2c', color: '#fff', padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>MÜŞTERİ BİLGİLERİ</div>
              {[
                ['Firma Adı',   quote.company_name],
                ['Adres',       quote.address],
                ['Telefon',     quote.phone],
                ['İlgili Kişi', quote.contact_person],
                ['E-Posta',     quote.email],
              ].map(([k, v], idx, arr) => (
                <div key={k} style={{ display: 'flex', borderBottom: idx < arr.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <span style={{ width: 90, padding: '4px 8px', background: '#f9fafb', fontSize: 10, fontWeight: 600, color: '#4b5563', flexShrink: 0, borderRight: '1px solid #e5e7eb' }}>{k}</span>
                  <span style={{ padding: '4px 8px', fontSize: 10, color: '#111827', flex: 1 }}>{v || '-'}</span>
                </div>
              ))}
            </div>

            {/* Sağ: Teklif meta */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: '#1a6b2c', color: '#fff', padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>TEKLİF BİLGİLERİ</div>
              {[
                ['Teklif No',         quote.quote_no || '-'],
                ['Proje Adı',         quote.project_name || '-'],
                ['Düzenleme Tarihi',   fmtDate(quote.issue_date)],
                ['Geçerlilik Tarihi',  fmtDate(quote.valid_until)],
                ['Düzenleyen',         quote.prepared_by || 'Merkez'],
              ].map(([k, v], idx, arr) => (
                <div key={k} style={{ display: 'flex', borderBottom: idx < arr.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <span style={{ width: 130, padding: '4px 8px', background: '#f9fafb', fontSize: 10, fontWeight: 600, color: '#4b5563', flexShrink: 0, borderRight: '1px solid #e5e7eb' }}>{k}</span>
                  <span style={{ padding: '4px 8px', fontSize: 10, color: '#111827', flex: 1 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Kalem Tablosu ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, tableLayout: 'fixed' }}>
            <colgroup>
              {(() => {
                const w_img   = colWidths.img   || 68;
                const w_code  = colWidths.code  || 78;
                const w_power = colWidths.power || 46;
                const w_name  = colWidths.name  || 160;
                const w_desc  = colWidths.desc  || 120;
                const w_qty   = colWidths.qty   || 52;
                const w_unit  = colWidths.unit  || 52;
                const w_price = colWidths.price || 80;
                const w_total = colWidths.total || 80;
                const totalW  = 22 + w_img + w_code + w_power + w_name + w_desc + w_qty + w_unit + w_price + w_total;
                const pc = (w) => `${((w / totalW) * 100).toFixed(2)}%`;
                
                return (
                  <>
                    <col style={{ width: pc(22) }} />
                    <col style={{ width: pc(w_img) }} />
                    <col style={{ width: pc(w_code) }} />
                    <col style={{ width: pc(w_power) }} />
                    <col style={{ width: pc(w_name) }} />
                    <col style={{ width: pc(w_desc) }} />
                    <col style={{ width: pc(w_qty) }} />
                    <col style={{ width: pc(w_unit) }} />
                    <col style={{ width: pc(w_price) }} />
                    <col style={{ width: pc(w_total) }} />
                  </>
                );
              })()}
            </colgroup>
            <thead>
              <tr style={{ background: '#1a6b2c', color: '#fff' }}>
                {['No','Görsel','Ürün Kodu','Güç (W)','Ürün Adı','Açıklama','Miktar','BR','Birim Fiyat','Toplam'].map(h => (
                  <th key={h} style={{ border: '1px solid #146025', padding: '4px 4px', fontSize: 10, fontWeight: 700, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, i) => (
                <tr key={ln.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', height: rowHeight }}>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', textAlign: 'center', fontSize: 10, color: '#6b7280', verticalAlign: 'middle' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: 2, textAlign: 'center', verticalAlign: 'middle' }}>
                    {ln.image_url
                      ? <img src={ln.image_url} alt="" style={{ width: (colWidths.img || 54) - 8, height: rowHeight - 6, objectFit: 'cover', borderRadius: 4, display: 'block', margin: 'auto' }} />
                      : <div style={{ width: (colWidths.img || 54) - 8, height: rowHeight - 6, background: '#f3f4f6', borderRadius: 4, margin: 'auto' }} />}
                  </td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, verticalAlign: 'middle' }}>{ln.item_code}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, textAlign: 'center', verticalAlign: 'middle' }}>{ln.power_w}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, fontWeight: 600, verticalAlign: 'middle', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{ln.name}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, color: '#4b5563', verticalAlign: 'middle' }}>{ln.description}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, textAlign: 'center', verticalAlign: 'middle' }}>{ln.quantity}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, textAlign: 'center', verticalAlign: 'middle' }}>{ln.unit}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, textAlign: 'right', verticalAlign: 'middle' }}>{fmt(ln.unit_price)}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: 10, textAlign: 'right', fontWeight: 700, verticalAlign: 'middle' }}>{fmt(ln.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Açıklamalar + Toplamlar ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Açıklamalar</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', minHeight: 64, fontSize: 10, color: '#374151', whiteSpace: 'pre-wrap' }}>
                {quote.notes || ''}
              </div>
            </div>
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '4px 8px', background: '#f9fafb', fontSize: 10, color: '#4b5563' }}>Toplam</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, fontWeight: 600 }}>{fmt(subtotal)} ₺</td>
                  </tr>
                  {quote.vat_rate && (
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '4px 8px', background: '#f9fafb', fontSize: 10, color: '#4b5563' }}>KDV %{quote.vat_rate}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10 }}>{fmt(vatAmt)} ₺</td>
                    </tr>
                  )}
                  <tr style={{ background: '#1a6b2c' }}>
                    <td style={{ padding: '5px 8px', color: '#fff', fontSize: 11, fontWeight: 700 }}>Genel Toplam</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fff', fontSize: 12, fontWeight: 700 }}>{fmt(grandTotal)} ₺</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── İmza ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 12 }}>
            {['Üretici Firma', 'Müşteri'].map(lbl => (
              <div key={lbl} style={{ borderTop: '2px solid #d1d5db', paddingTop: 8 }}>
                <p style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{lbl} Kaşe / İmza</p>
                <div style={{ height: 52 }} />
                <div style={{ height: 10 }} />
              </div>
            ))}
          </div>

          {/* ── Alt: sertifika + Türkiye görseli ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
            <img src="/tsecevs.jpg" alt="TSE CE ENEC RoHS"
              style={{ height: 32, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; }} />
            <img src="/turkiyegucunu.svg" alt="Türkiye’nin Gücu"
              style={{ height: 32, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          body > * { visibility: hidden; }
          #quote-print, #quote-print * { visibility: visible; }
          #quote-print {
            position: fixed; inset: 0;
            padding: 12mm 14mm;
            max-width: none;
            margin: 0;
            font-size: 10pt;
          }
        }
      `}</style>
    </div>
  );
}

// ── Ana Form ──────────────────────────────────────────────────────────────────
export default function QuoteForm({ quoteId, onBack, onSaved }) {
  const { currentColor } = useTheme();

  const [allItems,   setAllItems]   = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [previewQuoteNo, setPreviewQuoteNo] = useState('');
  const [form, setForm] = useState({
    quote_no: '', status: 'draft', project_name: '',
    company_name: '', address: '', phone: '', contact_person: '', email: '',
    issue_date: today(), valid_until: addDays(today(), 9),
    prepared_by: 'Merkez', notes: '', currency: 'TRY', vat_rate: '',
    line_items: [emptyLine()],
  });
  const [saving, setSaving]     = useState(false);
  const [preview, setPreview]   = useState(false);
  const [imageModal, setImageModal] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgUploadRef = useRef();

  // Sütun/satır ayarları — localStorage'dan yüklenir, sürükleyerek ayarlanır
  const SAVED_LAYOUT_KEY = 'quoteTableLayout';
  const DEFAULT_COL_WIDTHS = { no: 32, img: 68, code: 78, power: 46, name: 160, desc: 120, qty: 52, unit: 52, price: 80, total: 80 };
  const savedLayout = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_LAYOUT_KEY) || '{}');
      // Tüm anahtarların sayı olduğunu doğrula, yoksa default'a dön
      const cw = raw.colWidths || {};
      const valid = Object.keys(DEFAULT_COL_WIDTHS).every(k => typeof cw[k] === 'number' && cw[k] > 0);
      if (!valid) return {};
      return raw;
    } catch { return {}; }
  })();
  const [rowHeight, setRowHeight] = useState(typeof savedLayout.rowHeight === 'number' ? savedLayout.rowHeight : 58);
  const [colWidths, setColWidths] = useState(savedLayout.colWidths || DEFAULT_COL_WIDTHS);
  const resizingCol = useRef(null);
  const resizingRow = useRef(null);

  // resize olunca localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem(SAVED_LAYOUT_KEY, JSON.stringify({ rowHeight, colWidths }));
  }, [rowHeight, colWidths]);


  // Mouse resize handlers — ref değerlerini capture ederek null race condition önle
  useEffect(() => {
    const onMove = (e) => {
      const col = resizingCol.current;  // snapshot al
      if (col) {
        const dx = e.clientX - col.startX;
        setColWidths(p => ({ ...p, [col.key]: Math.max(20, col.startW + dx) }));
      }
      const row = resizingRow.current;  // snapshot al
      if (row) {
        const dy = e.clientY - row.startY;
        setRowHeight(Math.max(28, row.startH + dy));
      }
    };
    const onUp = () => { resizingCol.current = null; resizingRow.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startColResize = (key, e) => {
    e.preventDefault();
    resizingCol.current = { key, startX: e.clientX, startW: colWidths[key] };
  };
  const startRowResize = (e) => {
    e.preventDefault();
    resizingRow.current = { startY: e.clientY, startH: rowHeight };
  };

  // Firma adı autocomplete
  const [custQ, setCustQ]           = useState('');
  const [showCustSugg, setShowCustSugg] = useState(false);
  const custExists = allCustomers.some(c =>
    (c.name || '').toLowerCase() === (custQ || '').toLowerCase()
  );
  const custSuggestions = custQ.length >= 1
    ? allCustomers.filter(c => (c.name || '').toLowerCase().includes(custQ.toLowerCase())).slice(0, 8)
    : [];

  // ── Veri yükle ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('items').select('*').order('name').then(({ data }) => setAllItems(data || []));
    supabase.from('customers').select('id,name,vkntckn,phone,email,address').order('name').then(({ data }) => setAllCustomers(data || []));
  }, []);

  // Yeni formda teklif no önizlemesi için son numarayı çek
  useEffect(() => {
    if (quoteId) return;
    const year = new Date().getFullYear();
    supabase.from('quotes').select('quote_no').ilike('quote_no', `TKL-${year}-%`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        let seq = 1;
        if (data?.quote_no) {
          const parts = data.quote_no.split('-');
          seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
        }
        const no = `TKL-${year}-${String(seq).padStart(3, '0')}`;
        setPreviewQuoteNo(no);
        setForm(f => f.quote_no ? f : { ...f, quote_no: no });
      });
  }, [quoteId]);

  // Mevcut teklif yükle (edit modu)
  useEffect(() => {
    if (!quoteId) return;
    supabase.from('quotes').select('*').eq('id', quoteId).single().then(({ data }) => {
      if (data) {
        setForm({ ...data, line_items: data.line_items?.length ? data.line_items : [emptyLine()] });
        setCustQ(data.company_name || '');
      }
    });
  }, [quoteId]);

  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Müşteri seç → formu doldur
  const selectCustomer = (c) => {
    setF('company_name', c.name);
    setF('phone',        c.phone  || '');
    setF('email',        c.email  || '');
    setF('address',      c.address || '');
    setCustQ(c.name);
    setShowCustSugg(false);
  };

  // Yeni müşteri kaydet
  const saveNewCustomer = async () => {
    if (!custQ.trim()) return;
    const { data, error } = await supabase.from('customers').insert({
      name: custQ.trim(), phone: form.phone, email: form.email,
      address: form.address, source: 'manual',
    }).select().single();
    if (!error && data) {
      setAllCustomers(p => [data, ...p]);
      setShowCustSugg(false);
    }
  };

  // Satır güncelle/sil/ekle
  const updateLine = (id, patch) => setForm(f => ({
    ...f, line_items: f.line_items.map(l => l.id === id ? { ...l, ...patch } : l),
  }));
  const deleteLine = (id) => setForm(f => ({ ...f, line_items: f.line_items.filter(l => l.id !== id) }));
  const addLine    = ()   => setForm(f => ({ ...f, line_items: [...f.line_items, emptyLine()] }));

  // Hesapla
  const lines      = form.line_items || [];
  const subtotal   = lines.reduce((s, l) => s + Number(l.total || 0), 0);
  const vatRate    = Number(form.vat_rate) || 0;
  const vatAmt     = vatRate ? subtotal * vatRate / 100 : 0;
  const grandTotal = subtotal + vatAmt;

  // Görsel modal
  const openImageModal = async (lineId) => {
    setImageModal(lineId);
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    setMediaItems(data || []);
  };
  const selectMedia = (url, lineId) => {
    updateLine(lineId, { image_url: url });
    setImageModal(null);
  };

  // Görsel modal içinde direkt yükleme (base64 → API → B2)
  const uploadImageDirect = async (file) => {
    if (!file || !imageModal) return;
    setUploadingImg(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileData: base64,
          name: file.name.replace(/\.[^.]+$/, ''),
        }),
      });
      const { publicUrl, error } = await r.json();
      if (error) throw new Error(error);
      // Görseli satıra ata ve modalı kapat
      updateLine(imageModal, { image_url: publicUrl });
      setImageModal(null);
      const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
      setMediaItems(data || []);
    } catch (e) {
      alert('Yükleme hatası: ' + e.message);
    } finally { setUploadingImg(false); }
  };

  // Kaydet
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, subtotal, vat_amount: vatAmt, grand_total: grandTotal };
      const url    = quoteId ? `/api/quotes?id=${quoteId}` : '/api/quotes';
      const method = quoteId ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!data.success) throw new Error(data.error);
      onSaved?.(data.quote);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const fieldCls = 'w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-800 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500';
  const labelCls = 'text-xs text-gray-500 font-medium mb-1 block';

  // Önizleme için kullanılacak teklif no: form'da varsa onu, yoksa previewQuoteNo
  const displayQuoteNo = form.quote_no || previewQuoteNo;

  return (
    <div className="bg-white text-gray-800 min-h-screen">
      {/* ── Araç Çubuğu ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
          <div>
            <p className="font-bold text-gray-800 text-sm">{displayQuoteNo || 'Yeni Teklif'}</p>
            <p className="text-[10px] text-gray-400">Teklif Formu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={form.status} onChange={e => setF('status', e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
            {[['draft','Taslak'],['sent','Gönderildi'],['accepted','Kabul Edildi'],['rejected','Reddedildi'],['expired','Süresi Doldu']].map(([v, l]) =>
              <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => setPreview(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 hover:bg-gray-50">
            <Eye size={15} /> Önizle
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#1a6b2c' }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Kaydediliyor</> : <><Save size={15} /> Kaydet</>}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* ── Bilgi Satırı ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Sol: Müşteri Bilgileri */}
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-sm inline-block" style={{ background: '#1a6b2c' }} />
              Müşteri Bilgileri
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Firma Adı — cari autocomplete */}
              <div className="col-span-2 relative">
                <label className={labelCls}>Firma Adı</label>
                <input
                  value={custQ}
                  onChange={e => { setCustQ(e.target.value); setF('company_name', e.target.value); setShowCustSugg(true); }}
                  onFocus={() => setShowCustSugg(true)}
                  onBlur={() => setTimeout(() => setShowCustSugg(false), 150)}
                  className={fieldCls}
                  placeholder="Firma adı yaz veya cari seç..."
                />
                {showCustSugg && (
                  <div className="absolute left-0 top-full mt-0.5 z-[300] w-full shadow-2xl rounded-xl overflow-hidden border border-gray-200 bg-white">
                    {custSuggestions.map(c => (
                      <div key={c.id} onMouseDown={() => selectCustomer(c)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-green-700">{(c.name || 'X')[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone || c.vkntckn || ''}</p>
                        </div>
                      </div>
                    ))}
                    {/* Yeni müşteri kaydet */}
                    {custQ.trim() && !custExists && (
                      <div onMouseDown={saveNewCustomer}
                        className="flex items-center gap-3 px-4 py-3 bg-green-50 hover:bg-green-100 cursor-pointer">
                        <UserPlus size={16} className="text-green-700" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">"{custQ.trim()}" müşterisini kaydet</p>
                          <p className="text-xs text-green-600">Cariler listesine eklenecek</p>
                        </div>
                      </div>
                    )}
                    {custQ.trim() && custExists && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400">
                        <Check size={12} className="text-green-500" /> Kayıtlı müşteri
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Diğer alanlar */}
              <div className="col-span-2">
                <label className={labelCls}>Adres</label>
                <input value={form.address || ''} onChange={e => setF('address', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Telefon</label>
                <input value={form.phone || ''} onChange={e => setF('phone', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>İlgili Kişi</label>
                <input value={form.contact_person || ''} onChange={e => setF('contact_person', e.target.value)} className={fieldCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>E-Posta</label>
                <input type="email" value={form.email || ''} onChange={e => setF('email', e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Sağ: Teklif Meta */}
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-sm inline-block" style={{ background: '#1a6b2c' }} />
              Teklif Bilgileri
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teklif No</label>
                <input value={form.quote_no || ''} onChange={e => setF('quote_no', e.target.value)}
                  placeholder={previewQuoteNo || 'Otomatik'} className={fieldCls} />
                {!form.quote_no && previewQuoteNo && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Kaydedince: {previewQuoteNo}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Para Birimi</label>
                <select value={form.currency} onChange={e => setF('currency', e.target.value)} className={fieldCls}>
                  {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Düzenleme Tarihi</label>
                <input type="date" value={form.issue_date} onChange={e => setF('issue_date', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Geçerlilik Tarihi</label>
                <input type="date" value={form.valid_until} onChange={e => setF('valid_until', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Düzenleyen Kişi</label>
                <input value={form.prepared_by || ''} onChange={e => setF('prepared_by', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>KDV Oranı (%)</label>
                <input type="number" value={form.vat_rate || ''} onChange={e => setF('vat_rate', e.target.value)}
                  placeholder="Opsiyonel" min={0} max={100} className={fieldCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Proje Adı</label>
                <input value={form.project_name || ''} onChange={e => setF('project_name', e.target.value)}
                  placeholder="Opsiyonel" className={fieldCls} />
              </div>
            </div>
          </div>
        </div>


        {/* ── Kalem Tablosu — Excel-like resize ── */}
        <div className="rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between" style={{ background: '#f0faf3' }}>
            <p className="font-semibold text-gray-700 text-sm">Ürün Kalemleri <span className="text-xs text-gray-400 font-normal ml-1">· sütun başlıklarının sağ kenarından sürükleyerek boyutlandırın</span></p>
            <button onClick={addLine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: '#1a6b2c' }}>
              <Plus size={13} /> Satır Ekle
            </button>
          </div>
          <div className="overflow-x-auto" style={{ userSelect: 'none' }}>
            <table className="border-collapse" style={{
              width: Math.max(Object.values(colWidths).reduce((a, b) => a + b, 28), 600),
              minWidth: '100%',
              tableLayout: 'fixed'
            }}>
              <colgroup>
                <col style={{ width: colWidths.no }} />
                <col style={{ width: colWidths.img }} />
                <col style={{ width: colWidths.code }} />
                <col style={{ width: colWidths.power }} />
                <col style={{ width: colWidths.name }} />
                <col style={{ width: colWidths.desc }} />
                <col style={{ width: colWidths.qty }} />
                <col style={{ width: colWidths.unit }} />
                <col style={{ width: colWidths.price }} />
                <col style={{ width: colWidths.total }} />
                <col style={{ width: 28 }} />{/* sil butonu */}
              </colgroup>
              <thead>
                <tr style={{ background: '#1a6b2c' }}>
                  {[
                    ['no',    'No'],
                    ['img',   'Görsel'],
                    ['code',  'Ürün Kodu'],
                    ['power', 'Güç (W)'],
                    ['name',  'Ürün Adı'],
                    ['desc',  'Açıklama'],
                    ['qty',   'Miktar'],
                    ['unit',  'BR'],
                    ['price', 'Birim Fiyat'],
                    ['total', 'Toplam'],
                  ].map(([key, label]) => (
                    <th key={key} className="text-left text-white text-[11px] font-semibold"
                      style={{ position: 'relative', padding: '8px 6px', whiteSpace: 'nowrap', overflow: 'hidden', borderRight: '1px solid #146025' }}>
                      {/* Satır yükseklik handle'u — sadece ilk (No) sütununda */}
                      {key === 'no' && (
                        <div
                          onMouseDown={startRowResize}
                          title="Satır yüksekliği — aşağı sürükle"
                          style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            height: 4, cursor: 'row-resize',
                            background: 'rgba(255,255,255,0.25)',
                          }}
                        />
                      )}
                      {label}
                      {/* Sütun genişlik handle'u */}
                      <div
                        onMouseDown={(e) => startColResize(key, e)}
                        title="Sütun genişliği — sağa sürükle"
                        style={{
                          position: 'absolute', top: 0, right: 0, bottom: 0,
                          width: 5, cursor: 'col-resize',
                          background: 'rgba(255,255,255,0)',
                        }}
                        className="hover:bg-white/40 transition-colors"
                      />
                    </th>
                  ))}
                  {/* Sil sütunu başlığı — boş */}
                  <th style={{ width: 28, borderRight: 'none' }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <QuoteLine key={line.id} line={line} idx={i} allItems={allItems}
                    onUpdate={updateLine} onDelete={deleteLine} onAddImage={openImageModal}
                    rowHeight={rowHeight} imgWidth={colWidths.img} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2 border-t border-gray-200 bg-gray-50">
            <button onClick={addLine} className="text-xs text-green-700 hover:text-green-900 font-semibold flex items-center gap-1">
              <Plus size={12} /> Yeni satır ekle
            </button>
          </div>
        </div>

        {/* ── Açıklamalar + Özet ── */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 rounded-xl border border-gray-200 p-5">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Açıklamalar</label>
            <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)}
              className={`${fieldCls} resize-none`} rows={5}
              placeholder="Ödeme koşulları, teslimat bilgileri, teknik notlar..." />
          </div>
          <div className="rounded-xl border border-gray-200 p-5 self-start">
            <p className="font-semibold text-gray-700 text-sm mb-4">Özet</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Toplam</span>
                <span className="font-semibold">{fmt(subtotal)} ₺</span>
              </div>
              {vatRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">KDV %{vatRate}</span>
                  <span>{fmt(vatAmt)} ₺</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-bold text-gray-800">Genel Toplam</span>
                <span className="font-bold text-lg" style={{ color: '#1a6b2c' }}>{fmt(grandTotal)} ₺</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Önizleme ── */}
      {preview && (
        <QuotePreview
          quote={{ ...form, quote_no: displayQuoteNo, line_items: lines, subtotal, vat_amount: vatAmt, grand_total: grandTotal }}
          onClose={() => setPreview(false)}
          colWidths={colWidths}
          rowHeight={rowHeight}
        />
      )}

      {/* ── Görsel Seçme Modalı ── */}
      {imageModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <p className="font-bold text-gray-800">Görsel Seç</p>
              <div className="flex items-center gap-2">
                {/* Direkt yükleme */}
                <button
                  onClick={() => imgUploadRef.current?.click()}
                  disabled={uploadingImg}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: '#1a6b2c' }}>
                  {uploadingImg ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Yükle
                </button>
                <input ref={imgUploadRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageDirect(f); e.target.value = ''; }} />
                <button onClick={() => setImageModal(null)}><X size={18} /></button>
              </div>
            </div>

            {/* Arama */}
            <div className="px-4 py-3 border-b border-gray-200">
              <input value={mediaSearch} onChange={e => setMediaSearch(e.target.value)}
                placeholder="Görsel ara..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
              {uploadingImg ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-green-600" />
                  <span className="ml-2 text-gray-500 text-sm">Yükleniyor...</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {mediaItems
                    .filter(m => m.mime_type?.startsWith('image/') && (m.name || '').toLowerCase().includes(mediaSearch.toLowerCase()))
                    .map(m => (
                      <div key={m.id} onClick={() => selectMedia(m.file_url, imageModal)}
                        className="aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-green-500 transition-all group relative">
                        <img src={m.file_url} alt={m.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                          <p className="text-[10px] text-white truncate">{m.name}</p>
                        </div>
                      </div>
                    ))}
                  {/* Boş durum */}
                  {mediaItems.filter(m => m.mime_type?.startsWith('image/')).length === 0 && (
                    <div className="col-span-4 text-center py-12 text-gray-400">
                      <ImageIcon size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Henüz görsel yok</p>
                      <p className="text-xs">Yukarıdaki "Yükle" butonuyla ekleyebilirsiniz</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
