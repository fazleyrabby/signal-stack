# SignalStack 📡

SignalStack is a high-performance, backend-driven signal intelligence system. It monitors high-trust RSS streams, processes them through a dedicated scoring engine, and surfaces critical events in a real-time dashboard.

<img width="3650" height="2184" alt="CleanShot 2026-04-05 at 18 14 45@2x" src="https://github.com/user-attachments/assets/daf97e33-6f15-491e-b56d-f1939c0034a8" />


## 🏗 Project Structure

This is a **monorepo** containing the entire SignalStack ecosystem:

- **[`/backend`](./backend)**: NestJS API, PostgreSQL data layer, and the automated Signal Crawler.
- **[`/frontend`](./frontend)**: Next.js 14+ Dashboard with dual-column desktop views and mobile optimization.
- **[`/models`](./models)**: Local AI GGUF models (llama.cpp) - not committed to git.
- **[`DOCS.md`](./DOCS.md)**: Full technical documentation, scoring rules, and architecture deep-dive.

## 🚀 Quick Start

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

- **Bookmark button** on each signal card and in the detail modal
- **Bookmarks filter** in the dashboard header to view only saved signals
- **API**: `GET /api/bookmarks` (list), `POST /api/bookmarks/{signalId}` (add), `DELETE /api/bookmarks/{signalId}` (remove)

## 📰 Signal Feed

The main dashboard features:

- **Two-column layout** — Geopolitics and Technology streams side by side (tabbed on mobile)
- **Grid & List modes** — dense list view or expanded card grid with severity color stripes
- **Signal Detail Modal** — click any card for full title, AI summary, content preview (HTML-stripped), and metadata
- **Bookmark/Save Signals** — save signals for later review, persisted in database and synced across sessions
- **Search** — real-time filtering across all screen sizes
- **Severity filters** — one-click All / High / Medium / Low toggles
- **Source & sort controls** — filter by feed source, sort by newest/oldest/score

## 📊 Trends Analytics

The Trends page at `/trends` provides 30-day analytics with interactive charts:

- **Signal Volume** — Stacked area chart by severity (high/medium/low)
- **Top Sources** — Ranked table with counts and average scores
- **Category Breakdown** — Geopolitics vs Technology comparison
- **Severity Distribution** — Donut chart
- **AI Provider Stats** — local vs groq vs openrouter usage
- **Geographic Heatmap** — World map showing signal counts by country (click to filter by country)

Open-access page with 5-minute auto-refresh.

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

Each item includes custom `signal:score` and `signal:source` elements.

## 🔔 Discord Alerts

Discord alerts send clean, HTML-free embeds with severity-based color coding (red/orange/green). RSS content and titles are fully sanitized — all HTML entities (including numeric like `&#8217;`) are decoded and all tags (including `<script>`/`<style>`) are stripped before sending.

Alerts can be filtered to only send tech-related signals:

```env
DISCORD_WEBHOOK_URL=your-webhook-url
DISCORD_FILTER_TECH=true  # Only send aiCategory === 'Tech'
```

## 🛡 Authentication

The admin portal (`/admin`) uses **email/password authentication** with bcrypt-hashed passwords and JWT sessions.

- Credentials stored in a `users` table with bcrypt password hashing
- JWT tokens issued as HTTP-only secure cookies (15m access + 7d refresh)
- Default credentials: `admin@signalstack.local` / `changeme123`
- Configure via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars before first deploy

## 📜 License

Private / Internal Protocol
