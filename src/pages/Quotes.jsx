import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, FileText, Loader2, Trash2, Eye, Edit3,
  CheckCircle2, Clock, XCircle, Send, RefreshCw, FileMinus, Calendar, X
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
      // Satış ekranına yönlendir — teklif durumunu henüz değiştirme.
      // Kullanıcı sipariş oluşturursa -> accepted, iptal ederse -> orijinal durum kalır.
      navigate('/sales', {
        state: {
          createFromQuote: q,
          quoteOriginalStatus: q.status, // geri dönüş için
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

  // İstatistikler
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

  // Teklif formu aç/kapat
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

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
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}` }} />
          </div>
          <div className="flex gap-1.5 flex-wrap overflow-x-auto">
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
          {/* Tarih Filtresi — mobilde gizle */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}` }}>
              <Calendar size={11} style={{ color: c.muted }} />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent text-[11px] outline-none" style={{ color: c.text }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color: c.muted }}>—</span>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}` }}>
              <Calendar size={11} style={{ color: c.muted }} />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-transparent text-[11px] outline-none" style={{ color: c.text }} />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="p-1.5 rounded-lg" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                <X size={11} />
              </button>
            )}
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
          <>
            {/* ── Desktop: Tablo görünümü ── */}
            <div className="hidden sm:block rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
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
                  <div className="col-span-3 flex items-center justify-end gap-1">
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

            {/* ── Mobil: Kart görünümü ── */}
            <div className="sm:hidden space-y-3">
              {filtered.map((q, i) => (
                <motion.div key={q.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: c.card, border: `1px solid ${c.border}` }}>
                  {/* Üst: No + Durum + Tutar */}
                  <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                    <div className="flex items-center gap-2.5">
                      <p className="text-sm font-bold font-mono" style={{ color: '#22863a' }}>{q.quote_no}</p>
                      <StatusBadge status={q.status} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: c.text }}>{fmt(q.grand_total)}</p>
                      <p className="text-[10px]" style={{ color: c.muted }}>{q.currency}</p>
                    </div>
                  </div>
                  {/* Orta: Müşteri + Tarih */}
                  <div className="px-4 pb-2.5">
                    <p className="text-sm font-medium" style={{ color: c.text }}>{q.company_name || '-'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {q.contact_person && <p className="text-[11px]" style={{ color: c.muted }}>{q.contact_person}</p>}
                      <p className="text-[11px]" style={{ color: c.muted }}>
                        <Calendar size={10} className="inline mr-1" />{fmtD(q.issue_date)}
                      </p>
                    </div>
                  </div>
                  {/* Alt: Aksiyon butonları */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-t" style={{ borderColor: c.border, background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                    <div className="flex items-center gap-0.5">
                      {q.status === 'draft' && (
                        <button onClick={() => updateStatus(q.id, 'sent')}
                          className="p-2 rounded-lg" style={{ color: '#3b82f6' }}>
                          <Send size={16} />
                        </button>
                      )}
                      {(q.status === 'draft' || q.status === 'sent') && (
                        <>
                          <button onClick={() => setAcceptModal(q)}
                            className="p-2 rounded-lg" style={{ color: '#10b981' }}>
                            <CheckCircle2 size={16} />
                          </button>
                          <button onClick={() => updateStatus(q.id, 'rejected')}
                            className="p-2 rounded-lg" style={{ color: '#f59e0b' }}>
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setPreviewQ(q)}
                        className="p-2 rounded-lg" style={{ color: '#6366f1' }}>
                        <Eye size={16} />
                      </button>
                      <button onClick={() => { setEditId(q.id); setView('form'); }}
                        className="p-2 rounded-lg" style={{ color: c.muted }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => deleteQuote(q.id, q.quote_no)}
                        className="p-2 rounded-lg" style={{ color: '#ef4444' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
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
              <strong className="text-gray-700">{acceptModal.company_name}</strong> adlı müşteriye ait teklif <span className="text-emerald-600 font-semibold mb-1">Kabul Edildi</span> aşamasına taşınacak ve sipariş formuna aktarılacak.
            </p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => handleAccept(acceptModal)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
                <CheckCircle2 size={15} /> Onayla ve Siparişe Geç
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

      <CustomDialog
        {...dialog}
        onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm ? dialog.onConfirm : () => setDialog({ ...dialog, open: false })}
      />
    </>
  );
}
