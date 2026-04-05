# Changelog

All notable changes to SignalStack will be documented in this file.

---

## [Unreleased]

### Added
- Error boundary components (`error.tsx`, `global-error.tsx`, `not-found.tsx`) for all routes
- Admin route error boundaries (`admin/error.tsx`, `admin/categories/error.tsx`, `admin/sources/error.tsx`)
- `scripts/audit.sh` — VPS environment health check script
- `scripts/deploy.sh` — automated pull-and-deploy script for production
- `CHANGELOG.md` — this file
- Infinite scroll with `IntersectionObserver` (auto-loads signals on scroll)
- Mobile category tab switcher (Geopolitics / Technology)
- Theme toggle (light/dark) with smooth CSS transitions
- Custom scrollbar styling matching theme variables
- Root `.env` file template for Docker Compose
- `docker-compose.prod.yml` — production-ready compose file with no volume mounts
- Database backup service (`BackupService`) with daily cron + manual trigger
- Database seed script (`seed.ts`) for bootstrapping categories and sources

### Changed
- Frontend `API_BASE` now uses `NEXT_PUBLIC_API_URL` env var instead of hardcoded `localhost`
- Header component: replaced theme dropdown with simple icon toggle button
- Header component: removed `ThemeProvider` dependency (self-contained theme state)
- Dashboard: two-column category layout (Geopolitics + Technology) instead of single feed
- Dashboard: each category column has independent infinite scroll and data fetching
- Dashboard: responsive column breakpoints (1 → 2 → 3 → 4 columns)
- Dashboard: container max-width expands on `2xl:` screens (1800px)
- Dashboard: removed `h-screen` lock, uses `min-h-screen` for natural scrolling
- CSS: replaced `columns` masonry with `grid` for scroll stability, then restored masonry with scroll preservation
- CSS: added `scroll-smooth` to html/body
- CSS: custom scrollbar with theme-aware colors
- `docker-compose.yml`: added volume mounts + `npm run dev` for frontend hot-reload (local dev)
- `docker-compose.yml`: removed volume mounts from backend (production-safe)
- `docker-compose.prod.yml`: container name changed from `signalstack-backend` to `signalstack-app`
- `docker-compose.prod.yml`: added `FRONTEND_URL`, `NODE_ENV: production`, `PORT` env vars
- `docker-compose.prod.yml`: configurable `POSTGRES_PASSWORD` and `NEXT_PUBLIC_API_URL` via env vars
- `.gitignore`: added `signalstack_backup.sql`, `report.md`, expanded patterns
- `DOCS.md`: complete rewrite with production deployment guide, AI pipeline docs, error handling docs
- `report.md`: expanded into full study guide with code examples and architecture walkthroughs

### Fixed
- Build error: `Button` component doesn't support `asChild` prop — replaced with plain `<a>` tags
- Build error: `theme-provider` import paths broken — fixed to use `@/` alias
- Build error: `Maximize2` icon missing import in `page.tsx`
- Build error: duplicate `loadMore` function definition
- Build error: `signals` referenced before initialization (hook ordering)
- Build error: `revalidateOnMount: false` prevented initial data fetch
- Runtime error: API response shape mismatch (`{ data: [] }` vs direct array)
- Runtime error: `stats` prop shape mismatch between `StatsBar` and page component
- Docker: frontend container serving blank page (stale build without new files)
- Docker: `docker compose` v2 vs `docker-compose` v1 compatibility
- Git: merge conflict markers in `docker-compose.prod.yml` on VPS
- Git: untracked `scripts/` folder blocking `git pull` on VPS
- CORS: browser blocking `localhost:3000` fetches from HTTPS origin
- Scroll: infinite scroll jumping to top on load more — fixed with scroll position preservation
- Scroll: CSS `columns` redistributing items causing scroll reset — switched to grid, then restored masonry with `useLayoutEffect` scroll restoration

### Removed
- `docker-compose.prod.yml` volume mounts (production isolation)
- Backend volume mounts in `docker-compose.yml` (production consistency)
- `asChild` prop usage on `Button` components
- `ThemeProvider` context dependency in `Header`
- `ScrollArea` component in favor of native `overflow-y-auto`
- "Load More" button replaced with infinite scroll sentinel
- Hardcoded `localhost:3000` API URLs in frontend

---

## [2026-04-04] — Initial Release

### Added
- NestJS backend with RSS feed scheduler
- Drizzle ORM + PostgreSQL database
- Redis caching and AI rate limiting
- Groq + OpenRouter dual-provider AI pipeline
- Next.js 16 frontend dashboard
- Admin portal (login, categories, sources management)
- Docker Compose multi-container setup
- Signal scoring engine (keyword-based)
- Discord webhook alerts for high-impact signals
- Database backup system (daily cron + manual trigger)
