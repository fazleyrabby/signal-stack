# Changelog

All notable changes to SignalStack will be documented in this file.

---

## [2026-04-13] — 2026 AI Intel Update

### Added
- **Dedicated AI Category**: Introduced `ai` category slug for precision intelligence monitoring.
- **Triple-Column Terminal**: Home dashboard upgraded to support 3 synchronous columns (Geopolitics | Tech | AI).
- **Premium 2026 Feeds**: Integrated high-trust feeds from Google DeepMind, Anthropic, BAIR, NVIDIA, and independent curators (Import AI, Pragmatic Engineer).
- **View Persistence**: Dashboard column visibility (toggle state) now persists in local storage.
- **Mobile AI Tab**: Dedicated third tab added to mobile navigation for focus on AI signals.

### Changed
- **OpenAI Feed Polish**: Updated legacy RSS URL to the consolidated 2026 `openai.com/news/rss.xml`.
- **MIT Tech Review Refinement**: Switched from general tech to AI-specific high-signal RSS feed.
- **Source Migration**: Re-categorized existing AI feeds (TechCrunch AI, VentureBeat AI) into the new `ai` category.

---

## [Unreleased]

### Added
- **Geographic Heatmap Optimization**: Switched to `geoEqualEarth` projection and `world-atlas` TopoJSON for accurate, distortion-free global visualization.
- **AI Source Enrichment**: Integrated 10+ high-reliability research feeds including **OpenAI**, **Anthropic**, **Google DeepMind**, **Hugging Face**, **BAIR (Berkeley)**, **MIT AI News**, **Stanford HAI**, **The Gradient**, **MarkTechPost**, and **VentureBeat AI**.
- **Verified Source Health**: All new AI RSS feeds verified for 2026 connectivity and schema compatibility via manual health checks.
- **UI Footer**: Added a global footer to **Trends** and **Admin** dashboard pages for improved navigation and professional branding.
- **Admin Layout**: Introduced a dedicated `AdminLayout` component to ensure consistent UI across all administrative sub-pages.

### Fixed
- **Geo-Mapping Logic**: Resolved the mismatch between backend ISO-A2 codes and frontend numeric IDs by implementing an explicit `ID_TO_ISO` mapping layer.
- **Heatmap Dark Mode**: Optimized color contrast for dark mode by switching null-data fill to deep slate (`#1e293b`) and boosting heat intensity for active regions.
- **Geo-Map Bug**: Removed invalid `maxZoom` prop from `ZoomableGroup` that was causing production build failures.
- **Broken AI Feeds**: Replaced 404/403 errored feeds (Meta, Stability, Microsoft Research) with verified healthy alternatives.

### Changed
- **Trends Layout**: Updated Trends page to use `min-h-screen` flex-col layout to accommodate the new footer while keeping the main feed clean.
- **Geo-Mapping Utility**: Expanded `backend/src/common/geo.util.ts` to correctly attribute new academic and research domains to their respective countries.

### Added
- **AI Content Fallback**: Signal title is now used for summarization if the RSS feed provides no description (specifically targeting TLDR AI style feeds).
- **Boilerplate Suppression Filter**: AI providers now detect and block common LLM error messages (e.g., "I don't see any content") from being saved as summaries.
- **Admin AI Cleanup**: New `POST /api/admin/ai/cleanup` endpoint and dashboard utility to identify and reset signals with boilerplate summaries.
- **AI startup requeue**: On container restart, `AIQueue.onModuleInit` automatically re-queues up to 50 unprocessed signals (score ≥ 7) after a 5s delay — no manual retry needed after deploys
- **Shell alias deploy**: `deploy-signal` alias in `~/.zshrc` SSHs into VPS and runs `deploy.sh` for one-command deploys from local machine
- **Premium Diagnostic Suite**: `scripts/test-endpoints.sh` added with animated terminal UI, payload previewing, and latency benchmarking for all core API endpoints
- **Mobile Navigation Overhaul**: 5-column bottom navigation with centered, animated search popup and global search state synchronization
- **High-Density UI Refinement**: Reduced global padding, card gaps, and header height to maximize screen real-estate and information density
- **Email Digest Polish**: Overhauled HTML email template with "bulletproof" CSS (inline-block margins) to fix badge/timestamp overlap across all email clients
- **Technology Digest Filter**: Daily digest restricted exclusively to the "technology" category as requested for cleaner focus / less noise
- **Gmail SMTP Integration**: Successfully configured Gmail SMTP via App Passwords with env-based configuration for production signal delivery

### Changed
- **Header Optimization**: Stats bar now hidden by default on mobile to prioritize signals. Toggle renamed to "Stats" with visual active state indicator
- **Global Search Context**: Search state migrated from local components to a centralized `SearchContext`, enabling seamless search between top-nav (desktop) and bottom-nav (mobile)
- **UI Spacing Polish**: Refined all component margins and paddings (`Card`, `Header`, `Column`, `StatsBar`) for a tighter, more professional "clinical" aesthetic

### Fixed
- **Local AI never processing** (`ai.service.ts`): hardcoded 4s `Promise.race` was overriding the provider's 35s AbortController — local AI always lost the race and fell back to Groq. Removed the race entirely; provider timeout is now authoritative
- **Local AI timeout too short** (`local.provider.ts`): increased from 15s → 35s, reduced `max_tokens` 60 → 40, content slice 200 → 120 chars to fit within VPS CPU inference speed (~3.2 tok/s)
- **Retry button missed pending signals** (`admin.service.ts`): `getFailedAISignals()` only queried `ai_failed=true`, missing signals that were pending but never failed. Now queries all `ai_processed=false AND score>=7`
- **Deployment Spam Protection**: Removed automatic on-startup email trigger in `EmailScheduler` to prevent duplicate notifications during maintenance/deployments
- **SMTP Routing Fix**: Corrected `ADMIN_EMAIL` and `SMTP_USER` environment mappings on VPS to resolve "Address not found" bounce-backs

### Changed
- **Deploy workflow**: removed GitHub Actions self-hosted runner (unsafe for public repos — forks could run arbitrary code on VPS). Replaced with `deploy-signal` shell alias for one-command local→VPS deploys
- **`scripts/deploy.sh`**: zero-downtime rewrite — pre-build while live, fast-swap (~3–5s downtime), auto-rollback on health check failure, retry-loop health checks replacing fragile `sleep`
- **Discord Noise Reduction**: Refined alert logic: **Technology** (Med+High score alerts) vs **Geopolitics** (High score alerts only). Replaced the rigid `filterTechOnly` flag with a dynamic category-aware severity threshold.

### Added
- **Public RSS Feed**: `GET /api/feed.xml` returns RSS 2.0 with last 50 signals (score >= 5)
- **RSS query parameters**: `?category=geopolitics`, `?severity=high`, combined filters
- **RSS icon in header**: desktop-only RSS link to `/api/feed.xml`
- **RSS link tag**: `<link rel="alternate">` added to frontend layout metadata
- **Trends Analytics page**: `/trends` with 6 interactive charts (volume, top sources, category breakdown, severity, AI providers, geo heatmap)
- **Trends API endpoint**: `GET /api/signals/trends` returning 30-day aggregated data
- **Environment-based AI routing**: Local-only mode for development (no external API calls)
- **AI provider breakdown** endpoint: `GET /api/signals/ai-providers`
- **High severity retry** endpoint: `POST /api/admin/ai/retry/high`
- **High Pending** counter in dashboard stats
- **AI Provider cards** in admin dashboard showing provider usage
- New environment variables: `AI_EXTERNAL_ENABLED`, `AI_PROCESS_DELAY`, `AI_MAX_WORKERS`, `AI_DAILY_LIMIT`
- Dynamic LLM model selection with searchable dropdown in admin dashboard (Groq + OpenRouter)
- **Visitor tracking**: Persistent visitor stats with PostgreSQL storage (`visitors` table)
- **Visitor API**: `POST /api/visitors` (track visit), `GET /api/visitors/stats` (get stats)
- **Visitor counter** displayed on homepage header (realtime) and admin dashboard (total + realtime)
- **Source Health Checker**: Admin can check RSS feed health status from Sources page
- `SearchableModelSelect` component with real-time filter by model name/ID
- Backend model management API: `GET/PUT /api/admin/ai/models`, `POST /api/admin/ai/models/refresh`
- `SettingsService` for persisting AI model configuration in database
- `settings` table in database schema for key-value configuration storage
- Model fetching from Groq and OpenRouter APIs with caching and static fallbacks
- Dozzle authentication enforcement via `DOZZLE_AUTH_PROVIDER: simple`
- Persistent backup volume (`backups:`) so database backups survive container rebuilds
- **Signal Detail Modal**: click any card to view full title, AI summary, content preview, metadata, and direct link to original article
- **Severity color stripes**: left border on signal cards (red/amber/blue) for instant visual scanning
- **Mobile search**: search input now visible on all screen sizes
- **UX font improvements**: minimum font sizes bumped for accessibility
- **Bookmark System**: Save/bookmark signals with API endpoint `GET/POST /api/bookmarks`, persisted in database
- **Email Digests**: Scheduled daily email digest of high-impact signals
- **Geographic Heatmap**: World map on `/trends` showing signal counts by country with hover tooltips and click-to-filter
- **Geo API endpoint**: `GET /api/signals/geo` returning `[{country, count}]`
- **Country extraction**: URL-based country code extraction (bbc→GB, nytimes→US, etc.)

### Changed
- **Local AI optimized for low-resource VPS**: context window 1024→512, max_tokens 15→60, output cap 80→150 chars, directive prompt format for better small-model compliance
- **Production defaults**: `LOCAL_AI_ENABLED=true`, `DISCORD_FILTER_TECH=true`, llama batch-size aligned to 64 across dev/prod
- **Signal Detail Modal**: HTML preview now stripped of tags, mobile viewport height constraint with scrolling body, bookmark/Explore buttons use stopPropagation to prevent modal popup
- **Card Bottom UI**: restyled to flex-col with badges and actions on separate rows for better spacing

### Fixed
- **Numeric HTML entities in titles**: `&#8217;` (`'`), `&#8220;` (`"`), etc. now decoded in both titles and content — previously only named entities were handled
- **Signal detail modal**: fixed type mismatch on close handler, fixed "Read Original" button not navigating (Button doesn't support href), improved spacing and transitions
- **Dialog transitions**: `tw-animate-css` was installed but never imported — animations now work (fade, zoom, slide)
- **HTML in Discord embeds**: RSS content with encoded HTML entities (`&lt;p&gt;`, `&lt;a href="..."&gt;`) now properly stripped — entities are decoded before tag stripping, and `<script>`/`<style>` blocks are fully removed
- Database backups lost on container rebuild — moved from `/app/` to `/app/backups/` on a named Docker volume
- **Signal detail modal**: HTML tags showing in content preview — now stripped before display
- **Signal detail modal**: mobile cutoff issue — modal now has max-height with scrolling body
- **Explore/Bookmark buttons**: clicking triggers parent card click event and opens modal — added stopPropagation
- **Bookmark URL mismatch**: column.tsx using relative `/api/bookmarks` instead of full backend URL — now uses API_BASE
- **Signal card bottom UI**: cramped on small cards — restyled to stack badges and actions on separate rows

### Added
- Error boundary components (`error.tsx`, `global-error.tsx`, `not-found.tsx`) for all routes
- Admin route error boundaries (`admin/error.tsx`, `admin/categories/error.tsx`, `admin/sources/error.tsx`)
- `scripts/audit.sh` — VPS environment health check script
- `scripts/deploy.sh` — zero-downtime deploy script with pre-build, fast-swap, and auto-rollback
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
