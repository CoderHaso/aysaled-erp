# A-ERP — Görev Takip Listesi

> Son güncelleme: 26 Mart 2026
> Bu dosya her oturumda güncellenir. Tamamlanan görevler ✅, devam edenler 🔄, bekleyenler ⬜ olarak işaretlenir.

---

## 🟢 Aşama 0 — Proje Kurulumu

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 0.1 | Vite 7 + React projesi oluşturma | ✅ | `e-fatura-new/` altında |
| 0.2 | Tailwind CSS v4 entegrasyonu | ✅ | `@tailwindcss/vite` plugin + `@import "tailwindcss"` |
| 0.3 | Framer Motion kurulumu | ✅ | Metric kartlarda kullanımda |
| 0.4 | Lucide React (ikonlar) kurulumu | ✅ | — |
| 0.5 | Supabase JS SDK kurulumu | ✅ | `src/lib/supabase.js` hazır |
| 0.6 | axios ve react-router-dom kurulumu | ✅ | — |
| 0.7 | vite-plugin-pwa 1.2.0 entegrasyonu | ✅ | Full manifest + Workbox service worker |
| 0.8 | index.html PWA meta tagları | ✅ | viewport-fit, apple-mobile-web-app-capable vb. |
| 0.9 | Vite proxy (/api → :3001) | ✅ | `vite.config.js`'de tanımlı |
| 0.10 | .gitignore + .env.example | ✅ | Kök dizindeki — |
| 0.11 | GitHub repo oluşturma | ⬜ | **SEN yapacaksın** — bkz. DEPLOYMENT.md |
| 0.12 | Supabase projesi + schema.sql | ⬜ | **SEN yapacaksın** — bkz. DEPLOYMENT.md |
| 0.13 | Vercel bağlantısı + env variables | ⬜ | **SEN yapacaksın** — bkz. DEPLOYMENT.md |

---

## 🟢 Aşama 1 — Veritabanı (Supabase)

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 1.1 | schema.sql tasarımı | ✅ | `schema.sql` artifacts'de mevcut |
| 1.2 | Supabase'e schema uygulanması | ⬜ | Manuel: SQL Editor'da çalıştırılacak |
| 1.3 | RLS kuralları (Admin/Personel) | ⬜ | Sonraki aşama |
| 1.4 | Storage bucket (fotoğraf/PDF) | ⬜ | Sonraki aşama |
| 1.5 | Realtime subscriptions aktif etme | ⬜ | Stok/fatura değişimlerinde |

---

## 🟡 Aşama 2 — Backend & Entegrasyon

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 2.1 | Express server kurulumu | ✅ | `index.js` — port 3001 |
| 2.2 | Uyumsoft SOAP client bağlantısı | ✅ | `node-soap` ile |
| 2.3 | `/get-invoices` endpoint | ✅ | `GetInboxInvoiceList` metodu |
| 2.4 | `/send-invoice` endpoint | ✅ | `SaveAsDraft` taslağı |
| 2.5 | `/check-user` endpoint | ✅ | VKN sorgu taslağı |
| 2.6 | TCMB Kur Servisi (cron job) | ⬜ | Günlük 15:30'da çalışacak |
| 2.7 | PDF Generator (teklif + üretim) | ⬜ | react-pdf veya puppeteer |
| 2.8 | Backend'i Vercel Serverless'a taşıma | ⬜ | `/api` klasörü yapısı |

---

## 🔴 Aşama 3 — Frontend: Stok & Ürün Yönetimi

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 3.1 | Responsive Sidebar + Header layout | ✅ | `Sidebar.jsx` + `App.jsx` |
| 3.2 | Dashboard metrik kartları | ✅ | 4 kart, animasyonlu |
| 3.3 | Ürün Listesi sayfası | ⬜ | — |
| 3.4 | Ürün Kart bileşeni (birim, kur, QR) | ⬜ | — |
| 3.5 | QR Kod Motoru (otomatik üret + yazdır) | ⬜ | — |
| 3.6 | Reçete Editörü (BOM, Drag & Drop) | ⬜ | — |
| 3.7 | Scan & Act (kamera QR okuma) | ⬜ | — |

---

## 🔴 Aşama 4 — Frontend: Satış & Finans

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 4.1 | Satış Paneli (müşteri seçimi, faturalı toggle) | ⬜ | — |
| 4.2 | Fatura "Özelleştir" modalı | ⬜ | — |
| 4.3 | Gelen Fatura Paneli (Uyumsoft) | ⬜ | Senkronize butonu mevcut |
| 4.4 | "Stoğa İşle" aksiyonu | ⬜ | — |
| 4.5 | Cari Takip ekranı | ⬜ | — |
| 4.6 | Tevkifat oranı seçimi | ⬜ | — |

---

## 🔴 Aşama 5 — Tema & Ayarlar

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 5.1 | Theme Manager (Dark/Light/Primary Color) | ⬜ | Context API ile |
| 5.2 | Global store (tema anlık değişim) | ⬜ | — |
| 5.3 | Dashboard hızlı erişim kısayolları (5 adet) | ✅ | Hızlı Aksiyonlar kartı mevcut |

---

## 🔴 Aşama 6 — Raporlama & Bildirimler

| # | Görev | Durum | Notlar |
|---|-------|--------|--------|
| 6.1 | Finans raporu (KDV dahil/hariç, net kar) | ⬜ | — |
| 6.2 | Resmi/Gayriresmi gelir-gider ayrımı | ⬜ | — |
| 6.3 | Toast bildirimleri (stok bitti vb.) | ⬜ | — |
| 6.4 | Notification merkezi | ⬜ | — |

---

## 📁 Proje Dosya Yapısı

```
aysaled/
├── PROJECT_SPEC.md      ← Teknik spesifikasyon (bu dosya)
├── TASKS.md             ← Görev listesi
├── index.js             ← Node.js Backend (port 3001)
├── package.json         ← Backend bağımlılıkları
├── node_modules/        ← Backend node_modules
└── e-fatura-new/        ← Yeni Vite+React Frontend
    ├── src/
    │   ├── App.jsx          ← Ana uygulama + Dashboard
    │   ├── index.css        ← Tailwind v4 + global stiller
    │   ├── components/
    │   │   └── Sidebar.jsx  ← Responsive nav menüsü
    │   └── lib/
    │       └── supabase.js  ← Supabase client
    ├── vite.config.js       ← Vite + proxy ayarları
    └── package.json         ← Frontend bağımlılıkları
```

---

## ⚠️ Bilinen Sorunlar / Bekleyen Düzeltmeler

| Sorun | Çözüm | Durum |
|-------|-------|--------|
| `lucide-react` v1.7 sürümü bazı ikonları değiştirdi | `^0.507.0`'a düşürüldü | ✅ |
| `vite-plugin-pwa` Vite 8 ile uyumsuz (v1.x) | package.json'da v2.0.0 tanımlandı, `npm install` ile kurulacak | 🔄 |
| ShoppingCart import eksikti (konsol hatası) | App.jsx import listesine eklendi | ✅ |
| Tailwind config.js v4'te geçersiz | `@import` + `@theme` yapısına geçildi | ✅ |
