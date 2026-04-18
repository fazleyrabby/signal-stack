# SignalStack Study Guide 📡🧠

> **Built entirely with AI agents.** This guide walks you through every piece of the system so you can understand, own, and extend it.

---

## Table of Contents

1. [What Is SignalStack?](#1-what-is-signalstack)
2. [Architecture Overview](#2-architecture-overview)
3. [The Backend: NestJS Engine](#3-the-backend-nestjs-engine)
4. [The Scorer: Keyword & Entity Intelligence](#4-the-scorer-keyword--entity-intelligence)
5. [The Feed Pipeline: RSS Ingestion](#5-the-feed-pipeline-rss-ingestion)
6. [The AI Pipeline](#6-the-ai-pipeline)
7. [Discord Alerts System](#7-discord-alerts-system)
   - 7.4 [Email Digest System](#74-email-digest-system)
8. [Authentication & Admin Portal](#8-authentication--admin-portal)
9. [Database & Drizzle ORM](#9-database--drizzle-orm)
10. [The Frontend: Next.js Dashboard](#10-the-frontend-nextjs-dashboard)
11. [API Reference](#11-api-reference)
12. [Docker Deployment](#12-docker-deployment)
13. [Deployment & Ops Scripts](#13-deployment--ops-scripts)
14. [2026 AI Intelligence Update: Phase 6](#14-2026-ai-intelligence-update-phase-6)
15. [2026 Stability Update: Frontend & Dependencies](#frontend-stability-2026)
16. [2026 Admin UX & Company Radar Update](#admin-ux-2026)
17. [Key Concepts to Learn](#17-key-concepts-to-learn)
18. [Common Commands Reference](#18-common-commands-reference)
19. [Performance & Scaling](#19-performance-scaling)
20. [Troubleshooting Guide](#20-troubleshooting-guide)
21. [Section 26: Admin Auth Session & Token Expiry](#section-26--admin-auth-session--token-expiry)
22. [Section 27: AI Daily Limit & Signal Backlog](#section-27--ai-daily-limit--signal-backlog)
23. [Section 28: OSM Nearby Query Improvements](#section-28--osm-nearby-query-improvements)
24. [Section 29: Directory Crawler Fixes — e-CAB & GitHub Source](#section-29-directory-crawler-fixes--e-cab--github-source-april-2026)
25. [Section 30: Company Radar — Tech Filter for Saved Companies](#section-30-company-radar--tech-filter-for-saved-companies-april-2026)
26. [Section 31: Deploy Script Rollback Fix](#section-31-deploy-script-rollback-fix-april-2026)
27. [Section 32: SignalCard UI Fix — Source Badge Overlap](#section-32-signalcard-ui-fix--source-badge-overlap-april-2026)

---

## 2026 Admin UX & Company Radar Update (April 17, 2026) <a name="admin-ux-2026"></a>

This update covers four major additions: admin UI polish, the Job Signal Extension, a new Company Radar tool, and table UX improvements.

### 1. Job Signal Extension (Full)

The jobs system fetches remote/tech job listings from free RSS feeds and surfaces them in a dedicated admin table.

**Architecture:**
- `backend/src/jobs/` — `JobsModule`, `JobsService`, `JobsFeedService`, `JobsRepository`, `JobsScheduler`
- `jobs` table: `id, sourceId, source, title, company, location, remote, jobType, salaryRange, experienceLevel, description, url, hash, tags, publishedAt, createdAt`
- Sources stored in the shared `sources` table with `type = 'job'` (vs `'signal'` for news)
- `JobsRepository.getActiveSources()` filters `WHERE type = 'job' AND isActive = true`
- Scheduler: fetch every 30 min, cleanup daily at 2 AM (14-day retention)
- Deduplication: SHA-256 hash of `title + url`

**Free RSS Job Sources (seeded):**
| Source | URL |
|--------|-----|
| We Work Remotely | `https://weworkremotely.com/remote-jobs.rss` |
| Remotive | `https://remotive.com/remote-jobs/feed` |
| Arbeitnow | `https://www.arbeitnow.com/feed` |
| Jobicy | `https://jobicy.com/?feed=job_feed` |

**Discord matching filters** (stored in `settings` table as JSON):
- `keywords` — ANY match triggers alert
- `excludeKeywords` — ANY match discards
- `locations` — location filter
- `remote` — null/true/false preference
- `strictGlobalRemote` — discard country-locked "remote" jobs (US Only, EST required, etc.)

**Admin endpoint:** `GET /api/admin/jobs` — paginated, searchable, admin-only (no public endpoint).

**Key file:** `backend/src/jobs/jobs-feed.service.ts` — RSS parsing with `rss-parser`, HTML stripping, 10s timeout per source, p-limit 5 concurrency.

---

### 2. Admin UI: Drizzle Studio Style Overhaul

All admin pages were redesigned to match Drizzle Studio's compact analytical layout.

**Design Patterns:**
- **Top bar**: `h-8` sticky bar with icon + title + row count badge (`font-mono border px-1.5 py-0.5 rounded`) + action buttons
- **Filter toolbar**: inline `h-7` selects, no card wrapper, `bg-muted/10` background
- **Table rows**: `py-2` cell padding, `border-border/30` row dividers, `hover:bg-muted/20` hover
- **Text hierarchy**: `text-xs` content → `text-[10px]` meta → `text-[9px]` badges
- **Full-height layout**: `flex flex-col h-full overflow-hidden` on page + `flex-1 overflow-auto` on table wrapper = viewport-filling scrollable table

**Layout fix in `admin/layout.tsx`:**
```tsx
// Before: overflow-y-auto (broke full-height tables)
// After:
<main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
  {children}
</main>
```

**Pages updated:**
- `frontend/src/app/admin/signals/page.tsx` — signals table + per-row translate button + bulk translate
- `frontend/src/app/admin/sources/page.tsx` — sources with health check, active toggle
- `frontend/src/app/admin/categories/page.tsx`
- `frontend/src/app/admin/jobs/page.tsx` — tabbed: Live Feed + Discord Filters
- `frontend/src/app/admin/page.tsx` — dashboard cleanup, moved config to Settings

---

### 3. Settings Page

Separated config from the dashboard into `/admin/settings`.

**Sections:**
1. **Appearance** — dark/light `Switch` toggle
2. **AI API Keys** — Groq + OpenRouter: masked display, source badge (`db`/`env`/`none`), status dot, password input + Save with spinner, "✓ Saved" feedback
3. **Discord Webhooks** — signals + jobs URL inputs, Test button per field (Zap icon), inline success/error feedback, Save button

**Key file:** `frontend/src/app/admin/settings/page.tsx`

---

### 4. Per-Row Translation Button

The signals table translate action was broken (SelectTrigger showed double chevron, no loading state).

**Fix — custom `TranslateButton` component** (`frontend/src/app/admin/signals/page.tsx`):
```tsx
function TranslateButton({ signalId, isTranslating, onTranslate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // mousedown outside-click closes dropdown
  // shows Loader2 spinner when isTranslating
  // custom dropdown: Bengali / Spanish / English
}
```

`translatingId` state tracks which row is currently being processed — only that row shows the spinner.

**Why SelectTrigger was broken:** shadcn `SelectTrigger` always injects a `ChevronDown` SVG as last child. The fix `[&>svg:last-child]:hidden` was a workaround; the final solution replaces Select entirely with a custom component.

---

### 5. Company Radar Feature

A new admin tool to discover IT/tech companies near any location and auto-detect career pages.

**How it works:**
1. User types a city name → geocoded via **Nominatim** (free OpenStreetMap API, no key needed)
2. Or clicks "My Location" → `navigator.geolocation.getCurrentPosition()`
3. Selects radius: 5 / 10 / 20 / 50 km
4. Backend queries **Overpass API** (OpenStreetMap) for `office=company|tech|it|software` nodes near those coordinates
5. For each company with a website, sends HEAD requests to `/careers`, `/jobs`, `/work-with-us`, `/join-us` (4s timeout, p-limit 5)
6. Results cached in Redis: key `companies:nearby:{lat}:{lng}:{radius}`, TTL 1 hour
7. User clicks **Save** to persist a specific company to the `companies` DB table

**New DB table:**
```ts
companies: {
  id, name, website, careerUrl, careerPageFound,
  city, country, lat, lng, osmId, tags, savedAt, createdAt
}
```

**Backend module:** `backend/src/companies/` — controller, service, repository, module
- `GET /api/admin/companies/nearby?lat=X&lng=Y&radius=10000`
- `POST /api/admin/companies/save`
- `GET /api/admin/companies/saved`
- `DELETE /api/admin/companies/:id`

**Frontend:** `frontend/src/app/admin/companies/page.tsx`
- Two tabs: "Nearby Search" (card grid) + "Saved" (table)
- Cards show: name, city, tags badge, website link, career page status (✓/✗), Save button
- Error handling: only redirects to login on HTTP 401 (not 500s from missing table, etc.)

**Key constraint:** OSM company data quality varies by city — major tech hubs (Berlin, London, SF) have better coverage than smaller cities.

---

### 6. Resizable Table Columns

All 5 admin data tables now support drag-to-resize columns.

**Implementation (no external library):**

```ts
// frontend/src/hooks/useResizableColumns.ts
function useResizableColumns(initialWidths: number[]) {
  const [widths, setWidths] = useState(initialWidths);

  const startResize = (colIndex, e) => {
    const startX = e.clientX;
    const startWidth = widths[colIndex];
    // attach mousemove + mouseup to document
    // delta = e.clientX - startX → update widths[colIndex]
    // minimum width: 40px
    // set cursor: col-resize + userSelect: none during drag
    // cleanup on mouseup
  };

  return { widths, startResize };
}
```

```tsx
// frontend/src/components/ui/resize-handle.tsx
// Thin div on right edge of each <th>
// cursor: col-resize on hover, highlights with primary color
<div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-2 cursor-col-resize ...">
  <div className="w-px h-4 bg-border/50 group-hover/handle:bg-primary/60" />
</div>
```

**Tables use `table-fixed` layout** — widths are strictly respected, not suggested.

**Applied to:** Signals, Jobs, Sources, Categories, Companies (saved tab)

---

### 7. Deploy Script

`deploy.sh` added at project root:
```bash
#!/bin/bash
set -e
git pull origin main
docker system prune -f   # ← prevents VPS disk filling up
docker compose -f docker-compose.prod.yml up -d --build
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Why `docker system prune -f`:** VPS disk hit 100% from accumulated build cache layers. This frees dangling images, stopped containers, and unused networks before every deploy (~22GB freed in first run).

---

### 8. Admin Sidebar Navigation

`frontend/src/components/AdminSidebar.tsx` nav items:
```ts
const navItems = [
  { name: 'Dashboard',  href: '/admin',           icon: LayoutDashboard },
  { name: 'Signals',    href: '/admin/signals',   icon: Activity },
  { name: 'Categories', href: '/admin/categories',icon: Layers },
  { name: 'Sources',    href: '/admin/sources',   icon: Rss },
  { name: 'Jobs',       href: '/admin/jobs',      icon: Briefcase },
  { name: 'Companies',  href: '/admin/companies', icon: Building2 },
  { name: 'Logs',       href: '/admin/logs',      icon: Database },
  { name: 'Settings',   href: '/admin/settings',  icon: Settings },
];
```

---

### 9. NestJS DI Fix: Missing Exports in AIModule

**Symptom:** Backend crashed on startup — `GroqProvider`/`OpenRouterProvider` injected in `AdminController` but not exported from `AIModule`.

**Fix in `backend/src/ai/ai.module.ts`:**
```ts
exports: [
  AIQueue, AIService, SettingsService, TranslationQueue,
  MetricsService, RedisService,
  GroqProvider,       // ← was missing
  OpenRouterProvider, // ← was missing
],
```

**Why this matters:** In NestJS, a provider must be in the `exports[]` array of its module to be injectable in any other module. Being in `providers[]` only makes it available _within_ that module.

---

## 2026 Stability Update: Frontend & Dependencies (April 16, 2026) <a name="frontend-stability-2026"></a>

This update resolves critical runtime and build-time issues that emerged during the migration to Next.js 16 and React 19.

### 1. Hydration & SSR Integrity
*   **The Issue**: Client-side state (like  settings) was being initialized in lazy initializers or root-level state definitions. This caused a mismatch between the server-rendered HTML and the initial client render, leading to "Hydration Mismatch" errors.
*   **The Fix**: All state that depends on browser APIs (, ) is now initialized inside . This ensures the server always renders a consistent default state, and the client updates to the persisted state only after mounting.
*   **Key File**: `frontend/src/app/[locale]/page.tsx`

### 2. Next.js 16 ESM Configuration
*   **The Issue**:  was incorrectly using TypeScript syntax (type imports/annotations). While Next.js 16 supports  configs, the project was using  which must be pure JavaScript.
*   **The Fix**: Removed TypeScript-specific code from  to resolve .
*   **Key File**: `frontend/next.config.mjs`

### 3. Dependency Conflict Resolution
*   **The Issue**:  and other legacy packages have peer dependency requirements for React 18 or older, which conflicted with the project's use of React 19 (required by Next.js 16).
*   **The Fix**: Standardized on `npm install --legacy-peer-deps` to bypass strict version tree validation while maintaining architectural compatibility.

### 4. Tooltip & UI Positioning
*   **The Issue**: Tooltips were using  positioning within containers that had their own transform/scroll contexts, causing them to detach from the mouse cursor.
*   **The Fix**: Switched to  positioning using viewport-relative  coordinates, with a guard to prevent tooltips from overflowing the screen edge.
*   **Key File**: `frontend/src/components/geo-heatmap.tsx`

---


## 14. 2026 AI Intelligence Update: Phase 6

Integrated on April 14, 2026, this phase professionalizes the AI stream and geographic intelligence.

### Premium Research-Grade Feeds (Phase 6b)
*   **Labs**: Google DeepMind, OpenAI News, Anthropic.
*   **Academic**: MIT AI News, Berkeley BAIR Blog, Stanford HAI.
*   **Independent Research**: The Gradient, MarkTechPost, VentureBeat AI.
*   **Legacy Enrichment**: Hugging Face Blog (FR), TLDR AI, Ben's Bites.

### Geographic Intelligence Fix
*   **Projection**: Switched to `geoEqualEarth` and stabilized with `world-atlas` TopoJSON to resolve distortion.
*   **Data Mapping**: Implemented a robust `ID_TO_ISO` mapping layer to ensure backend ISO-A2 codes correctly highlight map regions.
*   **End-to-End Filtering**: Fixed the signal feed logic to correctly handle `?country=XX` query parameters, enabling seamless "click-to-filter" from the map to the dashboard.
*   **Smart Tab Hiding**: Columns that contain zero matching results for a specific country or search query are automatically hidden. This eliminates "empty results" noise and allows relevant content to fill the screen.
*   **Visibility Force-Enable**: Clicking any region on the map now automatically enables all three categories (**Geopolitics**, **Tech**, **AI**) on the dashboard, ensuring a comprehensive view of that region's intelligence regardless of previous tab settings.


### Terminal UI Upgrades
*   **Triple-Column Grid**: Monitoring Geopolitics | Tech | AI simultaneously.
*   **Global Footer**: Professional navigation integrated into **Trends** and **Admin** pages while preserving the minimal feed space.
*   **Admin Layout**: Unified `AdminLayout` for consistent navigation across dashboard sub-pages.
### Test Suite & Tooling (Phase 6d)
*   **Production-Grade Testing**: Constructed a `backend/test/` directory adopting strict zero-regression architectures, with mock interfaces replacing actual DB connections ensuring reliable testing.
*   **Developer Environments**: Injected `signalstack-drizzle-studio` into local `docker-compose.yml`, tightly sandboxed to `127.0.0.1:4983`. Assured complete omittance from `docker-compose.prod.yml` to prevent production surface exposure.

### IP Resilience & Security (Phase 6c)
*   **MaxMind Integration**: Implemented `GeoIPService` to leverage self-hosted GeoLite2-City databases. IP data is now enriched with Country, City, Latitude, Longitude, and Timezone.
*   **Passive Bot Detection**: Integrated heuristics into the `VisitorsService` to automatically flag bots based on User-Agent patterns ("bot", "curl", "crawler") and anomalous request volume (>100 page views).
*   **Performance Optimization**: MaxMind binary databases are loaded once into memory on startup (singleton) to ensure sub-millisecond lookups. Enrichment tasks occur asynchronously after the visitor is tracked to prevent any latency in the main request flow.
*   **Infrastructure Security**: 
    *   Added dedicated `geoip` service for automated map database updates.
    *   Enforced **Read-Only** volume mounting for database binaries in the application container.
    *   Updated `.gitignore` and security configurations to prevent sensitive license keys and binary files from reaching version control.

### Test Suite Expansion (Phase 6e)
*   **AI Pipeline Tests**: Created comprehensive test suite in `backend/test/ai/`:
    *   `ai.service.spec.ts` — Tests fallback chain (local → groq → openrouter), local-only mode behavior, cooldown mechanism on 429 errors, high-load concurrent processing, provider timeout handling, health check endpoints, token tracking.
    *   `ai.queue.spec.ts` — Tests job enqueue/dequeue with deduplication, rate limiting and daily quota enforcement, retry logic with exponential backoff, queue recovery on startup, burst load handling (100 concurrent jobs).
*   **Signals E2E Tests**: Created `backend/test/signals/signals.e2e-spec.ts` to test:
    *   Signal insertion with proper hash generation
    *   Duplicate rejection (same hash should not insert twice)
    *   Filtering by severity, source, category, date range
    *   Search functionality across title/content
    *   Pagination with metadata
    *   Edge cases: empty content, very long content, special characters in URLs
*   **Test Utilities**: Added `backend/test/utils/wait-for.ts` helper for async test timing.
*   **Dependencies**: Installed missing `maxmind` and `@types/maxmind` packages for GeoIP testing.


---

## 1. What Is SignalStack?

SignalStack is an **RSS-to-intelligence pipeline**. It monitors news feeds, scores them for importance, enriches high-impact signals with AI summaries, and displays everything on a real-time dashboard.

### The Problem It Solves

News is noisy. SignalStack filters hundreds of articles down to only the signals that matter — scored by keywords, enriched by AI, and organized by category.

### The Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend API | NestJS 11 | Structured, modular, dependency-injected |
| Database | PostgreSQL 16 | Relational, ACID, full-text search |
| ORM | Drizzle ORM | TypeScript-first, zero magic, type-safe |
| Cache | Redis 7 | Deduplication, rate limiting, daily quotas |
| AI | Groq + OpenRouter | Dual-provider failover for reliability |
| Frontend | Next.js 16 | SSR, SSG, real-time SWR polling |
| Deployment | Docker Compose | Fully isolated, zero host dependencies |

---

## 2. Architecture Overview

```
RSS Feeds ──▶ Feed Scheduler ──▶ Fetch API ──▶ RSS Parser ──▶ Normalizer
              (every 5 min)      (10s timeout)    (rss-parser)   (clean + trim)
                                                                      │
                                                                      ▼
                                                                   Scorer
                                                          (keywords + entities
                                                           + source trustScore)
                                                                      │
                                                              ┌───────┼────────┐
                                                              ▼       ▼        ▼
                                                        [< 5]     [≥ 5]    [≥ 7]
                                                       discard    store    store +
                                                                           │
                                                              ┌────────────┼────────────┐
                                                              ▼            ▼            ▼
                                                        Discord Alert  AI Queue    Dashboard
                                                        (rate-limited) (RxJS)     (SWR poll)
                                                                          │
                                                               ┌────────────┴────────────┐
                                                              ▼                         ▼
                                                        Groq (primary)        OpenRouter (fallback)
                                                              │                         │
                                                              └─────────┬───────────────┘
                                                                        │
                                                                         ▼
                                                                   Database (ai_summary + ai_provider)
                                                                   (Fallback to Title if content empty)
                                                                   (Boilerplate Filter on response)
```

### Key Design Principles

- **Graceful degradation**: If AI fails, the system still works — keyword scoring is always available
- **Rate-limit safe**: 150 AI requests/day, 1.5s between jobs, 60s cooldown on 429 errors
- **Multi-layer deduplication**: SHA-256 hash of normalized title + URL, with DB unique constraint fallback
- **Fully isolated Docker**: No volume mounts for app code in production
- **Zero blocking**: AI + Discord alerts run async, never delay the main API or feed cycle
- **AI Provider Tracking**: Each signal stores `ai_provider` to identify which AI processed it (local/groq/openrouter)
- **Category-based Discord Filter**: Alerts are sent only for categories in `DISCORD_ALERT_CATEGORIES` (default `technology`)
- **Public API throttling**: 100 requests/minute/IP via NestJS throttler
- **Retention automation**: daily 2 AM cleanup deletes signals older than `SIGNAL_RETENTION_DAYS` and prunes orphaned bookmarks

---

## 3. The Backend: NestJS Engine

### 3.1 Project Structure

```
backend/src/
├── main.ts                 # Entry point — starts NestJS, attaches cookieParser + CORS
├── app.module.ts           # Root module — wires all 8 modules together
├── feed/                   # RSS harvester
│   ├── feed.module.ts
│   ├── feed.scheduler.ts   # Runs every 5 minutes via @Cron
│   └── feed.service.ts     # Fetches, normalizes, and scores RSS items
├── scorer/                 # Intelligence scoring engine
│   ├── scorer.module.ts
│   └── scorer.service.ts   # Keyword rules + entity rules + trustScore
├── signals/                # API endpoints + data layer
│   ├── signals.controller.ts  # REST API (signals, stats, health)
│   ├── signals.service.ts     # Stores signals, enqueues AI, dedup check
│   └── signals.repository.ts  # Drizzle queries, filtering, pagination
├── ai/                     # AI intelligence tier
│   ├── ai.module.ts
│   ├── ai.queue.ts         # Rate-limited background worker (RxJS)
│   ├── ai.service.ts       # Provider orchestration + failover
│   ├── redis.service.ts    # Redis dedup + daily quota tracking
│   └── providers/
│       ├── groq.provider.ts
│       └── openrouter.provider.ts
├── alerts/                 # Real-time notifications
│   ├── alerts.module.ts
│   └── discord.service.ts  # Discord webhook with rate-limited queue
├── database/               # Drizzle schema + ops
│   ├── database.module.ts  # Provides DATABASE_CONNECTION token
│   ├── schema.ts           # 4 tables: categories, sources, signals, settings
│   └── backup.service.ts   # Daily automated + manual pg_dump (persisted to Docker volume)
├── admin/                  # Admin portal API + auth
│   ├── admin.module.ts
│   ├── admin.controller.ts # CRUD for categories + sources + backup + model management
│   ├── admin.service.ts    # Business logic for admin operations
│   ├── admin.guard.ts      # JWT cookie + x-admin-key header guard
│   ├── auth.controller.ts  # Login/refresh/logout endpoints
│   └── auth.service.ts     # JWT token signing + verification
├── common/                 # Shared utilities
│   ├── hash.util.ts        # SHA-256 dedup with URL normalization
│   ├── logger.ts           # Structured JSON logging
│   └── types.ts            # Core interfaces (RawSignal, ScoredSignal, etc.)
└── scripts/                # Standalone utility scripts
    ├── test-ai.ts          # Manual AI provider test
    └── test-discord.ts     # Manual Discord webhook test
```

### 3.2 The 8 NestJS Modules

| Module | Responsibility |
|---|---|
| `DatabaseModule` | Drizzle connection, provides `DATABASE_CONNECTION` injection token |
| `SignalsModule` | REST API, repository queries, signal storage |
| `FeedModule` | RSS fetching, parsing, scheduling |
| `ScorerModule` | Keyword/entity scoring engine |
| `AlertsModule` | Discord webhook notifications |
| `AdminModule` | Auth + CRUD for categories/sources + backup + model selection |
| `AIModule` | Groq + OpenRouter + rate-limited queue + dynamic model config via `SettingsService` |
| `ScheduleModule` | NestJS cron job registration |

### 3.3 How NestJS Works

NestJS uses **modules**, **controllers**, and **services** — similar to Laravel's modules, controllers, and services.

```typescript
// A NestJS module (like a Laravel service provider)
@Module({
  imports: [ConfigModule],
  controllers: [SignalsController],
  providers: [SignalsService, SignalsRepository],
  exports: [SignalsService],
})
export class SignalsModule {}

// A controller (like a Laravel route handler)
@Controller('api/signals')
export class SignalsController {
  constructor(private signalsService: SignalsService) {}

  @Get()
  async findAll(@Query() query) {
    return this.signalsService.findAll(query);
  }
}

// A service (like a Laravel service class)
@Injectable()
export class SignalsService {
  constructor(private repo: SignalsRepository) {}

  async findAll(query) {
    return this.repo.findAll(query);
  }
}
```

**Dependency Injection**: NestJS automatically provides instances. You just declare them in the constructor — exactly like Laravel's service container.

### 3.4 The Feed Scheduler

Runs every 5 minutes, fetches all RSS feeds, and processes them:

```typescript
// backend/src/feed/feed.scheduler.ts
@Cron('*/5 * * * *')  // Every 5 minutes
async handleCron() {
  const sources = await this.sourceRepo.findAll();
  
  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    sources.map(source => this.fetchFeed(source))
  );
  
  // Process each result
  for (const result of results) {
    if (result.status === 'fulfilled') {
      await this.processSignals(result.value);
    }
  }
}
```

**Key concept**: `Promise.allSettled` — unlike `Promise.all`, it doesn't fail if one feed errors. Each feed is independent.

---

## 4. The Scorer: Keyword & Entity Intelligence

The scorer is the **core intelligence engine** — it runs on every signal before AI is ever involved. AI is expensive; keyword scoring is free and instant.

### 4.1 How Scoring Works

Every RSS item gets scored by combining three factors:

```
Final Score = Keyword Points + Entity Points + Source Trust Score
```

```typescript
// backend/src/scorer/scorer.service.ts
const text = `${raw.title} ${raw.content || ''}`.toLowerCase();

// 1. Keyword matching (case-insensitive substring)
let score = 0;
for (const rule of KEYWORD_RULES) {
  for (const keyword of rule.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += rule.points;
    }
  }
}

// 2. Entity matching (word-boundary regex)
for (const rule of ENTITY_RULES) {
  for (const entity of rule.entities) {
    const regex = new RegExp(`\\b${entity}\\b`, 'i');
    if (regex.test(text)) {
      score += rule.points;
    }
  }
}

// 3. Add source credibility
score += source.trustScore;  // 1–5 from the sources table
```

### 4.2 Scoring Rules

**Keyword Rules** — matched by substring:

| Points | Keywords |
|---|---|
| **5** (Critical) | outage, attack, explosion, cyberattack, breach, shutdown, vulnerability, zero-day, exploit, sanctions |
| **3** (Important) | acquisition, merger, layoff, regulation, ban, censorship, surveillance, leak |
| **2** (Notable) | launch, partnership, funding, update, release |

**Entity Rules** — matched by word boundary (`\b`):

| Points | Entities |
|---|---|
| **3** (Tier 1) | AWS, Amazon, Google, Microsoft, Cloudflare, OpenAI, Meta, Apple, NVIDIA, Anthropic |
| **2** (Tier 2) | Tesla, SpaceX, Stripe, Palantir, CrowdStrike |

**Why word boundary?** So "googled" doesn't match "Google", but "Google Cloud" does.

### 4.3 Severity Mapping

```typescript
function getSeverity(score: number): 'low' | 'medium' | 'high' {
  if (score >= 10) return 'high';
  if (score >= 7)  return 'medium';
  return 'low';
}
```

| Score Range | Severity | What Happens |
|---|---|---|
| < 5 | — | **Discarded entirely** — never stored |
| 5–6 | low | Stored in DB, shown on dashboard |
| 7–9 | medium | Stored + Discord alert + AI enrichment queue |
| 10+ | high | Stored + Discord alert + AI enrichment queue |

### 4.4 Source Trust Score

Each RSS source has a `trustScore` (1–5) in the database, configured in the admin panel. Higher trust means the signal's final score is boosted:

- **5**: Reuters, BBC, Foreign Affairs (tier-1 outlets)
- **3**: Default for new sources
- **1**: Unverified or low-reliability feeds

---

## 5. The Feed Pipeline: RSS Ingestion

### 5.1 Feed Service Architecture

The feed service handles fetching, parsing, normalizing, and deduplicating RSS items:

```typescript
// backend/src/feed/feed.service.ts
const FEED_TIMEOUT = 10_000;    // 10s per feed
const CONCURRENCY_LIMIT = 5;    // Max 5 feeds fetched at once

async fetchAllFeeds(): Promise<ScoredSignal[]> {
  const limit = pLimit(CONCURRENCY_LIMIT);
  const activeSources = await this.db.select().from(sources)
    .where(eq(sources.isActive, true));

  const results = await Promise.allSettled(
    activeSources.map(source => limit(() => this.fetchSingleFeed(source)))
  );
  // ... collect successful results
}
```

**Why `p-limit`?** Prevents overwhelming network/memory by capping concurrent HTTP requests to 5, even if there are 20+ sources.

### 5.1.1 HTTP Client: Native Fetch API

SignalStack uses Node.js 20's built-in `fetch` API instead of third-party HTTP libraries like `axios`. This eliminates supply chain risk and reduces dependencies.

```typescript
// backend/src/feed/feed.service.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), FEED_TIMEOUT);

const res = await fetch(source.url, {
  headers: { 'User-Agent': 'SignalStack/1.0' },
  signal: controller.signal,
});

clearTimeout(timeoutId);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const text = await res.text();
```

**Key patterns across all HTTP calls:**
- `AbortController` + `setTimeout` for timeouts (replaces axios `timeout` option)
- `res.ok` check before parsing (no automatic error throwing like axios)
- `res.json()` / `res.text()` for response body extraction

This pattern is used consistently across:
- Feed fetching (`feed.service.ts`)
- AI providers (`groq.provider.ts`, `openrouter.provider.ts`, `local.provider.ts`)
- Scorer AI service (`ai.service.ts`)
- Discord alerts (`discord.service.ts`)

### 5.2 RSS Normalization

Different feeds use different field names. The normalizer handles all variations:

```typescript
// Content extraction priority
const content =
  item['content:encoded'] ||   // RSS 2.0 full content
  item.content ||              // Atom content
  item.description ||          // RSS 2.0 summary
  item.contentSnippet ||       // Parser-generated snippet
  item.summary ||              // Atom summary
  null;

// Date extraction
const dateStr =
  item.pubDate ||              // RSS 2.0
  item.published ||            // Atom
  item.updated ||              // Atom fallback
  item.isoDate ||              // Parser-normalized
  null;
```

### 5.2.1 HTML Sanitization

Raw RSS content often contains HTML tags — sometimes double-encoded as HTML entities (e.g., `&lt;p&gt;`). The `stripHtml` pipeline ensures clean plain text for storage and Discord embeds:

```typescript
// 1. Decode ALL HTML entities FIRST — named and numeric (decimal + hex)
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// 2. Remove <script>/<style> blocks (content included), then strip remaining tags
function stripHtml(html: string): string {
  const decoded = decodeEntities(html);
  const sanitized = decoded
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s>][\s\S]*?<\/style>/gi, '');
  return striptags(sanitized)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

**Why decode before stripping?** If `striptags` runs first, encoded tags like `&lt;p&gt;` survive (they're entities, not tags). When decoded afterward, they become visible `<p>` tags in the output — which is exactly the bug this pipeline prevents.

**Numeric entities in titles:** RSS feeds frequently use numeric HTML entities in titles (e.g., `&#8217;` for `'`, `&#8220;` for `"`). Titles are decoded via `decodeEntities()` before storage to ensure clean display on the dashboard and in Discord embeds.

### 5.3 Data Quality Filters

Before a signal reaches the scorer, the normalizer applies two guards:

1. **Stale filter**: Articles older than **5 days** are silently dropped
2. **Content limit**: Content is truncated to **2,000 characters** to prevent memory bloat

```typescript
const STALE_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
if (publishedAt && Date.now() - publishedAt.getTime() > STALE_THRESHOLD_MS) {
  return null; // Skip stale data
}

return {
  ...fields,
  content: content ? content.slice(0, 2000) : null,
};
```

### 5.4 Deduplication (SHA-256 Hashing)

Every signal gets a unique hash to prevent duplicates — even if the same article appears in multiple feeds:

```typescript
// backend/src/common/hash.util.ts
export function generateHash(title: string, url: string): string {
  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedUrl = normalizeUrl(url);

  return createHash('sha256')
    .update(`${normalizedTitle}|${normalizedUrl}`)
    .digest('hex');
}
```

**URL normalization** strips tracking parameters so the same article with different UTM tags produces the same hash:

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url.trim().toLowerCase());
  // Remove: utm_*, ref, source, fbclid, gclid, mc_cid, mc_eid
  paramsToRemove.forEach(key => parsed.searchParams.delete(key));
  return parsed.toString();
}
```

**Two layers of dedup:**
1. **Application layer**: `hashExists()` check before insert
2. **Database layer**: `UNIQUE` constraint on `hash` column — catches any race conditions (error code `23505`)

### 5.5 Core TypeScript Interfaces

```typescript
// backend/src/common/types.ts
interface RawSignal {
  source: string;
  categoryId: string;
  title: string;
  content: string | null;
  url: string;
  publishedAt: Date | null;
}

interface ScoredSignal extends RawSignal {
  score: number;
  severity: 'low' | 'medium' | 'high';
  hash: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface SignalStats {
  total: number; high: number; medium: number; low: number;
  last24h: number; topSource: string;
}

interface HealthStatus {
  status: string; uptime: number;
  lastFetch: string | null; feedsActive: number;
}
```

---

## 6. The AI Pipeline

This is the most sophisticated part of the system.

### 6.1 The Flow

```
Signal (score ≥ 7) ──▶ AI Queue ──▶ Rate Limiter ──▶ Groq ──▶ OpenRouter ──▶ Local (llama.cpp) ──▶ DB
                                          │              │           │                │
                                     [429 error?]    [fail]      [fail]           [last resort,
                                          │              │           │              if enabled]
                                     60s cooldown ──▶ Next provider
```

### 6.2 AI Provider Order

SignalStack always uses the same provider chain regardless of environment:

| Priority | Provider | When Used |
|---|---|---|
| **1st** | Groq | Always tried first (fast & cheap) |
| **2nd** | OpenRouter | Fallback if Groq fails or on cooldown |
| **3rd (last resort)** | Local (llama.cpp) | Only if both cloud providers fail AND local is enabled |

**Environment Variables:**
```env
# Optional - defaults apply if not set
LOCAL_AI_ENABLED=true        # Set to false to disable local AI entirely
LOCAL_AI_URL=http://llama:8080
AI_PROCESS_DELAY=1500        # ms between requests
AI_MAX_WORKERS=2             # parallel workers
AI_DAILY_LIMIT=150           # daily request limit
```

**Provider Chain Logic:**

1. **Step 1 — Groq**: Tried first. If 429 → 60s cooldown, try next.
2. **Step 2 — OpenRouter**: Tried if Groq failed/on cooldown. If 429 → 60s cooldown.
3. **Step 3 — Local AI**: Only called if steps 1 & 2 both failed AND `LOCAL_AI_ENABLED=true`. Retries up to 2 times. If local also fails → signal marked as failed.

**Admin Toggle**: Local AI can be enabled/disabled at runtime from the admin dashboard without restarting. Toggle is persisted in the `settings` table via `SettingsService`.

### 6.3 Local AI (llama.cpp)

For zero-cost inference, SignalStack can run a local llama.cpp server:

```yaml
# docker-compose.yml
llama:
  image: ghcr.io/ggml-org/llama.cpp:server
  ports:
    - "8080:8080"
  volumes:
    - ./models:/models
  command: >
    -m /models/qwen.gguf
    -c 512
    --host 0.0.0.0
    --port 8080
```

**Model Requirements:**
- Qwen2.5-0.5B GGUF file at `models/qwen.gguf` (~497MB)
- Download: `https://huggingface.co/unsloth/Qwen2.5-0.5B-GGUF/resolve/main/Qwen2.5-0.5B-Q4_K_M.gguf`
- **Why Qwen2.5?** Outputs clean summaries without thinking/reasoning tags

**Environment Variables:**
```env
LOCAL_AI_ENABLED=true
LOCAL_AI_URL=http://llama:8080
```

**Performance (optimized for low-resource VPS):**
- Context window: 512 tokens (sufficient for small prompts)
- Max tokens: 60 (produces 1-2 sentence summaries)
- Output cap: 150 chars at word boundary
- Timeout: 15 seconds
- Prompt: directive format ("Summarize in 1 sentence, max 120 chars") for better small-model compliance
- Production compose limits: llama container capped at `0.5 CPU` and `1GB` memory

### 6.3 Rate-Limited Queue (RxJS)

```typescript
// backend/src/ai/ai.queue.ts
import { Subject, zip, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

export class AIQueue {
  private queue$ = new Subject<AIJob>();
  private readonly processDelay = 1500;  // 1.5s between jobs
  private readonly maxWorkers = 2;
  private readonly dailyLimit = 150;

  onModuleInit() {
    // Zip incoming jobs with a timer — one job every 1.5s
    zip(this.queue$, timer(0, this.processDelay)).pipe(
      mergeMap(([job]) => this.processJob(job), this.maxWorkers)
    ).subscribe();

    // Re-queue unprocessed signals after restart (5s delay for DB readiness)
    setTimeout(() => this.requeuePending(), 5000);
  }

  enqueue(job: AIJob) {
    this.queue$.next(job);
  }
}
```

**How `zip` + `timer` works:**
- `this.queue$` emits jobs as they arrive
- `timer(0, 1500)` emits a tick every 1.5s
- `zip` pairs them — a job only proceeds when BOTH emit
- Result: max 1 job per 1.5s, no matter how many arrive

**Startup requeue**: Because the queue is in-memory, a container restart wipes all pending jobs. `requeuePending()` runs 5 seconds after boot, fetches up to 50 unprocessed signals (score ≥ 7) from the DB, and re-enqueues them automatically — no manual retry needed after deploys.

### 6.3 Daily Quota (Redis)

```typescript
// backend/src/ai/redis.service.ts
async checkAndIncrementLimit(limit: number): Promise<boolean> {
  const key = `ai:daily_count:${new Date().toISOString().split('T')[0]}`;
  const count = await this.client.incr(key);

  if (count === 1) {
    await this.client.expire(key, 86400 + 3600); // 25h safety margin
  }

  return count <= limit; // false if over limit
}
```

**Why 25 hours?** If the key expires at midnight UTC but the server clock is slightly off, the 1-hour buffer prevents overlap.

### 6.4 Provider Failover

The full provider chain is: **Groq → OpenRouter → Local (llama.cpp, last resort)**.

**Key implementation detail**: `local.provider.ts` manages its own 35s `AbortController` timeout. `ai.service.ts` calls it directly — no outer `Promise.race` wrapper. An earlier bug had a hardcoded 4s race that was silently killing local AI before it could respond (~17s on CPU), causing 100% fallback to Groq.

Local AI runs last by design — cloud providers are fast and cheap; local is CPU-intensive and can peg the VPS at 100% CPU. By reserving it as last resort, it only activates when both cloud APIs are unavailable.

```typescript
// backend/src/ai/ai.service.ts
async processSignal(id, title, content, score) {
  let summary = null;

  // Step 1: Groq (fast & cheap)
  if (!this.isCooldown('groq')) {
    summary = await this.groq.summarize(title, content);
    if (!summary && this.groq.lastError === 429) this.setCooldown('groq', 60000);
  }

  // Step 2: OpenRouter (reliable fallback)
  if (!summary && !this.isCooldown('openrouter')) {
    summary = await this.openRouter.summarize(title, content);
    if (!summary && this.openRouter.lastError === 429) this.setCooldown('openrouter', 60000);
  }

  // Step 3: Local AI (last resort — only if enabled)
  if (!summary && localAiEnabled && !this.isCooldown('local')) {
    // Retry up to 2x — CPU inference is slow but reliable
    for (let i = 0; i < 2 && !summary; i++) {
      summary = await this.local.summarize(title, content);
    }
  }

  // Save to DB (or mark as failed)
  if (summary) {
    await this.db.update(signals).set({ aiSummary: summary }).where(eq(signals.id, id));
  }
}
```

### 6.5 AI Retry Mechanism

Failed signals are automatically retried with exponential backoff:

```typescript
// backend/src/ai/ai.queue.ts
// Retry up to 3 times with exponential backoff
const retries = job.retryCount || 0;
if (retries < 3) {
  const backoff = (retries + 1) * 30000; // 30s, 60s, 90s
  setTimeout(() => {
    this.enqueue({ ...job, retryCount: retries + 1 });
  }, backoff);
}
```

**Manual Retry**: Admins can re-queue all failed signals via `POST /api/admin/ai/retry` or the retry button on the dashboard. This fetches up to 50 failed signals and re-enqueues them.

### 6.6 AI Output Cleaning

Both providers clean their output:

```typescript
cleanResponse(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/<\|.*?\|>/g, ' ');  // Strip special tokens
  cleaned = cleaned.replace(/<.*?>/g, '');         // Strip HTML tags
  cleaned = cleaned.replace(/\n/g, ' ');           // Remove newlines
  cleaned = cleaned.replace(/\s+/g, ' ');          // Collapse whitespace
  cleaned = cleaned.trim();
  // Cap at 150 chars, break at last word boundary
  if (cleaned.length > 150) {
    cleaned = cleaned.slice(0, 150).replace(/\s\S*$/, '');
  }
  return cleaned;
}
```

---

## 7. Discord Alerts System

The alert system handles real-time notifications for high-importance signals. While the default threshold is **score ≥ 7**, the system now employs a refined filtering logic to reduce noise:

**Alerting Logic:**
- **Technology**: Sends alerts for **Medium (7-9)** and **High (10+)** signals.
- **Geopolitics**: Sends alerts for **High (10+)** signals only.
- **Fallbacks**: For other categories, alerts are sent if the category is enabled in `DISCORD_ALERT_CATEGORIES` and the score is **≥ 7**.

**Configuration:**
- Set `DISCORD_ALERT_CATEGORIES=technology,geopolitics` to enable both categories.
- Set `DISCORD_FILTER_TECH=false` to ensure alerts aren't blocked by missing AI categorization metadata.

### 7.1 Rate-Limited Queue

```typescript
// backend/src/alerts/discord.service.ts
const MIN_INTERVAL_MS = 2000; // 2 seconds between webhook calls

@Injectable()
export class DiscordService {
  private queue: ScoredSignal[] = [];
  private processing = false;

  async sendAlert(signal: ScoredSignal): Promise<void> {
    if (!this.webhookUrl) return; // Graceful skip if not configured
    this.queue.push(signal);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return; // Prevent concurrent processing
    this.processing = true;

    while (this.queue.length > 0) {
      const signal = this.queue.shift()!;
      const res = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [/* ... */] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Rate limit: wait 2 seconds between calls
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS));
      }
    }
    this.processing = false;
  }
}
```

### 7.2 Discord Embed Format

Each alert is a rich embed with severity-based color coding:

```typescript
const color =
  signal.severity === 'high'   ? 0xff0000   // Red
  : signal.severity === 'medium' ? 0xffa500 // Orange
  : 0x00ff00;                                // Green

const embed = {
  title: signal.title.slice(0, 256),
  url: signal.url,
  description: signal.content?.slice(0, 200) || '',
  color,
  fields: [
    { name: 'Source',   value: signal.source,                inline: true },
    { name: 'Score',    value: String(signal.score),         inline: true },
    { name: 'Severity', value: signal.severity.toUpperCase(), inline: true },
  ],
  timestamp: signal.publishedAt?.toISOString() || new Date().toISOString(),
  footer: { text: 'SignalStack' },
};
```

### 7.3 Email Digest System

The Email Digest System provides a scheduled intelligence briefing delivered daily. It summarizes the top signals so you don't have to monitor the dashboard constantly.

**Key logic:**
- **Schedule**: Triggers every day at **8:00 AM** via `@Cron`.
- **Filtering**: Currently locked to the **Technology** category with a **Score ≥ 7** threshold.
- **Deduplication**: Only include signals from the last 24 hours to ensure fresh reports.
- **Design Strategy**: Uses a "bulletproof" HTML architecture with `inline-block` margins instead of Flexbox to ensure consistent layout across Outlook, Gmail, and Apple Mail.

**Configuration:**
- `DIGEST_ENABLED`: Global toggle for the service.
- `DIGEST_CATEGORIES`: Defaults to `technology` (filterable in `.env`).
- `SMTP_HOST`: e.g., `smtp.gmail.com`.
- `SMTP_PASS`: Uses **App Passwords** for secure Google service authentication.

```typescript
// backend/src/alerts/email.service.ts
const { data: signals } = await this.signalsService.getSignals({
  page: 1, limit: 20,
  since: oneDayAgo.toISOString(),
  categoryId: this.digestCategories, // Filtered by Tech
  sort: 'score', order: 'desc',
});
```

### 7.4 Rate Limiting Summary

The system has **four layers** of rate limiting across different subsystems:

| Layer | Rate | Purpose |
|---|---|---|
| Public API throttle | 100 req/min/IP | Protect unauthenticated endpoints from abuse |
| Discord alerts | 1 per 2 seconds | Respect Discord webhook limits |
| AI queue | 1 per 1.5 seconds | Smooth API bursts |
| AI daily quota | 150 per day (Redis) | Stay within free-tier limits |
| AI provider cooldown | 60s after 429 | Back off on rate-limit errors |

---

## 8. Authentication & Admin Portal

### 8.1 Authentication Flow

The admin panel uses **email/password authentication** with bcrypt-hashed passwords and JWT tokens stored in HTTP-only cookies:

```
User enters email + password ──▶ POST /api/admin/auth/login
                                          │
                                  bcrypt.compare(password, hash)
                                          │
                                 ┌────────┴────────┐
                                 ▼                  ▼
                           Access Token       Refresh Token
                           (15 min)           (7 days)
                                 │                  │
                                 ▼                  ▼
                           Cookie:             Cookie:
                           signalstack_        signalstack_
                           access_token        refresh_token
                           (httpOnly)          (httpOnly, path=/api/admin/auth/refresh)
```

### 8.2 Users Table & Password Security

Credentials are stored in a `users` table with bcrypt-hashed passwords (salt rounds: 12):

```typescript
// backend/src/database/schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.3 AuthService — Database-Backed Login

```typescript
// backend/src/admin/auth.service.ts
@Injectable()
export class AuthService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  async login(email: string, password: string) {
    const [user] = await this.db.select().from(users)
      .where(eq(users.email, email.toLowerCase().trim())).limit(1);

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, this.jwtSecret, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    const decoded = jwt.verify(refreshToken, this.jwtSecret);
    if (decoded.type !== 'refresh') throw new UnauthorizedException('Invalid token');
    // Verify user still exists before issuing new tokens
    const [user] = await this.db.select().from(users)
      .where(eq(users.id, decoded.sub)).limit(1);
    if (!user) throw new UnauthorizedException('User no longer exists');
    // Issue new token pair...
  }
}
```

**Key improvements over the previous API-key approach:**
- Passwords are bcrypt-hashed (never stored in plaintext)
- JWT payload includes user identity (`sub`, `email`, `role`)
- Refresh validates user still exists in the database
- No shared API key — each admin has individual credentials

### 8.3 Cookie Configuration

```typescript
// backend/src/admin/auth.controller.ts
res.cookie('signalstack_access_token', tokens.accessToken, {
  httpOnly: true,                                    // Not accessible via JavaScript
  secure: process.env.NODE_ENV === 'production',     // HTTPS only in prod
  sameSite: 'lax',                                   // CSRF protection
  maxAge: 15 * 60 * 1000,                            // 15 minutes
  path: '/',                                         // Available on all routes
  domain: process.env.NODE_ENV === 'production'
    ? '.fazleyrabbi.xyz' : undefined,                // Subdomain sharing in prod
});
```

**Why `httpOnly`?** XSS attacks can't steal the token — `document.cookie` won't see it.
**Why `sameSite: lax`?** Prevents CSRF while still allowing normal navigation.

### 8.5 AdminGuard — JWT-Only Authentication

The guard validates JWT tokens from HTTP-only cookies and attaches user identity to the request:

```typescript
// backend/src/admin/admin.guard.ts
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.cookies?.signalstack_access_token;

    if (!accessToken) throw new UnauthorizedException('No access token provided');

    const decoded = jwt.verify(accessToken, jwtSecret);
    if (decoded.role === 'admin') {
      request.user = decoded; // { sub, email, role }
      return true;
    }

    throw new UnauthorizedException('Invalid or expired session');
  }
}
```

### 8.5 Frontend Middleware — Route Protection

```typescript
// frontend/src/middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page without auth
  if (pathname === '/admin/login') return NextResponse.next();

  // Protect all other /admin routes
  if (pathname.startsWith('/admin')) {
    const accessToken = request.cookies.get('signalstack_access_token')?.value;
    if (!accessToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
```

**Key concept**: Next.js middleware runs at the **edge** before the page renders — unauthorized users never see the admin HTML.

### 8.6 Admin CRUD Operations

The admin panel provides full CRUD for managing the intelligence pipeline:

```typescript
// backend/src/admin/admin.controller.ts
@Controller('api/admin')
@UseGuards(AdminGuard)  // All routes protected
export class AdminController {
  // Categories: GET, POST, PUT /:slug, DELETE /:slug
  // Sources:    GET, POST, PUT /:id,   DELETE /:id
  // Models:     GET, PUT /ai/models, POST /ai/models/refresh
  // System:     POST /backup
}
```

| Admin Page | Purpose |
|---|---|
| `/admin` | Dashboard — AI health, searchable model selection, feed stats, manual backup |
| `/admin/categories` | CRUD for intelligence categories (Geopolitics, Technology) |
| `/admin/sources` | CRUD for RSS feed sources per category |
| `/admin/login` | Email/password authentication |
| `/changelog` | View full project changelog |

### 8.7 Database Backup Service

Automated and manual backup via `pg_dump`:

```typescript
// backend/src/database/backup.service.ts
@Injectable()
export class BackupService {
  private readonly backupDir = path.join(process.cwd(), 'backups');
  private readonly backupPath = path.join(process.cwd(), 'backups', 'signalstack_backup.sql');

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutomatedBackup() {
    await this.runBackup();
  }

  async triggerManualBackup() {
    return await this.runBackup();
  }

  private async runBackup() {
    // 1. Verify pg_dump is available
    await execAsync('pg_dump --version');

    // 2. Dump to temp file, then rename (atomic write)
    const tempFile = `${this.backupPath}.tmp`;
    await execAsync(`pg_dump "${databaseUrl}" --no-owner --no-privileges --clean -f "${tempFile}"`);
    fs.renameSync(tempFile, this.backupPath);

    return { success: true, path: 'signalstack_backup.sql', timestamp: new Date().toISOString() };
  }
}
```

**Key detail**: Backups are written to `/app/backups/` which is mounted as a Docker named volume (`backups:`). This ensures backups survive container rebuilds — previously they were stored at `/app/signalstack_backup.sql` and got wiped on every `docker compose up --build`.

**Scheduled jobs in the system:**

| Job | Schedule | Module |
|---|---|---|
| Feed fetch | Every 5 minutes | `FeedModule` |
| Database backup | Every day at midnight | `BackupService` |

---

## 9. Database & Drizzle ORM

### 9.1 Complete Schema (4 Tables)

```typescript
// backend/src/database/schema.ts

// === Categories ===
export const categories = pgTable('categories', {
  slug:        varchar('slug', { length: 50 }).primaryKey(),
  name:        varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// === Sources (RSS Feeds) ===
export const sources = pgTable('sources', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       varchar('name', { length: 100 }).notNull(),
  url:        text('url').notNull(),
  categoryId: varchar('category_id', { length: 50 }).notNull()
                .references(() => categories.slug),      // Foreign key
  trustScore: integer('trust_score').notNull().default(3), // 1–5
  isActive:   boolean('is_active').notNull().default(true),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// === Signals (Intelligence Items) ===
export const signals = pgTable('signals', {
  id:          uuid('id').primaryKey().defaultRandom(),
  source:      varchar('source', { length: 100 }).notNull(),
  title:       text('title').notNull(),
  content:     text('content'),
  summary:     text('summary'),
  url:         text('url').notNull(),
  score:       integer('score').notNull(),
  categoryId:  varchar('category_id', { length: 50 }).notNull()
                 .references(() => categories.slug),
  aiCategory:  varchar('ai_category', { length: 50 }),
  severity:    varchar('severity', { length: 10 }).notNull(),
  hash:        varchar('hash', { length: 64 }).notNull().unique(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  aiSummary:   text('ai_summary'),
  aiProcessed: boolean('ai_processed').notNull().default(false),
  aiFailed:    boolean('ai_failed').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdAtIdx:  index('idx_signals_created_at').on(table.createdAt),
  categoryIdIdx: index('idx_signals_category_id').on(table.categoryId),
  severityIdx:   index('idx_signals_severity').on(table.severity),
  scoreIdx:      index('idx_signals_score').on(table.score),
  hashIdx:       index('idx_signals_hash').on(table.hash),
}));

// === Settings (Key-Value Config) ===
export const settings = pgTable('settings', {
  key:       varchar('key', { length: 100 }).primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// === Visitors (Session Tracking) ===
export const visitors = pgTable('visitors', {
  id:       uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 64 }).notNull().unique(), // IP-based session ID
  ip:       varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  pageViews: integer('page_views').notNull().default(1),
});

// === Bookmarks (Saved Signals) ===
export const bookmarks = pgTable('bookmarks', {
  id:        uuid('id').primaryKey().defaultRandom(),
  signalId:  uuid('signal_id').notNull().references(() => signals.id),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  signalSessionIdx: index('idx_bookmarks_signal_id_session_id').on(table.signalId, table.sessionId),
  uniqueSignalSession: uniqueIndex('uq_bookmarks_signal_id_session_id').on(table.signalId, table.sessionId),
}));
```

The `settings` table stores runtime configuration like selected AI models per provider. It's used by `SettingsService` to persist model choices (e.g., `groqModel`, `openrouterModel`) and cached model lists, so changes survive container restarts.

The `visitors` table tracks unique visitors using IP-based session IDs for analytics.

The `bookmarks` table stores user-saved signals with a unique constraint on `(signalId, sessionId)` to prevent duplicates.

### 9.2 Entity Relationship

```
categories (1) ──▶ (many) sources
categories (1) ──▶ (many) signals
settings   ──▶ standalone key-value store (no FK)
```

- A **category** (e.g., "geopolitics") has many **sources** (RSS feeds) and many **signals** (articles)
- Deleting a category requires removing its sources and signals first (referential integrity)
- **Settings** is a standalone key-value table with no foreign keys — used for runtime config like AI model selection

### 9.3 Performance Indexes

| Index | Column | Why |
|---|---|---|
| `idx_signals_created_at` | `created_at` | Dashboard sorts by newest |
| `idx_signals_category_id` | `category_id` | Column filtering by category |
| `idx_signals_severity` | `severity` | Quick-filter by severity level |
| `idx_signals_score` | `score` | Sort by importance |
| `idx_signals_hash` | `hash` | Fast deduplication lookups |

### 9.4 Advanced Repository Queries

The repository supports full-featured filtering with parallel count queries:

```typescript
// backend/src/signals/signals.repository.ts
async findAll(params) {
  const conditions: SQL[] = [];

  if (severity)   conditions.push(eq(signals.severity, severity));
  if (source)     conditions.push(eq(signals.source, source));
  if (categoryId) conditions.push(eq(signals.categoryId, categoryId));
  if (since)      conditions.push(gte(signals.createdAt, since));
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(
      ilike(signals.title, term),
      ilike(signals.summary, term),
      ilike(signals.content, term),
    ));
  }

  // Run data + count in parallel for speed
  const [data, countResult] = await Promise.all([
    db.select().from(signals).where(and(...conditions))
      .orderBy(orderFn(sortColumn)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(signals)
      .where(and(...conditions)),
  ]);

  return { data, total: countResult[0]?.count || 0 };
}
```

### 9.5 Stats Aggregation

Stats bar uses a single aggregated query with `FILTER` clauses. Both "Activity 24h" and "Critical Alerts" are scoped to the last 24 hours — no all-time counts shown on the dashboard:

```typescript
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

// Single query with multiple FILTER clauses (more efficient than 6 parallel queries)
db.select({
  total:   sql<number>`count(*)::int`,
  high:    sql<number>`count(*) FILTER (WHERE severity = 'high' AND created_at >= ${oneDayAgo})::int`,
  last24h: sql<number>`count(*) FILTER (WHERE created_at >= ${oneDayAgo})::int`,
  // ...
}).from(signals);
```

### 9.6 Pushing Schema Changes

```bash
# Update schema.ts, then:
npx drizzle-kit push
```

This compares your schema to the database and applies changes — no migration files needed.

---

## 10. The Frontend: Next.js Dashboard

### 10.1 Project Structure

```
frontend/src/
├── app/
│   ├── layout.tsx        # Root HTML wrapper + ThemeProvider
│   ├── page.tsx          # Main dashboard (signals)
│   ├── globals.css       # Tailwind v4 + CSS variables (oklch)
│   ├── error.tsx         # Route-level error boundary
│   ├── global-error.tsx  # Root-level error boundary
│   ├── not-found.tsx     # 404 page
│   ├── changelog/        # In-browser changelog
│   └── admin/            # Admin portal
│       ├── login/
│       ├── page.tsx
│       ├── error.tsx
│       ├── categories/
│       └── sources/
├── components/
│   ├── header.tsx        # Top bar with search + theme toggle
│   ├── bottom-nav.tsx    # Mobile navigation with search popup
│   ├── column.tsx        # Category column with independent scroll
│   ├── shell.tsx         # App shell layout wrapper
│   ├── sidebar.tsx       # Navigation sidebar
│   ├── footer.tsx        # Page footer
│   ├── signal-card.tsx   # Individual signal display (severity color stripes, stacked bottom UI)
│   ├── signal-detail-modal.tsx # Click-to-expand detail dialog (HTML-stripped preview, mobile-optimized)
│   ├── signal-skeleton.tsx # Loading skeleton for signals
│   ├── stats-bar.tsx     # Real-time stats
│   ├── theme-provider.tsx # Theme context (onyx/light/cyberpunk)
│   └── ui/               # Base UI components (shadcn-style)
├── context/
│   └── SearchContext.tsx # Global search state synchronization
└── lib/
    ├── api.ts            # TypeScript types for API
    └── utils.ts          # cn() helper for className merging
```

### 10.2 How the Dashboard Works

The main page fetches signals via **SWR** (stale-while-revalidate polling):

```typescript
// frontend/src/app/page.tsx
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/signals`;
const fetcher = (url: string) => fetch(url).then(res => res.json());

const { data: response, isLoading } = useSWR(
  `${API_BASE}?limit=20&categoryId=geopolitics`,
  fetcher,
  { refreshInterval: 15000 }  // Re-fetch every 15 seconds
);

const signals = response?.data ?? [];
```

**Why SWR?** It gives you:
- Automatic re-fetching
- Cache sharing between components
- Focus revalidation (refetch when tab becomes active)
- Optimistic UI patterns

### 10.2.1 Mobile-Responsive Control Bar

The column control bar (filter pills + source/sort/bookmark buttons) uses a responsive two-row layout on mobile to prevent overflow:

- **Mobile**: filter pills on top row, source/sort/bookmark on second row — both rows `overflow-x-auto scrollbar-none` with `shrink-0` on each button
- **Desktop (`sm+`)**: single flex row with spacer between groups
- **Dropdowns**: use `fixed` positioning + `getBoundingClientRect` (not `absolute` + `offsetLeft`) so they are never clipped by scrollable parent containers

### 10.3 The Two-Column Layout

Each category (Geopolitics, Technology) gets its own column with independent infinite scroll:

```typescript
function Column({ categoryId, ...props }) {
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch data for this category
  const { data } = useSWR(
    `${API_BASE}?limit=${PAGE_SIZE * page}&categoryId=${categoryId}`,
    fetcher
  );

  // Infinite scroll: auto-load when sentinel enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setPage(p => p + 1);
      },
      { root: scrollRef.current, rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [signals.length]);

  return (
    <div ref={scrollRef} className="overflow-y-auto">
      {signals.map(signal => <SignalCard key={signal.id} signal={signal} />)}
      <div ref={sentinelRef}>
        {isLoading && <Spinner />}
      </div>
    </div>
  );
}
```

**Responsive breakpoints:**

| Screen | Normal | Fullscreen |
|---|---|---|
| < 640px | 1 column | 1 column |
| 640px+ | 2 columns | 2 columns |
| 1280px+ | 3 columns | 3 columns |
| 1536px+ | 3 columns | 4 columns |

### 10.4 Bookmark/Save Signals Feature

SignalStack includes a database-backed bookmarking system that allows users to save signals for later review:

- **Bookmark Toggle**: Click the bookmark icon on any signal card or in the signal detail modal to save/remove signals
- **Database Persistence**: Bookmarks are stored in the `bookmarks` table and persist across sessions
- **Bookmarks View**: Toggle the bookmark icon in any column header to view only your saved signals
- **Deep-link support**: Open `/?bookmarks=true` to auto-enable bookmark-only mode on the home feed
- **Instant Feedback**: UI updates immediately via SWR cache mutation when toggling bookmarks
- **API Integration**: Uses full API_BASE URL (not relative) to correctly hit the backend server
- **Mobile Navigation**: Fixed bottom nav (`Feed`, `Trends`, `Saved`, `Admin`) with safe-area padding and active-tab detection from pathname

**Technical Implementation:**
- **Backend**: `bookmarks` table with `(signalId, sessionId)` unique constraint, API endpoints at `/api/bookmarks`
- **API Endpoints**: 
  - `POST /api/bookmarks/:signalId` - Toggle bookmark status
  - `GET /api/bookmarks` - Get bookmarked signal IDs
  - `DELETE /api/bookmarks/:signalId` - Remove bookmark
- **Frontend**: 
  - SWR hooks for fetching bookmark state
  - Optimistic UI updates with cache mutation
  - Bookmark icon from Lucide React (filled when saved, outline when not)

### 10.5 Mobile & Navigation Refinement

To maximize screen real-estate on mobile devices, SignalStack employs a "Mobile-First" navigation strategy that prioritizes signal visibility over administrative noise.

- **Global Search State (`SearchContext`)**: Search is no longer component-local. A centralized context synchronizes the search query between the top header (desktop) and the bottom navigation (mobile).
- **Animated Search Popup**: On mobile, the search bar is hidden from the header. Instead, a central Search button in the bottom navigation triggers a spring-animated popup input with auto-focus.
- **Dynamic Header Density**: The top stats and controls bar is hidden by default on mobile. Users can toggle it via a dedicated "Stats" button, which features an active-state glow.
- **High-Density Card Layout**: Signal cards use a "clinical" design with higher information density. The inner div padding was removed (`p-3.5` → `p-0`) to use the standard `Card` component's padding, and vertical gaps were tightened (`gap-2.5`) to fit 15-20% more signals on a small screen.
- **Bottom Navigation Layout**: A 5-column grid featuring `Feed`, `Trends`, `Search (Global)`, `Saved`, and `Admin`. The Search button is visually prioritized with a larger icon and active scaling.

**Global Search Implementation:**
```typescript
// frontend/src/context/SearchContext.tsx
export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
};
```
By wrapping the entire app in `SearchProvider`, any component can trigger or respond to searches, allowing the mobile popup to filter the same data as the desktop header without redundant state wiring.

### 10.6 Theme System

Three themes (Onyx, Light, Cyberpunk) managed by a `ThemeProvider` context using CSS custom properties with oklch color space:

```css
/* globals.css */
:root {
  /* Onyx (default) — Industrial Slate */
  --background: oklch(14% 0.01 240);
  --foreground: oklch(98% 0 0);
}

[data-theme='light'] {
  /* Studio Air — Standard Light */
  --background: oklch(100% 0 0);
  --foreground: oklch(14% 0.02 240);
}
```

```tsx
// components/theme-provider.tsx — context-based theme management
type Theme = "onyx" | "light" | "cyberpunk";

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>("onyx");

  const setTheme = (theme: Theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("signalstack_theme", theme);
    setCurrentTheme(theme);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

Smooth theme transitions are applied via a temporary CSS class to avoid triggering on page load.

---

## 11. API Reference

### 11.1 Public API (No Auth Required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/signals` | List signals with filtering + pagination |
| `GET` | `/api/signals/sources` | List unique sources (with counts) |
| `GET` | `/api/signals/stats` | Dashboard stats (total, severity, categories, AI metrics, highPending) |
| `GET` | `/api/signals/ai-providers` | AI provider breakdown (local, groq, openrouter counts) |
| `GET` | `/api/visitors/stats` | Visitor stats (total, today, realtime) |
| `POST` | `/api/visitors` | Track a visit |
| `GET` | `/api/health` | Health check (uptime, last fetch, active feeds) |
| `GET` | `/api/feed.xml` | RSS 2.0 feed (last 50 signals, score >= 5) |
| **Bookmarks (Session-based, no auth)** |
| `POST` | `/api/bookmarks/:signalId` | Toggle bookmark status for a signal |
| `GET` | `/api/bookmarks` | Get all bookmarked signal IDs for current session |
| `GET` | `/api/bookmarks/signals` | Get full signal data for bookmarked signals |

**RSS Feed query parameters:**

| Param | Type | Example | Description |
|---|---|---|---|
| `category` | string | `geopolitics` | Filter by category |
| `severity` | string | `high` | Filter by minimum severity |

**RSS ordering:** `GET /api/feed.xml` is sorted by `published_at DESC` so aggregators reliably detect newest items first.

**Signal query parameters:**

| Param | Type | Example | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (default: 1) |
| `limit` | number | `20` | Items per page (default: 20) |
| `severity` | string | `high` | Filter by severity (low/medium/high) |
| `source` | string | `Reuters` | Filter by source name |
| `categoryId` | string | `geopolitics` | Filter by category slug |
| `since` | ISO date | `2026-04-01` | Only signals after this date |
| `search` | string | `cyber` | Full-text search (title, content, summary) |
| `sort` | string | `score` | Sort column (created_at, score, severity, published_at) |
| `order` | string | `desc` | Sort direction (asc/desc) |

### 11.2 Admin API (Protected by AdminGuard)

**Authentication:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/auth/login` | Email/password login, returns JWT cookies |
| `POST` | `/api/admin/auth/refresh` | Refresh expired access token |
| `POST` | `/api/admin/auth/logout` | Clear auth cookies |
| `GET` | `/api/admin/ai/health` | Check all AI providers health status (local, groq, openrouter) |
| `GET` | `/api/admin/ai/models` | List available models for Groq and OpenRouter with current selection |
| `PUT` | `/api/admin/ai/models` | Update selected model for a provider (`{ provider, modelId }`) |
| `POST` | `/api/admin/ai/models/refresh` | Refresh cached model lists from provider APIs |
| `POST` | `/api/admin/ai/retry` | Re-queue failed AI signals for processing (max 50) |
| `POST` | `/api/admin/ai/retry/high` | Re-queue high severity signals for processing (max 100) |

**Categories CRUD:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/categories` | List all categories |
| `POST` | `/api/admin/categories` | Create category |
| `PUT` | `/api/admin/categories/:slug` | Update category |
| `DELETE` | `/api/admin/categories/:slug` | Delete category |

**Sources CRUD:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/sources` | List all RSS sources |
| `POST` | `/api/admin/sources` | Create source |
| `PUT` | `/api/admin/sources/:id` | Update source |
| `DELETE` | `/api/admin/sources/:id` | Delete source |
| `POST` | `/api/admin/sources/:id/health` | Check source feed health |
| `POST` | `/api/admin/sources/:id/toggle` | Toggle source active/inactive |

**System:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/backup` | Trigger manual database backup |

---

## 12. Docker Deployment

### 12.1 Three Compose Files

| File | Purpose | Frontend mode |
|---|---|---|
| `docker-compose.yml` | Base (shared services: postgres, redis, llama) | — |
| `docker-compose.dev.yml` | Dev overrides + drizzle-studio | `npm run dev` with hot-reload |
| `docker-compose.prod.yml` | Production / VPS | `npm start` (pre-built) |

**Drizzle Studio (dev only):** Defined in `docker-compose.dev.yml` as `drizzle-studio` service. Runs `npx drizzle-kit studio` on port `4983`, bound to `127.0.0.1` only (never exposed externally). Access at `http://localhost:4983` when running the dev compose stack. Intentionally absent from `docker-compose.prod.yml`.

```bash
# Start dev stack including drizzle-studio
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

```yaml
# docker-compose.prod.yml
services:
  postgres:   # Database (internal only)
  redis:      # Cache (internal only)
  app:        # Backend API (port 3000), backups volume mounted
  frontend:   # Next.js Dashboard (port 3001)
  logs:       # Dozzle log viewer (port 9999), auth via DOZZLE_AUTH_PROVIDER: simple
volumes:
  pgdata:     # PostgreSQL data
  models:     # Local AI GGUF models
  backups:    # Database backup persistence (survives rebuilds)
```

### 12.2 Dev vs Production Volume Strategy

**Development** (`docker-compose.yml`): Mounts only `src/` and `public/` for hot-reload. Config files (`tsconfig.json`, `postcss.config.mjs`, `next.config.ts`) and `node_modules` come from the Docker image build — never mounted from host.

```yaml
volumes:
  - ./frontend/src:/app/src      # Hot-reload source changes
  - ./frontend/public:/app/public # Hot-reload assets
```

**Production** (`docker-compose.prod.yml`): Zero volume mounts. The multi-stage Dockerfile copies only build artifacts (`.next`, `public`, `package.json`, `node_modules`) into a clean image.

**Why this matters**: Mounting the entire `./frontend:/app` directory causes stale `.next` cache corruption and `node_modules` conflicts between host and container architectures.

### 12.3 Frontend .dockerignore

```
node_modules
.next
```

Prevents the host's `node_modules` and `.next` cache from being copied into the Docker build context.

### 12.4 Environment Variables

```env
# Root .env (for Docker Compose)
ADMIN_EMAIL=admin@signalstack.local
ADMIN_PASSWORD=changeme123
JWT_SECRET=your-jwt-secret
GROQ_API_KEY=gsk_your-key
OPENROUTER_API_KEY=sk-or-v1-your-key
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
AI_ENABLED=true

# Frontend build arg (production only)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

### 12.5 Deploy Flow

The recommended way to deploy is via the script, which builds new images while old containers keep serving and rolls back automatically on failure:

```bash
./scripts/deploy.sh
```

For a manual deploy (causes full downtime equal to build time):

```bash
# 1. Pull latest code
git reset --hard origin/main

# 2. Build new images (old containers still running)
docker compose -f docker-compose.prod.yml build app frontend

# 3. Swap containers (brief ~3–5s downtime)
docker compose -f docker-compose.prod.yml up -d --no-build --remove-orphans

# 4. Seed database (first run only)
docker exec signalstack-app npm run seed
```

### 12.6 Troubleshooting Docker Builds

If the frontend shows broken styles or stale errors:
```bash
# Clear anonymous volumes and rebuild from scratch
docker compose down && docker compose up --build -V
```

The `-V` flag removes anonymous volumes (stale caches) but preserves named volumes (database data).

---

## 13. Deployment & Ops Scripts

### 13.1 deploy.sh — Zero-Downtime Production Deploy

Located at `scripts/deploy.sh`. Invoke it directly on the VPS, or from your local machine via the `deploy-signal` shell alias:

```bash
# From local machine (one command)
git push origin main && deploy-signal

# Alias definition in ~/.zshrc:
# alias deploy-signal="ssh fazley@192.168.0.110 'cd /home/fazley/signal-stack && ./scripts/deploy.sh'"
```

> **Note**: GitHub Actions with a self-hosted runner was evaluated but dropped — the repo is public, meaning forks could trigger arbitrary code on the VPS. The shell alias is simpler and equally automated for a single-developer project.

**Strategy**: Pre-build while live → fast-swap → auto-rollback on failure.

**What it does (in order):**

1. Validates environment (checks for `.git`, `docker-compose.prod.yml`, `.env`)
2. Syncs code from `origin/main` via `git reset --hard` (auto-resolves conflicts)
3. Snapshots current `app` and `frontend` images as `:rollback` tags
4. Frees memory by pruning stale Docker artifacts (24h+ old)
5. **Builds new images while old containers keep serving** (`docker compose build app frontend`)
6. Fast-swaps containers with `docker compose up -d --no-build` (~3–5s downtime)
7. Waits for PostgreSQL health check (up to 30 seconds, 1s polling)
8. Seeds database (idempotent — safe every deploy)
9. **Validates backend and frontend** with a 20-retry loop (no fragile `sleep`)
10. Prints container status and access URLs

**Auto-rollback**: `trap rollback ERR` fires on any failure after the snapshot step. It stops new containers, retags `:rollback` images back, and restarts the previous version.

**Manual rollback** (printed at end of every deploy):
```bash
docker compose -f docker-compose.prod.yml down
docker tag signalstack-app:rollback signalstack-app:latest
docker tag signalstack-frontend:rollback signalstack-frontend:latest
docker compose -f docker-compose.prod.yml up -d --no-build
```

**Downtime profile**:
| Phase | Duration |
|---|---|
| Code sync + image build | 0s (old containers live) |
| Container swap | ~3–5s |
| Health check validation | 0s (served by new containers) |

### 13.2 audit.sh — VPS Environment Audit

Located at `scripts/audit.sh`. Diagnoses the full deployment health:

```bash
./scripts/audit.sh
```

**What it checks:**

| Check | What It Verifies |
|---|---|
| System Info | OS, kernel, RAM, disk usage |
| Docker | Docker + Compose installed |
| Containers | All 4 SignalStack containers running |
| Ports | 3000, 3001, 5433, 6380 listening |
| Git | Clean working tree, correct branch |
| Environment | `.env` exists, no placeholder values |
| Connectivity | Backend API + frontend HTTP 200 |
| Logs | Scans last 100 lines for errors |
| Database | PostgreSQL healthy, table count |
| Redis | PING/PONG check |

### 13.3 test-endpoints.sh — Premium API Diagnostics

Located at `scripts/test-endpoints.sh`. Provides a high-fidelity diagnostic suite for all API endpoints with a professional "smooth" terminal UI.

```bash
# Run against local dev
./scripts/test-endpoints.sh http://localhost:3000

# Run against production (default)
./scripts/test-endpoints.sh
```

**Features:**
- **Animated Scans**: High-fidelity terminal spinner for "at-a-glance" status.
- **Payload Preview**: Automatically detects and pretty-prints a one-line preview of JSON/RSS payloads.
- **Latency Tracking**: Measures total round-trip time per endpoint.
- **Standardized Results**: Consistent 200/201 verification across 8+ core endpoints.

**End-to-End Validation**:
This script is used as the final gatekeeper after a production deploy to ensure the Geopolitics Feed, Technology Feed, RSS Distribution, and Geographic Intelligence systems are all firing at 100% capacity.

Outputs a summary with pass/warn/fail counts. Exits with code 1 if any checks fail.

---

## 16. Key Concepts to Learn

### 16.1 Dependency Injection (NestJS)

Instead of `new Service()`, NestJS creates and injects instances:

```typescript
// ❌ Manual instantiation (hard to test)
const service = new SignalsService(new Repository());

// ✅ Dependency injection (NestJS handles it)
@Injectable()
export class SignalsController {
  constructor(private service: SignalsService) {}
  // NestJS provides the instance automatically
}
```

### 16.2 RxJS Streams

RxJS treats data as a **stream** you can transform:

```typescript
import { Subject, timer, zip } from 'rxjs';
import { mergeMap, filter } from 'rxjs/operators';

const jobs$ = new Subject<Job>();

jobs$.pipe(
  filter(job => job.score >= 7),           // Only high-score jobs
  zip(timer(0, 1500)),                     // One per 1.5s
  mergeMap(([job]) => process(job), 2)     // Max 2 concurrent
).subscribe();
```

### 16.3 SWR (Stale-While-Revalidate)

SWR returns cached data immediately, then fetches fresh data in the background:

```typescript
// First render: returns cached data (or undefined)
// Background: fetches fresh data
// Second render: returns fresh data, triggers re-render
const { data, isLoading } = useSWR('/api/signals', fetcher);
```

### 16.4 Intersection Observer (Infinite Scroll)

Detects when an element enters the viewport:

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      loadMore(); // User scrolled to bottom
    }
  },
  { root: scrollContainer, rootMargin: '200px' } // Trigger 200px early
);
observer.observe(sentinelElement);
```

### 16.5 CSS Custom Properties (Theming)

CSS variables that change with a single attribute:

```css
:root {
  --bg: oklch(14% 0 0);
}
[data-theme='light'] {
  --bg: oklch(100% 0 0);
}
body {
  background: var(--bg); /* Automatically switches */
}
```

---

## 14.6 Native Fetch API (No External HTTP Client)

SignalStack uses Node.js 20's built-in `fetch` instead of axios or other HTTP libraries. This eliminates:
- Supply chain vulnerabilities (axios was compromised in March 2026)
- Unnecessary dependencies
- Bundle size bloat

**Timeout pattern with AbortController:**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: controller.signal,
});

clearTimeout(timeoutId);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
```

This pattern is used consistently across all HTTP calls: feed fetching, AI providers, Discord alerts, and health checks.

---

## 17. Common Commands Reference

### Local Development

```bash
# Start infrastructure
docker compose up postgres redis -d

# Backend
cd backend && npm run db:push && npm run start:dev

# Frontend (new terminal)
cd frontend && npm run dev
```

### Production (VPS)

```bash
# Deploy — zero-downtime (recommended)
./scripts/deploy.sh

# Run API diagnostics (Post-deploy)
./scripts/test-endpoints.sh

# Manual deploy — causes full build-time downtime
git reset --hard origin/main
docker compose -f docker-compose.prod.yml build app frontend
docker compose -f docker-compose.prod.yml up -d --no-build --remove-orphans

# Check environment
docker compose -f docker-compose.prod.yml config | grep API_KEY

# View logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f frontend

# Seed database
docker exec signalstack-app npm run seed

# Backup database
docker exec signalstack-app npm run backup

# Health check
curl http://localhost:3000/api/health
curl http://localhost:3001/
```

### SSH & Remote Access

```bash
# Connect to VPS
ssh user@192.168.0.110

# Run commands on VPS without interactive session
ssh user@192.168.0.110 "cd ~/signal-stack && git pull"

# Full deploy via SSH
ssh user@192.168.0.110 "cd ~/signal-stack && git pull && docker compose -f docker-compose.prod.yml up -d --build"

# Check container status on VPS
ssh user@192.168.0.110 "docker ps --filter name=signalstack"

# View live logs on VPS
ssh user@192.168.0.110 "docker logs -f signalstack-app"

# SSH and run interactive commands
ssh user@192.168.0.110
cd signal-stack
docker compose ps
docker logs signalstack-app --tail 50
```

### Docker

```bash
# Rebuild everything
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build

# Rebuild one service
docker compose -f docker-compose.prod.yml up -d --build frontend

# Rebuild backend only
docker compose -f docker-compose.prod.yml up -d --build app

# Restart without rebuilding
docker compose -f docker-compose.prod.yml restart

# View all containers
docker ps -a

# View resource usage
docker stats

# Clean stale images
docker system prune -f

# Clean all unused volumes
docker volume prune -f

# Copy backup to host (backups are now in a Docker volume)
docker cp signalstack-app:/app/backups/signalstack_backup.sql .

# Execute command in container
docker exec -it signalstack-app sh
docker exec signalstack-app npm run test:ai

# Check container health
docker inspect signalstack-app --format='{{.State.Health.Status}}'

# View container networks
docker network ls
docker network inspect signalstack_default
```

### Git & Deployment

```bash
# Check git status
git status

# Stage and commit
git add -A && git commit -m "your message"

# Push to remote
git push

# Pull latest on VPS
git pull

# Check current branch
git branch

# View recent commits
git log --oneline -10

# Check remote
git remote -v
```

### Database

```bash
# Open Drizzle Studio (visual DB browser)
cd backend && npm run db:studio

# Push schema changes
cd backend && npm run db:push

# Run seed
cd backend && npm run seed

# Connect to PostgreSQL
docker exec -it signalstack-db psql -U signal -d signalstack

# Run SQL query
docker exec signalstack-db psql -U signal -d signalstack -c "SELECT COUNT(*) FROM signals;"
```

### AI Testing

```bash
# Test AI providers locally
cd backend && npm run test:ai

# Test Discord webhook
cd backend && npm run test:discord

# Check AI health endpoint
curl http://localhost:3000/api/admin/ai/health

# Monitor AI queue size
docker exec signalstack-app curl -s http://localhost:3000/api/admin/ai/health | jq '.queueSize'
```

### Troubleshooting

```bash
# Check logs for errors
docker logs signalstack-app 2>&1 | grep -i error

# Check specific service logs
docker compose -f docker-compose.prod.yml logs app --tail=100

# Check Redis connection
docker exec signalstack-redis redis-cli ping

# Check PostgreSQL connection
docker exec signalstack-db pg_isready -U signal

# View disk usage
docker system df

# Check network connectivity between containers
docker exec signalstack-app ping llama
docker exec signalstack-app nslookup postgres

# Restart a specific service
docker compose -f docker-compose.prod.yml restart app
```

---

## Next Steps

1. **Read the code** — start with `backend/src/feed/feed.scheduler.ts` and trace the data flow
2. **Modify a feed** — add a new RSS source in the admin panel and watch it appear
3. **Test AI failover** — set `GROQ_API_KEY` to an invalid value and watch it fall back to OpenRouter
4. **Add a feature** — try adding a new severity level or a new dashboard widget

### 18.2 Production Performance Benchmarks (2-Core VPS)

The following metrics were captured during a live stress test on the production Proxmox VM:

| Metric | Load Scenario (500 VUs) | Stress Scenario (2000 VUs) |
|---|---|---|
| **Success Rate** | **100%** (0 Errors) | **86.7%** (Timeout Zone) |
| **Throughput** | 111 requests/sec | **266 requests/sec** |
| **Avg Latency** | 196ms | 4.45s |
| **p(95) Latency** | **789ms** | **11.93s** |
| **Max Throughput** | ~400 MB / 5 min | **1.2 GB / 10 min** |

### 18.3 Analysis of Results
- **Safe Zone (1–750 VUs)**: The system handles up to 750 concurrent users with sub-second latency and 100% reliability.
- **The Breaking Point**: CPU saturation hits 100% at ~1,200 users. Beyond this, Cloudflare and Next.js start timing out (11s+ latency) as the Node.js event loop becomes blocked.
- **Resource Usage**: Both the NestJS API and Next.js Frontend consume roughly equal CPU (~30% each) under heavy load. The database (PostgreSQL) remains highly efficient (<5% CPU) due to optimized indexing.

### 18.4 Roadmap to 1,000,000 Users
To scale to 1M monthly active users (~5,000 concurrent peak), the following upgrades are recommended in order of impact:

1.  **Edge Caching (Cloudflare)**:
    - Route: `/api/signals*` and `/api/signals/stats`.
    - Strategy: **Cache Everything** for 60 seconds.
    - Impact: **90% reduction** in VPS load. The VPS only processes 1 request per minute per edge location instead of thousands per second.
2.  **API Gateway**:
    - Discontinue Next.js `rewrites` for production scale. Use an **Nginx** reverse proxy to route `/api` traffic directly to the `app` container, bypassing the Next.js Node process.
3.  **Horizontal Scaling**:
    - Deploy 3x `app` containers and 2x `frontend` containers behind a load balancer (Traefik/Nginx).
4.  **Database Connection Pooling**:
    - Deploy **PgBouncer** to handle the thousands of concurrent TCP connections that occur at 1M user scale, preventing PostgreSQL from running out of workers.

---

## 18. Performance & Scaling

SignalStack is built to handle professional workloads. To verify this, the project includes a dedicated load testing suite using **k6**.

### 18.1 Running the Load Test
The test script is located at `scripts/loadtest.js`.

```bash
# Smoke test (against local dev)
k6 run scripts/loadtest.js

# Stress test (against your public domain)
k6 run -e BASE_URL=https://your-domain.com -e SCENARIO=stress scripts/loadtest.js
```

### 18.5 Performance Analysis (Local)
Initial stress tests on a **2-core VPS** showed the following characteristics:
- **Zero Failures**: The NestJS API remained 100% stable at 500 concurrent users.
- **CPU Bottleneck**: The Next.js SSR (Server-Side Rendering) is the heaviest component, consuming ~45% CPU under load.
- **Memory Stability**: Redis and PostgreSQL combined used less than 10% of available RAM.

### 18.6 Scaling Strategy for 1M Users
To move from 500 concurrent users to 1,000,000 monthly active users, follow this roadmap:

1.  **Frontend Caching**: Use **Incremental Static Regeneration (ISR)** in Next.js or a CDN like Cloudflare to serve cached HTML. This removes the SSR load from your VPS.
2.  **API Gateway**: Instead of proxying through Next.js (rewrites), use an **Nginx** or **Traefik** reverse proxy to route `/api` traffic directly to the backend.
3.  **Database Scaling**: 

---

## 19. Troubleshooting Guide

### 19.1 Container Crash: FeedService Not Exported

**Symptom:** AdminSourcesController fails to initialize with dependency injection error

```
Unable to resolve dependency at index 0
dependencies: [class FeedService]
```

**Cause:** FeedService was used in AdminModule but not exported from FeedModule

**Fix:**
```typescript
// backend/src/feed/feed.module.ts
@Module({
  imports: [ScorerModule, SignalsModule, AlertsModule],
  providers: [FeedService, FeedScheduler],
  exports: [FeedService],  // ADD THIS
})
export class FeedModule {}
```

**Prevention:** Always export services that are injected into other modules

### 19.2 Disk Full: Container Cannot Write

**Symptom:** PostgreSQL panic with error:
```
PANIC: could not write to file "pg_logical/replorigin_checkpoint.tmp": No space left on device
```

**Cause:** Docker volumes and old images filling up disk

**Fix:**
```bash
# Clean all unused Docker resources
docker system prune -af --volumes

# Verify cleanup
df -h /
```

**Prevention:** 
- Monitor disk space: `df -h`
- Set up disk space alerts
- Regular cleanup: `docker system prune`

### 19.3 Module Dependency Graph

Understanding module dependencies is critical for debugging DI errors:

```
AppModule
├── AdminModule
│   ├── FeedModule ← exports FeedService (required for AdminSourcesController)
│   ├── AIModule
│   └── DatabaseModule
├── SignalsModule
├── FeedModule ← exports FeedService
├── ScorerModule
└── AlertsModule
```

**Key Rule:** Any module that injects a service from another module requires that service to be exported.
    - Add **PgBouncer** for connection pooling.
    - Implement **Read Replicas** as traffic grows.
4.  **Application Clustering**:
    - Run multiple instances of the `app` container behind a load balancer.
    - Containerize the `Feed Scheduler` separately so ingestion doesn't compete with API traffic.

---

## 20. Job Signal Extension (April 2026) <a name="job-signal-extension"></a>

The Jobs module adds a parallel intelligence stream for job listings — private, preference-filtered, Discord-alerted. It reuses all existing patterns (RSS ingestion, hashing, Discord webhooks, settings storage) without touching the signals domain.

### Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| Storage | Separate `jobs` table | Orthogonal fields (company, salary, remote), no AI scoring, different retention |
| Sources | Shared `sources` table + `type` discriminator | Zero new CRUD endpoints needed |
| Preferences | JSON blob in `settings` table, key `job_preferences` | Single user, no dedicated table needed |

### Data Flow

```
[JobsScheduler — every 30min]
    ↓
JobsService.processJobs()
    ├─ getActiveSources()          → sources WHERE type='job' AND isActive=true
    ├─ JobsFeedService.fetchJobs() → RSS parse → RawJob[]
    ├─ getPreferences()            → settings WHERE key='job_preferences'
    └─ For each RawJob:
         ├─ generateHash(title, url)
         ├─ hashExists()           → skip duplicates
         ├─ repository.insert()
         ├─ matchesPreferences()   → deterministic filter
         └─ if match: DiscordService.sendJobAlert()
```

### Key Files

| File | Purpose |
|---|---|
| `backend/src/jobs/jobs.service.ts` | Core orchestration + matching engine |
| `backend/src/jobs/jobs-feed.service.ts` | RSS parsing, HTML decode, stale filter (14d) |
| `backend/src/jobs/jobs.repository.ts` | DB queries, pagination, dedup |
| `backend/src/jobs/jobs.scheduler.ts` | Cron: fetch every 30m, cleanup daily 2AM |
| `backend/src/jobs/jobs.controller.ts` | REST: GET /api/admin/jobs, PUT preferences |
| `backend/src/common/types.ts` | `RawJob`, `JobPreferences` interfaces |
| `frontend/src/app/admin/jobs/page.tsx` | Admin UI: Live Feed + Discord Filters tabs |

### JobPreferences Interface

```typescript
class JobPreferences {
  keywords: string[];          // match title/desc/tags/company (OR logic)
  excludeKeywords: string[];   // immediate discard on match
  locations: string[];         // substring match on location field
  remote: boolean | null;      // true=remote only, false=on-site, null=all
  experienceLevels: string[];  // entry/mid/senior exact match
  strictGlobalRemote?: boolean;// Phase 1 geo-filter (see below)
}
```

### Phase 1: Strict Global Remote Filter

`strictGlobalRemote: true` activates `isCountryLocked()` — a regex heuristic engine that scans `title + location + description` for geo-restriction patterns:

**Patterns detected:**
- Country-explicit: `US Only`, `UK Only`, `Canada Only`, `Australia Only`, `EMEA Only`, `Europe Only`
- Authorization language: `authorized to work in the US`, `US work authorization`, `right to work in the UK`
- Residency: `based in [country]`, `must be located in [country]`
- Timezone restrictions: `EST timezone required/only`, `PST timezone only`

**Logic:** Only applies to jobs where `remote === true`. On-site jobs are not filtered — the assumption is a job that claims to be "remote" but restricts to one country is misleading; a job listed as "on-site in USA" is honest.

**Key principle:** This is a false-negative-tolerant filter. It misses some country-locked jobs but never incorrectly blocks a genuinely global role.

### matchesPreferences() Logic (ordered)

1. **Exclude keywords** — discard if title OR description contains any
2. **Strict Global Remote** — discard if `strictGlobalRemote=true`, `job.remote=true`, and `isCountryLocked()=true`
3. **Remote preference** — filter by remote/on-site/all
4. **Keywords** — must match at least one in title/desc/tags/company (if any specified)
5. **Locations** — substring match; remote jobs bypass location check
6. **Experience levels** — exact match if job specifies level

### Admin UI

`/admin/jobs` has two tabs:
- **LIVE FEED** — paginated job cards, search, manual fetch trigger
- **DISCORD FILTERS** — keyword inputs, remote toggle, Strict Global Remote toggle

---

## 21. UI Light Mode Fixes (April 2026) <a name="light-mode-fixes"></a>

Several components used opacity-based color classes (`text-*-400`, `bg-*/10`) designed for dark backgrounds. These became invisible or "blobby" in light mode.

### Pattern Applied

| Before | After | Reason |
|---|---|---|
| `text-blue-400` | `text-blue-600 dark:text-blue-400` | `-400` too light on white |
| `bg-blue-500/10` | `bg-blue-500/15 dark:bg-blue-500/10` | Too transparent in light |
| `bg-emerald-500/20 ring-1` | `bg-emerald-500 dark:bg-emerald-500/20` | StatsBar blobs → solid icons |

### Files Changed
- `frontend/src/app/admin/page.tsx` — all StatCard icon/accent props
- `frontend/src/components/StatsBar.tsx` — icon backgrounds: solid colored in light, transparent in dark

### Double Header Bug Fix

Admin pages were importing and rendering the public `<Header>` component despite `admin/layout.tsx` already wrapping all children with `<AdminSidebar>`. Removed `<Header>` render from `jobs/page.tsx` and `categories/page.tsx`; removed unused imports from `sources/page.tsx`, `signals/page.tsx`, `admin/page.tsx`.

### Jobs Tab Layout Fix

`frontend/src/components/ui/tabs.tsx` uses `@base-ui/react/tabs` with `data-horizontal:flex-col` variant. The root sets `data-orientation="horizontal"` not `data-horizontal`, so the Tailwind variant never activated → TabsList and TabsContent rendered side-by-side in a row. Fix: added `flex-col` directly to the `<Tabs>` className in `jobs/page.tsx`.


---

## 22. API Key & Webhook Management (April 2026) <a name="api-key-management"></a>

AI API keys and Discord webhook URLs can now be configured through the admin dashboard without editing `.env` files. All values are stored in the `settings` table and applied in-memory immediately on save.

### Priority Order

DB setting (admin UI) → `.env` variable → disabled (no key)

On `onModuleInit`, each provider reads its stored key from the DB and overwrites the env-loaded value if present.

### Settings Keys Used

| Setting Key | Provider | Purpose |
|---|---|---|
| `groq_api_key` | Groq | AI summarization / translation |
| `openrouter_api_key` | OpenRouter | AI summarization fallback |
| `discord_webhook_url` | DiscordService | Signal alerts |
| `discord_jobs_webhook_url` | DiscordService | Job match alerts |

### Security Notes

- Keys are stored plain-text in PostgreSQL (same risk level as `.env` file on disk)
- The GET `/api/admin/keys` endpoint returns only masked values (`gsk_ab••••••••1234`) — the full key is never sent to the frontend
- PUT `/api/admin/keys` accepts the full key and stores it, updating the provider in-memory via `updateApiKey()`

### Files Changed

| File | Change |
|---|---|
| `backend/src/ai/providers/groq.provider.ts` | `OnModuleInit` loads DB key; `updateApiKey()` method |
| `backend/src/ai/providers/openrouter.provider.ts` | Same pattern |
| `backend/src/alerts/discord.service.ts` | `OnModuleInit` loads DB webhook URLs; `updateWebhookUrls()` + `getWebhookUrls()` |
| `backend/src/admin/admin.controller.ts` | GET/PUT `/api/admin/keys`, GET/PUT `/api/admin/webhooks`, POST `/api/admin/webhooks/test` |
| `frontend/src/app/admin/page.tsx` | API Keys section + Discord Webhooks section with test buttons |

### Webhook Test Endpoint

`POST /api/admin/webhooks/test` with `{ type: "signals" | "jobs" }` sends a test Discord embed to the configured webhook URL. Returns `{ success: true }` or `{ success: false, error: "..." }`.

---

## 23. Company Radar — Performance, Smart Detection & Resource Hardening (April 17, 2026) <a name="company-radar-v2"></a>

This update covers three rounds of improvements to the Company Radar feature: performance optimizations, smarter career page detection, and VPS resource safety.

---

### 23.1 OSM Query Broadening (Sparse-Region Fix)

**Problem:** Coordinates in South/Southeast Asia (e.g., Chittagong, BD: `22.3549, 91.8067`) returned zero results even at 50km radius. Root cause: OSM contributors in these regions rarely tag offices with `office=company|tech|it|software`. The original query was too restrictive.

**Fix — 3 new Overpass node queries added:**

```
node["amenity"="company"]                      → common tag in Asia
node["building"="office"]["name"]              → mapped office buildings
node["name"~"software|technologies|tech|..."]  → name-keyword fallback
```

**Cache key bumped** from `v2` → `v3` to bust stale empty results immediately.

**Result cap** raised from 15 → 25 companies per search.

**Key file:** `backend/src/companies/companies.service.ts` — `queryOverpass()`

---

### 23.2 Career Page Detection — 3-Step Smart Pipeline

**Previous approach:** HEAD request to 6 known paths (e.g. `/careers`, `/jobs`). If `200 OK` → mark as found. Problems:
1. SPAs return `200` for any URL (false positives)
2. No content verification — a 200 on `/careers` doesn't mean there are actual jobs
3. Sequential path checks — up to 6 × 4s = 24s worst case per company

**New 3-step pipeline:**

```
Step 1: HEAD all 9 paths concurrently
         ↓ (filter to 200 OK hits)
Step 2: GET each hit → read first 30KB → verify job keywords in body
         ↓ (if no hits pass verification)
Step 3: GET homepage → scan <a> links for career keywords
         ↓
Return first confirmed URL or null
```

**Job content keywords** (any one triggers a match):
```
apply now | job opening | open position | current opening | career opportunit
we're hiring | join our team | vacancies | full-time | part-time | internship
job listing | view all jobs | see all jobs | open roles | available position
```

**Career link keywords** (for homepage `<a>` scan):
```
career | careers | jobs | vacancies | hiring | openings | positions
join us | work with us | we're hiring
```

**Path list expanded:** 9 paths now (`/careers`, `/jobs`, `/work-with-us`, `/join-us`, `/join`, `/hiring`, `/vacancies`, `/opportunities`, `/positions`)

**Key files:**
- `checkCareerPage()` — orchestrates 3 steps
- `headRequest()` — semaphore-gated HEAD
- `verifyJobContent()` — stream-reads 30KB, checks `JOB_CONTENT_KEYWORDS`
- `scanHomepageForCareerLink()` — stream-reads 50KB, safe linear `indexOf` HTML scan

---

### 23.3 Concurrency Control — Semaphore

**Problem:** 25 companies × 9 paths = up to 225 simultaneous outbound HTTP requests. Risk: server IP gets blocked by target sites.

**Fix:** Custom `Semaphore` class caps total concurrent outbound requests at **8** across all companies:

```typescript
class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) { this.active++; return; }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}
```

Every `headRequest()`, `verifyJobContent()`, and `scanHomepageForCareerLink()` call acquires before the fetch and releases in `finally`. Queue backs up gracefully — no requests dropped.

**Timeout reduced:** 4000ms → 2500ms per path (semaphore queuing adds wait time anyway, so faster bail is appropriate).

---

### 23.4 VPS Resource Limits (Docker)

**Problem:** Only the `llama` container had Docker resource limits. The `app` and `frontend` containers were uncapped — a spike (nearby search on cold cache) could steal CPU from postgres/redis/llama.

**Limits added to `docker-compose.prod.yml`:**

| Container | CPU | Memory | Notes |
|---|---|---|---|
| `llama` | 0.5 | 1GB | Pre-existing |
| `app` | 1.0 | 768MB | New — raised from initial 512MB after OOM |
| `frontend` | 0.5 | 256MB | New |

**Why 512MB caused OOM on startup:** The `app` container runs `drizzle-kit push` + `ts-node seed.ts` + NestJS bootstrap sequentially on every start. Combined heap during this sequence exceeds 512MB. Idle runtime is ~53MB, so 768MB gives comfortable headroom.

**Total capped:** 2.0 CPU / ~2GB — leaves ~1.8GB free for postgres, redis, OS on a 3.8GB VM.

---

### 23.5 Regex Backtrack Risk — Fixed

**Problem:** `scanHomepageForCareerLink` originally used this regex on 50KB of untrusted HTML:

```typescript
/<a\s[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis
```

The `(.*?)` with `s` (dotall) flag can cause **catastrophic backtracking** on malformed HTML (e.g., unclosed tags, nested elements inside `<a>`), potentially pegging one CPU core until the AbortController fires.

**Fix:** Replaced with a safe linear `indexOf` scan:

```typescript
let pos = 0;
while (pos < html.length) {
  const aStart = html.indexOf('<a ', pos);
  if (aStart === -1) break;
  const tagEnd = html.indexOf('>', aStart);
  const tag = html.slice(aStart, tagEnd + 1);

  const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);  // bounded — no dotall
  if (hrefMatch) {
    const href = hrefMatch[1];
    // check href + inner text against CAREER_LINK_PATTERN
  }
  pos = tagEnd + 1;
}
```

**Why safe:** `indexOf` is O(n). The bounded `href=` regex runs only on the tag string (never crosses tag boundaries). No backtracking possible.

---

### 23.6 Performance Summary

| Metric | Before | After |
|---|---|---|
| Career enrichment worst case | ~72s (batches of 5, sequential paths) | ~2.5s (all concurrent, semaphore-gated) |
| Max concurrent outbound requests | 150+ | 8 (semaphore) |
| False positive career pages (SPAs) | Common | Eliminated (keyword verification) |
| Zero results in BD/Asia on OSM | Frequent | Fixed (broadened query + name keywords) |
| OOM crash on container start | Possible (no limit) | Prevented (768MB cap) |
| Regex CPU spike risk | Present | Eliminated (linear scan) |




---

## Section 24 — Directory Crawler: Architecture, Safety & Site-Specific Extractors

### 24.1 Overview

The Directory Crawler is a manually-triggered admin feature that scrapes company directories from three Bangladeshi industry sources and presents results for selective saving to the database. It is **not automated** — runs only when an admin clicks "Run Crawl" in the `/admin/companies` → "Directory Crawler" tab.

Sources:
| Key | Label | Type | Est. Companies |
|---|---|---|---|
| `basis` | BASIS | JSON API (Vue SPA) | 2,806 |
| `bacco` | BACCO | Server-rendered HTML | ~500 |
| `bdjobs` | bdjobs | Server-rendered HTML | varies |

### 24.2 API Endpoints

```
GET  /api/admin/companies/crawl/sources  → returns CRAWLER_SOURCES metadata
POST /api/admin/companies/crawl          → body: { source: 'basis'|'bacco'|'bdjobs' }
POST /api/admin/companies/save           → body: { name, website, city, country, source, tags, ... }
```

All endpoints guarded by `AdminGuard` + `SkipThrottle`. Crawl is synchronous — frontend waits for full response.

### 24.3 Site-Specific Extractors

**BASIS** — Vue SPA, HTML fetch returns empty `<div id="app">`. Solution: JSON API discovered via JS bundle analysis.

```
GET https://basis.org.bd/get-member-list?page=N
Headers: Accept: application/json, Referer: https://basis.org.bd/member-list

Response:
{
  "data": [{ "company_name": "...", "membership_no": "03-09-017", ... }],
  "meta": { "last_page": 188, "total": 2806, "per_page": 15 }
}
```

Pagination: reads `meta.last_page` dynamically, stops at that page or MAX_PAGES (15), whichever is first. Website field intentionally skipped — fetching `/get-company-profile/{membership_no}` per company would be 2,806 extra requests.

---

**BACCO** — server-rendered, 20 companies/page, ~25 pages. URL: `https://bacco.org.bd/member-list?page=N`

HTML structure per member:
```html
<div class="media mt-5 member-list-img">
  <h5 class="mt-0">COMPANY NAME</h5>
  <a href="https:////www.site.com">www.site.com</a>
</div>
```

Extractor uses linear `indexOf` scan — find `media mt-5 member-list-img`, walk to `<h5>` for name, walk to `<a href=` for website. Fixes BACCO's double-slash href bug: `https:////www.` → `https://www.` via `replace(/^(https?:)\/\/+/, '$1//')`.

---

**bdjobs** — `https://jobs.bdjobs.com/Company_list.asp` — single page, no pagination.

HTML structure:
```html
<div class="Org-name">
  <a class="sub_window_new_update" data-path='companyofferedjobs.asp?id=24362&...' href="javascript:void(0);">
    Company Name
  </a>
</div>
```

Extractor: find `class="Org-name"`, walk to `<a>`, extract inner text. Decodes `&amp;` → `&`. Applies exclude filter (see 24.5).

### 24.4 Anti-Blocking Measures

| Measure | Value |
|---|---|
| Request pattern | Sequential only, never parallel |
| Delay between pages | 1,500–3,000ms random |
| Per-request timeout | 8,000ms (AbortController) |
| Rate-limit response | Stops crawl immediately on 429 or 503 |
| Max pages per run | 15 (hard cap) |
| User-Agent | Rotates across 3 Chrome UAs (Win/Mac/Linux) |
| Accept headers | Mimics real browser requests |

Worst-case crawl duration: `15 pages × 8s timeout = 120s`. In practice ~30–45s for BASIS (API is fast), ~45s for BACCO.

### 24.5 Content Filtering (bdjobs)

bdjobs is a general job board — includes banks, NGOs, clinics, etc. A name-based exclude filter drops obviously non-tech companies before they reach the admin UI:

```typescript
private static readonly BDJOBS_EXCLUDE =
  /\b(bank|banks|banking|finance|financial|insurance|leasing|brac bank|dutch.bangla|islami bank|trust bank|city bank|mutual trust)\b/i;
```

Applied in `extractBdjobsCompanies()` — if `BDJOBS_EXCLUDE.test(name)` is true, company is dropped. BASIS and BACCO are industry-specific associations so no filter needed there.

### 24.6 Frontend Integration

Added as 3rd tab ("Directory Crawler") in `/admin/companies`. Source selection uses pill buttons (BASIS / BACCO / bdjobs). Results table uses `useResizableColumns([220, 100, 120, 140, 60])` matching other admin tables. Columns: Company, Location, Source (badge), Website, Save button.

`crawlSavedNames` Set tracks saved state by company name (not DB id) — Save button turns to "Saved ✓" after clicking without requiring a page reload.

### 24.7 Safety Summary

The manual Save gate is the strongest protection — nothing enters the DB without explicit admin action. System-level risks (CPU, memory, rate limiting) are all handled at the fetch layer and are not affected by what data gets returned.


---

## Section 25 — Unit Testing: DirectoryCrawlerService

### 25.1 Test Coverage

35 tests across 5 describe blocks. All tests are pure unit tests — no DB, no network, no mocks for the extractor methods (they are pure string-in / array-out).

| Block | Tests | What it covers |
|---|---|---|
| BACCO extractor | 7 | Name extraction, website extraction, double-slash fix, missing website, self-link skip, multi-company, empty HTML |
| bdjobs extractor | 5 | Name extraction, `&amp;` decode, whitespace trim, multi-company, empty HTML |
| Bank filter | 16 | 11 excluded names (banks/insurance/finance), 5 allowed tech company names |
| BASIS JSON parsing | 4 | Name from `company_name`, deduplication, null response stop, `last_page` pagination stop |
| CRAWLER_SOURCES | 2 | Key names, required fields per source |

### 25.2 Key Patterns

**Extractor tests** call private methods directly via `(service as any).extractBaccoCompanies(html)`. This is acceptable for pure parsing logic — the method has no side effects and no dependencies.

**BASIS crawl tests** mock `fetchJson` via `jest.spyOn(service as any, 'fetchJson').mockResolvedValueOnce(...)` and `randomDelay` to avoid actual delays in tests.

**Bank filter uses `it.each`** — one test per company name, keeping failures readable.

### 25.3 Pre-existing Test Failures

8 test suites fail on `main` unrelated to the crawler work (`admin.service.spec.ts`, `ai.service.spec.ts`, `signals.service.spec.ts`, etc.) — root cause is `SyntaxError: Cannot use import statement outside a module` in ESM dependencies. These are pre-existing and not introduced by this session.

---

## Section 26 — Admin Auth Session & Token Expiry

### 26.1 The Problem

Admin users were being logged out every ~15 minutes. The JWT access token was set to `'15m'` expiry in `auth.service.ts`, and the frontend has no automatic token-refresh logic (no periodic `/auth/refresh` call in the background). Once the access token expired, every authenticated request returned 401 and the admin was redirected to login.

### 26.2 The Fix

Both the JWT expiry and the cookie `maxAge` were bumped to 7 days:

**`backend/src/admin/auth.service.ts`:**
```typescript
private readonly accessTokenExpiry = '7d';   // was '15m'
private readonly refreshTokenExpiry = '7d';
```

**`backend/src/admin/auth.controller.ts`** (login + refresh endpoints):
```typescript
maxAge: 7 * 24 * 60 * 60 * 1000,  // was 15 * 60 * 1000
```

### 26.3 Token Architecture

| Token | Stored in | Path | Expiry |
|---|---|---|---|
| `signalstack_access_token` | httpOnly cookie | `/` | 7 days |
| `signalstack_refresh_token` | httpOnly cookie | `/api/admin/auth/refresh` | 7 days |

Both tokens are signed with `HS256` using `JWT_SECRET` env var. The refresh token path restriction (`/api/admin/auth/refresh`) means the browser only sends it on refresh requests — it cannot be accidentally sent to other endpoints.

### 26.4 Cookie Security Settings

```typescript
{
  httpOnly: true,                                    // JS cannot read it
  secure: process.env.NODE_ENV === 'production',    // HTTPS only in prod
  sameSite: 'lax',                                  // CSRF protection
  domain: process.env.NODE_ENV === 'production'
    ? '.fazleyrabbi.xyz' : undefined,               // shared across subdomains in prod
}
```

`sameSite: 'lax'` allows the cookie on cross-site navigations (clicking a link) but blocks on cross-site POST requests, providing CSRF protection without breaking the admin login flow.

---

## Section 27 — AI Daily Limit & Signal Backlog

### 27.1 Symptom

Signals stuck in `pending` state, `ai_daily_limit_reached` events appearing in logs every cycle. The signals queue was stalled because the daily counter had hit its limit.

### 27.2 How the Daily Limit Works

The AI queue (`ai.queue.ts`) uses a Redis key `ai:daily_count:YYYY-MM-DD` to track usage:

```
Key:  ai:daily_count:2026-04-17
TTL:  set to expire at UTC midnight of that day
Value: incremented atomically per AI call
```

Before processing any signal, the queue checks:
```typescript
const count = await redis.get(`ai:daily_count:${today}`);
if (Number(count) >= AI_DAILY_LIMIT) {
  emit('ai_daily_limit_reached');
  return;
}
```

### 27.3 Root Cause

Default `AI_DAILY_LIMIT` was 150. The Redis counter showed **1759** requests on a single day — 10x the limit. Every feed cycle was hitting the limit immediately and stalling all pending signals.

### 27.4 Fix

Raised the default limit to 500 in `docker-compose.prod.yml`:
```yaml
AI_DAILY_LIMIT: ${AI_DAILY_LIMIT:-500}
```

Manually deleted the Redis counter to immediately unblock the queue (no restart needed):
```bash
docker exec signalstack-redis redis-cli DEL ai:daily_count:2026-04-17
```

After deletion, `ai_processing_success` events resumed immediately with Groq as the provider.

### 27.5 Tuning the Limit

`AI_DAILY_LIMIT` can be set per-deployment in `.env`. For a personal instance:
- 500/day with Groq free tier is safe (Groq allows ~14,400 req/day on free tier)
- If you add many high-frequency RSS sources, increase to 1000+
- The Redis key resets automatically at UTC midnight — no cron needed

---

## Section 28 — OSM Nearby Query Improvements

### 28.1 Original Problem

The `/companies/nearby` endpoint was returning irrelevant results: banks, hospitals, mills, and other non-tech entities. The original query used a broad name filter (`ltd|limited`) which matched nearly any registered company.

### 28.2 Query Strategy

The fixed query requires the `["office"]` tag, which OSM contributors add specifically to business offices. This filters out most shops, hospitals, and utilities. The query also covers `way` type elements (buildings mapped as polygons, not just nodes):

```
node["office"~"company|tech|it|software|coworking|startup",i]
way["office"~"company|tech|it|software|coworking|startup",i]
node["name"]["website"]["office"]          ← has website + office tag
way["name"]["website"]["office"]
node["amenity"="company"]
node["building"="office"]["name"]          ← office buildings
way["building"="office"]["name"]
node["name"~"software|technologies|tech|systems|solutions|digital",i]["office"]
```

`out center` is required (instead of `out body`) so that `way` elements include `center.lat`/`center.lon` for their geographic centroid.

### 28.3 Way vs Node Handling

```typescript
const elLat = el.lat ?? el.center?.lat;
const elLng = el.lon ?? el.center?.lon;
if (!elLat || !elLng) continue;  // skip if no coords
```

Nodes have `el.lat`/`el.lon` directly. Ways have `el.center.lat`/`el.center.lon` (requires `out center` in query).

### 28.4 Cache Key

Bumped from `v3` → `v4` after the query change so old (irrelevant) cached results are not served:
```typescript
const cacheKey = `companies:nearby:v4:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;
```

### 28.5 OSM Data Limitations in Bangladesh

OSM coverage varies by country. Bangladesh has fewer office-tagged entries than Western Europe or North America. If results are sparse:
- Increase search radius (default 5km)
- Results improve as local OSM contributors add data
- For denser results, consider supplementing with Google Places API (has free quota) or Foursquare Places API

---

## Section 29: Directory Crawler Fixes — e-CAB & GitHub Source (April 2026)

### 29.1 What Broke

Two crawler sources stopped returning companies:

**GitHub (`github_bd`):** URL pointed to `README.md` but the repo (`MBSTUPC/tech-companies-in-bangladesh`) renamed the file to `README.adoc`. Fetch returned HTTP 404, parser got `null`, returned empty array.

**e-CAB (`ecab`):** Site migrated to a Vue SPA (`<div id="app"><app></app></div>`). `fetchPage()` only gets the pre-render HTML shell (~3KB of CSS/JS config). No member data is in the HTML — it's all loaded client-side via Axios.

### 29.2 e-CAB Fix — JSON API Discovery

Inspected the bundled JS (`/public/js/frontend_app.js`, ~3.4MB) with regex to find Axios calls. Found:

```javascript
// Inside the Vue component for /member-list route:
axios.get("/get-member-list?member_category=General", { params: this.search_data })
  .then(e => { this.table.datas = e.data.data; this.meta = e.data.meta; })
```

**API endpoint:** `GET https://e-cab.net/get-member-list?member_category=General&page=N`

**Response shape** (same as BASIS):
```json
{
  "data": [{ "company_name": "...", "website": "...", "current_office_address": "..." }],
  "meta": { "current_page": 1, "last_page": 98, "total": 2935 }
}
```

Required headers to avoid 403:
```typescript
'Accept': 'application/json',
'X-Requested-With': 'XMLHttpRequest',
'Referer': 'https://e-cab.net/member-list',
```

**Result:** 2935 members across 98 pages — far more than HTML scraping ever found.

### 29.3 GitHub Fix — AsciiDoc Parser

The file format changed from Markdown (`[Name](URL)`) to AsciiDoc table:

```asciidoc
|===
|Company Name |Office location |Technologies |Web presence |No. of Software Engineers

|Adplay Technologies (VU Mobile)
|Head Office: 4th Floor, House-114, Banani, Dhaka
|JavaScript, React, WordPress
|http://vumobile.biz/[Website]
|Please update
```

**Parser logic** — each company = 5 consecutive `|`-prefixed lines:
- Row 1: `|Company Name`
- Row 2: `|Address`
- Row 3: `|Technologies` (skipped)
- Row 4: `|http://url[LinkText]` — extract URL with regex `/(https?:\/\/[^\[]+)\[/`
- Row 5: `|headcount` (skipped)

Advance `i += 5` per company. Skip `|===`, `|Company Name` header rows.

**Result:** 238 companies parsed correctly with name + website + address for city detection.

### 29.4 Key Lesson

When a site returns an empty or tiny HTML page, check if it's a SPA:
1. Look for `<div id="app">` or `<app>` — Vue/React indicator
2. Inspect the JS bundle for `axios.get(` or `fetch(` calls
3. The real data endpoint is almost always a REST/JSON API

---

## Section 30: Company Radar — Tech Filter for Saved Companies (April 2026)

### 30.1 Problem

Saved companies list included non-tech entries from OSM (`office=company` tag with no tech signal) — banks, garments factories, restaurants, hospitals saved alongside IT firms.

### 30.2 Solution — `isTechCompany()` Guard

Added to `companies.repository.ts`:

```typescript
const NON_TECH_EXCLUDE = /\b(bank|banking|finance|insurance|hospital|clinic|
  restaurant|hotel|real estate|construction|garments|textile|apparel|food|
  grocery|retail|trade|import|export|transport|shipping|airline|travel|
  tourism|newspaper|school|college|university|ngo|government|ministry)\b/i;

const TECH_CONFIRM = /\b(software|tech|technology|digital|IT|ICT|solutions|
  systems|apps|web|mobile|cloud|data|cyber|fintech|ecommerce|startup|
  dev|platform|SaaS|AI|ML|ERP|CRM|automation|electronics)\b/i;

const TECH_SOURCES = new Set(['basis', 'bacco', 'github_bd', 'ecab']);

export function isTechCompany(name: string, source: string, tags: string[]): boolean {
  if (TECH_SOURCES.has(source)) return true;          // directory sources = always tech
  const tagStr = tags.join(' ').toLowerCase();
  if (/\b(software|tech|it|coworking|startup)\b/.test(tagStr)) return true;
  if (TECH_CONFIRM.test(name)) return true;
  if (NON_TECH_EXCLUDE.test(name)) return false;
  return false;  // OSM generic "company" with no signal → exclude
}
```

### 30.3 Three-Layer Enforcement

| Layer | Where | What it does |
|-------|-------|-------------|
| `save` endpoint | `companies.controller.ts` | Rejects non-tech with `BadRequestException` before insert |
| `findAll` | `companies.repository.ts` | SQL `WHERE` clause filters out non-tech at DB level |
| `purgeNonTech()` | `companies.repository.ts` | `DELETE` query to clean existing bad rows |

**Purge endpoint:** `POST /api/admin/companies/purge-non-tech` (admin-only)

### 30.4 DB-Level Filter Pattern

```typescript
const techFilter = sql`(
  source = ANY(ARRAY['basis','bacco','github_bd','ecab'])
  OR tags::text ~* '\\y(software|tech|it|coworking|startup)\\y'
  OR name ~* '\\y(software|tech|technology|digital|...)\\y'
) AND name !~* '\\y(bank|hospital|garments|...)\\y'`;
```

`~*` = PostgreSQL case-insensitive regex match. `\\y` = word boundary (equivalent to `\b`).

---

## Section 31: Deploy Script Rollback Fix (April 2026)

### 31.1 The Bug

`scripts/deploy.sh` was snapshotting images under the wrong name:

```bash
# Script used (WRONG):
docker tag signalstack-app:latest signalstack-app:rollback

# Actual image name built by Docker Compose (CORRECT):
signal-stack-app:latest   # hyphenated — derived from project dir name
```

Docker Compose names images as `{project_name}-{service_name}` where project name comes from the directory (`signal-stack`). The missing hyphen meant every snapshot silently warned and skipped — rollback was never actually saved.

### 31.2 Improvements Added

**1. `--rollback` flag** — one-command manual rollback:
```bash
./scripts/deploy.sh --rollback
```
Shows the git SHA of the snapshot being restored, brings containers up with `--no-build`.

**2. Two-generation rotation:**
```
Before deploy:  rollback → rollback-prev,  latest → rollback
After deploy:   latest = new build
```
If the latest rollback is also bad, `rollback-prev` gives one more escape hatch.

**3. SHA traceability:**
```bash
docker inspect --format '{{index .Config.Labels "deploy.sha"}}' signal-stack-app:rollback
```
Prints which git commit the rollback image was built from.

**4. Snapshot summary at deploy end:**
```
Rollback snapshots:
  signal-stack-app:rollback       abc1234   2 hours ago
  signal-stack-app:rollback-prev  def5678   1 day ago
```

### 31.3 Manual Rollback Without Script

```bash
# Go back 1 deploy
docker tag signal-stack-app:rollback signal-stack-app:latest
docker tag signal-stack-frontend:rollback signal-stack-frontend:latest
docker compose -f docker-compose.prod.yml up -d --no-build

# Go back 2 deploys
docker tag signal-stack-app:rollback-prev signal-stack-app:latest
docker compose -f docker-compose.prod.yml up -d --no-build
```

### 31.4 Admin Panel Pagination Status

| Page | Paginated? | Notes |
|------|-----------|-------|
| Signals | ✅ Yes | page/limit + meta.totalPages |
| Jobs | ✅ Yes | page/limit |
| Companies (Saved) | ✅ Yes | page/limit, Prev/Next buttons |
| Sources | ✅ Fine | Lookup table, no limit risk |
| Categories | ✅ Fine | Lookup table |
| Logs | ✅ Fine | Hardcoded `.limit(50)` |

---

## Section 32: SignalCard UI Fix — Source Badge Overlap (April 2026)

### 32.1 Problem

In compact mode (Job Intelligence Live Feed), the source badge, timestamp, and category label all sit in one `flex` row. Long source names (e.g. "We Work Remotely") pushed the category text off-screen or caused visual overlap.

### 32.2 Root Cause

- Source badge had `shrink-0` (never shrinks) + `max-w-[130px] truncate` — wide enough to crowd others
- Category span had `truncate min-w-0` but no `flex-1` — couldn't claim remaining space
- Row container had no `overflow-hidden` — children could overflow parent

### 32.3 Fix (`SignalCard.tsx`)

```tsx
// Before
<div className="flex items-center gap-2 min-w-0 flex-1">
  <span className="... shrink-0 max-w-[130px] truncate">
  <span className="... truncate min-w-0">  {/* category */}

// After
<div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
  <span className="... shrink-0 max-w-[100px] truncate">  {/* tighter cap */}
  <span className="... truncate min-w-0 flex-1">           {/* takes remaining space */}
```

`flex-1` on the category span means it expands to fill whatever space the source badge + timestamp don't use, then truncates cleanly instead of pushing siblings.
