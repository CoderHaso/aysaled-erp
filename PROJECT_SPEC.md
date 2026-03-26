# A-ERP Sistem Spesifikasyonu v1.0

## 📌 Proje Amacı
Uyumsoft (e-Fatura) entegrasyonlu, Supabase tabanlı, PWA destekli modern bir ERP sistemi.

---

## 1. Teknik Altyapı

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 19 + Vite 8 |
| Stil | Tailwind CSS v4 + Framer Motion |
| Backend | Node.js + Express + node-soap |
| Veritabanı | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime Subscriptions |
| Kur Servisi | TCMB API (Günlük senkronizasyon) |
| PWA | vite-plugin-pwa (Service Worker) |
| Hosting | Vercel (Frontend + Serverless) |

---

## 2. Veritabanı Şeması

### `items` — Ürün / Stok
| Alan | Tip | Açıklama |
|------|-----|----------|
| id | UUID | Primary Key |
| name | TEXT | Ürün adı |
| sku | TEXT | Stok kodu (unique) |
| unit | TEXT | kg / m / pcs |
| stock_count | NUMERIC | Mevcut stok miktarı |
| critical_limit | NUMERIC | Uyarı eşiği |
| base_currency | TEXT | USD / EUR / TL |
| purchase_price | NUMERIC | Alış fiyatı |
| qr_code_url | TEXT | QR görsel URL |

### `contacts` — Cari Kartlar
| Alan | Tip | Açıklama |
|------|-----|----------|
| id | UUID | Primary Key |
| name | TEXT | Firma/şahıs adı |
| type | TEXT | customer / supplier |
| tax_id | TEXT | Vergi numarası |
| balance_tl / usd / eur | NUMERIC | Bakiye (para birimi bazlı) |

### `transactions` — Hareketler
| Alan | Tip | Açıklama |
|------|-----|----------|
| id | UUID | Primary Key |
| contact_id | UUID | FK → contacts |
| type | TEXT | sale / purchase / return |
| is_official | BOOLEAN | Faturalı mı? |
| total_amount | NUMERIC | Toplam tutar |
| currency | TEXT | TL / USD / EUR |
| exchange_rate | NUMERIC | İşlem anındaki kur |
| status | TEXT | pending / completed / approved |

### `bom_recipes` — Üretim Reçeteleri
| Alan | Tip | Açıklama |
|------|-----|----------|
| parent_id | UUID | FK → items (Mamül) |
| component_id | UUID | FK → items (Hammadde) |
| quantity_required | NUMERIC | Birim başına miktar |

### `currencies` — Kur Tablosu
| Alan | Tip | Açıklama |
|------|-----|----------|
| currency_code | TEXT | USD / EUR |
| rate | NUMERIC | TL karşılığı |
| last_updated | TIMESTAMP | Son güncelleme |

---

## 3. Modüller ve Fonksiyonel Detaylar

### Döviz Çevrim Motoru
- İşlem anındaki kur `transactions.exchange_rate` sütununa **sabitlenir**
- Raporlamada: "Bugünkü Kurla Değer" vs "İşlem Anındaki Değer" olarak iki ayrı kar hesabı

### Fatura Modülü
- Tevkifat oranı seçimi (5/10, 9/10 vb.)
- Uyumsoft API ile e-Fatura durumu anlık senkronize
- Gelen fatura → "Stoğa İşle" butonu ile otomatik stok artışı

### Üretim & İş Emri
- Satıştan "Üretim Başlat" aksiyonu
- PDF "Üretim Kağıdı" çıktısı (BOM listesi)

### PWA Özellikleri
- Offline Cache: Service Worker ile temel veriler çevrimdışı
- Installable: iOS "Ana Ekrana Ekle", Android "Uygulamayı Yükle"
- Push Notification: Stok kritik seviye / vade bildirimleri
- Fluid Layout: Sidebar → Hamburger, Tablo → Kart görünümü

---

## 4. API Endpointleri (Backend — localhost:3001)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | /check-user | VKN sorgulama |
| POST | /get-invoices | Uyumsoft'tan gelen fatura listesi |
| POST | /send-invoice | Uyumsoft'a fatura gönderme (taslak) |

---

## 5. Deployment

- **Frontend:** Vercel — `main` branch push → otomatik deploy
- **Backend:** Vercel Serverless Functions (`/api` klasörü altında)
- **Env Değişkenleri:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, Uyumsoft credentials
