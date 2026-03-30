import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, FileText, Loader2, Trash2, Eye, Edit3,
  CheckCircle2, Clock, XCircle, Send, RefreshCw, FileMinus
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import QuoteForm, { QuotePreview } from './QuoteForm';

const STATUS = {
  draft:    { label: 'Taslak',        color: '#94a3b8', icon: Clock },
  sent:     { label: 'Gönderildi',    color: '#3b82f6', icon: Send },
  accepted: { label: 'Kabul Edildi',  color: '#10b981', icon: CheckCircle2 },
  rejected: { label: 'Reddedildi',    color: '#ef4444', icon: XCircle },
};

const fmt  = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
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

export default function Quotes() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [quotes, setQuotes]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView]         = useState('list'); // 'list' | 'form'
  const [editId, setEditId]     = useState(null);
  const [previewQ, setPreviewQ] = useState(null);
  const [acceptModal, setAcceptModal] = useState(null);
  const [toast, setToast]       = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const updateStatus = async (id, status) => {
    await fetch(`/api/quotes?id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    showToast('Durum güncellendi');
    load();
  };

  const handleAccept = async (q, createInvoice) => {
    try {
      await fetch(`/api/quotes?id=${q.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'accepted' }) });
      if (createInvoice && q.line_items) {
        const createForm = {
          type: 'outbox',
          cari_name: q.company_name || 'Bilinmeyen Müşteri',
          vkntckn: '',
          issue_date: new Date().toISOString().slice(0, 10),
          currency: q.currency || 'TRY',
          notes: q.notes || '',
          lines: q.line_items.map(l => ({
            name: l.name,
            quantity: Number(l.quantity || 1),
            unit: l.unit || 'Adet',
            unitPrice: Number(l.unit_price || 0),
            taxRate: Number(q.vat_rate || 20),
            total: Number(l.total || 0)
          }))
        };
        await fetch('/api/invoices-api?action=create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
        showToast('Teklif onaylandı ve taslak fatura oluşturuldu!');
      } else {
        showToast('Teklif başarıyla onaylandı.');
      }
      setAcceptModal(null);
      load();
    } catch (e) { alert('Hata: ' + e.message); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteQuote = async (id, no) => {
    if (!window.confirm(`"${no}" silinsin mi?`)) return;
    await fetch(`/api/quotes?id=${id}`, { method: 'DELETE' });
    showToast('Teklif silindi');
    load();
  };

  const filtered = quotes.filter(q => {
    const matchSearch = !search ||
      (q.quote_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.company_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // İstatistikler
  const stats = {
    total:    quotes.length,
    draft:    quotes.filter(q => q.status === 'draft').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalValue: quotes.filter(q => q.status !== 'rejected').reduce((s, q) => s + Number(q.grand_total || 0), 0),
  };

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
  };

  // Teklif formu aç/kapat
  if (view === 'form') {
    return (
      <QuoteForm
        quoteId={editId}
        onBack={() => { setView('list'); setEditId(null); load(); }}
        onSaved={(q) => { showToast(`${q.quote_no} kaydedildi ✓`); setView('list'); setEditId(null); load(); }}
      />
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: c.text }}>Teklifler</h1>
            <p className="text-sm mt-0.5" style={{ color: c.muted }}>{quotes.length} teklif · Aktif yönetim</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <RefreshCw size={16} className="text-slate-400" />
            </button>
            <button onClick={() => { setEditId(null); setView('form'); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg"
              style={{ background: `linear-gradient(135deg, #1a6b2c, #22863a)` }}>
              <Plus size={16} /> Yeni Teklif
            </button>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Toplam Teklif', value: stats.total,    color: '#6366f1' },
            { label: 'Taslak',        value: stats.draft,    color: '#94a3b8' },
            { label: 'Kabul Edildi',  value: stats.accepted, color: '#10b981' },
            { label: 'Toplam Değer',  value: `${fmt(stats.totalValue)} ₺`, color: '#1a6b2c', isText: true },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <p className="text-xs font-medium mb-1" style={{ color: c.muted }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.isText ? s.color : c.text }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Teklif no veya müşteri ara..."
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}` }} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[['all', 'Tümü'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} onClick={() => setStatusFilter(k)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: statusFilter === k ? currentColor : 'rgba(255,255,255,0.06)',
                  color: statusFilter === k ? '#fff' : c.muted,
                }}>
                {l}
              </button>
            ))}
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
            <p>{search || statusFilter !== 'all' ? 'Sonuç bulunamadı' : 'Henüz teklif oluşturulmadı'}</p>
            {!search && statusFilter === 'all' && (
              <button onClick={() => { setEditId(null); setView('form'); }}
                className="mt-4 px-5 py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background: '#1a6b2c' }}>
                İlk Teklifi Oluştur
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
            {/* Tablo header */}
            <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold"
              style={{ color: c.muted, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderBottom: `1px solid ${c.border}` }}>
              <div className="col-span-2">Teklif No</div>
              <div className="col-span-3">Müşteri</div>
              <div className="col-span-2">Tarih</div>
              <div className="col-span-1">Durum</div>
              <div className="col-span-1 text-right">Tutar</div>
              <div className="col-span-3" />
            </div>
            {filtered.map((q, i) => (
              <motion.div key={q.id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-12 px-5 py-4 items-center border-b last:border-b-0 group hover:bg-white/5 transition-colors"
                style={{ borderColor: c.border }}>
                <div className="col-span-2">
                  <p className="text-sm font-bold font-mono" style={{ color: '#22863a' }}>{q.quote_no}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm font-medium" style={{ color: c.text }}>{q.company_name || '-'}</p>
                  <p className="text-[11px]" style={{ color: c.muted }}>{q.contact_person || ''}</p>
                </div>
                <div className="col-span-2 text-sm" style={{ color: c.muted }}>{fmtD(q.issue_date)}</div>
                <div className="col-span-1"><StatusBadge status={q.status} /></div>
                <div className="col-span-1 text-right">
                  <p className="text-sm font-bold" style={{ color: c.text }}>{fmt(q.grand_total)}</p>
                  <p className="text-[10px]" style={{ color: c.muted }}>{q.currency}</p>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Hızlı İşlemler */}
                  {q.status === 'draft' && (
                    <button onClick={() => updateStatus(q.id, 'sent')} title="Gönderildi Olarak İşaretle"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                      <Send size={15} />
                    </button>
                  )}
                  {(q.status === 'draft' || q.status === 'sent') && (
                    <>
                      <button onClick={() => setAcceptModal(q)} title="Onayla / Satışa Aktar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">
                        <CheckCircle2 size={15} />
                      </button>
                      <button onClick={() => updateStatus(q.id, 'rejected')} title="Reddet"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <XCircle size={15} />
                      </button>
                    </>
                  )}

                  <div className="w-[1px] h-4 bg-slate-200 mx-1" />

                  <button onClick={() => setPreviewQ(q)} title="Önizle / Yazdır"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => { setEditId(q.id); setView('form'); }} title="Düzenle"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => deleteQuote(q.id, q.quote_no)} title="Sil"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Önizleme */}
      {previewQ && <QuotePreview quote={previewQ} onClose={() => setPreviewQ(null)} />}

      {/* Onay Modal */}
      {acceptModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Teklifi Onayla</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <strong className="text-gray-700">{acceptModal.company_name}</strong> adlı müşteriye ait teklif <span className="text-emerald-600 font-semibold mb-1">Kabul Edildi</span> aşamasına taşınacak. Satış işlemlerini hızlandırmak için giden faturayı <strong className="text-gray-700">Taslak</strong> olarak oluşturmak ister misiniz?
            </p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => handleAccept(acceptModal, true)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
                <FileMinus size={15} /> Onayla ve Fatura Taslağı Oluştur
              </button>
              <button onClick={() => handleAccept(acceptModal, false)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Gerek Yok, Sadece Onayla
              </button>
              <button onClick={() => setAcceptModal(null)}
                className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 mt-2 transition-colors">
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}
