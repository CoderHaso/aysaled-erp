import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import { Menu, Bell, Search } from 'lucide-react';
import Dashboard      from './pages/Dashboard';
import Stock          from './pages/Stock';
import Suppliers      from './pages/Suppliers';
import Customers      from './pages/Customers';
import Sales          from './pages/Sales';
import Settings       from './pages/Settings';
import QRDetail       from './pages/QRDetail';
import Invoices       from './pages/Invoices';
import Quotes         from './pages/Quotes';
import Media          from './pages/Media';
import Notifications  from './pages/Notifications';
import Kasa           from './pages/Kasa';
import Reports        from './pages/Reports';
import HesapDefteri  from './pages/HesapDefteri';
import IsEmri        from './pages/IsEmri';
import Katalog        from './pages/Katalog';
import Login          from './pages/Login';
import { supabase }   from './lib/supabaseClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const PAGES = {
  '/':           { title: 'Dashboard',      sub: 'Genel Bakış' },
  '/stock':      { title: 'Stok Merkezi',   sub: 'Hammadde & Mamül' },
  '/suppliers':  { title: 'Tedarikçiler',   sub: 'Tedarikçi Yönetimi' },
  '/contacts':   { title: 'Cari Takip',     sub: 'Müşteri & Tedarikçi' },
  '/kasa':       { title: 'Kasa',           sub: 'Nakit Gider & Gelir Takibi' },
  '/incoming-invoices': { title: 'Giden (Satış) Faturaları', sub: 'Uyumsoft Giden Faturalar' },
  '/outgoing-invoices': { title: 'Gelen (Alış) Faturaları', sub: 'Uyumsoft Gelen Faturalar' },
  '/sales':      { title: 'Satış',          sub: 'Sipariş & Satış' },
  '/quotes':     { title: 'Teklifler',      sub: 'Teklif Formu Yönetimi' },
  '/media':      { title: 'Medya',          sub: 'Görsel Kütüphanesi · Backblaze B2' },
  '/reports':    { title: 'Raporlar',       sub: 'Finans & Analiz' },
  '/ledger':     { title: 'Hesap Defteri',  sub: 'Cari & Tedarikçi Borç / Alacak Takibi' },
  '/is-emri':    { title: 'İş Emirleri',      sub: 'Atölye Üretim Takibi' },
  '/katalog':    { title: 'Katalog Merkezi',  sub: 'Ürün Kataloğu Oluşturucu' },
  '/settings':   { title: 'Ayarlar',        sub: 'Sistem Yapılandırması' },
  '/notifications': { title: 'Bildirimler', sub: 'Ödeme Hatırlatmaları & Sistem Bildirimleri' },
};

const ROUTE_TO_ID = {
  '/':          'dashboard',
  '/stock':     'stock',
  '/suppliers': 'suppliers',
  '/contacts':  'contacts',
  '/kasa':      'kasa',
  '/incoming-invoices': 'incoming-invoices',
  '/outgoing-invoices': 'outgoing-invoices',
  '/sales':     'sales',
  '/quotes':    'quotes',
  '/media':     'media',
  '/reports':   'reports',
  '/ledger':    'ledger',
  '/is-emri':   'is-emri',
  '/katalog':   'katalog',
  '/settings':  'settings',
  '/notifications': 'notifications',
};

// ─── Bell Butonu (okunmamış sayısını gösterir) ────────────────────────────────
function BellButton({ navigate }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
      setUnread(count || 0);
    };
    load();
    // 60 saniyede bir kontrol
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-xl transition-colors flex-shrink-0"
      style={{ color: isDark ? '#94a3b8' : '#64748b' }}
      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold
          flex items-center justify-center text-white"
          style={{ background: '#ef4444', border: '2px solid var(--bg-header)' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

function AppShell() {
  const { effectiveMode, currentColor } = useTheme();
  const { session, profile, logout, ROLES } = useAuth();
  const isDark = effectiveMode === 'dark';

  // Desktop: sidebar açık/kapalı; Mobile: varsayılan kapalı (ekran genişliğine göre)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const location  = useLocation();
  const navigate  = useNavigate();

  // Route security
  if (!session) {
    return <Login />;
  }

  // RBAC checks
  const isRouteAllowed = () => {
    if (!profile) return true; // hala yükleniyor olabilir
    const r = profile.role || ROLES.ATOLYE;
    const p = location.pathname;

    if (r === ROLES.DEV || r === ROLES.ADMIN) return true;
    if (r === ROLES.ATOLYE) {
       if (p === '/is-emri') return true;
       return false;
    }
    if (r === ROLES.OZEL) {
       const allowed = profile.allowed_tabs || [];
       if (allowed.includes('*')) return true;
       if (allowed.includes(p)) return true;
       return false;
    }
    return false;
  };

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
      ledger: '/ledger',
      'is-emri': '/is-emri',
      kasa: '/kasa',
      notifications: '/notifications',
      'incoming-invoices': '/incoming-invoices',
      'outgoing-invoices': '/outgoing-invoices',
      sales: '/sales', quotes: '/quotes', media: '/media',
      reports: '/reports', settings: '/settings',
      katalog: '/katalog',
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
            <BellButton navigate={navigate} />

          </div>
        </header>

        {/* ── Sayfa içeriği (tek scroll burası) ───────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ background: c.bg, color: c.text }}>
          {!isRouteAllowed() ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
               <h2 className="text-2xl font-bold text-red-500">Yetkisiz Erişim</h2>
               <p style={{ color: c.muted }}>Bu sayfayı görüntüleme yetkiniz yok.</p>
               <button onClick={logout} className="mt-4 px-6 py-2 rounded-xl text-sm font-bold bg-slate-200 dark:bg-slate-800">Çıkış Yap</button>
            </div>
          ) : (
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
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/kasa"          element={<Kasa />} />
            <Route path="/reports"    element={<Reports />} />
            <Route path="/ledger"     element={<HesapDefteri />} />
            <Route path="/is-emri"    element={<IsEmri />} />
            <Route path="/katalog"    element={<Katalog />} />
          </Routes>
          )}
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
    <AuthProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AuthProvider>
  );
}
