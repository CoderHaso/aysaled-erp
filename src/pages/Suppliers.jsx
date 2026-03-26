import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Building2, Phone, Mail, Pencil, Trash2, Check, X, RefreshCcw, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSuppliers } from '../hooks/useSuppliers';

export default function Suppliers() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const { suppliers, loading, saving, add, update, remove, refetch } = useSuppliers();

  const [search,       setSearch]       = useState('');
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [newForm,      setNewForm]      = useState({ name: '', phone: '', email: '', address: '', notes: '', tax_id: '' });
  const [editId,       setEditId]       = useState(null);
  const [editData,     setEditData]     = useState({});
  const [toast,        setToast]        = useState(null);

  const c = {
    bg:       isDark ? '#0f172a' : '#f8fafc',
    card:     isDark ? 'rgba(30,41,59,0.9)' : '#ffffff',
    border:   isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#64748b',
    inputBg:  isDark ? 'rgba(30,41,59,0.8)' : '#f8fafc',
    rowHover: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const FORM_FIELDS = [
    { k: 'name',    l: 'Tedarikçi Adı *', ph: 'Ledim, Meanwell, Aluplast...' },
    { k: 'tax_id',  l: 'Vergi No',        ph: '1234567890'    },
    { k: 'phone',   l: 'Telefon',         ph: '0212 000 00 00' },
    { k: 'email',   l: 'E-posta',         ph: 'info@firma.com' },
    { k: 'address', l: 'Adres',           ph: 'İstanbul, Türkiye' },
    { k: 'notes',   l: 'Notlar',          ph: 'Ek bilgi...'    },
  ];

  const handleAdd = async () => {
    if (!newForm.name.trim()) return;
    try {
      await add(newForm);
      setNewForm({ name: '', phone: '', email: '', address: '', notes: '', tax_id: '' });
      setShowAddForm(false);
      showToast('Tedarikçi eklendi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleUpdate = async (id) => {
    try {
      await update(id, editData);
      setEditId(null);
      showToast('Güncellendi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`"${s.name}" silinsin mi?`)) return;
    try {
      await remove(s.id);
      showToast('Tedarikçi silindi ✓');
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">

      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: c.text }}>Tedarikçiler</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: c.muted }}>
            {suppliers.length} tedarikçi kayıtlı
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch}
            className="p-2 rounded-xl border transition-all"
            style={{ borderColor: c.border, color: c.muted, background: c.inputBg }}>
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowAddForm(v => !v)}
            className="btn-primary text-sm">
            <Plus size={15} />
            <span className="hidden sm:inline">Tedarikçi Ekle</span>
            <span className="sm:hidden">Ekle</span>
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Toplam',   value: suppliers.length,                                   color: currentColor, icon: '🏢' },
          { label: 'Aktif',    value: suppliers.filter(s => s.email || s.phone).length,   color: '#10b981',    icon: '✓'  },
          { label: 'Eksik',    value: suppliers.filter(s => !s.email && !s.phone).length, color: '#f59e0b',    icon: '⚠'  },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold" style={{ color: c.muted }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Yeni tedarikçi formu */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="rounded-2xl p-4 sm:p-5 space-y-4"
              style={{ background: c.card, border: `1.5px solid ${currentColor}`, boxShadow: `0 0 0 3px ${currentColor}15` }}>
              <p className="text-sm font-bold" style={{ color: c.text }}>Yeni Tedarikçi</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FORM_FIELDS.map(({ k, l, ph }) => (
                  <div key={k} className={k === 'notes' ? 'sm:col-span-2' : ''}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: c.muted }}>{l}</p>
                    {k === 'notes'
                      ? <textarea className="modal-input" rows={2} placeholder={ph}
                          value={newForm[k] || ''} onChange={e => setNewForm(f => ({ ...f, [k]: e.target.value }))} />
                      : <input className="modal-input" placeholder={ph}
                          value={newForm[k] || ''} onChange={e => setNewForm(f => ({ ...f, [k]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && k === 'name' && handleAdd()} />
                    }
                  </div>
                ))}
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                <button onClick={() => setShowAddForm(false)}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: c.border, color: c.muted }}>
                  İptal
                </button>
                <button onClick={handleAdd} disabled={saving}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: currentColor }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Kaydet
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arama */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
        style={{ background: c.card, borderColor: c.border }}>
        <Search size={15} style={{ color: c.muted }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Ad, e-posta veya telefon ara..."
          className="bg-transparent border-none outline-none text-sm flex-1"
          style={{ color: c.text }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ color: c.muted }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="rounded-2xl overflow-hidden" style={{ background: c.card, border: `1px solid ${c.border}` }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: c.muted }}>
            <RefreshCcw size={20} className="animate-spin" style={{ color: currentColor }} />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: c.muted }}>
            <Building2 size={40} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">{search ? 'Sonuç bulunamadı' : 'Henüz tedarikçi eklenmemiş'}</p>
            {!search && (
              <button onClick={() => setShowAddForm(true)}
                className="mt-3 btn-primary text-xs px-4 py-2">
                + İlk Tedarikçiyi Ekle
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop tablo */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                    {['Tedarikçi', 'Vergi No', 'Telefon', 'E-posta', 'Adres', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: c.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const isEditing = editId === s.id;
                    return (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${c.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {isEditing ? (
                          <>
                            {['name','tax_id','phone','email','address'].map(k => (
                              <td key={k} className="px-3 py-2">
                                <input className="modal-input"
                                  style={{ padding: '5px 8px', fontSize: '12px' }}
                                  value={editData[k] || ''}
                                  onChange={e => setEditData(d => ({ ...d, [k]: e.target.value }))} />
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button onClick={() => handleUpdate(s.id)} className="p-1.5 rounded-lg" style={{ color: '#10b981' }}><Check size={14} /></button>
                                <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg" style={{ color: c.muted }}><X size={14} /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ background: currentColor }}>
                                  {s.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold" style={{ color: c.text }}>{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5"><span className="text-xs font-mono" style={{ color: c.muted }}>{s.tax_id || '—'}</span></td>
                            <td className="px-4 py-3.5">
                              {s.phone ? (
                                <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: c.muted }}>
                                  <Phone size={11} />{s.phone}
                                </a>
                              ) : <span style={{ color: c.muted }}>—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              {s.email ? (
                                <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: c.muted }}>
                                  <Mail size={11} />{s.email}
                                </a>
                              ) : <span style={{ color: c.muted }}>—</span>}
                            </td>
                            <td className="px-4 py-3.5"><span className="text-xs" style={{ color: c.muted }}>{s.address || '—'}</span></td>
                            <td className="px-4 py-3.5">
                              <div className="flex gap-1">
                                <button onClick={() => { setEditId(s.id); setEditData({ name: s.name, tax_id: s.tax_id||'', phone: s.phone||'', email: s.email||'', address: s.address||'' }); }}
                                  className="p-1.5 rounded-lg transition-all" style={{ color: currentColor }}
                                  onMouseEnter={e => e.currentTarget.style.background = `${currentColor}20`}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDelete(s)}
                                  className="p-1.5 rounded-lg transition-all" style={{ color: '#ef4444' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#ef444420'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobil kart listesi */}
            <div className="md:hidden divide-y" style={{ borderColor: c.border }}>
              {filtered.map(s => (
                <div key={s.id} className="p-4 flex items-start gap-3"
                  style={{ borderBottom: `1px solid ${c.border}` }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: currentColor }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: c.text }}>{s.name}</p>
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs mt-1" style={{ color: c.muted }}>
                        <Phone size={10} />{s.phone}
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="flex items-center gap-1 text-xs mt-0.5" style={{ color: c.muted }}>
                        <Mail size={10} />{s.email}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditId(s.id); setEditData({ name: s.name, tax_id: s.tax_id||'', phone: s.phone||'', email: s.email||'', address: s.address||'' }); }}
                      className="p-2 rounded-lg" style={{ color: currentColor, background: `${currentColor}15` }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(s)}
                      className="p-2 rounded-lg" style={{ color: '#ef4444', background: '#ef444415' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t text-xs" style={{ borderColor: c.border, color: c.muted }}>
              {filtered.length} / {suppliers.length} tedarikçi gösteriliyor
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[300] px-5 py-3 rounded-2xl shadow-xl text-white font-semibold text-sm"
            style={{ background: toast.type === 'error' ? '#ef4444' : currentColor }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
