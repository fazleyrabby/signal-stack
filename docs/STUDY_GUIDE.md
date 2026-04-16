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
16. [Key Concepts to Learn](#16-key-concepts-to-learn)
17. [Common Commands Reference](#17-common-commands-reference)
18. [Performance & Scaling](#18-performance-scaling)
19. [Troubleshooting Guide](#19-troubleshooting-guide)

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
