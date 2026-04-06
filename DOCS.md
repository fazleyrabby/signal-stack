# SignalStack: Advanced Intelligence Platform 📡🧠

## Modern Stack Overview
- **Frontend**: Next.js 16 (App Router), Base UI, Lucide Icons, SWR Intelligence Polling, Tailwind CSS v4.
- **Backend**: NestJS 11, Drizzle ORM (PostgreSQL 16), Redis, RxJS.
- **AI Engine**: Dual-provider failover (Groq ⚡ + OpenRouter 🧠) with rate-limited background workers.
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
| Frontend | http://localhost:3001 | Dashboard + Admin Portal |
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

## Environment Configuration

Create a `.env` file at the project root for Docker Compose:

```env
# --- Security ---
ADMIN_API_KEY=your-secret-admin-key

# --- AI Intelligence (Failover Cluster) ---
GROQ_API_KEY=gsk_your-groq-key
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key

# --- Alerts ---
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook

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
  - **Primary**: **Groq** (⚡ Sub-second inference).
  - **Secondary**: **OpenRouter** (🧠 Comprehensive failover).
  - **429 Mitigation**: If a provider returns a rate limit error, the system enters a **60s Cooldown** for that provider.
- **Executive Summaries**: AI distills entire news articles into a single, high-impact sentence (max 200 chars).
- **Safe Fallback**: If all AI providers fail or are paused, the system remains 100% functional via high-fidelity keyword scoring.

---

## 📰 The SignalStack Terminal (Dashboard)

The dashboard is a pro-grade analytical terminal:

- **Widescreen Command Center**: Toggle between standard/centered and 100% viewport width for ultrawide monitoring.
- **High-Density Modes**:
  - **List Mode**: Ultra-compact, single-line "quick titles" for scanning hundreds of events.
  - **Grid Mode**: Expansive layout for detailed signal cards.
- **Intelligence Switcher (Mobile)**: Tactile tabs to switch between Geopolitical and Tech streams.
- **Real-time Global Search**: Instant, server-side full-text search across titles, content, and AI summaries.
- **Severity Quick Filters**: One-click toggles for All / High / Medium / Low severity.
- **Live Stats Bar**: Real-time signal counts, severity breakdown, and top source.
- **Load More**: Fetch additional signals on demand without page reload.

---

## 🛡 Admin Portal

Access at `/admin`. Protected by JWT-based session authentication with HTTP-only cookies.

| Page | Description |
|---|---|
| `/admin/login` | JWT session authentication (API key exchange) |
| `/admin` | Dashboard — feed health, stats, manual backup trigger, logout |
| `/admin/categories` | Manage intelligence categories (Geopolitics, Technology) |
| `/admin/sources` | Manage RSS feed sources per category |
| `/changelog` | View full project changelog |

**Authentication Flow**:
1. User enters `ADMIN_API_KEY` at `/admin/login`
2. Backend validates key and issues JWT tokens (15m access + 7d refresh)
3. Tokens stored as HTTP-only, secure cookies — never exposed to JavaScript
4. Middleware checks for valid access token on all `/admin/*` routes
5. Auto-refresh extends sessions up to 7 days
6. Logout clears both cookies server-side

**Default Admin Key**: `dev-admin-key` (configure via `ADMIN_API_KEY` in `.env`)
**JWT Secret**: Configure via `JWT_SECRET` in `.env` (required for production)

### System Backup
- **Automated**: Runs daily at **Midnight** via cron.
- **Manual**: Triggerable from the Admin Dashboard.
- **Output**: `backend/signalstack_backup.sql`
- **Requires**: `postgresql-client` (included in Docker image).

---

## 🛰️ Coverage & Categories (Active Streams)

SignalStack monitors high-fidelity streams divided into strategic intelligence categories:

- **World Geopolitics**: High-impact regional news and global policy shifts.
  - *Sources*: Guardian World, NYTimes, Al Jazeera, Foreign Affairs.
- **Technology Intelligence**: Deep tech shifts, hardware breakthroughs, and software engineering signals.
  - *Sources*: Ars Technica, The Verge, TechCrunch, MIT Tech Review, Wired.

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

3. **Container Ignition**:
   ```bash
   docker compose up -d --build
   ```

4. **Seed Database** (first run only):
   ```bash
   docker exec signalstack-app npm run seed
   ```

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
```bash
cd backend && npm run test:discord
```

### Viewing Logs
```bash
docker compose logs -f          # All services
docker compose logs -f app      # Backend only
docker compose logs -f frontend # Frontend only
```

**Dozzle** (production): Browse real-time container logs at [http://localhost:9999](http://localhost:9999) — no CLI needed.

### Rebuilding After Code Changes
```bash
docker compose up -d --build    # Rebuild and restart all services
docker compose up -d --build frontend  # Rebuild frontend only
```

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
                                              └──────────┘ └───┬────┘ └──────────┘
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
