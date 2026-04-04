# SignalStack: Advanced Intelligence Platform 📡🧠

## Modern Stack Overview
- **Frontend**: Next.js 15, Base UI, Lucide Icons, SWR Intelligence Polling.
- **Backend**: NestJS, Drizzle ORM (PostgreSQL), Redis.
- **AI Engine**: Dual-provider failover (Groq ⚡ + OpenRouter 🧠).
- **Deployment**: Multi-container Docker (Production-ready).

---

## Key Phase 3 & 4 Enhancements

### 🧠 AI Intelligence Tier (Automated Executive Summaries)
SignalStack now features an automated analytical layer that processes every incoming news signal.
- **Executive Summaries**: AI distills entire news articles into a single, high-impact sentence.
- **Semantic Scoring**: Automated impact assessment (1-10) based on geopolitical and tech relevance.
- **Automatic Classification**: Signals are categorized into *Cyber, Outage, Geopolitics, Finance, Tech, Policy* automatically.
- **High-Availability Failover**: 
  - Primary: **Groq** (Llama 3.3 for sub-second inference).
  - Secondary: **OpenRouter** (for deep reasoning if Groq rate-limits).
  - Tertiary: Pattern-matching fallback for 100% uptime.

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

### High-Fidelity Monitoring
Your SignalStack node automatically pushes the latest DB schema updates using `drizzle-kit push` on startup, ensuring that your production environment is always in sync with the intelligence engine's evolving data structures.
