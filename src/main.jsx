import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

// Eski QR veya direkt link girişlerini yakalayıp HashRouter formatına çevir (PWA uyumu)
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
  const p = window.location.pathname;
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
