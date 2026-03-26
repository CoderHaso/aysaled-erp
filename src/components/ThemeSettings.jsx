import React, { useState } from 'react';
import { useTheme, THEME_PRESETS } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor, Check, RotateCcw, Palette, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MODES = [
  { key: 'light',  label: 'Aydınlık', icon: Sun },
  { key: 'dark',   label: 'Karanlık', icon: Moon },
  { key: 'system', label: 'Sistem',   icon: Monitor },
];

export default function ThemeSettings({ onClose }) {
  const { theme, effectiveMode, setMode, setPreset, setCustomColor, reset, currentColor } = useTheme();
  const [tab, setTab] = useState('theme'); // 'theme' | 'color'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.18 }}
      className="theme-panel"
    >
      {/* Header */}
      <div className="theme-panel-header">
        <div className="flex items-center gap-2">
          <Palette size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="font-bold text-base" style={{ color: 'var(--text-base)' }}>
            Tema Ayarları
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="theme-close-btn">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="theme-tabs">
        {['theme', 'color'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`theme-tab ${tab === t ? 'active' : ''}`}
          >
            {t === 'theme' ? 'Mod' : 'Renk'}
          </button>
        ))}
      </div>

      <div className="theme-body">
        {/* Mode Tab */}
        {tab === 'theme' && (
          <div className="space-y-3">
            <p className="theme-label">Görünüm Modu</p>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`mode-btn ${theme.mode === key ? 'active' : ''}`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium">{label}</span>
                  {theme.mode === key && (
                    <div className="mode-check">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="theme-preview">
              <span className="theme-label">Önizleme</span>
              <div className={`preview-box ${effectiveMode}`}>
                <div className="preview-sidebar" />
                <div className="preview-content">
                  <div className="preview-bar" style={{ backgroundColor: `var(--color-primary)` }} />
                  <div className="preview-cards">
                    <div className="preview-card" />
                    <div className="preview-card" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color Tab */}
        {tab === 'color' && (
          <div className="space-y-4">
            <p className="theme-label">Hazır Paletler</p>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEME_PRESETS).filter(([k]) => k !== 'custom').map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={`palette-btn ${theme.preset === key ? 'active' : ''}`}
                  title={p.label}
                >
                  <div className="palette-circle" style={{ background: p.primary }} />
                  <span className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                    {p.emoji} {p.label}
                  </span>
                  {theme.preset === key && (
                    <div className="palette-check" style={{ background: p.primary }}>
                      <Check size={8} strokeWidth={3} color="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <p className="theme-label mb-2">🎨 Özel Renk</p>
              <div className="custom-color-row">
                <input
                  type="color"
                  value={theme.preset === 'custom' ? theme.customColor : currentColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="color-picker"
                />
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {theme.preset === 'custom' ? theme.customColor : currentColor}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="theme-footer">
        <button onClick={reset} className="theme-reset-btn">
          <RotateCcw size={13} />
          <span>Sıfırla</span>
        </button>
        <div className="theme-current">
          <div className="current-dot" style={{ background: currentColor }} />
          <span style={{ color: 'var(--text-muted)' }}>
            {THEME_PRESETS[theme.preset]?.label || 'Özel'} · {effectiveMode === 'dark' ? '🌙' : '☀️'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
