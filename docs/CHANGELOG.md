# Changelog

All notable changes to SignalStack will be documented in this file.

---

## [2026-04-19] — PicoClaw Orchestrator, Mac Local AI Tier & Admin Dashboard Updates

### Added
- **PicoClaw Orchestrator**: Lightweight Python/Flask service (LXC container) acting as a smart routing layer for AI requests.
  - Tiered routing: Groq (Primary) → PicoClaw (Mac Local) → OpenRouter → VPS Local.
  - Health check system: 300ms fast-fail, Redis caching (60s TTL).
  - Circuit Breaker: 3 failures / 60s reset in NestJS `PicoClawService`.
- **Mac Local AI Provider** (`mac_local`): Direct integration for llama.cpp running on Mac (M1/M2/M3).
  - Configurable endpoint (LAN/Tailscale), timeout, and enabled state via Admin Dashboard.
  - High-quality signal routing: triggered if score >= 7 or Groq output is low-quality.
  - `isLowQuality` helper: detects short summaries (<20 chars) or generic AI boilerplate.
- **Admin Dashboard Enhancements**:
  - **Live AI Status Header**: Real-time status dots (🟢/🔴/⚫) for Groq, OpenRouter, PicoClaw, and Mac Local.
  - **Mac Local Configuration Card**: Integrated UI for managing the Mac M1 LLM tier (endpoint, timeout, test connection).
  - **AI Provider Labels**: Technical `aiProvider` strings mapped to user-friendly labels (e.g., "Pico Mac", "Mac Local") in Signal Detail Modals and Admin list.

### Fixed
- **llama.cpp Reachability**: Resolved "Connection Refused" by binding Mac server to `0.0.0.0` (LAN access for LXC).
- **AI Provider Display**: Added `getProviderLabel` utility to ensure "Mac Local" is correctly identified in the UI.

### Study Guide
- Section 29: PicoClaw Orchestrator Architecture
- Section 30: Mac Local LLM Integration (llama.cpp)
- Section 31: Advanced AI Pipeline Tiering

---

## [2026-04-17] — Auth Fix, AI Limit & OSM Query

### Fixed
- **Admin session logout**: JWT access token expiry `'15m'` → `'7d'`; cookie `maxAge` updated to match. Admins now stay logged in for 7 days.
- **AI signal backlog**: `ai_daily_limit_reached` was firing at limit=150. Redis counter was at 1759. Raised `AI_DAILY_LIMIT` default to 500 in `docker-compose.prod.yml`. Manually deleted Redis key to immediately unblock queue.
- **OSM nearby query**: added `way` type support + `out center`, required `["office"]` tag on all clauses — eliminates banks/hospitals/mills from results. Cache key bumped v3→v4.

### Study Guide
- Section 26: Admin Auth Session & Token Expiry
- Section 27: AI Daily Limit & Signal Backlog
- Section 28: OSM Nearby Query Improvements

---

## [2026-04-17] — Unit Tests, DB Fixes & Load Testing

### Added
- **DirectoryCrawlerService unit tests**: 35 tests covering BACCO extractor, bdjobs extractor, bank filter, BASIS JSON parsing, CRAWLER_SOURCES metadata
- **Visitors cleanup cron**: daily at 3 AM, 90-day retention (`VISITOR_RETENTION_DAYS` env)
- **k6 `vps` scenario**: 3 VUs, 60s, ~1 req/s — safe for Proxmox personal VM
- **Health check admin section**: 4 admin endpoints checked, 401 = guard active (correct)

### Changed
- `companies`: dropped redundant `savedAt` column (identical to `createdAt`)
- `companies`: added unique index on `(name, source)` — prevents duplicate crawler saves
- `docker compose` v2 now used for all VPS deployments (v1 fails with `KeyError: ContainerConfig` on newer Docker)

### Notes
- k6 from Mac blocked by Tailscale kernel extension — run from VPS (`/tmp/k6-v0.55.0-linux-amd64/k6`) targeting `localhost:3000`
- k6 VPS results: 100% pass, 0% errors, avg 21ms, p95 82ms

---

## [2026-04-17] — Directory Crawler, Bank Filter & Endpoint Audit

### Added
- **Directory Crawler** (`DirectoryCrawlerService`): manually-triggered admin feature to scrape company directories from BASIS, BACCO, and bdjobs. Accessible via 3rd tab on `/admin/companies`.
  - BASIS: uses JSON API (`/get-member-list?page=N`) — SPA HTML is useless, API discovered via JS bundle analysis
  - BACCO: fixed URL to `/member-list`, linear indexOf extractor, fixes double-slash href bug (`https:////` → `https://`)
  - bdjobs: fixed URL to `Company_list.asp`, extracts company names from `Org-name` divs
  - All extractors regex-free (no backtrack risk), sequential requests, 1.5–3s random delay, bail on 429/503
- **Bank filter for bdjobs**: name-based exclude regex drops banks, financial institutions, and insurance companies before they reach admin UI

### Changed
- `docker compose` v2 now used for deployments on VPS (old `docker-compose` v1 fails with `KeyError: ContainerConfig` on newer Docker versions)

### Audited
- All 11 controllers reviewed — no invalid or orphaned endpoints found

---

## [2026-04-17] — AI Pipeline Reorder, Mobile UX & Dev Tooling

### Changed
- **AI Provider Order**: Reversed provider chain from `local → groq → openrouter` to `groq → openrouter → local`. Local llama.cpp is now last resort only, preventing 100% CPU usage on the VPS during normal operation. Admin toggle for local AI remains in the dashboard.
- **Critical Alerts Stat**: "Critical Alerts" in the stats bar now shows last 24 hours only (consistent with "Activity 24h"). Previously showed all-time count.
- **Column Control Bar (Mobile)**: Restructured from a single overflowing flex row to a two-row responsive layout — filter pills on top, source/sort/bookmark on bottom. Both rows scroll horizontally on small screens. All buttons marked `shrink-0`.
- **Column Dropdowns**: Switched from `absolute` + `offsetLeft` positioning to `fixed` + `getBoundingClientRect`, fixing clipping inside scrollable containers on mobile.

### Fixed
- **Admin Metrics TypeError**: `metrics.translation.latency.toFixed is not a function` — backend returns latency as `Record<string, {avgMs, count}>` (per-provider), not a number. Frontend type corrected and display now shows average across active providers.
- **Stats Bar Light Mode Contrast**: Icon colors bumped from `*-600` to `*-700` in light mode (emerald, red, amber) for improved visibility against `*-100` backgrounds.

### Added
- **Drizzle Studio (Dev)**: Added `drizzle-studio` service to `docker-compose.dev.yml`. Runs `npx drizzle-kit studio` on `127.0.0.1:4983` — localhost only, not exposed in production. Shares `node_modules_backend` volume to avoid reinstall overhead.

---

## [2026-04-16] — Frontend Stability & Dependency Fixes

### Fixed
- **Next.js Config**: Resolved `SyntaxError` in `next.config.mjs` by removing TypeScript type annotations that were accidentally included in the ES module file.
- **Dependency Conflicts**: Fixed a major peer dependency resolution failure between `Next.js 16`, `React 19`, and `react-simple-maps` using `--legacy-peer-deps`.
- **Hydration Mismatch**: Fixed a critical hydration error in the main dashboard where `mobileTab` state was being initialized from `localStorage` during the initial server-render/hydration phase.
- **Tooltip Positioning**: Corrected Geographic Heatmap tooltip positioning by switching to `fixed` coordinates, ensuring it tracks the mouse accurately regardless of viewport scrolling.
- **Code Structure**: Reorganized `Column.tsx` imports and removed redundant definitions for better maintainability.

---

## [2026-04-15] — Admin Security & Analytics Enhancement

### Added
- **Translated Signals Metric**: Added "Total Translated Signals" to the admin dashboard analytics. Tracks signals with at least one non-English translation stored in the `jsonb` translations field.
- **Admin Auth Guards**: Implemented automatic 401/error redirects to `/admin/login` across all admin pages (`Dashboard`, `Categories`, `Sources`).

### Fixed
- **i18n Navigation Robustness**: 
    - Marked `Footer.tsx` as a Client Component to resolve `useParams` build errors.
    - Standardized `Link` usage in `bottom-nav.tsx` and `footer.tsx` to ensure locale prefixes are correctly applied (or bypassed for `/admin`) across all routes.
    - Added missing `useEffect` imports in admin pages to fix TypeScript build failures.

---

## [2026-04-15] — i18n Routing Fixes & Language Switcher Redesign

### Fixed
- **Middleware Matcher**: Broadened next-intl middleware to catch all routes (e.g. `/trends`, `/changelog`) and redirect to locale-prefixed paths, preventing `useLocale()` crash outside `NextIntlClientProvider`.
- **Admin Excluded from Locale Routing**: `/admin/*` bypasses locale middleware — served at `/admin` with no prefix.
- **Locale-Aware Navigation Links**: `header.tsx`, `footer.tsx`, and `bottom-nav.tsx` now use locale-aware `Link` from `@/navigation` so URLs preserve the active locale on navigation. Admin tab in bottom-nav intentionally keeps plain `next/link`.
- **Active State Detection**: `bottom-nav.tsx` switched to `usePathname` from `@/navigation` (strips locale prefix) so tab active states resolve correctly across all locales.

### Changed
- **Language Switcher**: Replaced button-row UI with a compact `<select>` dropdown styled to match the header aesthetic (`h-9`, `rounded-xl`, `accent/20` background).

---

## [2026-04-14] — Phase 6g/h: Distributed Multi-language System (i18n)

### Added
- **Async AI Translation Queue**: Converted slow, synchronous translation logic into a non-blocking asynchronous pipeline via RxJS and Queue mechanisms to prevent API lag.
- **Smart Priority & Analytics**: Translations now verify usage limits and only fire automatically for intelligence signals with an initial score of 7 or higher. Language popularity metrics now track target translation queries to aid warm-caching.
- **Multi-tiered Resilient Caching Layer**: Pre-warming translation keys leveraging Redis background jobs processing trending signals. Enforced locking primitives (`NX` parameter via `setLock`) securing cross-container distributed environments.
- **Failover Logic Enhancement**: `try/catch` chain for `AIService.translate` guaranteeing continuous translations if primary LLM proxies report internal server degradation over multiple queries. 

### Fixed
- **Latency Impacts**: Feed payload operations resolving <50ms avoiding the blocking ~1200ms processing delay imposed by raw completion wait.

---

## [2026-04-14] — Phase 6f: UI Stabilization & Positioning

### Fixed
- **Dropdown Positioning Logic**: Resolved a bug where "Source" and "Sort" dropdowns were offset or overlapping content when the top analytics bar was hidden.
- **Context-Aware Layout**: Migrated dropdowns from viewport-relative `fixed` positioning to parent-relative `absolute` positioning, ensuring they track perfectly during layout transitions.
- **Z-Index Layering**: Enforced strict `z-index` stacking on column control bars to ensure dropdowns always overlap signal cards and scrollable content.

---

## [2026-04-14] — Phase 6b: Geographic & Source Intelligence

### Added
- **Premium Research-Grade AI Feeds**: Integrated 10+ high-reliability sources including **OpenAI**, **Anthropic**, **Google DeepMind**, **Hugging Face**, **BAIR (Berkeley)**, **MIT AI News**, **Stanford HAI**, **The Gradient**, **MarkTechPost**, and **VentureBeat AI**.
- **Interactive Map Zoom**: Added `ZoomableGroup` to the Geographic Intelligence heatmap for precision navigation and country inspection.
- **Global UI Footer**: Integrated a professional footer into **Trends** and **Admin** pages for improved navigation and branding.
## [2026-04-14] — Phase 6d: Test Suite & Tooling

### Added
- **Production-grade Test Suite**: Scaffolded `backend/test/` structure emphasizing zero-regression principles. Tests simulate bot heuristics, IP extraction, and backend tracking paths dynamically.
- **Drizzle Studio (Local Only)**: Introduced a developer-only `signalstack-drizzle-studio` service directly into `docker-compose.yml`. Bound cleanly to localhost (127.0.0.1:4983) and strictly omitted from `docker-compose.prod.yml` to ensure high operational security.
- **GeoIP Mocking Structure**: Fully decoupled MaxMind integrations from logic pathings to allow deterministic testing regardless of host environment map presence.

---

## [2026-04-14] — Phase 6c: IP Resilience & Security

### Added
- **Smart Tab Hiding**: Automatically hides empty columns during filtered views (country/search) to maximize relevance and screen real-estate.
- **UX Reset Logic**: Dashboard now force-enables all category sections when a country is selected from the heatmap to prevent empty result screens.
- **Mobile Map-to-Feed Sync**: Auto-switches to the most relevant tab (Geopolitics) when navigating from the map on mobile devices.
- **IP Intelligence & Enrichment**: Integrated MaxMind GeoLite2 for automated visitor geolocation (Country, City, Lat/Long).
- **Passive Bot Detection**: Implemented heuristics to identify and flag crawlers/bots (User-Agent string matching + request volume monitoring).
- **Security Hardening**: Dockerized automated GeoIP updates and enforced read-only volume mounting for sensitive map databases.
- **Async Enrichment Pipeline**: Implemented non-blocking ingestion for IP data to ensure zero latency impact on visitor tracking.

### Fixed
- **Geographic Projection**: Switched to `geoEqualEarth` and stabilized with `world-atlas` TopoJSON to resolve map distortion.
- **Data Mapping Layer**: Resolved mismatch between backend ISO-A2 codes and frontend numeric IDs via a robust `ID_TO_ISO` mapping.
- **Reactive Map Fix**: Removed invalid `maxZoom` property that caused production build failures.
- **Source Health Re-verification**: Replaced broken RSS feeds (Meta, Stability) with verified healthy alternatives.
- **JSX Syntax Errors**: Resolved component nesting and layout issues inherited from the AdminLayout migration.

---

## [2026-04-13] — Phase 6a: AI Pipeline & UI Resilience

### Added
- **AI Content Fallback**: Summarizer now defaults to the signal title if the RSS feed provides no description (targets TLDR-style feeds).
- **Boilerplate Suppression**: AI providers now block generic LLM error messages from polluting the database summaries.
- **Admin AI Cleanup Tool**: New endpoint and dashboard utility to reset signals containing boilerplate AI responses.
- **Focus Mode & Flexible Layout**: Implemented card layout optimizations to prevent squishing and ensure readability in high-density views.
- **Premium Diagnostic Suite**: `scripts/test-endpoints.sh` with animated terminal UI, payload previewing, and latency benchmarking.
- **Self-Healing AI Queue**: Automatically re-queues unprocessed high-score signals on container restart.

### Fixed
- **Local AI Race Condition**: Removed 4s hardcoded timeout that was causing local AI to prematurely failover to Groq.
- **AI Timeout Calibration**: Increased provider timeouts to 35s to accommodate low-RAM VPS inference speeds.
- **Retry Logic Expansion**: Admin retry tool now detects signals that were "pending" but never formally "failed."
- **Terminal UI Architecture**: Corrected ASCII diagrams and documentation for the triple-column stream.

### Changed
- **Deployment Strategy**: Replaced unsafe GitHub Actions with a secure `deploy-signal` shell alias and zero-downtime `deploy.sh` script.
- **UI Spacing Polish**: Refined margins and paddings globally for a tighter, "clinical" professional aesthetic.

---

## [2026-04-12] — Phase 5: Email Digest & Mobile Overhaul

### Added
- **Email Digest System**: Daily HTML summaries of high-impact signals delivered via Gmail SMTP.
- **Mobile Navigation 2.0**: 5-column bottom navigation with centered, animated search and tab switching.
- **Technology Focus Filter**: Restructured email digests to focus exclusively on the "technology" category.
- **Search Context**: Centralized search state allowing seamless transitions between desktop and mobile search bars.

### Fixed
- **Email Rendering**: "Bulletproof" CSS overhaul to fix badge/timestamp overlap in mobile mail clients.
- **Spam Prevention**: Removed on-startup email triggers to prevent duplicate notifications during maintenance.

---

## [2026-04-10] — Phase 4: Trends & Analytics

### Added
- **Trends Dashboard**: Interactive analytics suite with 6 charts (volume, top sources, category breakdown, severity, AI providers, geo heatmap).
- **Visitor Tracking**: Persistent visitor statistics with PostgreSQL storage and realtime dashboard counter.
- **Signal Detail Modal**: High-fidelity modal for deep-reading signal content without leaving the dashboard.
- **Severity Visuals**: Color-coded side stripes on cards for instant status scanning (High/Med/Low).
- **Bookmark System**: Personalized "Save for later" functionality with database persistence.

### Fixed
- **HTML Entity Decoding**: Full support for numeric entities (e.g., `'`) in titles and summaries.
- **Infinite Scroll Stability**: Fixed "jump to top" issues during data revalidation.

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

---

## [2026-04-18] — Phase 7: Admin Intelligence & System Hardening

### Added
- **Sortable Column Headers**: All admin tables (Signals, Jobs, Sources, Categories, Companies saved) now have clickable sortable headers with asc/desc toggle and directional icons (`ChevronUp/Down/ChevronsUpDown`). Sources and Categories sort client-side; Jobs, Signals, Companies use server-side sort via API params.
- **Signal Read/Unread State**: New `is_read` boolean on signals table. Unread signals show a blue dot indicator and subtle row tint. Per-row Eye icon toggle + "Mark All Read" button in top bar.
- **Structured Logs Page**: Admin logs page now shows a real-time structured table (Time / Level / Context / Event / Details) with color-coded level badges and filter buttons. Previously showed nothing — NestJS only wrote to stdout. Fixed by adding `FileLogger` in `main.ts` that writes JSON lines to `logs/app.log`.
- **Cross-Source Job Dedup**: Jobs now deduplicated by `contentHash(title+company)` in addition to `hash(title+url)`. Same posting from multiple boards (e.g. We Work Remotely + Remotive) is now caught. `crossSourceDupes` count logged each cycle.
- **Company → Jobs Link**: Saved companies tab has a search icon next to each company name that links to Jobs page pre-filtered by that company name.
- **Floating Save All Button**: Mobile-only (`md:hidden`) fixed button in Directory Crawler tab — no more scrolling to the bottom to save 2000+ companies.
- **Search Filters on Saved Companies**: Name, source dropdown, and city filters added to saved companies tab with server-side filtering.
- **Deploy `--stop` / `--start` Flags**: `./scripts/deploy.sh --stop` stops app + frontend + llama cleanly; `--start` brings them back without rebuild.

### Fixed
- **saveAllFiltered() Connection Pool Bomb**: Was firing 2935 concurrent HTTP requests for full e-CAB save. Now chunked to 50 at a time — prevents DB connection pool exhaustion.
- **Missing DB Indexes**: Added `idx_companies_source`, `idx_companies_city`, `idx_jobs_source` — all filter/sort columns now hit indexes instead of full table scans. Added `idx_jobs_content_hash` for cross-source dedup.
- **Llama Restart Policy**: Changed `restart: always` → `restart: unless-stopped` — llama now stays stopped when manually stopped instead of auto-restarting.
- **SortableHead TypeScript**: Added `style?: React.CSSProperties` prop — was missing, caused build failure on VPS.

### Changed
- **Job Retention**: Default 14 days → 30 days (`JOB_RETENTION_DAYS` in compose).
- **Signal Retention**: Dual-tier: low-score signals expire at 30 days, high-score (≥7) at 90 days.
- **Logs Architecture**: NestJS `ConsoleLogger` extended to `FileLogger` — writes JSON structured lines simultaneously to stdout and `logs/app.log`.

### Infrastructure
- **VPS DB Backup**: Full `pg_dump` snapshot taken to `backup/signalstack_20260418_130244.sql` (5.8MB) before any schema changes. `backup/` gitignored.
- **Migration 0002**: `IF NOT EXISTS` indexes — safe on existing VPS data.
- **Migration 0003**: `ALTER TABLE ADD COLUMN` for `content_hash` (jobs) and `is_read` (signals) — zero data loss.
- **Mac Cleanup**: Freed ~22GB from `claudevm.bundle`, browser caches, Homebrew tarballs, JetBrains cache, logs.
- **OrbStack / VS Code**: Stopped to reduce RAM pressure. Swap dropped from 9.2GB → 3.9GB.

---

## [2026-04-19] — Company Radar v2, Scoring Optimization & Translation Quality Tiers

### Added
- **Google Places API integration** (`places.googleapis.com/v1/places:searchNearby`): New Radar source using the modern Places API (New). Uses `POST` with `X-Goog-Api-Key` header + `X-Goog-FieldMask`. Returns up to 20 results per query.
- **Mapbox Search API integration** (`/search/searchbox/v1/category/software`): New Radar source using Mapbox Searchbox v1 (not v6 — v6 is 404). Requires `proximity=lng,lat` parameter. Returns up to 25 results.
- **Admin toggles for Radar sources**: OSM, Google Places, Mapbox can be individually enabled/disabled from Admin Settings → Radar Data Sources panel. State persisted in `settings` table.
- **Universal API key testing tool** (`POST /api/admin/keys/test`): Test Groq, OpenRouter, Google Places, or Mapbox keys live from Admin Settings without leaving the UI. Returns `{ status: 'healthy' }` or `{ status: 'error', error: '...' }`.
- **Google + Mapbox key management**: `/api/admin/keys` now returns masked values for `google` and `mapbox`. `/api/admin/keys` PUT accepts `provider: 'google' | 'mapbox'`.
- **CSV Signal Export** (`GET /api/admin/signals/export/csv?days=N`): New "Export Reports" tab in Admin Signals page. Downloads signal history as CSV for offline analysis.
- **Dual-tier translation quality**: Signals with score ≥ `translationThreshold` (default 7) get full speculative translation. Signals below threshold get `translateLowPower()` — cheaper, faster. Threshold configurable from Admin Settings.
- **Background crawl with toast notification**: Directory crawler now runs in background via `CrawlContext`. UI shows toast on completion instead of blocking.

### Fixed
- **Mapbox API version**: was calling v6 endpoint (404). Corrected to v1 (`/search/searchbox/v1/category/`).
- **Mapbox health check**: was missing required `proximity` parameter. Added `proximity=90.41,23.81` (Dhaka) to health check request.
- **Google Places**: was using deprecated Places API (v1 text search). Upgraded to `places.googleapis.com/v1/places:searchNearby` with proper `X-Goog-Api-Key` header auth.
- **`Response` type import error** in `AdminSignalsController`: resolved TypeScript build failure.
- **TranslationQueue priority scope error**: `priority` variable was accessed outside its declared scope. Fixed by hoisting declaration.
- **Discord news/job separation**: `jobsWebhookUrl` no longer falls back to main webhook. If `DISCORD_JOBS_WEBHOOK_URL` is not set, job alerts are silently skipped — news and job alerts are now strictly separated channels.
- **SettingsPage syntax error**: resolved build-breaking syntax error.

### Changed
- **OSM nearby query broadened**: added `amenity=company`, `company`, and `building=commercial` tags to Overpass query. Result cap raised 100 → 200.
- **Scoring mechanism optimized**: `ENTITY_RULES` now use pre-compiled `RegExp` arrays instead of constructing `new RegExp()` per signal per entity. `text.toLowerCase()` computed once and reused across all keyword rules.
- **Admin dashboard labels simplified**: section titles and labels cleaned up for readability.
- **Mobile card layout compacted**: column title bar hidden on mobile (`hidden sm:flex`). Stats bar shrunk. Filter buttons smaller (`h-6 sm:h-7`). ART tab label fixed.
- **Radar cache key bumped**: v8 → v11 (new sources added). Cache now keyed by `source` param.

### Study Guide
- Section 43: Company Radar v2 — Google Places & Mapbox Integration
- Section 44: Dual-Tier Translation Quality System
- Section 45: Scoring Engine Optimization
