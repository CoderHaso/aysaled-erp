import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Download, Printer, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QRModal({ item, onClose }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const printRef = useRef(null);

  const c = {
    bg:     isDark ? '#1e293b' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? '#0f172a' : '#f8fafc',
    overlay:isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
  };

  // QR içeriği: uygulama URL'i + item ID
  const qrValue = `${window.location.origin}/stock/${item.id}`;

  // Ürün bilgilerini QR altında göster
  const stockStatus = () => {
    if (item.stock_count <= 0)                          return { label: 'Stok Yok',      color: '#ef4444' };
    if (item.stock_count <= item.critical_limit)        return { label: 'Kritik Seviye', color: '#f59e0b' };
    return { label: 'Stokta',   color: '#10b981' };
  };
  const status = stockStatus();

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>QR Kod — ${item.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: white; }
            .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; max-width: 280px; }
            .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #64748b; text-transform: uppercase; margin-bottom: 16px; }
            .qr { margin: 0 auto 16px; }
            .name { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
            .sku { font-size: 11px; font-weight: 600; color: #64748b; font-family: monospace; }
            .divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
            .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left; }
            .info-item label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94a3b8; display: block; }
            .info-item span  { font-size: 13px; font-weight: 700; color: #0f172a; }
            .url { font-size: 9px; color: #94a3b8; word-break: break-all; margin-top: 12px; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    win.document.close();
    win.print();
    win.close();
  };

  const handleSVGDownload = () => {
    const svg = printRef.current.querySelector('svg');
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${item.sku || item.id.slice(0, 8)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: c.overlay }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: c.border }}>
            <span className="font-bold text-sm" style={{ color: c.text }}>QR Kod</span>
            <button onClick={onClose} style={{ color: c.muted }}>
              <X size={18} />
            </button>
          </div>

          {/* QR Kart (Yazdırılacak alan) */}
          <div ref={printRef}>
            <div className="card" style={{ display: 'none' }}>
              {/* Baskı versiyonu */}
            </div>

            <div className="flex flex-col items-center px-6 py-6">
              {/* Marka */}
              <p className="text-[10px] font-black tracking-[0.15em] mb-4" style={{ color: c.muted }}>
                A-ERP · STOK YÖNETİMİ
              </p>

              {/* QR */}
              <div className="p-4 rounded-2xl shadow-inner" style={{ background: '#ffffff' }}>
                <QRCodeSVG
                  value={qrValue}
                  size={180}
                  fgColor="#0f172a"
                  bgColor="#ffffff"
                  level="M"
                  imageSettings={{
                    src: '',
                    height: 0,
                    width: 0,
                    excavate: false,
                  }}
                />
              </div>

              {/* Ürün Bilgileri */}
              <div className="w-full mt-5 space-y-3">
                <div className="text-center">
                  <h3 className="text-lg font-bold" style={{ color: c.text }}>{item.name}</h3>
                  {item.sku && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: `${currentColor}20`, color: currentColor }}>
                      {item.sku}
                    </span>
                  )}
                </div>

                <hr style={{ borderColor: c.border }} />

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Stok',
                      value: `${item.stock_count ?? 0} ${item.unit || 'pcs'}`,
                      color: status.color
                    },
                    {
                      label: 'Durum',
                      value: status.label,
                      color: status.color
                    },
                    {
                      label: 'Satış Fiyatı',
                      value: item.sale_price > 0
                        ? `${item.sale_price} ${item.base_currency}`
                        : '—',
                      color: c.text
                    },
                    {
                      label: 'Kategori',
                      value: item.category || '—',
                      color: c.text
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: c.cardBg }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: c.muted }}>{label}</p>
                      <p className="text-sm font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[9px] text-center font-mono break-all" style={{ color: c.muted }}>
                  {qrValue}
                </p>
              </div>
            </div>
          </div>

          {/* Aksiyon butonları */}
          <div className="flex gap-2 px-5 pb-5">
            <button onClick={handleSVGDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all"
              style={{ borderColor: c.border, color: c.muted, background: c.cardBg }}>
              <Download size={15} />
              SVG İndir
            </button>
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: currentColor }}>
              <Printer size={15} />
              Yazdır
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
