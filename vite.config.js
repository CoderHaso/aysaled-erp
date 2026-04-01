import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'A-ERP — Modern ERP Sistemi',
        short_name: 'A-ERP',
        description: 'Uyumsoft e-Fatura entegrasyonlu, Supabase tabanlı modern ERP',
        theme_color: '#0284c7',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'tr',
        icons: [] // Resimler eklendiğinde buraya doldurulabilir
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Supabase ve API çağrılarını ASLA cache'leme — auth header'ları değişir
        // ve CORS hatası gibi görünen "no-response" hatasına neden olur
        runtimeCaching: [
          {
            // Supabase API çağrıları — sadece network, hiç cache'leme
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Vercel API fonksiyonları — NetworkFirst, uzun timeout
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 },
              networkTimeoutSeconds: 20
            }
          }
        ]
      },
      devOptions: {
        enabled: false // dev modda SW devre dışı — yerel geliştirmeyi karmaik etmesin
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
