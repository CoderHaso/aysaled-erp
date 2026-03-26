import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Hazır Tema Paletleri ────────────────────────────────────────────────────
export const THEME_PRESETS = {
  ocean: {
    label: 'Okyanus',
    emoji: '🌊',
    primary: '#0284c7',
    primaryLight: '#38bdf8',
    primaryDark: '#075985',
  },
  forest: {
    label: 'Orman',
    emoji: '🌿',
    primary: '#16a34a',
    primaryLight: '#4ade80',
    primaryDark: '#14532d',
  },
  sunset: {
    label: 'Gün Batımı',
    emoji: '🌅',
    primary: '#ea580c',
    primaryLight: '#fb923c',
    primaryDark: '#7c2d12',
  },
  violet: {
    label: 'Mor',
    emoji: '💜',
    primary: '#7c3aed',
    primaryLight: '#a78bfa',
    primaryDark: '#4c1d95',
  },
  rose: {
    label: 'Gül',
    emoji: '🌸',
    primary: '#e11d48',
    primaryLight: '#fb7185',
    primaryDark: '#881337',
  },
  midnight: {
    label: 'Gece Yarısı',
    emoji: '🌑',
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#312e81',
  },
  amber: {
    label: 'Kehribar',
    emoji: '🍯',
    primary: '#d97706',
    primaryLight: '#fbbf24',
    primaryDark: '#78350f',
  },
  custom: {
    label: 'Özel',
    emoji: '🎨',
    primary: '#0284c7',
    primaryLight: '#38bdf8',
    primaryDark: '#075985',
  },
};

// ─── CSS Değişkenlerini DOM'a Uygula ─────────────────────────────────────────
function applyTheme({ mode, preset, customColor }) {
  const root = document.documentElement;
  const p = preset === 'custom'
    ? { primary: customColor, primaryLight: customColor, primaryDark: customColor }
    : THEME_PRESETS[preset] || THEME_PRESETS.ocean;

  // Renk değişkenleri
  root.style.setProperty('--color-primary',       p.primary);
  root.style.setProperty('--color-primary-light', p.primaryLight);
  root.style.setProperty('--color-primary-dark',  p.primaryDark);

  // Dark/light mod
  if (mode === 'dark') {
    root.classList.add('dark');
    root.style.setProperty('--bg-app',       '#0f172a');
    root.style.setProperty('--bg-card',      'rgba(30,41,59,0.85)');
    root.style.setProperty('--bg-sidebar',   '#1e293b');
    root.style.setProperty('--bg-header',    'rgba(15,23,42,0.85)');
    root.style.setProperty('--text-base',    '#f1f5f9');
    root.style.setProperty('--text-muted',   '#94a3b8');
    root.style.setProperty('--border',       'rgba(148,163,184,0.12)');
    root.style.setProperty('--input-bg',     '#1e293b');
  } else {
    root.classList.remove('dark');
    root.style.setProperty('--bg-app',       '#f8fafc');
    root.style.setProperty('--bg-card',      'rgba(255,255,255,0.85)');
    root.style.setProperty('--bg-sidebar',   '#1e293b');
    root.style.setProperty('--bg-header',    'rgba(255,255,255,0.85)');
    root.style.setProperty('--text-base',    '#0f172a');
    root.style.setProperty('--text-muted',   '#64748b');
    root.style.setProperty('--border',       '#e2e8f0');
    root.style.setProperty('--input-bg',     '#ffffff');
  }

  // Meta theme-color güncelle (PWA için)
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', p.primary);
}

// ─── Context ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

const STORAGE_KEY = 'aerp_theme';

const DEFAULT_THEME = {
  mode: 'light',            // 'light' | 'dark' | 'system'
  preset: 'ocean',          // preset key
  customColor: '#0284c7',   // custom renk (preset==='custom' ise)
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_THEME, ...JSON.parse(saved) } : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  // System preference detection
  const getEffectiveMode = useCallback((mode) => {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }, []);

  useEffect(() => {
    const effective = { ...theme, mode: getEffectiveMode(theme.mode) };
    applyTheme(effective);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme, getEffectiveMode]);

  // System preference değişince otomatik güncelle
  useEffect(() => {
    if (theme.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme({ ...theme, mode: mq.matches ? 'dark' : 'light' });
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setMode = useCallback((mode) => {
    setThemeState(prev => ({ ...prev, mode }));
  }, []);

  const setPreset = useCallback((preset) => {
    setThemeState(prev => ({ ...prev, preset }));
  }, []);

  const setCustomColor = useCallback((color) => {
    setThemeState(prev => ({ ...prev, preset: 'custom', customColor: color }));
  }, []);

  const reset = useCallback(() => {
    setThemeState(DEFAULT_THEME);
  }, []);

  const value = {
    theme,
    effectiveMode: getEffectiveMode(theme.mode),
    setMode,
    setPreset,
    setCustomColor,
    reset,
    presets: THEME_PRESETS,
    currentColor: theme.preset === 'custom'
      ? theme.customColor
      : (THEME_PRESETS[theme.preset]?.primary || '#0284c7'),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
