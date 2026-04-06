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
8. [Authentication & Admin Portal](#8-authentication--admin-portal)
9. [Database & Drizzle ORM](#9-database--drizzle-orm)
10. [The Frontend: Next.js Dashboard](#10-the-frontend-nextjs-dashboard)
11. [API Reference](#11-api-reference)
12. [Docker Deployment](#12-docker-deployment)
13. [Deployment & Ops Scripts](#13-deployment--ops-scripts)
14. [Key Concepts to Learn](#14-key-concepts-to-learn)
15. [Common Commands Reference](#15-common-commands-reference)

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
RSS Feeds ──▶ Feed Scheduler ──▶ Axios Fetch ──▶ RSS Parser ──▶ Normalizer
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
                                                                       ▼
                                                                 Database (ai_summary)
```

### Key Design Principles

- **Graceful degradation**: If AI fails, the system still works — keyword scoring is always available
- **Rate-limit safe**: 150 AI requests/day, 1.5s between jobs, 60s cooldown on 429 errors
- **Multi-layer deduplication**: SHA-256 hash of normalized title + URL, with DB unique constraint fallback
- **Fully isolated Docker**: No volume mounts for app code in production
- **Zero blocking**: AI + Discord alerts run async, never delay the main API or feed cycle

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
│   ├── schema.ts           # 3 tables: categories, sources, signals
│   └── backup.service.ts   # Daily automated + manual pg_dump
├── admin/                  # Admin portal API + auth
│   ├── admin.module.ts
│   ├── admin.controller.ts # CRUD for categories + sources + backup
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
| `AdminModule` | Auth + CRUD for categories/sources + backup |
| `AIModule` | Groq + OpenRouter + rate-limited queue |
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
Signal (score ≥ 7) ──▶ AI Queue ──▶ Rate Limiter ──▶ Local (llama.cpp) ──▶ Groq ──▶ OpenRouter ──▶ DB
                                          │              │
                                     [429 error?]    [fail]
                                          │              │
                                     60s cooldown ──▶ Next provider
```

### 6.2 Local AI (llama.cpp)

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
    -c 1024
    --host 0.0.0.0
    --port 8080
```

**Model Requirements:**
- Qwen3.5-0.8B GGUF file at `models/qwen.gguf`
- Download: `https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf`

**Environment Variables:**
```env
LOCAL_AI_ENABLED=true
LOCAL_AI_URL=http://llama:8080
```

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

```typescript
// backend/src/ai/ai.service.ts
async summarize(signal) {
  let summary = null;

  // 1. Try Groq (primary)
  if (!this.isCooldown('groq')) {
    summary = await this.groq.summarize(signal.title, signal.content);
    if (!summary && this.groq.lastError === 429) {
      this.setCooldown('groq', 60000); // 60s cooldown
    }
  }

  // 2. Fallback to OpenRouter
  if (!summary && !this.isCooldown('openrouter')) {
    summary = await this.openRouter.summarize(signal.title, signal.content);
    if (!summary && this.openRouter.lastError === 429) {
      this.setCooldown('openrouter', 60000);
    }
  }

  // 3. Save to DB (or mark as failed)
  if (summary) {
    await this.db.update(signals)
      .set({ aiSummary: summary })
      .where(eq(signals.id, signal.id));
  }
}
```

### 6.5 AI Output Cleaning

Both providers clean their output:

```typescript
cleanResponse(text: string): string {
  return text
    .replace(/\n/g, ' ')        // Remove newlines
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim()
    .slice(0, 200);             // Max 200 characters
}
```

---

## 7. Discord Alerts System

When a signal scores **≥ 7**, a Discord alert is fired with a color-coded embed. The alert system is fully async and rate-limited — it never blocks feed processing.

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
      await axios.post(this.webhookUrl!, { embeds: [/* ... */] });

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

### 7.3 Rate Limiting Summary

The system has **four layers** of rate limiting across different subsystems:

| Layer | Rate | Purpose |
|---|---|---|
| Discord alerts | 1 per 2 seconds | Respect Discord webhook limits |
| AI queue | 1 per 1.5 seconds | Smooth API bursts |
| AI daily quota | 150 per day (Redis) | Stay within free-tier limits |
| AI provider cooldown | 60s after 429 | Back off on rate-limit errors |

---

## 8. Authentication & Admin Portal

### 8.1 JWT Authentication Flow

The admin panel uses **JWT tokens stored in HTTP-only cookies** — never exposed to JavaScript:

```
User enters ADMIN_API_KEY ──▶ POST /api/admin/auth/login
                                      │
                              ┌───────┴───────┐
                              ▼               ▼
                        Access Token     Refresh Token
                        (15 min)         (7 days)
                              │               │
                              ▼               ▼
                        Cookie:           Cookie:
                        signalstack_      signalstack_
                        access_token      refresh_token
                        (httpOnly)        (httpOnly, path=/api/admin/auth/refresh)
```

### 8.2 AuthService — Token Management

```typescript
// backend/src/admin/auth.service.ts
@Injectable()
export class AuthService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  async login(apiKey: string) {
    const validKey = this.configService.get<string>('ADMIN_API_KEY') || 'dev-admin-key';
    if (apiKey !== validKey) {
      throw new UnauthorizedException('Invalid Admin Key');
    }

    const accessToken = jwt.sign({ role: 'admin' }, this.jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ role: 'admin', type: 'refresh' }, this.jwtSecret, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    const decoded = jwt.verify(refreshToken, this.jwtSecret);
    if (decoded.role !== 'admin' || decoded.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token');
    }
    return this.login(this.configService.get<string>('ADMIN_API_KEY'));
  }
}
```

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

### 8.4 AdminGuard — Dual Authentication

The guard supports **two methods**, allowing both browser sessions and API scripts:

```typescript
// backend/src/admin/admin.guard.ts
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Method 1: JWT from httpOnly cookie (browser sessions)
    const accessToken = request.cookies?.signalstack_access_token;
    if (accessToken) {
      const decoded = jwt.verify(accessToken, jwtSecret);
      if (decoded.role === 'admin') return true;
    }

    // Method 2: x-admin-key header (API scripts, curl)
    const clientKey = request.headers['x-admin-key'];
    if (clientKey === apiKey) return true;

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
  // System:     POST /backup
}
```

| Admin Page | Purpose |
|---|---|
| `/admin` | Dashboard — feed health, stats, manual backup trigger |
| `/admin/categories` | CRUD for intelligence categories (Geopolitics, Technology) |
| `/admin/sources` | CRUD for RSS feed sources per category |
| `/admin/login` | API key authentication |
| `/changelog` | View full project changelog |

### 8.7 Database Backup Service

Automated and manual backup via `pg_dump`:

```typescript
// backend/src/database/backup.service.ts
@Injectable()
export class BackupService {
  private readonly backupPath = path.join(process.cwd(), 'signalstack_backup.sql');

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

**Scheduled jobs in the system:**

| Job | Schedule | Module |
|---|---|---|
| Feed fetch | Every 5 minutes | `FeedModule` |
| Database backup | Every day at midnight | `BackupService` |

---

## 9. Database & Drizzle ORM

### 9.1 Complete Schema (3 Tables)

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
```

### 9.2 Entity Relationship

```
categories (1) ──▶ (many) sources
categories (1) ──▶ (many) signals
```

- A **category** (e.g., "geopolitics") has many **sources** (RSS feeds) and many **signals** (articles)
- Deleting a category requires removing its sources and signals first (referential integrity)

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

Six parallel queries for the real-time stats bar:

```typescript
const [total, high, medium, low, last24h, topSource] = await Promise.all([
  db.select({ count: sql`count(*)::int` }).from(signals),
  db.select({ count: sql`count(*)::int` }).from(signals).where(eq(signals.severity, 'high')),
  db.select({ count: sql`count(*)::int` }).from(signals).where(eq(signals.severity, 'medium')),
  db.select({ count: sql`count(*)::int` }).from(signals).where(eq(signals.severity, 'low')),
  db.select({ count: sql`count(*)::int` }).from(signals).where(gte(signals.createdAt, oneDayAgo)),
  db.select({ source: signals.source, count: sql`count(*)::int` })
    .from(signals).groupBy(signals.source).orderBy(desc(sql`count(*)`)).limit(1),
]);
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
│   ├── column.tsx        # Category column with independent scroll
│   ├── shell.tsx         # App shell layout wrapper
│   ├── sidebar.tsx       # Navigation sidebar
│   ├── footer.tsx        # Page footer
│   ├── signal-card.tsx   # Individual signal display
│   ├── signal-skeleton.tsx # Loading skeleton for signals
│   ├── stats-bar.tsx     # Real-time stats
│   ├── theme-provider.tsx # Theme context (onyx/light/cyberpunk)
│   └── ui/               # Base UI components (shadcn-style)
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

### 10.4 Theme System

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
| `GET` | `/api/signals/stats` | Dashboard stats (total, severity breakdown, top source) |
| `GET` | `/api/health` | Health check (uptime, last fetch, active feeds) |

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
| `POST` | `/api/admin/auth/login` | Exchange API key for JWT tokens |
| `POST` | `/api/admin/auth/refresh` | Refresh expired access token |
| `POST` | `/api/admin/auth/logout` | Clear auth cookies |
| `GET` | `/api/admin/ai/health` | Check all AI providers health status (local, groq, openrouter) |

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

**System:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/backup` | Trigger manual database backup |

---

## 12. Docker Deployment

### 12.1 Two Compose Files

| File | Purpose | Frontend mode |
|---|---|---|
| `docker-compose.yml` | Local development | `npm run dev` with hot-reload |
| `docker-compose.prod.yml` | Production / VPS | `npm start` (pre-built) |

```yaml
# docker-compose.prod.yml
services:
  postgres:   # Database (internal only)
  redis:      # Cache (internal only)
  app:        # Backend API (port 3000)
  frontend:   # Next.js Dashboard (port 3001)
  logs:       # Dozzle log viewer (port 9999)
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
ADMIN_API_KEY=your-secret-key
GROQ_API_KEY=gsk_your-key
OPENROUTER_API_KEY=sk-or-v1-your-key
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
AI_ENABLED=true
JWT_SECRET=your-jwt-secret

# Frontend build arg (production only)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

### 12.5 Deploy Flow

```bash
# 1. Pull latest code
git pull origin main

# 2. Stop old containers
docker compose -f docker-compose.prod.yml down --remove-orphans

# 3. Rebuild images
docker compose -f docker-compose.prod.yml build

# 4. Start services
docker compose -f docker-compose.prod.yml up -d

# 5. Seed database (first run only)
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

### 13.1 deploy.sh — Automated Production Deploy

Located at `scripts/deploy.sh`. One command to deploy on a VPS:

```bash
./scripts/deploy.sh
```

**What it does (in order):**

1. Validates environment (checks for `.git`, `docker-compose.prod.yml`, `.env`)
2. Pulls latest code from `origin/main` (auto-resolves merge conflicts)
3. Frees memory by pruning stale Docker artifacts
4. Stops old containers with `docker compose down --remove-orphans`
5. Builds and starts all services with `docker compose up -d --build`
6. Waits for PostgreSQL health check (up to 30 seconds)
7. Seeds database (idempotent — safe to run every deploy)
8. Validates backend (HTTP 200 on `/api/health`) and frontend (HTTP 200 on `/`)
9. Prints container status and access URLs

**Key feature**: Auto-resolves git merge conflicts by accepting remote changes — designed for hands-off VPS deploys.

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

Outputs a summary with pass/warn/fail counts. Exits with code 1 if any checks fail.

---

## 14. Key Concepts to Learn

### 14.1 Dependency Injection (NestJS)

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

### 14.2 RxJS Streams

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

### 14.3 SWR (Stale-While-Revalidate)

SWR returns cached data immediately, then fetches fresh data in the background:

```typescript
// First render: returns cached data (or undefined)
// Background: fetches fresh data
// Second render: returns fresh data, triggers re-render
const { data, isLoading } = useSWR('/api/signals', fetcher);
```

### 14.4 Intersection Observer (Infinite Scroll)

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

### 14.5 CSS Custom Properties (Theming)

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

## 15. Common Commands Reference

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
# Deploy (pull + build + restart)
./scripts/deploy.sh

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

### Database

```bash
# Open Drizzle Studio (visual DB browser)
cd backend && npm run db:studio

# Push schema changes
cd backend && npm run db:push

# Run seed
cd backend && npm run seed
```

### Docker

```bash
# Rebuild everything
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build

# Rebuild one service
docker compose -f docker-compose.prod.yml up -d --build frontend

# Clean stale images
docker system prune -f

# Copy backup to host
docker cp signalstack-app:/app/signalstack_backup.sql .
```

---

## Next Steps

1. **Read the code** — start with `backend/src/feed/feed.scheduler.ts` and trace the data flow
2. **Modify a feed** — add a new RSS source in the admin panel and watch it appear
3. **Test AI failover** — set `GROQ_API_KEY` to an invalid value and watch it fall back to OpenRouter
4. **Add a feature** — try adding a new severity level or a new dashboard widget

### 16.2 Production Performance Benchmarks (2-Core VPS)

The following metrics were captured during a live stress test on the production Proxmox VM:

| Metric | Load Scenario (500 VUs) | Stress Scenario (2000 VUs) |
|---|---|---|
| **Success Rate** | **100%** (0 Errors) | **86.7%** (Timeout Zone) |
| **Throughput** | 111 requests/sec | **266 requests/sec** |
| **Avg Latency** | 196ms | 4.45s |
| **p(95) Latency** | **789ms** | **11.93s** |
| **Max Throughput** | ~400 MB / 5 min | **1.2 GB / 10 min** |

### 16.3 Analysis of Results
- **Safe Zone (1–750 VUs)**: The system handles up to 750 concurrent users with sub-second latency and 100% reliability.
- **The Breaking Point**: CPU saturation hits 100% at ~1,200 users. Beyond this, Cloudflare and Next.js start timing out (11s+ latency) as the Node.js event loop becomes blocked.
- **Resource Usage**: Both the NestJS API and Next.js Frontend consume roughly equal CPU (~30% each) under heavy load. The database (PostgreSQL) remains highly efficient (<5% CPU) due to optimized indexing.

### 16.4 Roadmap to 1,000,000 Users
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

## 16. Load Testing & Scaling to 1M Users

SignalStack is built to handle professional workloads. To verify this, the project includes a dedicated load testing suite using **k6**.

### 16.1 Running the Load Test
The test script is located at `scripts/loadtest.js`.

```bash
# Smoke test (against local dev)
k6 run scripts/loadtest.js

# Stress test (against your public domain)
k6 run -e BASE_URL=https://your-domain.com -e SCENARIO=stress scripts/loadtest.js
```

### 16.2 Performance Analysis
Initial stress tests on a **2-core VPS** showed the following characteristics:
- **Zero Failures**: The NestJS API remained 100% stable at 500 concurrent users.
- **CPU Bottleneck**: The Next.js SSR (Server-Side Rendering) is the heaviest component, consuming ~45% CPU under load.
- **Memory Stability**: Redis and PostgreSQL combined used less than 10% of available RAM.

### 16.3 Scaling Strategy for 1M Users
To move from 500 concurrent users to 1,000,000 monthly active users, follow this roadmap:

1.  **Frontend Caching**: Use **Incremental Static Regeneration (ISR)** in Next.js or a CDN like Cloudflare to serve cached HTML. This removes the SSR load from your VPS.
2.  **API Gateway**: Instead of proxying through Next.js (rewrites), use an **Nginx** or **Traefik** reverse proxy to route `/api` traffic directly to the backend.
3.  **Database Scaling**:
    - Add **PgBouncer** for connection pooling.
    - Implement **Read Replicas** as traffic grows.
4.  **Application Clustering**:
    - Run multiple instances of the `app` container behind a load balancer.
    - Containerize the `Feed Scheduler` separately so ingestion doesn't compete with API traffic.
