import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Globally themed custom dropdown (Select).
 *
 * Props:
 *  value       – seçili değer (string)
 *  onChange    – fn(value) callback
 *  options     – string[] | { value, label, icon?, group? }[]
 *  placeholder – boş durum metni
 *  error       – hata mesajı (string) — kırmızı border
 *  disabled    – boolean
 *  size        – 'sm' | 'md' (default 'md')
 *  className   – ek CSS sınıfı
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = '— Seç —',
  error,
  disabled = false,
  size = 'md',
  className = '',
}) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [open, setOpen] = useState(false);
  const ref  = useRef(null);

  // Normalized options
  const normalized = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  const selected = normalized.find(o => o.value === value);

  // Dış tıklama ile kapat
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Klavye navigasyonu
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); }
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = normalized.findIndex(o => o.value === value);
      const next = normalized[idx + 1];
      if (next) onChange(next.value);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = normalized.findIndex(o => o.value === value);
      const prev = normalized[idx - 1];
      if (prev) onChange(prev.value);
    }
  }, [disabled, normalized, value, onChange]);

  // ── Renk token'ları ──────────────────────────────────────────────────────
  const colors = {
    triggerBg:  'var(--input-bg)',
    triggerBdr: error    ? '#ef4444'
               : open    ? currentColor
               : 'var(--border)',
    triggerShadow: open
      ? `0 0 0 3px color-mix(in srgb, ${currentColor} 18%, transparent)`
      : 'none',
    text:       value ? 'var(--text-base)' : 'var(--text-muted)',
    muted:      'var(--text-muted)',
    menuBg:     isDark ? '#1e293b' : '#ffffff',
    menuBorder: isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0',
    menuShadow: isDark
      ? '0 20px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)'
      : '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
    itemHover:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    itemActive: `color-mix(in srgb, ${currentColor} 14%, transparent)`,
  };

  const padding = size === 'sm' ? '0.45rem 0.75rem' : '0.68rem 0.95rem';
  const fontSize = size === 'sm' ? '0.8rem' : '0.875rem';

  return (
    <div ref={ref} className={`relative w-full ${className}`}>

      {/* ── Trigger buton ─────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 rounded-[0.875rem] border text-left transition-all"
        style={{
          background:  disabled ? 'var(--border)' : colors.triggerBg,
          borderColor: colors.triggerBdr,
          boxShadow:   colors.triggerShadow,
          color:       colors.text,
          padding,
          fontSize,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
        }}
      >
        <span className="truncate font-medium">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            color: colors.muted,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* ── Dropdown menü ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0,  scaleY: 1    }}
            exit={{    opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute z-[200] w-full mt-1.5 rounded-xl overflow-hidden"
            style={{
              background:     colors.menuBg,
              border:         `1.5px solid ${colors.menuBorder}`,
              boxShadow:      colors.menuShadow,
              transformOrigin:'top',
            }}
          >
            <div className="py-1.5 max-h-56 overflow-y-auto custom-scrollbar">
              {normalized.length === 0 && (
                <div className="px-4 py-3 text-sm" style={{ color: colors.muted }}>
                  Seçenek yok
                </div>
              )}
              {normalized.map((opt, i) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-left transition-colors"
                    style={{
                      background: isSelected ? colors.itemActive : 'transparent',
                      color:      isSelected ? currentColor : 'var(--text-base)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = colors.itemHover;
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {isSelected && (
                      <Check size={14} className="flex-shrink-0" style={{ color: currentColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hata mesajı */}
      {error && (
        <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  );
}
