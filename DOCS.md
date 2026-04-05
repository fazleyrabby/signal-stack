# SignalStack: Advanced Intelligence Platform 📡🧠

## Modern Stack Overview
- **Frontend**: Next.js 15, Base UI, Lucide Icons, SWR Intelligence Polling.
- **Backend**: NestJS, Drizzle ORM (PostgreSQL), Redis.
- **AI Engine**: Dual-provider failover (Groq ⚡ + OpenRouter 🧠).
- **Deployment**: Multi-container Docker (Production-ready).

---

### 🧠 Phase 5 Intelligence Tier (Rate-Limited Background Processing)
SignalStack now features a production-grade, asynchronous AI enrichment pipeline designed for reliability and cost-efficiency.
- **Asynchronous Processing**: Ingestion no longer blocks on AI. Signals are scored via keywords first, and high-impact items (score ≥ 7) are enqueued for deep analysis.
- **Rate-Limited Execution**:
    - **Smoothing**: Processes 1 job every ~1.5 seconds to prevent API bursts.
    - **Concurrency**: Managed by 2 parallel background workers.
    - **Daily Quota**: Automatically pauses AI analysis after 150 requests to stay within free-tier limits.
- **Strategic Failover & Cooldowns**:
    - **Primary**: **Groq** (⚡ Sub-second inference).
    - **Secondary**: **OpenRouter** (🧠 Comprehensive failover).
    - **429 Mitigation**: If a provider returns a rate limit error, the system enters a **60s Cooldown** for that provider.
- **Executive Summaries**: AI distills entire news articles into a single, high-impact sentence (max 200 chars).
- **Safe Fallback**: If all AI providers fail or are paused, the system remains 100% functional via high-fidelity keyword scoring.

### 📰 The SignalStack Terminal (UI Overhaul)
The dashboard has been upgraded to a pro-grade analytical terminal:
- **Widescreen Command Center**: Toggle between standard/centered and 100% viewport width for ultrawide monitoring.
- **High-Density Modes**:
    - **Grid/Masonry**: Expansive layout for detailed signal cards.
    - **News List**: Ultra-compact, single-line "quick titles" for scanning hundreds of events at once.
- **Intelligence Switcher (Mobile)**: Tactile tabs to switch between Geopolitical and Tech streams on the go.
- **Real-time Global Search**: Instant, server-side full-text search across titles, content, and AI summaries.

---

## System Configuration (Backend)

### Environment Variables (`backend/.env`)
```env
# --- Database ---
DATABASE_URL="postgresql://..."

# --- Security ---
ADMIN_API_KEY="your-secret-key"

# --- AI Intelligence (Failover Cluster) ---
GROQ_API_KEY="gsk_..."
OPENROUTER_API_KEY="sk-or-v1..."

# --- Alerts ---
DISCORD_WEBHOOK_URL="your-webhook-url"
```

### Analytical Testing
Run the following connectivity probe to verify your dual-provider intelligence uplink:
```bash
cd backend && npm run test:ai
```

---

## Production Deployment (Proxmox / VPS)

### Command Flow:
1. **Repository Sync**:
   ```bash
   git clone https://github.com/fazleyrabby/signal-stack.git && cd signal-stack
   ```

2. **Container Ignition**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

### 🛰️ Coverage & Categories (Active Streams)
SignalStack monitors high-fidelity streams divided into strategic intelligence categories:
- **World Geopolitics**: High-impact regional news and global policy shifts.
    - *Sources*: Guardian World, NYTimes, Al Jazeera, Foreign Affairs.
- **Technology Intelligence**: Deep tech shifts, hardware breakthroughs, and software engineering signals.
    - *Sources*: Ars Technica, The Verge, TechCrunch, MIT Tech Review, Wired.

---

## 🛠 Maintenance & Engineering

### Database Seeding (Idempotent)
To reset or bootstrap your regional categories and sources, run the standalone seeder:
```bash
cd backend && npm run seed
```
*Note: This script handles its own database connection and can be run safely multiple times; it will not duplicate existing records.*

### 💾 Automated Backup & Recovery
SignalStack includes a specialized backup engine that mirrors your data to a SQL file for disaster recovery.
- **Automated**: Runs every day at **Midnight** via `@Cron`.
- **Manual**: Triggerable via the **Admin Console** (`System Backup` module).
- **Target File**: `backend/signalstack_backup.sql`
- **Infrastructure**: Requires `postgresql-client` (included in the production Docker image).

### High-Fidelity Monitoring
Your SignalStack node automatically pushes the latest DB schema updates using `drizzle-kit push` on startup, ensuring that your production environment is always in sync with the intelligence engine's evolving data structures.
