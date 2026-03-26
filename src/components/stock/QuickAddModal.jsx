import React, { useState } from 'react';
import { X, Zap, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import Select from '../ui/Select';

const UNITS = ['pcs', 'adet', 'kg', 'm', 'lt', 'm²', 'm³', 'kutu', 'rulo'];

export default function QuickAddModal({ onClose, onSave, saving }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [form, setForm] = useState({
    name: '', item_type: 'raw', unit: 'pcs', stock_count: 0,
  });
  const [nameError, setNameError] = useState('');

  const bg     = isDark ? '#1e293b' : '#fff';
  const border = isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0';
  const text   = isDark ? '#f1f5f9' : '#0f172a';
  const muted  = isDark ? '#94a3b8' : '#64748b';

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (k === 'name') setNameError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setNameError('Ürün adı zorunlu'); return; }
    await onSave(form);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.4)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: border }}>
            <div className="flex items-center gap-2">
              <Zap size={18} style={{ color: currentColor }} />
              <span className="font-bold text-sm" style={{ color: text }}>Hızlı Ekle</span>
            </div>
            <button onClick={onClose} style={{ color: muted }}>
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Tip seçimi */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: muted }}>Tür</p>
              <div className="flex gap-2">
                {[
                  { v: 'raw',     label: '🔩 Hammadde' },
                  { v: 'product', label: '⚡ Mamül' },
                ].map(({ v, label }) => (
                  <button key={v} onClick={() => set('item_type', v)}
                    className="flex-1 py-2 rounded-xl text-sm font-bold border transition-all"
                    style={{
                      background:  form.item_type === v ? currentColor : 'var(--input-bg)',
                      color:       form.item_type === v ? 'white' : muted,
                      borderColor: form.item_type === v ? currentColor : border,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* İsim */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: muted }}>
                Ad *
              </p>
              <input
                autoFocus
                className="modal-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder={form.item_type === 'raw' ? 'Örn: LED Chip 24V 4K' : 'Örn: 150cm Lineer'}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                style={nameError ? { borderColor: '#ef4444' } : {}}
              />
              {nameError && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{nameError}</p>}
            </div>

            {/* Birim + Stok */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: muted }}>Birim</p>
                <Select value={form.unit} onChange={v => set('unit', v)} options={UNITS} size="sm" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: muted }}>Başlangıç Stok</p>
                <input
                  type="number" min="0"
                  className="modal-input"
                  value={form.stock_count}
                  onChange={e => set('stock_count', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-5 pb-5">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
              style={{ color: muted, borderColor: border }}>
              İptal
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: currentColor, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Ekleniyor...' : '+ Ekle'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
