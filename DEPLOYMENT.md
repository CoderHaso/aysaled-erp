# 🚀 Deployment Rehberi — Supabase + Vercel + GitHub

> Bu rehber sana ne yapman gerektiğini adım adım anlatır.
> "Senin yapman" gereken adımlar **🧑 SEN** ile işaretli.
> Kod/config tarafını ben hallettim.

---

## 1️⃣ GitHub — Repo Oluştur

**🧑 SEN yapacaksın:**

1. [github.com/new](https://github.com/new) adresine git
2. Repo adı: `aysaled-erp` (ya da istediğin)
3. **Private** seç
4. README ekleme (zaten var)
5. "Create repository" tıkla
6. Terminalde şunu çalıştır:

```powershell
cd c:\Users\efeha\Documents\aysaled
git init
git add .
git commit -m "feat: ilk commit - A-ERP altyapısı"
git remote add origin https://github.com/KULLANICI_ADIN/aysaled-erp.git
git branch -M main
git push -u origin main
```

---

## 2️⃣ Supabase — Proje Oluştur

**🧑 SEN yapacaksın:**

1. [app.supabase.com](https://app.supabase.com) → "New Project" 
2. Proje adı: `aysaled-erp`
3. Region: **Frankfurt** (EU, Türkiye'ye en yakın)
4. Güçlü bir şifre belirle (kaydet!)
5. Proje oluştuktan sonra:
   - Sol menü → **Settings → API**
   - `Project URL` → kopyala → `.env.local` a yapıştır
   - `anon public` key → kopyala → `.env.local` a yapıştır

**`.env.local` oluştur (root'ta — ben yapamam çünkü .gitignore'da):**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

6. Sol menü → **SQL Editor** → Yeni sorgu aç → `schema.sql` içeriğini yapıştır → Çalıştır

---

## 3️⃣ Vercel — Proje Bağla

**🧑 SEN yapacaksın:**

1. [vercel.com](https://vercel.com) → "Add New Project"
2. GitHub hesabını bağla → `aysaled-erp` reposunu import et
3. **Framework Preset:** Vite
4. **Root Directory:** `e-fatura-new` (önemli!)
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. **Environment Variables** sekmesine gir:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | supabase'den aldığın URL |
| `VITE_SUPABASE_ANON_KEY` | supabase'den aldığın anon key |

8. "Deploy" tıkla → Bitti!

---

## 4️⃣ Otomatik Deploy (CI/CD)

Artık her `git push origin main` yaptığında:
- Vercel otomatik olarak yeni build başlatır
- ~1-2 dk içinde canlıya geçer
- Custom domain ekleyebilirsin: Settings → Domains

---

## 5️⃣ PWA Test (Kurulum Butonu)

Vercel'e deploy ettikten sonra:
- **Chrome Android:** URL çubuğunda "Uygulamayı Yükle" butonu çıkar
- **Safari iOS:** Paylaş → "Ana Ekrana Ekle"
- **Chrome Desktop:** URL çubuğu sağında install ikonu

---

## ⚠️ Önemli Notlar

- **Uyumsoft credentials** asla frontend'e koyma — sadece backend'de (index.js veya Vercel Serverless Functions'da)
- `schema.sql` çalıştırmadan Supabase ekranları çalışmaz
- `.env.local` dosyası `.gitignore`'da — GitHub'a gitmiyor ✅

---

## 📋 Özet Checklist

- [ ] GitHub repo oluştur
- [ ] `git push` yap
- [ ] Supabase projesi aç
- [ ] `.env.local` doldur
- [ ] `schema.sql` çalıştır (Supabase SQL Editor)
- [ ] Vercel'e GitHub reposunu bağla
- [ ] Vercel'e env variable ekle
- [ ] Deploy et
