import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

/**
 * InvoicePreviewModal
 *
 * Props:
 *  - invoiceId    : string (fatura no — gösterim için)
 *  - documentId   : string (Uyumsoft document UUID)
 *  - type         : 'inbox' | 'outbox' (fatura listesinde kullanılır)
 *  - previewUrl   : string (doğrudan URL geçilebilir — draft preview için)
 *  - onClose      : fn
 */
export default function InvoicePreviewModal({ invoiceId, documentId, type = 'outbox', previewUrl: directUrl, onClose }) {
  const [url,     setUrl]     = useState(directUrl || null);
  const [pdfUrl,  setPdfUrl]  = useState(null);
  const [loading, setLoading] = useState(!directUrl);
  const [error,   setError]   = useState(null);
  const iframeRef = useRef(null);

  const docType = type === 'inbox' ? 'InboxInvoice' : 'OutboxInvoice';

  useEffect(() => {
    if (directUrl) { setUrl(directUrl); setLoading(false); return; }
    if (!documentId) { setError('Document ID bulunamadı'); setLoading(false); return; }
    fetchUrl('Html');
  }, [documentId, directUrl]);

  const fetchUrl = async (fileType = 'Html') => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/get-invoice-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, documentType: docType, fileType }),
      });
      const data = await r.json();
      if (!data.success || !data.url) throw new Error(data.error || 'URL alınamadı');
      if (fileType === 'Html') setUrl(data.url);
      else setPdfUrl(data.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.focus();
      iframeRef.current.contentWindow?.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
    await fetchUrl('Pdf');
    if (pdfUrl) window.open(pdfUrl, '_blank');
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-5xl flex flex-col rounded-3xl overflow-hidden"
          style={{
            height: 'calc(100vh - 4rem)',
            background: '#0c1526',
            border: '1px solid rgba(148,163,184,0.12)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          }}
          initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(148,163,184,0.08)', background: 'rgba(0,0,0,0.3)' }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fatura Önizleme</p>
              <h3 className="text-sm font-bold text-slate-100 font-mono mt-0.5">{invoiceId || 'TASLAK'}</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* PDF İndir */}
              {documentId && (
                <button onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Download size={13} />PDF
                </button>
              )}
              {/* Yazdır */}
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Printer size={13} />Yazdır
              </button>
              {/* Yeni sekmede aç */}
              {url && (
                <button onClick={() => window.open(url, '_blank')}
                  className="p-2 rounded-xl transition-all text-slate-400 hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <ExternalLink size={14} />
                </button>
              )}
              {/* Yenile */}
              {!directUrl && (
                <button onClick={() => fetchUrl('Html')}
                  className="p-2 rounded-xl transition-all text-slate-400 hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              )}
              <button onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* İçerik */}
          <div className="flex-1 relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: '#0c1526' }}>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Loader2 size={28} className="animate-spin text-blue-400" />
                </div>
                <p className="text-sm text-slate-400 font-semibold">Fatura yükleniyor...</p>
                <p className="text-xs text-slate-600">Uyumsoft'tan görsel alınıyor</p>
              </div>
            )}

            {!loading && error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={28} className="text-red-400" />
                </div>
                <p className="text-sm font-bold text-red-400 text-center">{error}</p>
                <p className="text-xs text-slate-500 text-center max-w-sm">
                  Fatura görüntüsü alınamadı. Uyumsoft'ta bu fatura için HTML görünümü aktif olmayabilir.
                </p>
                {!directUrl && (
                  <button onClick={() => fetchUrl('Html')}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <RefreshCw size={14} />Tekrar Dene
                  </button>
                )}
              </div>
            )}

            {!loading && !error && url && (
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                title="Fatura Önizleme"
                sandbox="allow-same-origin allow-scripts allow-popups"
                style={{ background: '#fff' }}
              />
            )}
          </div>

          {/* Footer — Taslak uyarısı */}
          {directUrl && (
            <div className="px-5 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(148,163,184,0.08)', background: 'rgba(245,158,11,0.06)' }}>
              <p className="text-[11px] text-amber-400 font-semibold text-center">
                ⚠️ Bu taslak önizlemesidir. Sipariş kaydedildikten sonra gerçek fatura kesilebilir.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
