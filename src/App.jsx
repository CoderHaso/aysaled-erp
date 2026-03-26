import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import { Menu, Bell, Plus, Search } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';

// ─── Sayfa meta bilgileri ──────────────────────────────────────────────────────
const PAGES = {
  '/':          { title: 'Dashboard',      sub: 'Genel Bakış' },
  '/stock':     { title: 'Stok Merkezi',   sub: 'Ürün & Hammadde' },
  '/contacts':  { title: 'Cari Takip',     sub: 'Müşteri & Tedarikçi' },
  '/invoices':  { title: 'Faturalar',      sub: 'Gelen & Giden' },
  '/sales':     { title: 'Satış Paneli',   sub: 'Yeni Satış & Sipariş' },
  '/reports':   { title: 'Raporlar',       sub: 'Finans & Analiz' },
};

// Route → Sidebar id eşleştirme
const ROUTE_TO_ID = {
  '/':         'dashboard',
  '/stock':    'stock',
  '/contacts': 'contacts',
  '/invoices': 'invoices',
  '/sales':    'sales',
  '/reports':  'reports',
};

function AppShell() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const page = PAGES[location.pathname] || { title: 'A-ERP', sub: '' };
  const activeId = ROUTE_TO_ID[location.pathname] || 'dashboard';

  const c = {
    bg:         isDark ? '#0f172a' : '#f8fafc',
    header:     isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
    border:     isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:       isDark ? '#f1f5f9' : '#0f172a',
    muted:      isDark ? '#94a3b8' : '#64748b',
    searchBg:   isDark ? 'rgba(30,41,59,0.8)' : 'rgba(241,245,249,0.9)',
    hoverBg:    isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
  };

  const handleNavigate = (id) => {
    const routes = { dashboard: '/', stock: '/stock', contacts: '/contacts', invoices: '/invoices', sales: '/sales', reports: '/reports' };
    navigate(routes[id] || '/');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: c.bg }}>
      <Sidebar
        isOpen={sidebarOpen}
        toggle={() => setSidebarOpen(v => !v)}
        activeId={activeId}
        onNavigate={handleNavigate}
      />

      {/* Ana alan */}
      <div className={`flex flex-col flex-1 transition-all duration-300 overflow-hidden
        ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-[72px]'}`}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b z-30"
          style={{
            background: c.header,
            backdropFilter: 'blur(14px)',
            borderColor: c.border,
          }}>
          <div className="flex items-center gap-4">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: c.muted }}
              onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <div>
              <h2 className="font-bold text-base leading-none" style={{ color: c.text }}>
                {page.title}
              </h2>
              {page.sub && (
                <p className="text-xs mt-0.5" style={{ color: c.muted }}>{page.sub}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Arama */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: c.searchBg, borderColor: c.border }}>
              <Search size={15} style={{ color: c.muted }} />
              <input
                type="text"
                placeholder="Ara..."
                className="bg-transparent border-none outline-none text-sm w-44"
                style={{ color: c.text }}
              />
            </div>

            {/* Bildirim */}
            <button className="relative p-2 rounded-xl transition-colors"
              style={{ color: c.muted }}
              onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Bell size={19} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2"
                style={{ borderColor: c.header }} />
            </button>

            {/* Yeni İşlem */}
            <button className="btn-primary hidden sm:flex">
              <Plus size={16} />
              Yeni İşlem
            </button>
          </div>
        </header>

        {/* ── Sayfa İçeriği ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ background: c.bg, color: c.text }}>
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/stock"   element={<Stock />} />
            {/* Yakında:  */}
            <Route path="/contacts"  element={<ComingSoon title="Cari Takip" />} />
            <Route path="/invoices"  element={<ComingSoon title="Faturalar" />} />
            <Route path="/sales"     element={<ComingSoon title="Satış Paneli" />} />
            <Route path="/reports"   element={<ComingSoon title="Raporlar" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Geçici placeholder ───────────────────────────────────────────────────────
function ComingSoon({ title }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-4">
      <div className="text-6xl">🚧</div>
      <h2 className="text-xl font-bold" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
        Bu modül yakında aktif olacak.
      </p>
    </div>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
