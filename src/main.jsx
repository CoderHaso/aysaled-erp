import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

// Yeni sürüm yayınlandığında eski sekmenin istediği parça dosyaları (hash'li chunk) artık yoktur: bir kez sayfayı yenile
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  try {
    if (sessionStorage.getItem('aerp_chunk_reload') === '1') return;
    sessionStorage.setItem('aerp_chunk_reload', '1');
  } catch { /* yok say */ }
  window.location.reload();
});
setTimeout(() => { try { sessionStorage.removeItem('aerp_chunk_reload'); } catch { /* yok say */ } }, 10000);

// Eski QR veya direkt link girişlerini yakalayıp HashRouter formatına çevir (PWA uyumu)
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
  let p = window.location.pathname;
  if (p.startsWith('/stock/')) p = p.replace('/stock/', '/qr/');
  // Redirect
  window.location.replace(`${window.location.origin}/#${p}${window.location.search}`);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
