# SignalStack Intelligence Node: System Engineering Report 🕵️‍♂️🛰️

Welcome to the **SignalStack** architecture. This report breaks down the project’s DNA, its operational flows, and how the modern TypeScript stack compares to the Laravel ecosystem you know.

---

## 🏗️ 1. The Architectural Blueprint
SignalStack is built as a **Decoupled Intelligence Platform**. It is divided into two primary zones:

1.  **The Backend (Engine Room)**: A NestJS application that acts as the harvester, analyst, and API provider.
2.  **The Frontend (Command Center)**: A Next.js 15 dashboard optimized for high-density information display.

### The "Laravel to SignalStack" Rosetta Stone
If you are coming from Laravel, here is how the core concepts translate:

| Laravel Component  | SignalStack Component | Why it matters |
| :--- | :--- | :--- |
| **Eloquent ORM** | **Drizzle ORM** | Drizzle is "TypeScript-first." Instead of magic models, it uses explicit SQL schemas that guarantee your code and database are 100% in sync. |
| **Artisan Migrations** | **Drizzle Push** | You don't write manual migration files. You update `schema.ts`, and Drizzle automatically "pushes" the changes to PostgreSQL. |
| **Queues (Redis/SQS)** | **AI Background Queue (RxJS)** | Instead of a heavy daemon, we use a lightweight, in-memory stream manager that respects API rate-limits while remaining ultra-fast. |
| **Blade/Livewire** | **React / Next.js** | Next.js handles the "Interactive Terminal" experience, allowing for real-time filtering without traditional page reloads. |
| **Service Container** | **NestJS Dependency Injection** | Exactly like Laravel's container. You `inject` services into controllers, making the system modular and easy to test. |

---

## 📡 2. The Intelligence Lifecycle (Data Flow)
The system follows a strict, 5-stage pipeline to transform raw RSS noise into high-impact signals.

## 📡 2. The Intelligence Lifecycle (Data Flow)
The system follows a strict, 5-stage pipeline to transform raw RSS noise into high-impact signals.

### Step 1: Harvester Phase (`FeedService`)
The engine scans active RSS sources using `rss-parser`.
- **Normalization**: RSS formats are inconsistent. We standardizing everything into a single `RawSignal` object.

### Step 2: Classical Scoring (`ScorerService`)
Before expensive AI is called, we filter the "Noise." This is your primary **Fast Path**.
- **Keyword Logic**: Detects "Outage," "Attack," or "Cyber."
- **Entity Detection**: High-value targets like "AWS" or "Nvidia" increase score.
- **Baseline**: A signal needs a **Score of 7+** to qualify for the AI Intelligence Tier.

### Step 3: Phase 5 Advanced Queue (`AIQueue`)
This is the most sophisticated part of the project (your `Async Job` system).

#### The "Smooth-Traffic Protocol" (RxJS)
Unlike a standard Laravel queue that might hammer your CPU, SignalStack uses a **Smoothed Execution Pattern**:
```typescript
// backend/src/ai/ai.queue.ts
zip(this.queue$, timer(0, 1500)).pipe(
  mergeMap(([job]) => this.processJob(job), 2)
).subscribe();
```
- **The Zip Logic**: We "zip" the incoming signals with a timer that fires every 1.5 seconds. This ensures that no matter how many signals arrive, we only process **one every 1.5s**.
- **Concurrency**: `mergeMap(2)` allows two "lanes" of processing while still respecting the 1.5s gap.

#### Redis Intelligence Sync (`RedisService`)
We use Redis (`ioredis`) for two critical production features:
1.  **Deduplication**: We cache signal hashes for 7 days. If the same news arrives twice, AI is never called again.
2.  **Daily Quota Tracking**: We increment a key `ai:daily_count:YYYY-MM-DD`. Once it hits **150**, the system automatically freezes AI analysis until the next UTC day to keep your costs at **$0.00**.

### Step 4: AI Analysis (`AIService`)
The signal goes through a **Dual-Provider Failover Cluster** with independent cooldowns.
1.  **Groq (Primary)**: Llama 3.3 for sub-second analysis.
2.  **OpenRouter (Secondary)**: Fallback for deep reasoning if Groq fails.
3.  **Cooldown Logic**: If a provider returns an Error 429 (Rate Limit), SignalStack initiates a **60s Intelligence Cooldown** for that provider, protecting your API reputation.

### Step 5: Dashboard Exhibition (The UI)
The user sees the results in the Next.js Terminal.
- **SWR Polling**: The frontend "probes" the API every 30 seconds to fetch new intelligence without a refresh.

---

## 💻 3. Code Deep-Dive: Drizzle vs Eloquent
In Laravel, you would write a query with `$signal->where('score', '>=', 7)->get()`. 
In Drizzle, it looks like this:

```typescript
// backend/src/signals/signals.repository.ts
async findAll(params) {
  return this.db
    .select()
    .from(signals)
    .where(and(
      eq(signals.severity, 'high'),
      gte(signals.score, 7)
    ))
    .orderBy(desc(signals.createdAt))
    .limit(20);
}
```
**Why it's better**: You get full TypeScript autocomplete on your columns. If you rename a column in `schema.ts`, Drizzle catches it everywhere in your app instantly.

---

## 📂 4. The Intelligence Directory Map
- `ai/`: Providers (Groq/OpenRouter), The Redis Sync Tier, and the Background Queue.
- `signals/`: The API Controller and the main Data Repository.
- `database/`: Your Drizzle schemas (`schema.ts`) and global Postgres connection.
- `feed/`: The Cron-driven RSS scraper and normalization logic.
- `common/`: Your typed logs, global types, and hashing utilities.

---

## 🧠 5. Graceful Degradation Philosophy
SignalStack is "Resilient by Default."
- **Scenario**: Groq is down and your OpenRouter quota is expired.
- **Result**: The system **will not crash**. It will simply skip the `aiSummary` field and mark it as `ai_failed = true`. Your users will still see the news and the scores from the keyword engine. AI is an **enhancement**, never a dependency.

**Your SignalStack terminal is now optimized for long-term production stability.** 🦾🏁🔐🦾🏁🔐

---

## 🧠 Final Philosophy
This project is built on **Efficiency over Complexity**. We treat AI as an **Optional Enhancement**. If the Groq API goes down or your daily limit is reached, the SignalStack terminal will still show you the news—just without the "Why it Matters" summaries. This "Graceful Degradation" is what makes the system production-reliable.

**Your SignalStack Node is now a fully automated, rate-limited, and cloud-synchronized intelligence machine.** 🦾🏁🔐🦾🏁🔐

---

## 🛠️ Recent Engineering Log (2026-04-05)

### Standalone Script Architecture Fix
- **Issue**: The `seed.ts` maintenance script was failing because it tried to import a `db` instance that wasn't exported from the schema.
- **Solution**: Refactored the script to initialize its own `pg.Pool` and `drizzle` connection. This allows the seeder to run as a standalone maintenance tool independently of the NestJS application context.
- **Impact**: Guarantees that database bootstrapping (Categories/Sources) can be performed during deployment or fresh installs without requiring the API server to be active.

### Intelligence Source Strategy (V2)
- **Signal Quality**: Removed "Low Signal-to-Noise" sources like *AP News* and *Hacker News* (too much general chatter).
- **Premium Expansion**: Integrated high-trust, specific feeds like *Foreign Affairs*, *Al Jazeera*, *TechCrunch*, and *Wired*.
- **Categorization**: Alignment with the dual-column "Command Center" dashboard, ensuring a balanced feed between Global Geopolitics and Emerging Technology.
