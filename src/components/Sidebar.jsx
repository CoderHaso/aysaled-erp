import React, { useState } from 'react';
import { 
  LayoutDashboard, Package, Users, FileText,
  ShoppingCart, TrendingUp, Settings, Palette, X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';
import ThemeSettings from './ThemeSettings';

const MENU = [
  { name: 'Dashboard',      icon: LayoutDashboard, id: 'dashboard' },
  { name: 'Stok',           icon: Package,         id: 'stock' },
  { name: 'Cariler',        icon: Users,           id: 'contacts' },
  { name: 'Faturalar',      icon: FileText,        id: 'invoices' },
  { name: 'Satış',          icon: ShoppingCart,    id: 'sales' },
  { name: 'Raporlar',       icon: TrendingUp,      id: 'reports' },
];

export default function Sidebar({ isOpen, toggle, activeId = 'dashboard', onNavigate }) {
  const { effectiveMode, currentColor, theme } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);

  return (
    <>
      <aside
        style={{ background: 'var(--bg-sidebar)' }}
        className={`fixed top-0 left-0 h-full transition-all duration-300 z-50 overflow-visible
          ${isOpen ? 'w-[260px]' : 'w-0 lg:w-[72px]'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 overflow-hidden">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${currentColor}, ${theme.preset !== 'custom' ? 'var(--color-primary-dark)' : currentColor})`,
            }}
          >
            <TrendingUp size={22} color="white" />
          </div>
          {isOpen && (
            <div className="overflow-hidden">
              <span className="text-white font-bold text-lg tracking-tight block leading-none">A-ERP</span>
              <span className="text-slate-400 text-xs">Pro v1.0</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="px-2 space-y-0.5 mt-2">
          {MENU.map(({ name, icon: Icon, id }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate?.(id)}
                className="nav-link"
                style={active ? {
                  background: `color-mix(in srgb, ${currentColor} 18%, transparent)`,
                  color: 'var(--color-primary-light)',
                } : {}}
              >
                <Icon size={20} className="shrink-0" />
                {isOpen && <span>{name}</span>}
                {active && !isOpen && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ background: currentColor }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Tema + Kullanıcı */}
        <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
          {/* Tema butonu (ThemeSettings paneli açar) */}
          <div className="relative">
            <button
              onClick={() => setThemeOpen(v => !v)}
              className="nav-link"
              style={themeOpen ? {
                background: `color-mix(in srgb, ${currentColor} 15%, transparent)`,
                color: 'var(--color-primary-light)',
              } : {}}
            >
              <Palette size={20} className="shrink-0" />
              {isOpen && <span>Tema</span>}
              {isOpen && (
                <div
                  className="ml-auto w-4 h-4 rounded-full border-2 border-slate-600"
                  style={{ background: currentColor }}
                />
              )}
            </button>

            <AnimatePresence>
              {themeOpen && (
                <ThemeSettings onClose={() => setThemeOpen(false)} />
              )}
            </AnimatePresence>
          </div>

          {/* Settings */}
          <button className="nav-link">
            <Settings size={20} className="shrink-0" />
            {isOpen && <span>Ayarlar</span>}
          </button>

          {/* User */}
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm"
              style={{ background: currentColor }}>
              E
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-white text-sm font-semibold leading-none truncate">Efe Han</p>
                <p className="text-slate-400 text-xs mt-0.5">Admin</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm lg:hidden z-40"
          onClick={toggle}
        />
      )}
    </>
  );
}
