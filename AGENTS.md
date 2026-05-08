# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
A-ERP (aysaled-erp) is a Turkish-language ERP system built with React 19 + Vite 7 (frontend) and Vercel Serverless Functions (backend in `/api`). Database is cloud-hosted Supabase (PostgreSQL + Auth + Realtime).

### Dev environment
- **Node**: v22+ (pre-installed)
- **Package manager**: npm (lockfile: `package-lock.json`)
- **Dev server**: `npm run dev` → Vite on port 5173
- **Build**: `npm run build`
- **Lint**: `npm run lint` (requires an `eslint.config.js` — currently missing from the repo, so lint will fail)
- **Backend API**: Vercel serverless functions in `/api/` — locally accessed via Vite proxy (`/api` → `localhost:3001`). No local API server setup needed for frontend-only work.

### Environment variables
Copy `.env.example` to `.env.local`. The Supabase URL and anon key in `.env.example` are functional test credentials for the shared dev project.

### Auth & Roles
- Supabase Auth with auto-confirm enabled. New signups get `Atolye` role (restricted to İş Emirleri page only).
- To test all pages, update the user's profile role to `Dev` via Supabase REST API after registration.
- Login page has a known React hooks violation (useEffect after conditional return in `AppShell`). After first login, **refresh the page** to load the dashboard correctly.

### Key gotchas
- The project has no automated tests, no Makefile, no Docker, no CI.
- External services (Uyumsoft, Backblaze B2, Groq, DeepSeek) are optional — only needed for their specific features.
- PDF export in Katalog page uses dynamic imports of `jspdf` + `html2canvas` (page-by-page rendering).
