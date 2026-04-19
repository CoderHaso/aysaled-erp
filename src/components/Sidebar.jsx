import React, { useState } from 'react';
import {
  LayoutDashboard, Package, Users, FileDown, FileUp,
  ShoppingCart, TrendingUp, Settings, Palette, Building2,
  FileText, Image, Wallet, BookOpen, Hammer
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';
import ThemeSettings from './ThemeSettings';
import { useAuth } from '../contexts/AuthContext';

const MENU = [
  { name: 'Genel Bakış',  icon: LayoutDashboard, id: 'dashboard' },
  { name: 'Stok',         icon: Package,         id: 'stock'     },
  { name: 'Tedarikçiler', icon: Building2,       id: 'suppliers' },
  { name: 'Cariler',      icon: Users,           id: 'contacts'  },
  { name: 'Hesap Defteri',icon: BookOpen,        id: 'ledger'    },
  { name: 'İş Emirleri',   icon: Hammer,          id: 'is-emri'   },
  { name: 'Kasa',         icon: Wallet,          id: 'kasa'      },
  { name: 'Giden Fat.',   icon: FileUp,          id: 'incoming-invoices' },
  { name: 'Gelen Fat.',   icon: FileDown,        id: 'outgoing-invoices' },
  { name: 'Satış',        icon: ShoppingCart,    id: 'sales'     },
  { name: 'Teklifler',    icon: FileText,        id: 'quotes'    },
  { name: 'Katalog',      icon: BookOpen,        id: 'katalog'   },
  { name: 'Medya',        icon: Image,           id: 'media'     },
  { name: 'Raporlar',     icon: TrendingUp,      id: 'reports'   },
];

export default function Sidebar({ isOpen, toggle, activeId = 'dashboard', onNavigate }) {
  const { effectiveMode, currentColor, theme } = useTheme();
  const { profile, ROLES, logout } = useAuth();
  const isDark = effectiveMode === 'dark';
  const [themeOpen, setThemeOpen] = useState(false);

  // RBAC filtreleme
  const isAllowed = (id) => {
    if (!profile) return false;
    const r = profile.role || ROLES.ATOLYE;
    const mappedPath = id === 'dashboard' ? '/' : `/${id}`;
    if (r === ROLES.DEV || r === ROLES.ADMIN) return true;
    if (r === ROLES.ATOLYE) return id === 'is-emri';
    if (r === ROLES.OZEL) {
      const allowed = profile.allowed_tabs || [];
      return allowed.includes('*') || allowed.includes(mappedPath);
    }
    return false;
  };
  
  const allowedMenu = MENU.filter(m => isAllowed(m.id));

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
          {allowedMenu.map(({ name, icon: Icon, id }) => {
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
          {isAllowed('settings') && (
            <button onClick={() => onNavigate?.('settings')}
              className="nav-link w-full"
              style={activeId === 'settings' ? { background: `color-mix(in srgb, ${currentColor} 18%, transparent)`, color: 'var(--color-primary-light)' } : {}}>
              <Settings size={19} className="shrink-0" />
              {isOpen && <span>Ayarlar</span>}
            </button>
          )}

          {/* User */}
          {profile && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl mt-1" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: currentColor }}>
                  {profile.email?.substring(0, 2).toUpperCase()}
                </div>
                {isOpen && (
                  <div className="overflow-hidden">
                    <p className="text-white text-xs font-semibold leading-none truncate">{profile.email.split('@')[0]}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">{profile.role}</p>
                  </div>
                )}
              </div>
              {isOpen && (
                <button onClick={logout} className="text-xs transition-colors hover:text-red-400" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                   Çıkış
                </button>
              )}
            </div>
          )}
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
