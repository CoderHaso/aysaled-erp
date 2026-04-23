import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import { Menu, Bell } from 'lucide-react';
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
  '/':           { title: 'Genel Bakış',    sub: 'Aylık Raporlama & Analiz' },
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

  // Global mouse wheel engelleme: number inputlar (mouse scroll yapınca sayı değişmesin)
  useEffect(() => {
    const handleWheel = (e) => {
      // preventDefault çalışmayabilir (passive: false gerekir ama document seviyesinde sorun olabilir).
      // focus silmek daha güvenlidir.
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Route security
  if (!session) {
    return <Login />;
  }

  // Atölye rolü: otomatik olarak iş emri sayfasına yönlendir
  useEffect(() => {
    if (!profile) return;
    const r = profile.role || ROLES.ATOLYE;
    if (r === ROLES.ATOLYE && location.pathname !== '/is-emri') {
      navigate('/is-emri', { replace: true });
    }
  }, [profile, location.pathname, navigate, ROLES]);

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
    <div className="flex overflow-hidden" style={{ background: c.bg, height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

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

          {/* Sağ: bildirim */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <BellButton navigate={navigate} />
          </div>
        </header>

        {/* ── Sayfa içeriği (tek scroll burası) ───────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ background: c.bg, color: c.text }}>
          <Routes location={location} key={location.pathname}>
            <Route path="/"           element={<RBACGuard><Dashboard /></RBACGuard>} />
            <Route path="/stock"      element={<RBACGuard><Stock /></RBACGuard>} />
            <Route path="/stock/:id"  element={<QRDetail />} />
            <Route path="/qr/:id"     element={<QRDetail />} />
            <Route path="/suppliers"  element={<RBACGuard><Suppliers /></RBACGuard>} />
            <Route path="/settings"   element={<RBACGuard><Settings /></RBACGuard>} />
            <Route path="/contacts"   element={<RBACGuard><Customers /></RBACGuard>} />
            <Route path="/incoming-invoices" element={<RBACGuard><Invoices key="outbox" type="outbox" /></RBACGuard>} />
            <Route path="/outgoing-invoices" element={<RBACGuard><Invoices key="inbox" type="inbox" /></RBACGuard>} />
            <Route path="/sales"      element={<RBACGuard><Sales /></RBACGuard>} />
            <Route path="/quotes"     element={<RBACGuard><Quotes /></RBACGuard>} />
            <Route path="/media"      element={<RBACGuard><Media /></RBACGuard>} />
            <Route path="/notifications" element={<RBACGuard><Notifications /></RBACGuard>} />
            <Route path="/kasa"          element={<RBACGuard><Kasa /></RBACGuard>} />
            <Route path="/reports"    element={<RBACGuard><Reports /></RBACGuard>} />
            <Route path="/ledger"     element={<RBACGuard><HesapDefteri /></RBACGuard>} />
            <Route path="/is-emri"    element={<IsEmri />} />
            <Route path="/katalog"    element={<RBACGuard><Katalog /></RBACGuard>} />
            <Route path="*"           element={<Dashboard />} />
          </Routes>
        </main>
      </div>

      {/* WhatsApp İletişim Butonu */}
      <WhatsAppFab />
    </div>
  );
}

function RBACGuard({ children }) {
  const { effectiveMode } = useTheme();
  const { profile, logout, ROLES } = useAuth();
  const isDark = effectiveMode === 'dark';

  if (!profile) return children; // profil yüklenirken göster

  const r = profile.role || ROLES.ATOLYE;
  if (r === ROLES.DEV || r === ROLES.ADMIN) return children;

  // Atölye kullanıcıları useEffect ile /is-emri'ye yönlendirilir (AppShell'de)
  // Buraya gelirse yönlendirme henüz gerçekleşmedi, boş göster
  if (r === ROLES.ATOLYE) return null;

  // OZEL rol  
  if (r === ROLES.OZEL) {
    const allowed = profile.allowed_tabs || [];
    if (allowed.includes('*')) return children;
    // Route path kontrolü burada yapılamaz (iç bileşen)  
    // AppShell zaten yönlendirme yapıyor, burada sadece yakalama
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
       <h2 className="text-2xl font-bold text-red-500">Yetkisiz Erişim</h2>
       <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Bu sayfayı görüntüleme yetkiniz yok.</p>
       <button onClick={logout} className="mt-4 px-6 py-2 rounded-xl text-sm font-bold bg-slate-200 dark:bg-slate-800">Çıkış Yap</button>
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

// ─── WhatsApp İletişim Butonu ──────────────────────────────────────────────────
function WhatsAppFab() {
  const [open, setOpen] = useState(false);

  const WA_NUMBER = '905512429300';
  const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Merhaba, bilgi almak istiyorum.')}`;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        transform: open ? 'translateX(0)' : 'translateX(calc(100% - 40px))',
      }}
    >
      {/* Toggle tab */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="WhatsApp"
        style={{
          width: 40,
          height: 40,
          borderRadius: '12px 0 0 12px',
          border: 'none',
          background: '#25D366',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '-2px 2px 12px rgba(0,0,0,0.25)',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#1ebe5d'}
        onMouseLeave={e => e.currentTarget.style.background = '#25D366'}
      >
        <svg viewBox="0 0 32 32" width="22" height="22" fill="white">
          <path d="M16.004 2.002c-7.732 0-14.002 6.27-14.002 14.002 0 2.468.657 4.876 1.904 6.986L2 30l7.204-1.887A13.94 13.94 0 0016.004 30c7.732 0 14.002-6.27 14.002-14.002S23.736 2.002 16.004 2.002zm0 25.63a11.594 11.594 0 01-5.916-1.62l-.424-.252-4.398 1.154 1.174-4.293-.276-.44a11.58 11.58 0 01-1.778-6.177c0-6.406 5.214-11.62 11.618-11.62s11.618 5.214 11.618 11.62-5.214 11.628-11.618 11.628zm6.37-8.706c-.35-.174-2.068-1.02-2.388-1.136-.32-.118-.552-.174-.786.174-.234.348-.904 1.136-1.11 1.37-.204.234-.408.262-.758.088-.35-.174-1.476-.544-2.812-1.736-1.04-.926-1.742-2.07-1.946-2.42-.204-.35-.022-.538.154-.712.158-.156.35-.408.524-.612.174-.204.232-.35.348-.582.118-.234.058-.438-.03-.612-.088-.174-.786-1.894-1.076-2.594-.284-.68-.572-.588-.786-.598l-.67-.012c-.234 0-.612.088-.932.438-.32.348-1.224 1.196-1.224 2.916s1.254 3.382 1.428 3.616c.174.234 2.468 3.768 5.98 5.284.836.36 1.488.576 1.996.738.838.266 1.602.228 2.204.138.672-.1 2.068-.846 2.36-1.662.292-.816.292-1.516.204-1.662-.088-.146-.32-.234-.67-.408z"/>
        </svg>
      </button>

      {/* Expanded panel */}
      <a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px 8px 10px',
          background: '#25D366',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Inter', system-ui, sans-serif",
          whiteSpace: 'nowrap',
          borderRadius: '0 0 0 0',
          boxShadow: '-2px 2px 12px rgba(0,0,0,0.25)',
          letterSpacing: '0.01em',
        }}
      >
        <span>İletişim Hattı</span>
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>+90 551 242 93 00</span>
      </a>
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
