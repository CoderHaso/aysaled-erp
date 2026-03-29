import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Search, ChevronDown, ChevronUp, Image as ImageIcon,
  Printer, Save, X, Check, Package, Eye, ArrowLeft, FileText,
  Download, Send
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n, d = 2) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '';

function emptyLine() {
  return {
    id:          Math.random().toString(36).slice(2),
    image_url:   '',
    item_code:   '',
    power_w:     '',
    name:        '',
    description: '',
    quantity:    1,
    unit:        'Adet',
    unit_price:  0,
    total:       0,
  };
}

// ── Satır bileşeni ─────────────────────────────────────────────────────────────
function QuoteLine({ line, idx, allItems, onUpdate, onDelete, onAddImage }) {
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState('');

  const suggestions = q.length >= 1
    ? allItems.filter(i => i.name?.toLowerCase().includes(q.toLowerCase()) || i.item_code?.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];

  const selectItem = (item) => {
    onUpdate(line.id, {
      item_code:   item.item_code || '',
      name:        item.name || '',
      description: item.description || '',
      unit_price:  item.sale_price || item.purchase_price || 0,
      unit:        item.unit || 'Adet',
      image_url:   item.image_url || '',
      power_w:     item.power_w || '',
      total:       (item.sale_price || 0) * (line.quantity || 1),
    });
    setShowSearch(false);
    setQ('');
  };

  const update = (field, val) => {
    const updated = { ...line, [field]: val };
    if (field === 'quantity' || field === 'unit_price') {
      updated.total = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0);
    }
    onUpdate(line.id, updated);
  };

  const cellCls = "border border-gray-300 px-2 py-1 text-xs";
  const inputCls = "w-full bg-transparent outline-none text-xs";

  return (
    <tr className="hover:bg-gray-50 group">
      <td className={`${cellCls} w-8 text-center text-gray-500`}>{idx + 1}</td>
      {/* Görsel */}
      <td className={`${cellCls} w-16`}>
        <div className="w-12 h-12 mx-auto flex items-center justify-center rounded overflow-hidden cursor-pointer border border-dashed border-gray-300 hover:border-green-500"
          onClick={() => onAddImage(line.id)}>
          {line.image_url
            ? <img src={line.image_url} alt="" className="w-full h-full object-cover" />
            : <ImageIcon size={16} className="text-gray-400" />}
        </div>
      </td>
      {/* Ürün Kodu */}
      <td className={`${cellCls} w-24`}>
        <input value={line.item_code} onChange={e => update('item_code', e.target.value)} className={inputCls} placeholder="KOD" />
      </td>
      {/* Güç */}
      <td className={`${cellCls} w-16`}>
        <input value={line.power_w} onChange={e => update('power_w', e.target.value)} className={inputCls} placeholder="W" />
      </td>
      {/* Ürün Adı */}
      <td className={`${cellCls} min-w-[140px] relative`}>
        <input value={line.name}
          onChange={e => { update('name', e.target.value); setQ(e.target.value); setShowSearch(true); }}
          onFocus={() => setShowSearch(true)}
          onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          className={inputCls} placeholder="Ürün adı yaz veya seç..." />
        {showSearch && suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-50 w-72 shadow-xl rounded-xl overflow-hidden border border-gray-200"
            style={{ background: '#fff' }}>
            {suggestions.map(s => (
              <div key={s.id} onMouseDown={() => selectItem(s)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 cursor-pointer">
                {s.image_url
                  ? <img src={s.image_url} alt="" className="w-8 h-8 object-cover rounded" />
                  : <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center"><Package size={14} className="text-gray-400" /></div>}
                <div>
                  <p className="text-xs font-semibold text-gray-700">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.item_code} {s.power_w ? `· ${s.power_w}W` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </td>
      {/* Açıklama */}
      <td className={`${cellCls} min-w-[120px]`}>
        <input value={line.description} onChange={e => update('description', e.target.value)} className={inputCls} placeholder="Açıklama" />
      </td>
      {/* Miktar */}
      <td className={`${cellCls} w-16`}>
        <input type="number" value={line.quantity} min={1} onChange={e => update('quantity', e.target.value)} className={`${inputCls} text-center`} />
      </td>
      {/* Birim */}
      <td className={`${cellCls} w-16`}>
        <select value={line.unit} onChange={e => update('unit', e.target.value)} className={`${inputCls} cursor-pointer`}>
          {['Adet', 'Mt', 'Kg', 'M²', 'Rulo', 'Paket', 'Set'].map(u => <option key={u}>{u}</option>)}
        </select>
      </td>
      {/* Birim Fiyat */}
      <td className={`${cellCls} w-24`}>
        <input type="number" value={line.unit_price} min={0} step="0.01"
          onChange={e => update('unit_price', e.target.value)} className={`${inputCls} text-right`} />
      </td>
      {/* Toplam */}
      <td className={`${cellCls} w-24 text-right font-semibold text-gray-700`}>
        {fmt(line.total)}
      </td>
      {/* Sil */}
      <td className="w-8 text-center border border-gray-300">
        <button onClick={() => onDelete(line.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity px-1">
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── Baskı / Önizleme bileşeni (A4 uyumlu) ────────────────────────────────────
export function QuotePreview({ quote, onClose }) {
  const handlePrint = () => window.print();

  const lines = quote.line_items || [];
  const subtotal   = lines.reduce((s, l) => s + Number(l.total || 0), 0);
  const vatAmt     = quote.vat_rate ? subtotal * Number(quote.vat_rate) / 100 : 0;
  const grandTotal = subtotal + vatAmt;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white w-full max-w-5xl max-h-[95vh] overflow-auto rounded-2xl shadow-2xl">
        {/* Toolbar (ekranda görünür, basımda gizlenir) */}
        <div className="no-print flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
          <p className="font-bold text-gray-700">Teklif Önizleme · {quote.quote_no}</p>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
              <Printer size={15} /> Yazdır / PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200"><X size={18} /></button>
          </div>
        </div>

        {/* A4 content */}
        <div id="quote-print" className="p-10 font-sans text-gray-800" style={{ minWidth: 900 }}>
          {/* Logo + Başlık Satırı */}
          <div className="flex items-start justify-between mb-6">
            <div>
              {/* Logo */}
              <img src="/aysaled-logo.png" alt="AYSALED" className="h-16 object-contain mb-1"
                onError={e => { e.target.style.display='none'; }} />
              <p className="text-[10px] text-gray-500">LED Aydınlatma Çözümleri</p>
            </div>
            {/* Teklif Bilgileri */}
            <div className="text-right text-sm">
              <div className="inline-block text-left border border-gray-300 rounded-lg overflow-hidden">
                {[
                  ['Teklif No', quote.quote_no],
                  ['Düzenleme Tarihi', fmtDate(quote.issue_date)],
                  ['Geçerlilik Tarihi', fmtDate(quote.valid_until)],
                  ['Düzenleyen', quote.prepared_by || 'Merkez'],
                ].map(([k, v]) => (
                  <div key={k} className="flex border-b last:border-b-0 border-gray-200">
                    <span className="px-3 py-1.5 text-[11px] font-semibold text-gray-600 bg-gray-50 w-40">{k}</span>
                    <span className="px-3 py-1.5 text-[11px] text-gray-800 min-w-[120px]">{v || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Müşteri Bilgileri */}
          <div className="grid grid-cols-2 gap-4 mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Müşteri Bilgileri</p>
              {[
                ['Firma Adı', quote.company_name],
                ['Adres', quote.address],
                ['Telefon', quote.phone],
                ['İlgili Kişi', quote.contact_person],
                ['E-Posta', quote.email],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex gap-2 mb-0.5">
                  <span className="text-[11px] text-gray-500 w-24 shrink-0">{k}:</span>
                  <span className="text-[11px] text-gray-800">{v}</span>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Kalem Tablosu */}
          <table className="w-full border-collapse text-xs mb-4">
            <thead>
              <tr className="text-white" style={{ background: '#1a6b2c' }}>
                {['No', 'Görsel', 'Ürün Kodu', 'Güç (W)', 'Ürün Adı', 'Açıklama', 'Miktar', 'BR', 'Birim Fiyat', 'Toplam Fiyat'].map(h => (
                  <th key={h} className="border border-green-800 px-2 py-1.5 text-left font-semibold text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={line.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i + 1}</td>
                  <td className="border border-gray-300 px-1 py-1">
                    {line.image_url
                      ? <img src={line.image_url} alt="" className="w-12 h-12 object-cover mx-auto rounded" />
                      : <div className="w-12 h-12 bg-gray-100 mx-auto rounded" />}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">{line.item_code}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{line.power_w}</td>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{line.name}</td>
                  <td className="border border-gray-300 px-2 py-1 text-gray-600">{line.description}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{line.quantity}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{line.unit}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmt(line.unit_price)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{fmt(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Alt Bölüm: Açıklamalar + Toplamlar */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Açıklamalar */}
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Açıklamalar</p>
              <div className="border border-gray-200 rounded-lg p-3 min-h-[80px] text-[11px] text-gray-600 whitespace-pre-wrap">
                {quote.notes || ''}
              </div>
            </div>
            {/* Toplamlar */}
            <div>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-2 text-gray-600 bg-gray-50 text-[11px]">Toplam</td>
                    <td className="px-3 py-2 text-right font-semibold text-[11px]">{fmt(subtotal)} ₺</td>
                  </tr>
                  {quote.vat_rate && (
                    <tr className="border-b border-gray-200">
                      <td className="px-3 py-2 text-gray-600 bg-gray-50 text-[11px]">KDV %{quote.vat_rate}</td>
                      <td className="px-3 py-2 text-right text-[11px]">{fmt(vatAmt)} ₺</td>
                    </tr>
                  )}
                  <tr style={{ background: '#1a6b2c' }}>
                    <td className="px-3 py-2 text-white font-bold text-[11px]">Genel Toplam</td>
                    <td className="px-3 py-2 text-right text-white font-bold text-[12px]">{fmt(grandTotal)} ₺</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* İmza Alanları */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {['Üretici Firma', 'Müşteri'].map(label => (
              <div key={label} className="border-t-2 border-gray-300 pt-3">
                <p className="text-[11px] text-gray-500 font-semibold">{label} Kaşe / İmza</p>
                <div className="h-16" />
                {label === 'Üretici Firma' && (
                  <p className="text-[11px] text-gray-700 font-bold">AYSALED LED AYDINLATMA</p>
                )}
              </div>
            ))}
          </div>

          {/* Alt Logolar */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              {['TSE', 'CE', 'Türk Malı', 'ENEC', 'RoHS', 'ISO'].map(logo => (
                <div key={logo} className="border border-gray-300 rounded px-2 py-1 text-[10px] font-bold text-gray-600">{logo}</div>
              ))}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 italic">Türkiye'nin Gücünü ve Potansiyelini Keşfet</p>
              <p className="text-[10px] text-gray-400">www.aysaled.com.tr</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #quote-print, #quote-print * { visibility: visible; }
          #quote-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── Ana Form Bileşeni ──────────────────────────────────────────────────────────
export default function QuoteForm({ quoteId, onBack, onSaved }) {
  const { currentColor } = useTheme();
  const [allItems, setAllItems] = useState([]);
  const [form, setForm] = useState({
    quote_no:       '',
    status:         'draft',
    company_name:   '',
    address:        '',
    phone:          '',
    contact_person: '',
    email:          '',
    issue_date:     today(),
    valid_until:    addDays(today(), 9), // 1 hafta 2 gün
    prepared_by:    'Merkez',
    notes:          '',
    currency:       'TRY',
    vat_rate:       '',
    line_items:     [emptyLine()],
  });
  const [saving, setSaving]   = useState(false);
  const [preview, setPreview] = useState(false);
  const [imageModal, setImageModal] = useState(null); // lineId
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaSearch, setMediaSearch] = useState('');

  // Stok ürünleri
  useEffect(() => {
    supabase.from('items').select('*').order('name').then(({ data }) => setAllItems(data || []));
  }, []);

  // Mevcut teklif yükle
  useEffect(() => {
    if (!quoteId) return;
    supabase.from('quotes').select('*').eq('id', quoteId).single().then(({ data }) => {
      if (data) setForm({ ...data, line_items: data.line_items || [emptyLine()] });
    });
  }, [quoteId]);

  const updateLine = (id, patch) => {
    setForm(f => ({
      ...f,
      line_items: f.line_items.map(l => l.id === id ? { ...l, ...patch } : l),
    }));
  };

  const deleteLine = (id) => {
    setForm(f => ({ ...f, line_items: f.line_items.filter(l => l.id !== id) }));
  };

  const addLine = () => {
    setForm(f => ({ ...f, line_items: [...f.line_items, emptyLine()] }));
  };

  // Hesapla
  const lines = form.line_items || [];
  const subtotal   = lines.reduce((s, l) => s + Number(l.total || 0), 0);
  const vatRate    = Number(form.vat_rate) || 0;
  const vatAmt     = vatRate ? subtotal * vatRate / 100 : 0;
  const grandTotal = subtotal + vatAmt;

  const openImageModal = async (lineId) => {
    setImageModal(lineId);
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    setMediaItems(data || []);
  };

  const selectMedia = (url, lineId) => {
    updateLine(lineId, { image_url: url });
    setImageModal(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        subtotal, vat_amount: vatAmt, grand_total: grandTotal,
      };
      const url = quoteId ? `/api/quotes?id=${quoteId}` : '/api/quotes';
      const method = quoteId ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error);
      onSaved?.(data.quote);
    } catch (e) {
      alert(e.message);
    } finally { setSaving(false); }
  };

  const f = form;
  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const fieldCls = "w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-800 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500";
  const labelCls = "text-xs text-gray-500 font-medium mb-1 block";

  return (
    <div className="bg-white text-gray-800 min-h-screen">
      {/* Toolbar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="font-bold text-gray-800 text-sm">{f.quote_no || 'Yeni Teklif'}</p>
            <p className="text-[10px] text-gray-400">Teklif Formu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={f.status} onChange={e => setF('status', e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
            {[['draft','Taslak'],['sent','Gönderildi'],['accepted','Kabul Edildi'],['rejected','Reddedildi'],['expired','Süresi Doldu']].map(([v,l]) =>
              <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => setPreview(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 hover:bg-gray-50">
            <Eye size={15} /> Önizle
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#1a6b2c' }}>
            {saving ? '...' : <><Save size={15} /> Kaydet</>}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* ── Teklif Bilgileri Satırı ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sol: Müşteri Bilgileri */}
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-sm inline-block" style={{ background: '#1a6b2c' }} />
              Müşteri Bilgileri
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'company_name',   label: 'Firma Adı', fullWidth: true },
                { key: 'address',        label: 'Adres',     fullWidth: true },
                { key: 'phone',          label: 'Telefon' },
                { key: 'contact_person', label: 'İlgili Kişi' },
                { key: 'email',          label: 'E-Posta',   fullWidth: true, type: 'email' },
              ].map(({ key, label, fullWidth, type }) => (
                <div key={key} className={fullWidth ? 'col-span-2' : ''}>
                  <label className={labelCls}>{label}</label>
                  <input type={type || 'text'} value={f[key] || ''} onChange={e => setF(key, e.target.value)}
                    className={fieldCls} />
                </div>
              ))}
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
                <input value={f.quote_no || ''} onChange={e => setF('quote_no', e.target.value)}
                  placeholder="Otomatik" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Para Birimi</label>
                <select value={f.currency} onChange={e => setF('currency', e.target.value)} className={fieldCls}>
                  {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Düzenleme Tarihi</label>
                <input type="date" value={f.issue_date} onChange={e => setF('issue_date', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Geçerlilik Tarihi</label>
                <input type="date" value={f.valid_until} onChange={e => setF('valid_until', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Düzenleyen Kişi</label>
                <input value={f.prepared_by || ''} onChange={e => setF('prepared_by', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>KDV Oranı (%)</label>
                <input type="number" value={f.vat_rate || ''} onChange={e => setF('vat_rate', e.target.value)}
                  placeholder="Opsiyonel" min={0} max={100} className={fieldCls} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Kalem Tablosu ── */}
        <div className="rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between"
            style={{ background: '#f0faf3' }}>
            <p className="font-semibold text-gray-700 text-sm">Ürün Kalemleri</p>
            <button onClick={addLine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: '#1a6b2c' }}>
              <Plus size={13} /> Satır Ekle
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
              <thead>
                <tr className="text-left" style={{ background: '#1a6b2c' }}>
                  {['No', 'Görsel', 'Ürün Kodu', 'Güç (W)', 'Ürün Adı', 'Açıklama', 'Miktar', 'BR', 'Birim Fiyat', 'Toplam', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-[11px] font-semibold text-white border-r border-green-800 last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <QuoteLine key={line.id} line={line} idx={i} allItems={allItems}
                    onUpdate={(id, patch) => updateLine(id, patch)}
                    onDelete={deleteLine}
                    onAddImage={openImageModal} />
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

        {/* ── Alt Bölüm: Açıklamalar + Toplamlar ── */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 rounded-xl border border-gray-200 p-5">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Açıklamalar</label>
            <textarea value={f.notes || ''} onChange={e => setF('notes', e.target.value)}
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

      {/* Önizleme */}
      {preview && (
        <QuotePreview quote={{ ...form, line_items: lines, subtotal, vat_amount: vatAmt, grand_total: grandTotal }}
          onClose={() => setPreview(false)} />
      )}

      {/* Görsel Seçme Modalı */}
      {imageModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <p className="font-bold text-gray-800">Görsel Seç</p>
              <button onClick={() => setImageModal(null)}><X size={18} /></button>
            </div>
            <div className="px-4 py-3 border-b border-gray-200">
              <input value={mediaSearch} onChange={e => setMediaSearch(e.target.value)}
                placeholder="Ara..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-4 gap-3">
                {mediaItems
                  .filter(m => m.mime_type?.startsWith('image/') && m.name?.toLowerCase().includes(mediaSearch.toLowerCase()))
                  .map(m => (
                    <div key={m.id} onClick={() => selectMedia(m.file_url, imageModal)}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-green-500 transition-all">
                      <img src={m.file_url} alt={m.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
              </div>
              {mediaItems.filter(m => m.mime_type?.startsWith('image/')).length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <ImageIcon size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Medya kütüphanesinde görsel yok</p>
                  <p className="text-xs">Önce Medya sekmesinden görsel yükleyin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
