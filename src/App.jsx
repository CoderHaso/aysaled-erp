import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import { Menu, Bell, Search } from 'lucide-react';
import Dashboard  from './pages/Dashboard';
import Stock      from './pages/Stock';
import Suppliers  from './pages/Suppliers';
import Customers  from './pages/Customers';
import Sales      from './pages/Sales';
import Settings   from './pages/Settings';
import QRDetail   from './pages/QRDetail';
import Invoices   from './pages/Invoices';
import Quotes     from './pages/Quotes';
import Media      from './pages/Media';

const PAGES = {
  '/':           { title: 'Dashboard',      sub: 'Genel Bakış' },
  '/stock':      { title: 'Stok Merkezi',   sub: 'Hammadde & Mamül' },
  '/suppliers':  { title: 'Tedarikçiler',   sub: 'Tedarikçi Yönetimi' },
  '/contacts':   { title: 'Cari Takip',     sub: 'Müşteri & Tedarikçi' },
  '/incoming-invoices': { title: 'Gelir Faturaları', sub: 'Uyumsoft Gelen Faturalar' },
  '/outgoing-invoices': { title: 'Gider Faturaları', sub: 'Uyumsoft Giden Faturalar' },
  '/sales':      { title: 'Satış',          sub: 'Sipariş & Satış' },
  '/quotes':     { title: 'Teklifler',      sub: 'Teklif Formu Yönetimi' },
  '/media':      { title: 'Medya',          sub: 'Görsel Kütüphanesi · Backblaze B2' },
  '/reports':    { title: 'Raporlar',       sub: 'Finans & Analiz' },
  '/settings':   { title: 'Ayarlar',        sub: 'Sistem Yapılandırması' },
};

const ROUTE_TO_ID = {
  '/':          'dashboard',
  '/stock':     'stock',
  '/suppliers': 'suppliers',
  '/contacts':  'contacts',
  '/incoming-invoices': 'incoming-invoices',
  '/outgoing-invoices': 'outgoing-invoices',
  '/sales':     'sales',
  '/quotes':    'quotes',
  '/media':     'media',
  '/reports':   'reports',
  '/settings':  'settings',
};

function AppShell() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  // Desktop: sidebar açık/kapalı; Mobile: varsayılan kapalı (ekran genişliğine göre)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const location  = useLocation();
  const navigate  = useNavigate();

  const page     = PAGES[location.pathname] || { title: 'A-ERP', sub: '' };
  const activeId = ROUTE_TO_ID[location.pathname] || 'dashboard';

  const c = {
    bg:       isDark ? '#0f172a' : '#f8fafc',
    header:   isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
    border:   isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#64748b',
    searchBg: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(241,245,249,0.9)',
    hoverBg:  isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
  };

  const handleNavigate = (id) => {
    const routes = {
      dashboard: '/', stock: '/stock', suppliers: '/suppliers',
      contacts: '/contacts',
      'incoming-invoices': '/incoming-invoices',
      'outgoing-invoices': '/outgoing-invoices',
      sales: '/sales', quotes: '/quotes', media: '/media',
      reports: '/reports', settings: '/settings',
    };
    navigate(routes[id] || '/');
    // Mobilde gezindikten sonra sidebar kapat
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: c.bg }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Sidebar
        isOpen={sidebarOpen}
        toggle={() => setSidebarOpen(v => !v)}
        activeId={activeId}
        onNavigate={handleNavigate}
      />

      {/* ── Sağ ana alan ─────────────────────────────────────────────────
           Mobil: Sidebar overlay → margin yok
           Desktop (lg+): Sidebar inline → margin var
      ────────────────────────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300
          ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-[72px]'}`}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-3 sm:px-5 py-3 border-b z-30"
          style={{ background: c.header, backdropFilter: 'blur(14px)', borderColor: c.border }}
        >
          {/* Sol: hamburger + başlık */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-2 rounded-xl flex-shrink-0 transition-colors"
              style={{ color: c.muted }}
              onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base leading-none truncate" style={{ color: c.text }}>
                {page.title}
              </h2>
              {page.sub && (
                <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: c.muted }}>{page.sub}</p>
              )}
            </div>
          </div>

          {/* Sağ: arama + bildirim */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: c.searchBg, borderColor: c.border }}>
              <Search size={14} style={{ color: c.muted }} />
              <input type="text" placeholder="Ara..."
                className="bg-transparent border-none outline-none text-sm w-36 lg:w-44"
                style={{ color: c.text }} />
            </div>
            <button className="relative p-2 rounded-xl transition-colors flex-shrink-0"
              style={{ color: c.muted }}
              onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2"
                style={{ borderColor: c.header }} />
            </button>
          </div>
        </header>

        {/* ── Sayfa içeriği (tek scroll burası) ───────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ background: c.bg, color: c.text }}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/stock"      element={<Stock />} />
            {/* Eski hash tabanlı QR kodları (A-ERP.com/#/stock/id) için kurtarma rotası */}
            <Route path="/stock/:id"  element={<QRDetail />} />
            {/* Güncel QR kod rotası */}
            <Route path="/qr/:id"     element={<QRDetail />} />
            <Route path="/suppliers"  element={<Suppliers />} />
            <Route path="/settings"   element={<Settings />} />
            <Route path="/contacts"   element={<Customers />} />
            <Route path="/incoming-invoices" element={<Invoices type="outbox" />} />
            <Route path="/outgoing-invoices" element={<Invoices type="inbox" />} />
            <Route path="/sales"      element={<Sales />} />
            <Route path="/quotes"     element={<Quotes />} />
            <Route path="/media"      element={<Media />} />
            <Route path="/reports"    element={<ComingSoon title="Raporlar"   icon="📊" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function ComingSoon({ title, icon = '🚧' }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <div className="text-6xl">{icon}</div>
      <h2 className="text-xl font-bold" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</h2>
      <p className="text-sm text-center" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
        Bu modül yakında aktif olacak.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
