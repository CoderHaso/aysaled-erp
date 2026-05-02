import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Image as ImageIcon, Printer, Save, X, Package,
  Eye, ArrowLeft, Upload, UserPlus, Loader2, Check, Send
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import CustomDialog from '../components/CustomDialog';
import MediaPickerModal from '../components/MediaPickerModal';
import { useFxRates } from '../hooks/useFxRates';
import { trNorm } from '../lib/trNorm';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = (n, d = 2) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const today   = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '';
const currSymbol = (c) => {
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  return '₺';
};

function emptyLine() {
  return {
    id: Math.random().toString(36).slice(2),
    image_url: '', item_code: '', power_w: '', name: '',
    description: '', quantity: 1, unit: 'Adet', unit_price: 0, total: 0,
  };
}

// ── Ürün satırı ────────────────────────────────────────────────────────────────
function QuoteLine({ line, idx, allItems, onUpdate, onDelete, onAddImage, onAddNewItem, quoteCurrency, convert, rowHeight = 58, imgWidth = 68, sym = '₺' }) {
  const [showSugg, setShowSugg] = useState(false);
  const [q, setQ]               = useState(line.name || '');
  const [dropPos, setDropPos]   = useState({ top: 0, left: 0, width: 280 });
  const inputRef                = useRef(null);

  // allItems değişince q'yu başlatma (edit modunda)
  useEffect(() => { setQ(line.name || ''); }, []);

  const suggestions = (allItems && q.trim().length >= 1)
    ? allItems.filter(i => {
        const i_name = trNorm(i.name || i.item_name);
        const i_code = trNorm(i.item_code || i.sku);
        const search = trNorm(q);
        return i_name.includes(search) || i_code.includes(search);
      }).slice(0, 15)
    : [];

  const openSugg = () => {
    if (inputRef.current) {
      const r         = inputRef.current.getBoundingClientRect();
      const vh        = window.innerHeight;
      const spaceBelow = vh - r.bottom - 8;      // px kalan alan (aşağıda)
      const spaceAbove = r.top - 8;              // px kalan alan (yukarıda)
      const DROPDOWN_H = 300;                    // max dropdown yüksekliği

      if (spaceBelow >= Math.min(DROPDOWN_H, 120)) {
        // Aşağı aç
        setDropPos({
          top:       r.bottom + 2,               // fixed → viewport-relative
          left:      r.left,
          width:     Math.max(r.width, 300),
          maxHeight: Math.min(DROPDOWN_H, spaceBelow),
          openUp:    false,
        });
      } else {
        // Yukarı aç
        const availH = Math.min(DROPDOWN_H, spaceAbove);
        setDropPos({
          top:       r.top - availH - 2,         // açıldığı noktanın tabanı = input.top
          left:      r.left,
          width:     Math.max(r.width, 300),
          maxHeight: availH,
          openUp:    true,
        });
      }
    }
    setShowSugg(true);
  };

  const doSelectItem = (item, keepImage = false) => {
    let rawPrice = Number(item.sale_price || item.purchase_price || 0);
    let cur = item.item_type === 'product' ? (item.sale_currency || 'TRY') : (item.base_currency || 'TRY');
    let unit_price = convert ? Number(convert(rawPrice, cur, quoteCurrency || 'TRY').toFixed(2)) : Number(rawPrice.toFixed(2));
    
    const total = unit_price * Number(line.quantity || 1);
    onUpdate(line.id, {
      item_id:     item.id,
      item_code:   item.item_code || item.sku || '',
      name:        item.name || '',
      description: item.description || '',
      unit_price:  unit_price,
      unit:        item.unit || 'Adet',
      image_url:   keepImage ? (line.image_url || item.image_url || '') : (item.image_url || ''),
      power_w:     item.power_w || '',
      total,
    });
    setQ(item.name || '');
    setShowSugg(false);
  };

  // Resim çakışması kontrolü — mevcut resim varsa seçilen üründe farklı resim varsa sor
  const handleSelectItem = (item) => {
    const hasCurrentImg = !!(line.image_url);
    const hasNewImg     = !!(item.image_url);
    const isDifferent   = hasCurrentImg && hasNewImg && line.image_url !== item.image_url;
    if (isDifferent) {
      setPendingItem(item); // onay bekliyor
    } else {
      doSelectItem(item);
    }
  };

  // Bekleyen ürün seçimi (resim onayı için)
  const [pendingItem, setPendingItem] = useState(null);


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
    <>
      <tr className="hover:bg-gray-50 group" style={{ height: rowHeight }}>
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

      {/* Ürün Adı — arama dropdown (fixed position, tablo overflow'unu aşar) */}
      <td className={cell} style={{ overflow: 'hidden' }}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => { upd('name', e.target.value); openSugg(); }}
          onFocus={openSugg}
          onBlur={() => setTimeout(() => setShowSugg(false), 200)}
          className={inp}
          placeholder="Ürün yaz veya seç..."
        />
        {showSugg && createPortal(
          <div style={{
            position: 'fixed',
            top:      dropPos.top,
            left:     dropPos.left,
            width:    Math.max(dropPos.width || 0, 300),
            zIndex:   99999,
            background: '#fff',
            border:   '1px solid #d1fae5',
            // Yukarı açılınca köşeleri ters yuvarlat
            borderRadius: dropPos.openUp ? '14px 14px 6px 6px' : '6px 6px 14px 14px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.22), 0 0 0 1px rgba(26,107,44,0.08)',
            maxHeight: dropPos.maxHeight || 300,
            overflowY: 'auto',
            fontFamily: 'inherit',
          }}>
            {/* Başlık */}
            <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #f0fdf4', background: '#f0fdf4' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stok Listesi</p>
            </div>

            {q.trim().length >= 1 && suggestions.map(s => (
              <div key={s.id} onMouseDown={(e) => { e.preventDefault(); handleSelectItem(s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {s.image_url
                  ? <img src={s.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  : <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package size={13} color="#9ca3af" />
                    </div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: '#9ca3af' }}>{s.item_code || s.sku || ''}{s.power_w ? ` · ${s.power_w}W` : ''}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>
                  {fmt(s.sale_price || s.purchase_price)} {currSymbol(s.item_type === 'product' ? (s.sale_currency || 'TRY') : (s.base_currency || 'TRY')) || '₺'}
                </span>
              </div>
            ))}

            {/* Eşleşme yok */}
            {q.trim().length >= 1 && suggestions.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Stokta bulunamadı</div>
            )}

            {/* Yeni ürün kaydet */}
            {q.trim() && (
              <div onMouseDown={(e) => { e.preventDefault(); setShowSugg(false); onAddNewItem && onAddNewItem(q.trim()); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: '#f0fdf4', cursor: 'pointer', borderTop: '1px solid #d1fae5' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}>
                <Plus size={13} color="#16a34a" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>"{q}" yeni ürün olarak kaydet</span>
              </div>
            )}

            {/* Kayıtsız kullan */}
            {q.trim() && (
              <div onMouseDown={(e) => { e.preventDefault(); setShowSugg(false); onUpdate(line.id, { name: q.trim(), item_code: '', image_url: line.image_url || '' }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: '#eff6ff', cursor: 'pointer', borderTop: '1px solid #dbeafe' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}>
                <Check size={13} color="#2563eb" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>"{q}" kayıtsız kullan</span>
              </div>
            )}
          </div>,
          document.body
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

    {/* Resim değiştirme onay diyaloğu — porta ile render */}
    {pendingItem && createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: 28, maxWidth: 380, width: '90%',
          boxShadow: '0 32px 64px rgba(0,0,0,0.3)',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Resim Değiştirilsin mi?</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
            Bu satırda zaten bir ürün görseli var. <strong>{pendingItem.name}</strong> ürününün görseli farklı — eski resmi değiştirmek ister misiniz?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { doSelectItem(pendingItem, true); setPendingItem(null); }}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e5e7eb',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151', background: '#f9fafb' }}>
              Mevcut Resmi Koru
            </button>
            <button
              onClick={() => { doSelectItem(pendingItem, false); setPendingItem(null); }}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff', background: '#1a6b2c' }}>
              Yeni Resmi Getir
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
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
            <button onClick={async () => {
              const el = document.getElementById('quote-print');
              if (!el) return;
              try {
                const { default: html2canvas } = await import('html2canvas');
                const { jsPDF } = await import('jspdf');
                const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                
                // A4 PDF oluştur
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pageW = 210;
                const pageH = 297;
                const imgW = pageW;
                const imgH = (canvas.height * imgW) / canvas.width;
                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                
                // Sayfa taşması varsa birden fazla sayfa ekle
                let yOffset = 0;
                while (yOffset < imgH) {
                  if (yOffset > 0) pdf.addPage();
                  pdf.addImage(imgData, 'JPEG', 0, -yOffset, imgW, imgH);
                  yOffset += pageH;
                }
                
                const pdfBlob = pdf.output('blob');
                const fileName = `${quote.quote_no || 'Teklif'}.pdf`;
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                
                // Mobil mi kontrol et (sadece mobilde Web Share API kullan)
                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                
                if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    title: `Teklif - ${quote.quote_no}`,
                    text: `${quote.company_name || ''} - ${quote.quote_no} Teklif`,
                    files: [file],
                  });
                } else {
                  // PDF indir + WhatsApp Web aç
                  const phone = (quote.phone || '').replace(/\D/g, '');
                  const fullPhone = phone ? `90${phone.startsWith('0') ? phone.slice(1) : phone}` : '';
                  const msg = encodeURIComponent(
                    `Merhaba, ${quote.company_name || ''} adına hazırlanan ${quote.quote_no} numaralı teklifimiz ektedir. İyi günler.`
                  );
                  const waUrl = fullPhone 
                    ? `https://web.whatsapp.com/send?phone=${fullPhone}&text=${msg}`
                    : `https://web.whatsapp.com/send?text=${msg}`;
                  
                  // Önce PDF indir
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(pdfBlob);
                  link.download = fileName;
                  link.click();
                  URL.revokeObjectURL(link.href);
                  
                  // Sonra WhatsApp Web aç
                  setTimeout(() => window.open(waUrl, '_blank'), 500);
                }
              } catch (err) {
                console.error('WhatsApp paylaşım hatası:', err);
                const phone = (quote.phone || '').replace(/\D/g, '');
                const fullPhone = phone ? `90${phone.startsWith('0') ? phone.slice(1) : phone}` : '';
                const msg = encodeURIComponent(
                  `Merhaba, ${quote.company_name || ''} adına hazırlanan ${quote.quote_no} numaralı teklifimiz hakkında bilgi vermek istiyoruz.`
                );
                const waUrl = fullPhone 
                  ? `https://web.whatsapp.com/send?phone=${fullPhone}&text=${msg}`
                  : `https://web.whatsapp.com/send?text=${msg}`;
                window.open(waUrl, '_blank');
              }
            }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
              <Send size={15} /> WhatsApp Paylaş
            </button>
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
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, fontWeight: 600 }}>{fmt(subtotal)} {currSymbol(quote.currency)}</td>
                  </tr>
                  {quote.vat_rate && (
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '4px 8px', background: '#f9fafb', fontSize: 10, color: '#4b5563' }}>KDV %{quote.vat_rate}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10 }}>{fmt(vatAmt)} {currSymbol(quote.currency)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#1a6b2c' }}>
                    <td style={{ padding: '5px 8px', color: '#fff', fontSize: 11, fontWeight: 700 }}>Genel Toplam</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fff', fontSize: 12, fontWeight: 700 }}>{fmt(grandTotal)} {currSymbol(quote.currency)}</td>
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
  const { convert } = useFxRates();

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
  const [dialog, setDialog]     = useState({ open: false, title: '', message: '', type: 'confirm', onConfirm: null, loading: false });
  const [preview, setPreview]   = useState(false);
  const [imageModal, setImageModal] = useState(null);

  // Quick modals
  const [quickItemForm, setQuickItemForm] = useState(null);     // { lineId, name, type, code, price }
  const [quickEntityForm, setQuickEntityForm] = useState(null); // { name, type, vkntckn, city, email, phone, address }

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
    trNorm(c.name) === trNorm(custQ)
  );
  const custSuggestions = custQ.length >= 1
    ? allCustomers.filter(c => trNorm(c.name).includes(trNorm(custQ))).slice(0, 8)
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

  const saveNewCustomer = () => {
    if (!custQ.trim()) return;
    setQuickEntityForm({ name: custQ.trim(), type: 'corporate', vkntckn: '', address: form.address || '', city: '', email: form.email || '', phone: form.phone || '' });
    setShowCustSugg(false);
  };

  const submitQuickEntity = async () => {
    if (!quickEntityForm?.name?.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('customers').insert({
         name: quickEntityForm.name.trim(),
         type: quickEntityForm.type || 'corporate',
         vkntckn: quickEntityForm.vkntckn || null,
         city: quickEntityForm.city || null,
         address: quickEntityForm.address || null,
         email: quickEntityForm.email || null,
         phone: quickEntityForm.phone || null,
         is_faturasiz: !!quickEntityForm.is_faturasiz,
         source: 'manual'
      }).select().single();
      if (error) throw error;
      setAllCustomers(prev => [...prev, data]);
      setForm(f => ({ ...f, company_name: data.name, address: data.address || '', phone: data.phone || '', email: data.email || '' }));
      setCustQ(data.name);
      setQuickEntityForm(null);
    } catch (e) {
      setDialog({ open: true, title: 'Hata', message: 'Müşteri kaydedilemedi: ' + e.message, type: 'alert' });
    } finally { setSaving(false); }
  };

  const submitQuickItem = async () => {
    if (!quickItemForm?.name?.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('items').insert({
         name: quickItemForm.name.trim(),
         item_type: quickItemForm.type || 'product',
         item_code: quickItemForm.code || null,
         sale_price: quickItemForm.price ? Number(quickItemForm.price) : 0,
         unit: quickItemForm.unit || 'Adet'
      }).select().single();
      if (error) throw error;
      setAllItems(prev => [...prev, data]);
      updateLine(quickItemForm.lineId, { name: data.name, item_code: data.item_code || '', unit_price: data.sale_price || 0, unit: data.unit || 'Adet' });
      setQuickItemForm(null);
    } catch(e) {
      setDialog({ open: true, title: 'Hata', message: 'Ürün eklenirken hata oluştu: ' + e.message, type: 'alert' });
    } finally { setSaving(false); }
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
  const openImageModal = (lineId) => {
    setImageModal(lineId);
  };
  const selectMedia = async (url, lineId) => {
    const line = form.line_items.find(l => l.id === lineId);
    updateLine(lineId, { image_url: url });
    setImageModal(null);
    if (line && line.item_id) {
       await supabase.from('items').update({ image_url: url }).eq('id', line.item_id);
    }
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
    } catch (e) { 
      setDialog({ open: true, title: 'Kayıt Hatası', message: e.message, type: 'alert' });
    }
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
                    {/* Yeni müşteri kaydet modal'ını aç */}
                    {custQ.trim() && !custExists && (
                      <div onMouseDown={() => { setShowCustSugg(false); setQuickEntityForm({ name: custQ.trim(), type: 'corporate', vkntckn: '', address: '', city: '', email: '', phone: '' }); }}
                        className="flex items-center gap-3 px-4 py-3 bg-green-50 hover:bg-green-100 cursor-pointer">
                        <UserPlus size={16} className="text-green-700" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">"{custQ.trim()}" için kayıt detayları gir</p>
                          <p className="text-xs text-green-600">Cariler listesine detaylı olarak eklenecek</p>
                        </div>
                      </div>
                    )}
                    {/* Hızlı eklensin istersen kayıtsız geçsin? Quote is fine string only */}
                    {custQ.trim() && !custExists && (
                        <div onMouseDown={() => setShowCustSugg(false)}
                        className="flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 cursor-pointer">
                          <Check size={16} className="text-blue-700" />
                          <p className="text-sm font-semibold text-blue-800">Sadece teklife "{custQ.trim()}" adıyla kayıtsız yaz</p>
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
          <div className="overflow-x-auto" style={{ userSelect: 'none', overflowY: 'visible' }}>
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
                    onAddNewItem={(name) => setQuickItemForm({ lineId: line.id, name, type: 'product', code: '', price: '', unit: 'Adet' })}
                    quoteCurrency={form.currency}
                    convert={convert}
                    rowHeight={rowHeight} imgWidth={colWidths.img}
                    sym={currSymbol(form.currency)}
                  />
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
                <span className="font-semibold">{fmt(subtotal)} {currSymbol(form.currency)}</span>
              </div>
              {vatRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">KDV %{vatRate}</span>
                  <span>{fmt(vatAmt)} {currSymbol(form.currency)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-bold text-gray-800">Genel Toplam</span>
                <span className="font-bold text-lg" style={{ color: '#1a6b2c' }}>{fmt(grandTotal)} {currSymbol(form.currency)}</span>
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
      <MediaPickerModal 
        isOpen={!!imageModal} 
        onClose={() => setImageModal(null)} 
        onSelect={(item) => selectMedia(item.url || item.file_url, imageModal)} 
      />

      {/* ── Hızlı Ürün Ekle Modal ── */}
      {quickItemForm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Sisteme Ürün Kaydet</h3>
              <button onClick={() => setQuickItemForm(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Ürün Adı *</label>
                <input value={quickItemForm.name || ''} onChange={e => setQuickItemForm(p => ({...p, name: e.target.value}))} className={fieldCls} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Tür</label>
                    <select value={quickItemForm.type} onChange={e => setQuickItemForm(p => ({...p, type: e.target.value}))} className={fieldCls}>
                        <option value="product">Mamül</option>
                        <option value="rawmaterial">Hammadde</option>
                        <option value="service">Hizmet</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Birim</label>
                    <select value={quickItemForm.unit} onChange={e => setQuickItemForm(p => ({...p, unit: e.target.value}))} className={fieldCls}>
                        {['Adet','Mt','Kg','M²','Rulo','Paket','Set'].map(u => <option key={u}>{u}</option>)}
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Satış Fiyatı (₺)</label>
                    <input type="number" step="0.01" value={quickItemForm.price || ''} onChange={e => setQuickItemForm(p => ({...p, price: e.target.value}))} className={fieldCls} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Ürün Kodu</label>
                    <input value={quickItemForm.code || ''} onChange={e => setQuickItemForm(p => ({...p, code: e.target.value}))} className={fieldCls} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setQuickItemForm(null)} className="flex-1 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">İptal</button>
                <button onClick={submitQuickItem} disabled={saving || !quickItemForm.name.trim()} className="flex-1 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50">
                    {saving ? 'Kaydediliyor...' : 'Kaydet ve Seç'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hızlı Müşteri Ekle Modal ── */}
      {quickEntityForm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Sisteme Müşteri Kaydet</h3>
              <button onClick={() => setQuickEntityForm(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {/* Faturasız Toggle */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all"
                style={{ background: quickEntityForm.is_faturasiz ? 'rgba(245,158,11,0.10)' : 'rgba(0,0,0,0.02)', border: `1px solid ${quickEntityForm.is_faturasiz ? 'rgba(245,158,11,0.4)' : '#e5e7eb'}` }}
                onClick={() => setQuickEntityForm(p => ({...p, is_faturasiz: !p.is_faturasiz}))}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: quickEntityForm.is_faturasiz ? '#f59e0b' : '#e5e7eb', border: `1px solid ${quickEntityForm.is_faturasiz ? '#f59e0b' : '#cbd5e1'}` }}>
                  {quickEntityForm.is_faturasiz && <Check size={11} color="white"/>}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold" style={{ color: quickEntityForm.is_faturasiz ? '#f59e0b' : '#64748b' }}>Faturasız Müşteri</p>
                  <p className="text-[10px] text-gray-400">{quickEntityForm.is_faturasiz ? 'Sadece temel bilgiler gerekli' : 'E-fatura için tam adres bilgisi gerekli'}</p>
                </div>
              </label>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Müşteri / Firma Adı *</label>
                <input value={quickEntityForm.name || ''} onChange={e => setQuickEntityForm(p => ({...p, name: e.target.value}))} className={fieldCls} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="text-xs font-semibold text-gray-500 mb-1 block">VKN / TCKN</label>
                   <input value={quickEntityForm.vkntckn || ''} onChange={e => setQuickEntityForm(p => ({...p, vkntckn: e.target.value}))} className={fieldCls} />
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-500 mb-1 block">Telefon</label>
                   <input value={quickEntityForm.phone || ''} onChange={e => setQuickEntityForm(p => ({...p, phone: e.target.value}))} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">E-Posta</label>
                <input type="email" value={quickEntityForm.email || ''} onChange={e => setQuickEntityForm(p => ({...p, email: e.target.value}))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Adres / Şehir</label>
                <input value={quickEntityForm.address || ''} onChange={e => setQuickEntityForm(p => ({...p, address: e.target.value}))} className={fieldCls} placeholder="Mahalle, sokak, no, şehir..." />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setQuickEntityForm(null)} className="flex-1 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">İptal</button>
                <button onClick={submitQuickEntity} disabled={saving || !quickEntityForm.name.trim()} className="flex-1 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50">
                    {saving ? 'Kaydediliyor...' : 'Kaydet ve Seç'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CustomDialog
        {...dialog}
        onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog({ ...dialog, open: false })}
      />
    </div>
  );
}
