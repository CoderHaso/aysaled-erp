import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Download, AlertCircle, FileDown, FileUp, Eye } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Invoices({ type = 'inbox' }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const isInbox = type === 'inbox';
  const Icon = isInbox ? FileDown : FileUp;

  useEffect(() => {
    fetchInvoices();
  }, [type]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/get-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pageSize: 50 }) // 50 items default
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.detail || 'Faturalar yüklenemedi.');
      }

      // Uyumsoft SOAP yanıtından faturayı ayıklama (Değişken yapıya uyum)
      let list = [];
      const resultData = type === 'outbox' 
        ? data.data?.GetOutboxInvoiceListResult 
        : data.data?.GetInboxInvoiceListResult;
        
      if (resultData?.Value) {
        const valueObj = resultData.Value;
        // InboxInvoice veya OutboxInvoice şeklinde gelebilir
        const invoicesRaw = valueObj.InboxInvoice || valueObj.OutboxInvoice || valueObj.InvoiceInfo || [];
        list = Array.isArray(invoicesRaw) ? invoicesRaw : [invoicesRaw];
      } else {
         // Generic fallback to find array inside result
         const recursiveFindArray = (obj) => {
           if (!obj) return null;
           if (Array.isArray(obj)) return obj;
           if (typeof obj === 'object') {
             for (let key in obj) {
               const res = recursiveFindArray(obj[key]);
               if (res) return res;
             }
           }
           return null;
         };
         list = recursiveFindArray(resultData) || [];
      }
      setInvoices(list);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const c = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    hover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const filtered = invoices.filter(inv => {
    const term = search.toLowerCase();
    const id = (inv.InvoiceId || inv.InvoiceNumber || '').toLowerCase();
    const sender = (inv.SenderName || inv.TargetName || inv.CustomerName || '').toLowerCase();
    return id.includes(term) || sender.includes(term);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15`, color: currentColor }}>
            <Icon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: c.text }}>
              {isInbox ? 'Gelir Faturaları' : 'Gider Faturaları'}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: c.muted }}>
              Uyumsoft sisteminden çekilen güncel belgeler
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.muted }} />
            <input 
              type="text" 
              placeholder="Fatura No / Cari Ara..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl border outline-none min-w-[200px]"
              style={{ background: c.card, borderColor: c.border, color: c.text }}
            />
          </div>
          <button onClick={fetchInvoices} className="btn-primary flex items-center gap-2" style={{ background: currentColor }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
            Yenile
          </button>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} 
          className="p-4 rounded-xl flex items-center gap-3 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Table */}
      <div className="rounded-3xl overflow-hidden border" style={{ background: c.card, borderColor: c.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: c.border, background: c.hover }}>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Tarih</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Fatura No</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>{isInbox ? 'Gönderen Cari' : 'Alıcı Cari'}</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>VKN/TCKN</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-right" style={{ color: c.muted }}>Tutar</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-center" style={{ color: c.muted }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center" style={{ color: c.muted }}>
                    <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: currentColor }} />
                    Faturalar yükleniyor...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center" style={{ color: c.muted }}>
                    <Icon size={40} className="mx-auto mb-3 opacity-50" />
                    Gösterilecek fatura bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((inv, idx) => {
                  const date = inv.IssueDate || inv.CreateDate || inv.Date || '';
                  const invoiceId = inv.InvoiceId || inv.InvoiceNumber || inv.Number || '-';
                  const cariName = inv.SenderName || inv.TargetName || inv.CustomerName || '-';
                  const vkn = inv.SenderVknTckn || inv.TargetVknTckn || inv.VknTckn || '-';
                  const amount = inv.PayableAmount || inv.TotalAmount || inv.Amount || 0;
                  const currency = inv.CurrencyCode || 'TRY';

                  return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                      key={idx} className="border-b last:border-0 transition-colors"
                      style={{ borderColor: c.border }}
                    >
                      <td className="px-5 py-4 whitespace-nowrap text-sm" style={{ color: c.text }}>
                        {date.split('T')[0] || date}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg" style={{ background: `${currentColor}15`, color: currentColor }}>
                          {invoiceId}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium line-clamp-2" style={{ color: c.text, maxWidth: '250px' }}>
                        {cariName}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-mono" style={{ color: c.muted }}>
                        {vkn}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-right" style={{ color: c.text }}>
                        {Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button className="p-2 justify-center rounded-xl inline-flex items-center gap-2 transition-colors hover:bg-slate-500/10" style={{ color: currentColor }}>
                          <Eye size={16} />
                          <span className="text-xs font-semibold">Görüntüle</span>
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
