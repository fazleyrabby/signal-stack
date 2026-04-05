# SignalStack Study Guide 📡🧠

> **Built entirely with AI agents.** This guide walks you through every piece of the system so you can understand, own, and extend it.

---

## Table of Contents

1. [What Is SignalStack?](#1-what-is-signalstack)
2. [Architecture Overview](#2-architecture-overview)
3. [The Backend: NestJS Engine](#3-the-backend-nestjs-engine)
4. [The Frontend: Next.js Dashboard](#4-the-frontend-nextjs-dashboard)
5. [The AI Pipeline](#5-the-ai-pipeline)
6. [Database & Drizzle ORM](#6-database--drizzle-orm)
7. [Docker Deployment](#7-docker-deployment)
8. [Key Concepts to Learn](#8-key-concepts-to-learn)
9. [Common Commands Reference](#9-common-commands-reference)

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
RSS Feeds ──▶ Feed Scheduler ──▶ Parser ──▶ Scorer ──▶ Database
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼            ▼            ▼
                                    [Score < 7]   [Score ≥ 7]   [Score ≥ 7]
                                    (discard)     (store)       (AI Queue)
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    ▼                         ▼
                                              Groq (primary)          OpenRouter (fallback)
                                                    │                         │
                                                    └─────────┬───────────────┘
                                                              ▼
                                                        Database (ai_summary)
                                                              │
                                                              ▼
                                                    Next.js Dashboard (SWR poll)
```

### Key Design Principles

- **Graceful degradation**: If AI fails, the system still works
- **Rate-limit safe**: 150 requests/day, 1.5s between jobs, 60s cooldown on errors
- **Fully isolated Docker**: No volume mounts for app code in production
- **Zero blocking**: AI runs async, never delays the main API

---

## 3. The Backend: NestJS Engine

### 3.1 Project Structure

```
backend/src/
├── main.ts                 # Entry point — starts NestJS app
├── app.module.ts           # Root module — wires everything together
├── feed/                   # RSS harvester
│   ├── feed.module.ts
│   ├── feed.scheduler.ts   # Runs every 5 minutes
│   └── feed.service.ts     # Fetches and normalizes RSS
├── signals/                # API endpoints
│   ├── signals.controller.ts
│   ├── signals.service.ts  # Stores signals, enqueues AI
│   └── signals.repository.ts
├── ai/                     # AI intelligence tier
│   ├── ai.module.ts
│   ├── ai.queue.ts         # Rate-limited background worker
│   ├── ai.service.ts       # Provider orchestration
│   ├── redis.service.ts    # Redis dedup + quota
│   └── providers/
│       ├── groq.provider.ts
│       └── openrouter.provider.ts
├── database/               # Drizzle schema + backup
│   ├── schema.ts
│   └── backup.service.ts
└── admin/                  # Admin portal API
    ├── admin.controller.ts
    ├── admin.service.ts
    └── admin.guard.ts      # API key authentication
```

### 3.2 How NestJS Works

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

### 3.3 The Feed Scheduler

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

## 4. The Frontend: Next.js Dashboard

### 4.1 Project Structure

```
frontend/src/
├── app/
│   ├── layout.tsx        # Root HTML wrapper + ThemeProvider
│   ├── page.tsx          # Main dashboard (signals)
│   ├── globals.css       # Tailwind + CSS variables
│   ├── error.tsx         # Route-level error boundary
│   ├── global-error.tsx  # Root-level error boundary
│   ├── not-found.tsx     # 404 page
│   └── admin/            # Admin portal
│       ├── login/
│       ├── page.tsx
│       ├── categories/
│       └── sources/
├── components/
│   ├── header.tsx        # Top bar with search + theme toggle
│   ├── signal-card.tsx   # Individual signal display
│   ├── stats-bar.tsx     # Real-time stats
│   └── ui/               # Base UI components (shadcn-style)
└── lib/
    ├── api.ts            # TypeScript types for API
    └── utils.ts          # cn() helper for className merging
```

### 4.2 How the Dashboard Works

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

### 4.3 The Two-Column Layout

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

### 4.4 Theme System

Light/dark toggle using CSS custom properties:

```css
/* globals.css */
:root {
  --background: oklch(14% 0.01 240);   /* Dark */
  --foreground: oklch(98% 0 0);
}

[data-theme='light'] {
  --background: oklch(100% 0 0);       /* Light */
  --foreground: oklch(14% 0.02 240);
}
```

```tsx
// header.tsx — toggle
const toggleTheme = () => {
  const next = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
  localStorage.setItem('signalstack_theme', next);
};
```

---

## 5. The AI Pipeline

This is the most sophisticated part of the system.

### 5.1 The Flow

```
Signal (score ≥ 7) ──▶ AI Queue ──▶ Rate Limiter ──▶ Groq ──▶ DB
                                         │
                                    [429 error?]
                                         │
                                    60s cooldown ──▶ OpenRouter ──▶ DB
```

### 5.2 Rate-Limited Queue (RxJS)

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

### 5.3 Daily Quota (Redis)

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

### 5.4 Provider Failover

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

### 5.5 AI Output Cleaning

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

## 6. Database & Drizzle ORM

### 6.1 Schema Definition

```typescript
// backend/src/database/schema.ts
import { pgTable, text, integer, timestamp, varchar } from 'drizzle-orm/pg-core';

export const signals = pgTable('signals', {
  id: varchar('id', { length: 21 }).primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  source: text('source').notNull(),
  score: integer('score').notNull(),
  severity: text('severity').default('low'),
  aiSummary: text('ai_summary'),
  aiFailed: boolean('ai_failed').default(false),
  hash: text('hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 6.2 Pushing Schema Changes

```bash
# Update schema.ts, then:
npx drizzle-kit push
```

This compares your schema to the database and applies changes — no migration files needed.

### 6.3 Querying with Drizzle

```typescript
// Find signals with score >= 7, ordered by newest
const signals = await db
  .select()
  .from(signals)
  .where(gte(signals.score, 7))
  .orderBy(desc(signals.createdAt))
  .limit(20);

// Count by severity
const stats = await db
  .select({
    severity: signals.severity,
    count: count(),
  })
  .from(signals)
  .groupBy(signals.severity);
```

---

## 7. Docker Deployment

### 7.1 Services

```yaml
# docker-compose.prod.yml
services:
  postgres:   # Database (port 5433 → 5432)
  redis:      # Cache (port 6380 → 6379)
  app:        # Backend API (port 3000)
  frontend:   # Next.js Dashboard (port 3001)
```

### 7.2 Environment Variables

```env
# Root .env (for Docker Compose)
ADMIN_API_KEY=your-secret-key
GROQ_API_KEY=gsk_your-key
OPENROUTER_API_KEY=sk-or-v1-your-key
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
AI_ENABLED=true

# Frontend build arg
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

### 7.3 Deploy Flow

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

### 7.4 Why No Volume Mounts in Production?

Volume mounts (`./backend:/app`) are for **development only** — they let you edit code locally and see changes in the container. In production, they cause:
- Stale `.next` cache corruption
- `node_modules` conflicts between host and container
- Inconsistent builds

The production Dockerfile copies everything into the image at build time — fully self-contained.

---

## 8. Key Concepts to Learn

### 8.1 Dependency Injection (NestJS)

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

### 8.2 RxJS Streams

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

### 8.3 SWR (Stale-While-Revalidate)

SWR returns cached data immediately, then fetches fresh data in the background:

```typescript
// First render: returns cached data (or undefined)
// Background: fetches fresh data
// Second render: returns fresh data, triggers re-render
const { data, isLoading } = useSWR('/api/signals', fetcher);
```

### 8.4 Intersection Observer (Infinite Scroll)

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

### 8.5 CSS Custom Properties (Theming)

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

## 9. Common Commands Reference

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

The entire system is designed to be **readable and extensible**. Every piece is modular, typed, and documented.
