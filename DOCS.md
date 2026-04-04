# SignalStack — Official Documentation 📡

SignalStack is a backend-driven signal intelligence system that monitors high-quality geopolitical and technology sources, extracts meaningful signals, and surfaces them in a clean frontend dashboard. It filters noise and stores only high-value events.

---

## 🏗 System Architecture

The project is structured as a monorepo containing:
- **Backend**: NestJS REST API (Port 3000)
- **Frontend**: Next.js App Router (Port 3001)
- **Infrastructure**: Docker Compose (PostgreSQL & Redis)

### Data Flow Pipeline
1. **Cron Job** (`feed.scheduler.ts`) triggers every 5 minutes.
2. **Feed Fetcher** retrieves 10 trusted RSS feeds concurrently (`Promise.allSettled` with `p-limit` restricted to 5 concurrent fetches, 10s timeout per feed).
3. **Normalization** sanitizes incoming XML feeds, prioritizing standard fields to extract uniform `Signal` structures.
4. **Scorer** assigns points based on keywords (e.g. outage, acquisition), entities (e.g. Google, OpenAI), and source trust (e.g. Reuters = 5).
5. **Deduplication** applies a SHA-256 hash to a normalized version of the article title and URL (stripping tracking parameters).
6. **Storage** occurs only if the signal scores `≥ 5`.
7. **Alerts** fire a Discord Webhook (rate limited to 1 per 2 seconds) if the score reaches `≥ 7` (Medium/High severity).

---

## 🛠 Tech Stack

### Backend (`/backend`)
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Key Packages**:
  - `rss-parser` for feed ingestion
  - `@nestjs/schedule` for cron jobs
  - `p-limit` for concurrency throttling

### Frontend (`/frontend`)
- **Framework**: Next.js 16.2 (App Router)
- **Data Fetching**: SWR (Stale-While-Revalidate) with 10s polling
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui (Card, Badge, Table, Dialog, Select, Switch, Skeleton, Separator, ScrollArea)
- **Icons**: Lucide React
- **Standard View**: Dual-column (Desktop) side-by-side feed with independent "Load More" pagination.
- **Mobile View**: Tab-filtered single column view.
- **Design Theme**: Dark mode focus, Inter font, minimal "signal-first" UI.

---

## 🚦 Severity & Scoring Guidelines

- **High (≥ 10 points)**: Rendered in Red. Triggers Discord alerts. Examples: Major outages, cyberattacks combined with high-trust sources.
- **Medium (7 - 9 points)**: Rendered in Orange. Triggers Discord alerts. Examples: Layoffs, funding rounds, product launches.
- **Low (5 - 6 points)**: Rendered in Green. Stored but does not trigger alerts.
- **Ignored (< 5 points)**: Entirely discarded at the scoring phase to save database space.

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose

### 1. Start Infrastructure (PostgreSQL)
From the repository root:
```bash
docker compose up postgres -d
```
*This exposes PostgreSQL locally on port 5433.*

### 2. Setup Backend Environment
In `/backend/.env`:
```env
DATABASE_URL=postgresql://signal:signal@localhost:5433/signalstack
DISCORD_WEBHOOK_URL=<your-discord-webhook>
FRONTEND_URL=http://localhost:3001
PORT=3000
```
Run migrations and start:
```bash
cd backend
npm install
npm run db:push
npm run start:dev
```

### 3. Setup Frontend Environment
In `/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```
Start the frontend dev server:
```bash
cd frontend
npm install
npm run dev
```
Access the dashboard at [http://localhost:3001](http://localhost:3001)

---

## 📦 Next Steps (Phase 2)
- **Admin UI**: Fully integrated at `/admin`. Manage categories and RSS sources dynamically in PostgreSQL.
- **AI Processing**: Integrate LLMs for semantic scoring and summarization.
- **WebSocket Feed**: Transition from 10s SWR polling to Server-Sent Events (SSE) or WebSockets for instant updates.
