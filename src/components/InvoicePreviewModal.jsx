import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * InvoicePreviewModal
 *
 * İki mod:
 * 1. Gerçek fatura → invoiceId + documentId + type verilir; /api/get-invoice-view çağrılır
 * 2. Taslak önizleme → previewUrl verilir (string HTML içeriği veya URL)
 *
 * Props:
 *   invoiceId   – string (fatura no, gösterim amaçlı)
 *   documentId  – string (Uyumsoft document_id)
 *   type        – 'inbox' | 'outbox'
 *   previewHtml – string (taslak için doğrudan HTML içeriği)
 *   onClose     – fn
 */
export default function InvoicePreviewModal({ invoiceId, documentId, type = 'outbox', previewHtml, onClose }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [html,       setHtml]       = useState(previewHtml || null);
  const [pdfBase64,  setPdfBase64]  = useState(null);
  const [loading,    setLoading]    = useState(!previewHtml);
  const [error,      setError]      = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeView, setActiveView] = useState('html'); // 'html' | 'pdf'
  const iframeRef = useRef(null);
  const blobRef   = useRef(null);

  // Iframe'e HTML yaz
  // Uyumsoft HTML'i için: sandbox olmadan blob URL (blob URL zaten null origin ile izole)
  // Taslak HTML'i için: srcdoc kullanıyoruz
  const renderHtmlToIframe = (htmlStr, isDraft = false) => {
    if (!iframeRef.current) return;
    if (isDraft) {
      // Kendi HTML'imiz — srcdoc ile sandbox'lı render
      // allow-scripts var ama allow-same-origin YOK: güvenli
      iframeRef.current.removeAttribute('src');
      iframeRef.current.setAttribute('srcdoc', htmlStr);
      return;
    }
    // Uyumsoft HTML'i — blob URL ile (sandbox kullanmıyoruz, null origin zaten izole)
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    blobRef.current = url;
    iframeRef.current.removeAttribute('srcdoc');
    iframeRef.current.src = url;
  };

  useEffect(() => {
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  }, []);

  useEffect(() => {
    if (previewHtml) { setHtml(previewHtml); setLoading(false); return; }
    if (!documentId) { setError('Document ID bulunamadı'); setLoading(false); return; }
    fetchHtml();
  }, [documentId, previewHtml]);

  // HTML yüklenince iframe'e yaz
  useEffect(() => {
    if (html && iframeRef.current) renderHtmlToIframe(html, !!previewHtml);
  }, [html]);

  const fetchHtml = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/invoices-api?action=view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, documentId, type, format: 'html' }),
      });
      const data = await r.json();
      if (!data.success || !data.html) throw new Error(data.error || 'HTML içeriği boş geldi');
      setHtml(data.html);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const fetchPdf = async () => {
    if (pdfBase64) { downloadPdf(pdfBase64); return; }
    setPdfLoading(true);
    try {
      const r = await fetch('/api/invoices-api?action=view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, documentId, type, format: 'pdf' }),
      });
      const data = await r.json();
      if (!data.success || !data.pdfBase64) throw new Error(data.error || 'PDF alınamadı');
      setPdfBase64(data.pdfBase64);
      downloadPdf(data.pdfBase64);
    } catch (e) {
      alert(e.message);
    } finally { setPdfLoading(false); }
  };

  const downloadPdf = (b64) => {
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${invoiceId || 'fatura'}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.focus();
      iframeRef.current.contentWindow?.print();
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-5xl flex flex-col rounded-3xl overflow-hidden"
          style={{
            height: 'calc(100vh - 4rem)',
            background: isDark ? '#0c1526' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
            boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          }}
          initial={{ scale: 0.93, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : '#e2e8f0'}`, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)' }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {previewHtml ? 'Taslak Önizleme' : 'Fatura Görüntüle'}
              </p>
              <h3 className="text-sm font-bold font-mono mt-0.5" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{invoiceId || 'TASLAK'}</h3>
            </div>

            <div className="flex items-center gap-2">
              {/* PDF İndir — sadece gerçek fatura için */}
              {documentId && (
                <button onClick={fetchPdf} disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  PDF İndir
                </button>
              )}

              {/* Yazdır */}
              <button onClick={handlePrint} disabled={!html}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', opacity: html ? 1 : 0.4 }}>
                <Printer size={13} />Yazdır
              </button>

              {/* Yenile — gerçek fatura */}
              {!previewHtml && (
                <button onClick={fetchHtml}
                  className="p-2 rounded-xl transition-all"
                  style={{ color: '#94a3b8', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              )}

              <button onClick={onClose}
                className="p-2 rounded-xl transition-colors" style={{ color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── İçerik ── */}
          <div className="flex-1 relative overflow-hidden bg-white">
            {/* Yükleniyor */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: isDark ? '#0c1526' : '#f8fafc', zIndex: 10 }}>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Loader2 size={28} className="animate-spin text-blue-400" />
                </div>
                <p className="text-sm font-semibold" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Fatura yükleniyor...</p>
                <p className="text-xs" style={{ color: '#64748b' }}>Uyumsoft'tan HTML görünümü alınıyor</p>
              </div>
            )}

            {/* Hata */}
            {!loading && error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
                style={{ background: isDark ? '#0c1526' : '#f8fafc' }}>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={28} className="text-red-400" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-sm font-bold text-red-400 mb-2">Fatura görüntüsü alınamadı</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
                </div>
                <div className="flex gap-2">
                  {!previewHtml && (
                    <button onClick={fetchHtml}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <RefreshCw size={14} />Tekrar Dene
                    </button>
                  )}
                  {documentId && (
                    <button onClick={fetchPdf} disabled={pdfLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      PDF İndir
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* iframe
                - Uyumsoft HTML: blob URL, sandbox YOK (blob → null origin = zaten izole)
                - Taslak HTML  : srcdoc, sandbox="allow-scripts" (allow-same-origin YOK)
            */}
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              title="Fatura Önizleme"
              style={{ display: loading || error ? 'none' : 'block', background: '#fff' }}
              {...(previewHtml ? { sandbox: 'allow-scripts' } : {})}
            />
          </div>

          {/* ── Footer — taslak uyarısı ── */}
          {previewHtml && (
            <div className="px-5 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(148,163,184,0.08)', background: 'rgba(245,158,11,0.06)' }}>
              <p className="text-[11px] text-amber-400 font-semibold text-center">
                ⚠️ Bu taslak önizlemesidir — henüz devlete iletilmemiştir.
                Onayladıktan sonra Uyumsoft portalından resmi fatura kesin.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
