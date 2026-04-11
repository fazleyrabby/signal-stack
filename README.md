# SignalStack 📡

SignalStack is a high-performance, backend-driven signal intelligence system. It monitors high-trust RSS streams, processes them through a dedicated scoring engine, and surfaces critical events in a real-time dashboard.

<img width="3650" height="2184" alt="CleanShot 2026-04-05 at 18 14 45@2x" src="https://github.com/user-attachments/assets/daf97e33-6f15-491e-b56d-f1939c0034a8" />


## 🏗 Project Structure

This is a **monorepo** containing the entire SignalStack ecosystem:

- **[`/backend`](./backend)**: NestJS API, PostgreSQL data layer, and the automated Signal Crawler.
- **[`/frontend`](./frontend)**: Next.js 16 Dashboard with dual-column desktop views and mobile optimization.
- **[`/models`](./models)**: Local AI GGUF models (llama.cpp) - not committed to git.
- **[`DOCS.md`](./DOCS.md)**: Full technical documentation, scoring rules, and architecture deep-dive.

## 🚀 Quick Start

**Local development:**

1. **Infrastructure**: `docker compose up postgres -d`
2. **Backend**: 
   - `cd backend`
   - `npm install`
   - `npm run db:push`
   - `npm run start:dev`
3. **Frontend**:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

Access the system at [http://localhost:3001](http://localhost:3001).

**Production VPS deploy (zero-downtime):**

```bash
./scripts/deploy.sh
```

Builds new images while old containers serve traffic, then fast-swaps (~3–5s downtime) and auto-rolls back if health checks fail.

**Updating (one command):**

```bash
git push origin main && deploy-signal
```

The `deploy-signal` shell alias SSHs into the VPS and runs `deploy.sh` automatically. See [DOCS.md](./DOCS.md) for alias setup.

## 🧠 Local AI (Optional)

To run zero-cost local AI inference with llama.cpp:

```bash
# 1. Download Qwen2.5-0.5B model (~497MB) - recommended for clean summaries
mkdir -p models
curl -L -o models/qwen.gguf "https://huggingface.co/unsloth/Qwen2.5-0.5B-GGUF/resolve/main/Qwen2.5-0.5B-Q4_K_M.gguf"

# 2. Start llama.cpp
docker compose up -d llama

# 3. Enable local AI (edit .env)
LOCAL_AI_ENABLED=true
```

The AI pipeline uses fallback: `Local (llama.cpp) → Groq → OpenRouter` with auto-retry (3x exponential backoff) for failed signals.

In production (`docker-compose.prod.yml`), llama is constrained to `0.5 CPU` and `1GB RAM` to prevent idle CPU starvation on small VPS instances.

## 📊 Admin Dashboard

The admin panel at `/admin` provides:

- **AI Health** — real-time status of all AI providers with latency
- **Model Selection** — searchable dropdowns to switch Groq/OpenRouter models on the fly
- **Signal Stats** — total signals, severity breakdown, category counts, AI processing metrics
- **AI Retry** — re-queue failed AI signals with one click
- **Source Management** — CRUD for RSS feed sources
- **Category Management** — manage intelligence categories
- **Database Backup** — manual and automated daily backups

## 🔖 Bookmarks

Save signals for later review. Bookmarks are persisted in the database and synced across sessions.

- **Bookmark button** on each signal card and in the detail modal with loading state and toast feedback
- **Share button** — copy signal URL to clipboard
- **Bookmarks filter** in the column control bar to view only saved signals
- **API**: `GET /api/bookmarks` (list IDs), `POST /api/bookmarks/{signalId}` (toggle), `GET /api/bookmarks/signals` (full data with pagination)

## 📰 Signal Feed

The main dashboard features:

- **Two-column layout** — Geopolitics and Technology streams side by side (tabbed on mobile, persisted)
- **Mobile bottom nav** — fixed Feed / Trends / Saved / Admin tabs with safe-area padding
- **Grid & List modes** — dense list view or expanded card grid with severity color stripes
- **Signal Detail Modal** — scrollable dialog with full title, AI summary, content preview (HTML-stripped), and metadata
- **Bookmark/Save Signals** — save signals with loading feedback and toast notifications, persisted in database
- **Saved deep-link** — `/` supports `?bookmarks=true` to open directly in bookmark mode
- **Share Signal** — copy source URL to clipboard with one click
- **Search** — debounced server-side search across titles, sources, and content
- **Severity filters** — score-based All / High (≥8) / Medium (5–7) / Low (<5) toggles
- **Source & sort controls** — filter by feed source, sort by newest/oldest/score
- **Infinite scroll** — signals auto-load as you scroll
- **Skeleton loading** — shimmer placeholder cards for smoother perceived performance

## 📊 Trends Analytics

The Trends page at `/trends` provides 30-day analytics with interactive charts:

- **KPI Cards** — Total Signals, High Severity, Last 24h, Top Source
- **Signal Volume** — Stacked area chart with gradient fills and glow effects by severity
- **Top Sources** — Ranked list with animated gradient progress bars and average scores
- **Category Breakdown** — Bar chart with gradient fills
- **Severity Distribution** — Donut chart with center total label
- **AI Provider Stats** — Per-provider gradient bar chart with processed/failed counts
- **Geographic Heatmap** — World map showing signal counts by country (click to filter)

Open-access page with 5-minute auto-refresh. Theme-aware chart labels for correct contrast in both dark and light modes.

## 📡 RSS Feed

A public RSS 2.0 feed is available at `/api/feed.xml` for consuming signals programmatically.

**Endpoints:**
- `GET /api/feed.xml` — Full feed (last 50 signals with score >= 5)
- `GET /api/feed.xml?category=geopolitics` — Filter by category
- `GET /api/feed.xml?severity=high` — Filter by minimum severity
- `GET /api/feed.xml?category=technology&severity=medium` — Combined filters

**Response headers:**
- `Content-Type: application/rss+xml`
- `Cache-Control: public, max-age=900` (15 min cache)

Feed items are sorted chronologically by `published_at DESC` (newest first) for RSS reader compatibility.
Each item includes custom `signal:score` and `signal:source` elements.

## 🔔 Discord Alerts

Discord alerts send clean, HTML-free embeds with severity-based color coding (red/orange/green). RSS content and titles are fully sanitized during feed ingestion — all HTML entities (including numeric like `&#8217;`) are decoded and all tags (including `<script>`/`<style>`) are stripped before storing in the database.

Alerts can be filtered by category via environment variable:

```env
DISCORD_WEBHOOK_URL=your-webhook-url
DISCORD_ALERT_CATEGORIES=technology  # comma-separated, e.g. technology,geopolitics
```

## 🚦 API Protection & Retention

- **Global API throttle**: `100 requests / minute / IP` for public API endpoints via NestJS throttler
- **Admin throttle bypass**: authenticated admin controllers use `@SkipThrottle()`
- **Retention cleanup cron**: daily `2:00 AM` job deletes signals older than `SIGNAL_RETENTION_DAYS` (default `90`) and removes orphaned bookmarks

```env
SIGNAL_RETENTION_DAYS=90
```

## 🛡 Authentication

The admin portal (`/admin`) uses **email/password authentication** with bcrypt-hashed passwords and JWT sessions.

- Credentials stored in a `users` table with bcrypt password hashing
- JWT tokens issued as HTTP-only secure cookies (15m access + 7d refresh)
- Default credentials: `admin@signalstack.local` / `changeme123`
- Configure via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars before first deploy

## 📜 License

Private / Internal Protocol
