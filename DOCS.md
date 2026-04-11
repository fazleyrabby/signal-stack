# SignalStack: Advanced Intelligence Platform 📡🧠

## Modern Stack Overview
- **Frontend**: Next.js 16 (App Router), Base UI, Lucide Icons, SWR Intelligence Polling, Tailwind CSS v4.
- **Backend**: NestJS 11, Drizzle ORM (PostgreSQL 16), Redis, RxJS.
- **AI Engine**: Triple-provider failover (Local llama.cpp → Groq ⚡ → OpenRouter 🧠) with rate-limited background workers.
- **Deployment**: Multi-container Docker — production uses zero volume mounts; dev mounts only `src/` and `public/` for hot-reload.

---

## Quick Start

### Docker (Recommended — Fully Isolated)

```bash
# 1. Clone the repository
git clone https://github.com/fazleyrabby/signal-stack.git && cd signal-stack

# 2. Configure environment (copy and edit)
cp .env.example .env

# 3. Start all services
docker compose up -d --build
```

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:3001 | Dashboard + Trends Analytics + Admin Portal |
| Backend API | http://localhost:3000 | REST API + Feed Scheduler |
| PostgreSQL | localhost:5433 | Database (external access) |
| Redis | localhost:6380 | Cache + AI Queue (external access) |
| Dozzle Logs | http://localhost:9999 | Real-time Docker log viewer |

### Local Development

```bash
# 1. Start infrastructure only
docker compose up postgres redis -d

# 2. Backend
cd backend && cp .env.example .env
# Edit .env with your keys, then:
npm install && npm run db:push && npm run start:dev

# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev
```

Access at [http://localhost:3001](http://localhost:3001).

---

## 📊 Trends Analytics

Access at [http://localhost:3001/trends](http://localhost:3001/trends). Public page showing 30-day signal analytics with interactive charts.

### Dashboard Panels
- **KPI Stat Cards** — Total Signals (30d), High Severity, Last 24h, Top Source — displayed as prominent metric cards at the top
- **Signal Volume** — Stacked area chart with gradient fills and glow effects showing daily signal counts split by severity (red=high, amber=medium, blue=low)
- **Top Sources** — Ranked list with signal counts, average scores, and animated gradient progress bars
- **Category Breakdown** — Vertical bar chart with gradient fills comparing Geopolitics vs Technology
- **Severity Distribution** — Donut chart with center total label and color-coded legend
- **AI Provider Stats** — Bar chart with per-provider gradient fills (violet=local, cyan=groq, emerald=openrouter) and processed/failed counts
- **Geographic Heatmap** — Interactive world map showing signal counts by country with hover tooltips and click-to-filter functionality

### Features
- Auto-refreshes every 5 minutes
- Skeleton loaders while data loads
- Responsive: 2-column grid on desktop, single column on mobile
- Theme-aware chart labels — uses Tailwind CSS classes for SVG text fills, ensuring correct contrast in both dark and light modes
- Custom tooltips styled to match the app theme (card background, border, rounded corners)

### Backend Endpoint
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/signals/trends` | Returns 30-day aggregated analytics |

```json
{
  "volumeByDay": [{ "date": "2026-04-09", "count": 45, "high": 5, "medium": 12, "low": 28 }],
  "topSources": [{ "source": "Guardian World", "count": 120, "avgScore": 7.2 }],
  "categoryBreakdown": [{ "category": "geopolitics", "count": 200 }, { "category": "technology", "count": 180 }],
  "severityDistribution": { "high": 50, "medium": 150, "low": 180 },
  "aiStats": { "processed": 300, "failed": 20, "byProvider": { "local": 200, "groq": 80, "openrouter": 20 } }
}
```

---

## Environment Configuration

Create a `.env` file at the project root for Docker Compose:

```env
# --- Authentication ---
ADMIN_EMAIL=admin@signalstack.local
ADMIN_PASSWORD=changeme123

# --- AI Intelligence (Failover Cluster) ---
GROQ_API_KEY=gsk_your-groq-key
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key

# --- Alerts ---
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook
DISCORD_FILTER_TECH=true  # Only send tech-related signals to Discord

# --- AI Toggle ---
AI_ENABLED=true
```

> **Note**: The backend `.env` uses `localhost:5433` for local development. Docker Compose overrides this with the internal `postgres:5432` hostname.

---

## 🧠 AI Intelligence Tier (Phase 5)

SignalStack features a production-grade, asynchronous AI enrichment pipeline designed for reliability and cost-efficiency.

- **Asynchronous Processing**: Ingestion no longer blocks on AI. Signals are scored via keywords first, and high-impact items (score ≥ 7) are enqueued for deep analysis.
- **Rate-Limited Execution**:
  - **Smoothing**: Processes 1 job every ~1.5 seconds to prevent API bursts.
  - **Concurrency**: Managed by 2 parallel background workers via RxJS.
  - **Daily Quota**: Automatically pauses AI analysis after 150 requests to stay within free-tier limits.
- **Strategic Failover & Cooldowns**:
  - **Primary**: **Local (llama.cpp)** - Zero-cost local inference
  - **Secondary**: **Groq** (⚡ Sub-second inference)
  - **Tertiary**: **OpenRouter** (🧠 Comprehensive failover)
  - **429 Mitigation**: If a provider returns a rate limit error, the system enters a **60s Cooldown** for that provider.
- **Executive Summaries**: AI distills entire news articles into a single, high-impact sentence (max 150 chars).
- **Safe Fallback**: If all AI providers fail or are paused, the system remains 100% functional via high-fidelity keyword scoring.
- **Auto-Retry**: Failed signals automatically retry up to 3 times with exponential backoff (30s, 60s, 90s).
- **Manual Retry**: Admins can re-queue all failed signals via `POST /api/admin/ai/retry` or the retry button on the dashboard.

### Local AI Setup (llama.cpp)

For zero-cost AI inference, run a local llama.cpp server with a lightweight GGUF model.

#### 1. Download a Model

Create the models directory and download a quantized Qwen model:

```bash
mkdir -p models

# Qwen2.5-0.5B (recommended - smaller, no reasoning tags, faster inference)
curl -L -o models/qwen.gguf "https://huggingface.co/unsloth/Qwen2.5-0.5B-GGUF/resolve/main/Qwen2.5-0.5B-Q4_K_M.gguf"
```

> **Note**: ~497MB model file. First download may take a few minutes.
> **Why Qwen2.5?** The 2.5 version outputs clean summaries directly without thinking/reasoning tags that pollute the output.

#### 2. Start Local AI

```bash
# Start infrastructure + llama.cpp
docker compose up -d postgres redis llama

# Verify it's running
curl http://localhost:8080
```

#### 3. Enable Local AI

Set the environment variable:

```env
LOCAL_AI_ENABLED=true
LOCAL_AI_URL=http://llama:8080
```

Then restart the app:

```bash
docker compose up -d app
```

#### 4. Fallback Behavior

The AI pipeline follows this chain:

```
Local (llama.cpp) → Groq → OpenRouter
```

- If local AI is disabled or fails → falls back to Groq
- If Groq fails → falls back to OpenRouter
- **Never crashes** — always fails gracefully

#### Environment-Based AI Routing

SignalStack supports environment-based routing to control AI provider usage across different environments:

| Environment | Behavior |
|---|---|
| **Development/Local** | Uses only local AI (llama.cpp) - no external API calls |
| **Production** | Full chain: `Local → Groq → OpenRouter` with fallback |

**Environment Variables:**

```env
# Required for production external AI
NODE_ENV=production
AI_EXTERNAL_ENABLED=true

# Optional - defaults apply if not set
# LOCAL_AI_ENABLED=true (must be true for any AI processing)
# AI_PROCESS_DELAY=1500     # ms between requests (default: 1500)
# AI_MAX_WORKERS=2            # parallel workers (default: 2)
# AI_DAILY_LIMIT=150        # daily request limit (default: 150)
```

**Logic:**

1. **Local/Development Mode** (`NODE_ENV !== "production"` OR `AI_EXTERNAL_ENABLED=false`):
   - Always tries local AI first
   - If local fails after 2 retries → marks signal as failed
   - Never calls Groq or OpenRouter

2. **Production Mode** (`NODE_ENV = "production"` AND `AI_EXTERNAL_ENABLED=true`):
   - Tries `Local → Groq → OpenRouter` chain
   - Respects cooldowns and retry logic
   - Logs provider used per signal

**Provider Tracking:**

Each signal stores `ai_provider` in the database:
- `local` - processed by llama.cpp
- `groq` - processed by Groq
- `openrouter` - processed by OpenRouter
- `none` - not processed (legacy data)
- `failed` - all providers failed

#### Resource Constraints

For 4GB RAM / 2 CPU VMs:

- llama.cpp limited to **1GB memory**, **1 CPU**
- Context window: 512 tokens (optimized for small prompts)
- Max output: 60 tokens (~150 char summaries)
- Batch size: 64

---

## 📰 The SignalStack Terminal (Dashboard)

The dashboard is a pro-grade analytical terminal:

- **Widescreen Command Center**: Toggle between standard/centered and 100% viewport width for ultrawide monitoring.
- **High-Density Modes**:
  - **List Mode**: Ultra-compact, single-line "quick titles" for scanning hundreds of events.
  - **Grid Mode**: Expansive layout for detailed signal cards with severity color stripes (red/amber/blue left border).
- **Signal Detail Modal**: Click any card to open a scrollable dialog with full title, AI summary, content preview (HTML-stripped), metadata, and a direct link to the original article. Constrained to viewport height on mobile with pinned header/footer.
- **Bookmark/Save Signals**: Save signals for later review — persisted in the database and synced across sessions. Includes loading state feedback and toast notifications on toggle.
- **Bookmarks View**: Toggle to view only your saved signals in any column.
- **Share Signal**: Copy any signal's source URL to clipboard with one click (toast confirmation).
- **Intelligence Switcher (Mobile)**: Tactile tabs to switch between Geopolitical and Tech streams. Selection persists across page reloads via localStorage.
- **Real-time Global Search**: Debounced (300ms) full-text search passed to backend API for server-side filtering across titles, sources, and content.
- **Severity Quick Filters**: Score-based toggles for All / High (≥8) / Medium (5–7) / Low (<5).
- **Live Stats Bar**: Real-time signal counts, severity breakdown, and top source.
- **Infinite Scroll**: Signals load automatically as you scroll — no manual "Load More" button.
- **Skeleton Loading**: Shimmer placeholder cards while data loads for smoother perceived performance.

---

## 📡 Public RSS Feed

A public RSS 2.0 feed is available for consuming signals programmatically.

### Endpoint

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/feed.xml` | Full feed (last 50 signals with score >= 5) |

### Query Parameters

| Parameter | Description | Example |
|---|---|---|
| `category` | Filter by category | `?category=geopolitics` |
| `severity` | Filter by minimum severity | `?severity=high` |
| Combined | Multiple filters | `?category=technology&severity=medium` |

### Response Headers

- `Content-Type: application/rss+xml`
- `Cache-Control: public, max-age=900` (15 min cache)

### RSS Item Structure

Each item includes:
- `title`: Signal title
- `description`: AI summary or content excerpt (sanitized)
- `url`: Link to original article
- `guid`: Signal UUID
- `date`: Published timestamp
- `categories`: [categoryId, severity]
- `signal:score`: Signal score
- `signal:source`: Feed source

### Frontend Integration

The header includes an RSS icon (desktop only) that opens the feed in a new tab. The `<head>` also includes:

```html
<link rel="alternate" type="application/rss+xml" title="SignalStack Feed" href="/api/feed.xml" />
```

---

## 🛡 Admin Portal

Access at `/admin`. Protected by email/password authentication with bcrypt-hashed passwords and JWT sessions.

| Page | Description |
|---|---|
| `/admin/login` | Email/password authentication |
| `/admin` | Dashboard — AI health status, feed stats, manual backup trigger, logout |
| `/admin/categories` | Manage intelligence categories (Geopolitics, Technology) |
| `/admin/sources` | Manage RSS feed sources per category |
| `/changelog` | View full project changelog |

**Authentication Flow**:
1. User enters email and password at `/admin/login`
2. Backend verifies credentials against `users` table (bcrypt hash comparison)
3. JWT tokens issued (15m access + 7d refresh) as HTTP-only, secure cookies

---

## 👥 Visitor Tracking

SignalStack tracks unique visitors with persistent storage in PostgreSQL.

**Database Table:** `visitors`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `session_id` | VARCHAR(64) | Unique session identifier (IP-based) |
| `ip` | VARCHAR(45) | Client IP address |
| `user_agent` | TEXT | Browser user agent |
| `first_seen` | TIMESTAMP | First visit timestamp |
| `last_seen` | TIMESTAMP | Last visit timestamp |
| `page_views` | INT | Page view count |

**API Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/visitors` | Track a visit (called on page load) |
| `GET` | `/api/visitors/stats` | Get visitor stats `{ total, today, realtime }` |

**Frontend Integration:**
- Homepage header shows realtime viewer count
- Admin dashboard shows Total Today + Realtime visitors
- Automatically tracks visits on page load

---

## 🔖 Bookmarks API

Persistently save signals for later review. Bookmarks are stored in the database and synced across sessions.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bookmarks` | List bookmarked signal IDs (array of strings) |
| `POST` | `/api/bookmarks/{signalId}` | Toggle bookmark (add/remove) |
| `GET` | `/api/bookmarks/signals` | Get full signal data for bookmarked signals (with pagination) |

**Response (toggle):** `{ bookmarked: boolean }`

**Frontend Integration:**
- Bookmark button on each signal card and in the detail modal with loading spinner and toast feedback
- Bookmarks filter in the column control bar to show only saved signals
- Share button copies signal URL to clipboard with toast confirmation
- Uses SWR for optimistic UI updates and cache revalidation

---

**Default Credentials**: `admin@signalstack.local` / `changeme123` (configure via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars)
**JWT Secret**: Configure via `JWT_SECRET` in `.env` (required for production)

### Source Health Checker

The admin Sources page includes a health checker button for each RSS feed:

| Status | Icon | Description |
|---|---|---|
| Healthy | Green checkmark | HTTP 200 + valid RSS with items |
| Error | Red X | HTTP error, timeout, or no data |
| Checking | Spinner |正在检查中 |

**API Endpoint:** `POST /api/admin/sources/:id/health`

**Response:**
```json
{
  "status": "healthy",
  "code": 200,
  "isRss": true,
  "hasData": true,
  "itemCount": 25
}
```

**Actions:**
- Toggle source active/inactive with switch in table
- Edit source via dialog
- Delete source (with confirmation)
- **Latency** measurements for healthy providers
- **Error details** for unhealthy providers
- **Pipeline visualization**: Shows the active fallback chain
- **Queue size**: Displays real-time count of pending AI jobs in the processing queue
- **Model selection**: Searchable dropdowns for Groq and OpenRouter models with real-time filter
- Auto-refreshes every 60 seconds with manual refresh option
- API endpoints: `GET /api/admin/ai/health`, `GET/PUT /api/admin/ai/models`, `POST /api/admin/ai/models/refresh`

### Signal Intelligence Stats

The dashboard displays 8 metric cards with live data:
- **Total Signals** — all signals in the database
- **High / Medium / Low Severity** — severity breakdown
- **Geopolitics / Technology** — category counts
- **AI Processed** — signals successfully enriched by AI
- **AI Failed** — signals where all providers failed (with retry button)

### AI Retry System

Failed AI signals can be retried:
- **Auto-retry**: Up to 3 retries with exponential backoff (30s, 60s, 90s)
- **Manual retry**: Click the retry icon next to "AI Failed" count, or call `POST /api/admin/ai/retry`
- Re-queues up to 50 failed signals per request

### Dozzle Logs (Production)

Production container logs are accessible via Dozzle at `https://logs.fazleyrabbi.xyz/`.
- Protected by `DOZZLE_AUTH_PROVIDER: simple` with username/password authentication
- Credentials configured in `dozzle/users.yml` (bcrypt-hashed passwords)

### System Backup
- **Automated**: Runs daily at **Midnight** via cron.
- **Manual**: Triggerable from the Admin Dashboard.
- **Output**: `/app/backups/signalstack_backup.sql` (persisted to a Docker named volume `backups:`)
- **Requires**: `postgresql-client` (included in Docker image).
- **Persistence**: Backups survive container rebuilds via Docker volume mount.

---

## 🛰️ Coverage & Categories (Active Streams)

SignalStack monitors high-fidelity streams divided into strategic intelligence categories:

- **World Geopolitics**: High-impact regional news and global policy shifts.
  - *Sources*: Guardian World, NYTimes, Al Jazeera, Foreign Affairs.
- **Technology & AI Intelligence**: Deep tech shifts, AI developments, hardware breakthroughs, and software engineering signals.
  - *Sources*: Ars Technica, The Verge, TechCrunch, MIT Tech Review, Wired, OpenAI Blog, Google AI Blog, The Verge AI, VentureBeat AI, TechCrunch AI.

---

## Production Deployment (Proxmox / VPS)

### Prerequisites
- Docker + Docker Compose installed
- Git installed
- At least 2GB RAM (4GB recommended with AI enabled)

### Command Flow

1. **Repository Sync**:
   ```bash
   git clone https://github.com/fazleyrabby/signal-stack.git && cd signal-stack
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and admin secret
   ```

3. **Deploy** (zero-downtime on subsequent runs):
   ```bash
   ./scripts/deploy.sh
   ```

   The script builds new images while old containers keep serving, then does a fast-swap (~3–5s downtime) and automatically rolls back if health checks fail.

4. **Seed Database** (first run only — deploy.sh handles this automatically):
   ```bash
   docker exec signalstack-app npm run seed
   ```

### Updating / Redeploying

After pushing changes to `origin/main`, SSH into the VPS and pull + redeploy:

```bash
ssh fazley@192.168.0.110
cd /path/to/SignalStack

# 1. Pull latest code
git pull origin main

# 2. Redeploy (rebuilds images, swaps containers)
./scripts/deploy.sh
```

**If the VPS has local uncommitted changes or merge conflicts** (e.g. from a stash pop), discard them first:

```bash
git checkout -- .       # discard working tree changes
git pull origin main    # pull clean code
./scripts/deploy.sh     # redeploy
```

> **Important**: Always commit and push from your local machine first. The VPS should only ever pull — never edit code directly on the server.

### VPS Considerations

- **NEXT_PUBLIC_API_URL**: If deploying to a public domain, update the build arg in `docker-compose.yml` to your public backend URL (e.g., `https://api.yourdomain.com`).
- **Reverse Proxy**: Place Nginx/Caddy in front of ports 3000/3001 for HTTPS.
- **Firewall**: Only expose ports 80/443. Block direct access to 3000, 3001, 5433, 6380.
- **Database Password**: Change `POSTGRES_PASSWORD` from the default `signal` value.

---

## 🛠 Maintenance & Engineering

### Database Seeding (Idempotent)
To reset or bootstrap your regional categories and sources:
```bash
cd backend && npm run seed
```
*Note: This script handles its own database connection and can be run safely multiple times; it will not duplicate existing records.*

### Database Migrations
```bash
cd backend && npm run db:push    # Push schema changes
cd backend && npm run db:studio  # Open Drizzle Studio (visual DB browser)
```

### AI Connectivity Test
```bash
cd backend && npm run test:ai
```

### Discord Webhook Test

The Discord alerts now support **tech-only filtering**:
- Only signals with `aiCategory === 'Tech'` are sent to Discord
- Configure via `DISCORD_FILTER_TECH=true` in environment
- Non-tech signals are logged but skipped
- **HTML sanitization**: All RSS content and titles are decoded from HTML entities (including numeric like `&#8217;` → `'`), stripped of `<script>`/`<style>` blocks, and cleaned of all HTML tags before being sent to Discord embeds

```bash
cd backend && npm run test:discord
```

### Viewing Logs
```bash
docker compose logs -f          # All services
docker compose logs -f app      # Backend only
docker compose logs -f frontend # Frontend only
```

**Dozzle** (production): Browse real-time container logs at [http://localhost:9999](http://localhost:9999) — protected by username/password authentication.

### Rebuilding After Code Changes
```bash
# Preferred — zero-downtime, auto-rollback on failure
./scripts/deploy.sh

# Manual rebuild (causes full downtime)
docker compose up -d --build    # Rebuild and restart all services
docker compose up -d --build frontend  # Rebuild frontend only
```

---

## 🚀 Load Testing (Performance & Scaling)

SignalStack includes a production-grade **k6** load testing script to verify system stability under heavy traffic.

### 1. Prerequisites
- [k6](https://k6.io/) installed locally (`brew install k6`)
- Access to the target URL (local or public)

### 2. Available Scenarios
The test script (`scripts/loadtest.js`) supports 5 standard scenarios:
- **smoke**: 10 users for 30s (sanity check)
- **load**: Ramping to 500 users over 5 minutes (standard load)
- **stress**: Ramping to 2000 users over 10 minutes (breaking point)
- **spike**: Sudden burst of 3000 users (recovery test)
- **soak**: Sustained 200 users for 30 minutes (memory leak check)

### 3. Running Tests

```bash
# Smoke test (against local dev)
k6 run scripts/loadtest.js

# Stress test (against your public domain)
k6 run -e BASE_URL=https://your-domain.com -e SCENARIO=stress scripts/loadtest.js
```

### 4. Performance Baseline
On a standard **2-CPU / 4GB RAM VPS**:
- **p(95) Latency**: ~300ms - 600ms (Healthy)
- **CPU Saturation**: ~80% @ 500 Virtual Users
- **Bottleneck**: Next.js Server-Side Rendering (SSR) is the primary CPU consumer.

---

## Architecture

```
┌─────────────┐     ┌───────────────┐     ┌──────────┐     ┌───────────┐
│ RSS Feeds   │────▶│ Fetch Job     │────▶│ Parser   │────▶│ Scorer    │
│ (10 sources)│     │ (Promise.all) │     │ (rss-p)  │     │ (Keywords)│
└─────────────┘     └───────────────┘     └──────────┘     └─────┬─────┘
                                                                 │
                                                    ┌────────────┼────────────┐
                                                    ▼            ▼            ▼
                                              ┌──────────┐ ┌────────┐ ┌──────────┐
                                              │ Discard  │ │  DB    │ │  Alert   │
                                              │ (< 5)    │ │ (≥ 5)  │ │  (≥ 7)  │
                                              └──────────┘

---

### AI Provider Chain

The AI pipeline follows this fallback chain:

```
Local (llama.cpp/Qwen) → Groq → OpenRouter
```

- **Local**: Zero-cost, ~3s inference, limited by timeout (8s)
- **Groq**: Fastest, sub-second latency
- **OpenRouter**: Ultimate fallback, comprehensive model coverage
- **Provider Tracking**: Each signal stores `ai_provider` to identify which AI processed it
- **Health Check**: AI health is displayed on the admin dashboard with auto-refresh └───┬────┘ └──────────┘
                                                               │
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                              ┌──────────┐         ┌──────────────┐
                                              │ REST API │         │ AI Queue     │
                                              └────┬─────┘         │ (Groq ➜ OR)  │
                                                   │               └──────────────┘
                                                   ▼
                                             ┌──────────┐
                                             │ Frontend │
                                             │ (Next.js)│
                                             └──────────┘
```

---

## Error Handling

SignalStack includes comprehensive error boundaries at every layer:

### Frontend Error Boundaries
| File | Scope |
|---|---|
| `app/global-error.tsx` | Root-level catch (render-time errors) |
| `app/error.tsx` | Route-level catch (client-side errors) |
| `app/not-found.tsx` | 404 handler |
| `app/admin/error.tsx` | Admin section errors |
| `app/admin/categories/error.tsx` | Categories page errors |
| `app/admin/sources/error.tsx` | Sources page errors |

### Backend Error Handling
- **Feed failures**: Logged and skipped — never crash the cycle
- **Content sanitization**: RSS content and titles are entity-decoded (including numeric entities like `&#8217;`), then stripped of `<script>`/`<style>` blocks and all HTML tags to produce clean plain text
- **AI provider failures**: Automatic failover with 60s cooldown
- **Database errors**: Structured logging with PostgreSQL error code handling
- **Discord webhook failures**: Logged, non-blocking

---

## 📜 License

Private / Internal Protocol

---

## 🧠 Philosophy

Less noise. More signal.

The system prioritizes:
- **Reliability** over speed
- **Signal quality** over quantity
- **Simplicity** over overengineering
