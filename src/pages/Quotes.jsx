import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, FileText, Loader2, Trash2, Eye, Edit3,
  CheckCircle2, Clock, XCircle, Send, RefreshCw, FileMinus, Calendar, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import QuoteForm, { QuotePreview } from './QuoteForm';
import CustomDialog from '../components/CustomDialog';
import { trNorm } from '../lib/trNorm';

const STATUS = {
  draft: { label: 'Taslak', color: '#94a3b8', icon: Clock },
  sent: { label: 'Gönderildi', color: '#3b82f6', icon: Send },
  accepted: { label: 'Kabul Edildi', color: '#10b981', icon: CheckCircle2 },
  rejected: { label: 'Reddedildi', color: '#ef4444', icon: XCircle },
};

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
      style={{ background: `${s.color}18`, color: s.color }}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-[400] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold"
      style={{ background: type === 'error' ? '#ef4444' : '#10b981' }}>
      {msg}
    </motion.div>
  );
}

function DateGroup({ date, quotes, isInitiallyExpanded, isDark, c, currentColor, onEdit, onDelete, onPreview, onStatusUpdate, onAccept }) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: `1px solid ${c.border}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff' }}>
      <button onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderBottom: isExpanded ? `1px solid ${c.border}` : 'none' }}>
        <div className="flex items-center gap-3">
          <Calendar size={16} style={{ color: currentColor }} />
          <span className="text-sm font-bold" style={{ color: c.text }}>{date}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${currentColor}20`, color: currentColor }}>
            {quotes.length} Teklif
          </span>
        </div>
        {isExpanded ? <ChevronUp size={18} style={{ color: c.muted }} /> : <ChevronDown size={18} style={{ color: c.muted }} />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="divide-y" style={{ borderColor: c.border }}>
              {quotes.map((q) => (
                <div key={q.id} className="grid grid-cols-1 sm:grid-cols-12 px-5 py-4 items-center gap-3 hover:bg-white/5 transition-colors">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-bold font-mono" style={{ color: '#22863a' }}>{q.quote_no}</p>
                  </div>
                  <div className="sm:col-span-4">
                    <p className="text-sm font-medium" style={{ color: c.text }}>{q.company_name || '-'}</p>
                    <p className="text-[11px]" style={{ color: c.muted }}>{q.contact_person || ''}</p>
                  </div>
                  <div className="sm:col-span-2"><StatusBadge status={q.status} /></div>
                  <div className="sm:col-span-2 text-right">
                    <p className="text-sm font-bold" style={{ color: c.text }}>{fmt(q.grand_total)} {q.currency}</p>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-1">
                    {q.status === 'draft' && (
                      <button onClick={() => onStatusUpdate(q.id, 'sent')} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50">
                        <Send size={15} />
                      </button>
                    )}
                    {(q.status === 'draft' || q.status === 'sent') && (
                      <button onClick={() => onAccept(q)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50">
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    <button onClick={() => onPreview(q)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => onEdit(q.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => onDelete(q.id, q.quote_no)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Quotes() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const navigate = useNavigate();

  const [quotes, setQuotes] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editId, setEditId] = useState(null);
  const [previewQ, setPreviewQ] = useState(null);
  const [acceptModal, setAcceptModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState({ open: false, title: '', message: '', type: 'confirm', onConfirm: null, loading: false });

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const updateStatus = async (id, status) => {
    await fetch(`/api/quotes?id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    showToast('Durum güncellendi');
    load();
  };

  const handleAccept = async (q) => {
    try {
      setAcceptModal(null);
      navigate('/sales', {
        state: {
          createFromQuote: q,
          quoteOriginalStatus: q.status,
          quoteMsg: 'Sipariş formunu doldurup oluşturduğunuzda teklif kabul edilmiş olarak işaretlenecek.'
        }
      });
    } catch (e) {
      setDialog({ open: true, title: 'Hata', message: 'İşlem sırasında hata oluştu: ' + e.message, type: 'alert' });
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes, iRes] = await Promise.all([
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*').order('name')
    ]);
    setQuotes(qRes.data || []);
    setAllItems(iRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteQuote = async (id, no) => {
    setDialog({
      open: true,
      title: 'Teklifi Sil',
      message: `"${no}" numaralı teklifi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      type: 'danger',
      onConfirm: async () => {
        setDialog(d => ({ ...d, loading: true }));
        try {
          await fetch(`/api/quotes?id=${id}`, { method: 'DELETE' });
          showToast('Teklif silindi');
          load();
          setDialog({ open: false });
        } catch (e) {
          setDialog({ open: true, title: 'Hata', message: 'Silme başarısız: ' + e.message, type: 'alert' });
        }
      }
    });
  };

  const filtered = quotes.filter(q => {
    const matchSearch = !search ||
      trNorm(q.quote_no).includes(trNorm(search)) ||
      trNorm(q.company_name).includes(trNorm(search));
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    const d = new Date(q.created_at || q.issue_date);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalValue: quotes.filter(q => q.status !== 'rejected').reduce((s, q) => s + Number(q.grand_total || 0), 0),
  };

  const c = {
    card: isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
  };

  if (view === 'form') {
    return (
      <QuoteForm
        quoteId={editId}
        allItems={allItems}
        onBack={() => { setView('list'); setEditId(null); load(); }}
        onSaved={(q) => { showToast(`${q.quote_no} kaydedildi ✓`); setView('list'); setEditId(null); load(); }}
      />
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: c.text }}>Teklifler</h1>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: c.muted }}>{quotes.length} teklif · Aktif yönetim</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={load} className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <RefreshCw size={16} className="text-slate-400" />
            </button>
            <button onClick={() => { setEditId(null); setView('form'); }}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-lg"
              style={{ background: `linear-gradient(135deg, #1a6b2c, #22863a)` }}>
              <Plus size={16} /> <span className="hidden sm:inline">Yeni Teklif</span><span className="sm:hidden">Yeni</span>
            </button>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Toplam Teklif', value: stats.total, color: '#6366f1' },
            { label: 'Taslak', value: stats.draft, color: '#94a3b8' },
            { label: 'Kabul Edildi', value: stats.accepted, color: '#10b981' },
            { label: 'Toplam Değer', value: `${fmt(stats.totalValue)} ₺`, color: '#1a6b2c', isText: true },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <p className="text-xs font-medium mb-1" style={{ color: c.muted }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.isText ? s.color : c.text }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtreler */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Teklif no veya müşteri ara..."
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}`, color: c.text }} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[['all', 'Tümü'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} onClick={() => setStatusFilter(k)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: statusFilter === k ? currentColor : 'rgba(255,255,255,0.06)',
                  color: statusFilter === k ? '#fff' : c.muted,
                }}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}` }}>
              <Calendar size={11} style={{ color: c.muted }} />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-[11px] outline-none" style={{ color: c.text }} />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}` }}>
              <Calendar size={11} style={{ color: c.muted }} />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-[11px] outline-none" style={{ color: c.text }} />
            </div>
          </div>
        </div>

        {/* Teklif Listesi */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: c.muted }}>
            <FileText size={48} className="mx-auto mb-3 opacity-20" />
            <p>Sonuç bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const groups = {};
              filtered.forEach(q => {
                const d = new Date(q.created_at || q.issue_date).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });
                if (!groups[d]) groups[d] = [];
                groups[d].push(q);
              });
              const sortedDates = Object.keys(groups).sort((a, b) => new Date(groups[b][0].created_at || groups[b][0].issue_date) - new Date(groups[a][0].created_at || groups[a][0].issue_date));
              return sortedDates.map((date, idx) => (
                <DateGroup key={date} date={date} quotes={groups[date]} isInitiallyExpanded={idx === 0 && !search}
                  isDark={isDark} c={c} currentColor={currentColor} onEdit={id => { setEditId(id); setView('form'); }}
                  onDelete={deleteQuote} onPreview={setPreviewQ} onStatusUpdate={updateStatus} onAccept={setAcceptModal} />
              ));
            })()}
          </div>
        )}
      </motion.div>

      {previewQ && <QuotePreview quote={previewQ} onClose={() => setPreviewQ(null)} />}

      {acceptModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Teklifi Onayla</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <strong className="text-gray-700">{acceptModal.company_name}</strong> adlı müşteriye ait teklif kabul edilecek ve sipariş formuna aktarılacak.
            </p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => handleAccept(acceptModal)} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm">
                Onayla ve Siparişe Geç
              </button>
              <button onClick={() => setAcceptModal(null)} className="w-full py-2.5 text-gray-400 text-sm font-medium">İptal Et</button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>

      <CustomDialog {...dialog} onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog({ ...dialog, open: false })} />
    </>
  );
}
