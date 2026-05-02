import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { useSuppliers } from '../../hooks/useSuppliers';
import { trNorm } from '../../lib/trNorm';

/**
 * Tedarikçi autocomplete input.
 * Yazınca mevcut tedarikçileri listeler.
 * Bulunamazsa "+ Hızlı Ekle" butonu çıkar.
 */
export default function SupplierAutocomplete({ value, onChange }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const { suppliers, saving, add } = useSuppliers();

  const [inputVal,   setInputVal]   = useState(value || '');
  const [open,       setOpen]       = useState(false);
  const [quickModal, setQuickModal] = useState(false);
  const [newForm,    setNewForm]    = useState({ name: '', phone: '', email: '' });
  const ref = useRef(null);

  // Dış tıklama
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Üst bileşenden değer güncellemesi
  useEffect(() => { setInputVal(value || ''); }, [value]);

  const filtered = suppliers.filter(s =>
    trNorm(s.name).includes(trNorm(inputVal))
  );
  const exactMatch = suppliers.some(s => trNorm(s.name) === trNorm(inputVal));

  const border  = isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#94a3b8' : '#64748b';
  const menuBg  = isDark ? '#1e293b' : '#fff';
  const hover   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const handleSelect = (name) => {
    setInputVal(name);
    onChange(name);
    setOpen(false);
  };

  const handleQuickSave = async () => {
    if (!newForm.name.trim()) return;
    await add({ name: newForm.name.trim(), phone: newForm.phone, email: newForm.email });
    handleSelect(newForm.name.trim());
    setQuickModal(false);
    setNewForm({ name: '', phone: '', email: '' });
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex gap-2">
        <input
          className="modal-input flex-1"
          value={inputVal}
          placeholder="Tedarikçi adı..."
          onChange={e => { setInputVal(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {/* Hızlı ekleme butonu */}
        <button
          type="button"
          onClick={() => { setNewForm({ name: inputVal, phone: '', email: '' }); setQuickModal(true); }}
          title="Yeni tedarikçi ekle"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all flex-shrink-0"
          style={{
            borderColor: currentColor,
            color: currentColor,
            background: `${currentColor}10`,
          }}>
          <Plus size={14} />
        </button>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && inputVal && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[200] w-full mt-1.5 rounded-xl overflow-hidden shadow-xl"
            style={{ background: menuBg, border: `1.5px solid ${border}` }}>
            <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
              {filtered.map(s => (
                <button key={s.id} type="button" onClick={() => handleSelect(s.name)}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                  style={{ color: text }}
                  onMouseEnter={e => e.currentTarget.style.background = hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span className="font-semibold">{s.name}</span>
                  {s.phone && <span className="ml-2 text-xs" style={{ color: muted }}>{s.phone}</span>}
                </button>
              ))}
              {!exactMatch && inputVal && (
                <button type="button"
                  onClick={() => { setNewForm({ name: inputVal, phone: '', email: '' }); setQuickModal(true); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-t transition-colors"
                  style={{ borderColor: border, color: currentColor }}
                  onMouseEnter={e => e.currentTarget.style.background = `${currentColor}10`}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Plus size={14} />
                  "{inputVal}" → Hızlı Tedarikçi Ekle
                </button>
              )}
              {filtered.length === 0 && exactMatch === false && !inputVal && (
                <p className="px-4 py-3 text-xs" style={{ color: muted }}>Tedarikçi yok.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hızlı Tedarikçi Ekleme Modalı */}
      <AnimatePresence>
        {quickModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.45)' }}
            onClick={() => setQuickModal(false)}>
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: menuBg, border: `1px solid ${border}` }}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: border }}>
                <span className="font-bold text-sm" style={{ color: text }}>Hızlı Tedarikçi Ekle</span>
                <button onClick={() => setQuickModal(false)} style={{ color: muted }}><X size={16} /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { key: 'name',  label: 'Tedarikçi Adı *', ph: 'Ledim, Meanwell...' },
                  { key: 'phone', label: 'Telefon',          ph: '0212 000 00 00'    },
                  { key: 'email', label: 'E-posta',          ph: 'info@firma.com'    },
                ].map(({ key, label, ph }) => (
                  <div key={key}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: muted }}>{label}</p>
                    <input className="modal-input" placeholder={ph}
                      value={newForm[key]} onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 px-5 pb-5">
                <button onClick={() => setQuickModal(false)}
                  className="flex-1 py-2 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: border, color: muted }}>
                  İptal
                </button>
                <button onClick={handleQuickSave} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: currentColor }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Ekle
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
