import React, { useState } from 'react';
import {
  LayoutDashboard, Package, Users, FileDown, FileUp,
  ShoppingCart, TrendingUp, Settings, Palette, Building2,
  FileText, Image
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';
import ThemeSettings from './ThemeSettings';

const MENU = [
  { name: 'Dashboard',    icon: LayoutDashboard, id: 'dashboard' },
  { name: 'Stok',         icon: Package,         id: 'stock'     },
  { name: 'Tedarikçiler', icon: Building2,       id: 'suppliers' },
  { name: 'Cariler',      icon: Users,           id: 'contacts'  },
  { name: 'Gelir Fat.',   icon: FileDown,        id: 'incoming-invoices' },
  { name: 'Gider Fat.',   icon: FileUp,          id: 'outgoing-invoices' },
  { name: 'Satış',        icon: ShoppingCart,    id: 'sales'     },
  { name: 'Teklifler',    icon: FileText,        id: 'quotes'    },
  { name: 'Medya',        icon: Image,           id: 'media'     },
  { name: 'Raporlar',     icon: TrendingUp,      id: 'reports'   },
];

export default function Sidebar({ isOpen, toggle, activeId = 'dashboard', onNavigate }) {
  const { effectiveMode, currentColor, theme } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [themeOpen, setThemeOpen] = useState(false);

  // CSS değişkenlerini sidebar genişliğine göre set et
  const sidebarWidth     = isOpen ? 260 : 72;
  const mobileSidebarShow = isOpen;

  return (
    <>
      <aside
        style={{ background: 'var(--bg-sidebar)', width: `${sidebarWidth}px` }}
        className={`
          fixed top-0 left-0 h-full z-50
          flex flex-col
          transition-all duration-300
          ${mobileSidebarShow ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${currentColor}, ${currentColor}cc)` }}
          >
            <TrendingUp size={20} color="white" />
          </div>
          {isOpen && (
            <div className="overflow-hidden">
              <span className="text-white font-bold text-base tracking-tight block leading-none">A-ERP</span>
              <span className="text-slate-400 text-[10px]">Pro v1.0</span>
            </div>
          )}
        </div>

        {/* Nav (scroll varsa içeride) */}
        <nav className="flex-1 px-2 space-y-0.5 mt-1 overflow-y-auto custom-scrollbar">
          {MENU.map(({ name, icon: Icon, id }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate?.(id)}
                className="nav-link relative w-full"
                style={active ? {
                  background: `color-mix(in srgb, ${currentColor} 18%, transparent)`,
                  color: 'var(--color-primary-light)',
                } : {}}
              >
                <Icon size={19} className="shrink-0" />
                {isOpen && <span className="truncate">{name}</span>}
                {active && !isOpen && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                    style={{ background: currentColor }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Alt: Tema + Ayarlar + Kullanıcı */}
        <div className="flex-shrink-0 p-2 space-y-1 border-t" style={{ borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)' }}>
          {/* Tema */}
          <div className="relative">
            <button
              onClick={() => setThemeOpen(v => !v)}
              className="nav-link w-full"
              style={themeOpen ? { background: `color-mix(in srgb, ${currentColor} 15%, transparent)`, color: 'var(--color-primary-light)' } : {}}
            >
              <Palette size={19} className="shrink-0" />
              {isOpen && <span>Tema</span>}
              {isOpen && (
                <div className="ml-auto w-3.5 h-3.5 rounded-full border-2 border-slate-600 flex-shrink-0"
                  style={{ background: currentColor }} />
              )}
            </button>
            <AnimatePresence>
              {themeOpen && <ThemeSettings onClose={() => setThemeOpen(false)} />}
            </AnimatePresence>
          </div>

          {/* Settings */}
          <button onClick={() => onNavigate?.('settings')}
            className="nav-link w-full"
            style={activeId === 'settings' ? { background: `color-mix(in srgb, ${currentColor} 18%, transparent)`, color: 'var(--color-primary-light)' } : {}}>
            <Settings size={19} className="shrink-0" />
            {isOpen && <span>Ayarlar</span>}
          </button>

          {/* User */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm"
              style={{ background: currentColor }}>
              E
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-white text-sm font-semibold leading-none truncate">Efe Han</p>
                <p className="text-slate-400 text-[10px] mt-0.5">Admin</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobil overlay — sidebar açıkken tıklayınca kapanır */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm lg:hidden z-40"
          onClick={toggle}
        />
      )}
    </>
  );
}
