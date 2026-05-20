# 📡 SignalStack System Maintenance Guide

This document summarizes the critical configurations, pipelines, and operational routines required to keep SignalStack running at peak performance.

---

## 🏗️ 1. Core Architecture & Pipelines

### AI Intelligence Pipeline (The Waterfall)
The system follows a strict sequential failover logic to ensure zero-cost, private processing whenever possible:
1.  **Local AI Router** (LXC Proxy: `192.168.0.213:9000`): Intelligent routing layer.
2.  **Mac M1 llama.cpp** (Tailscale: `100.x.y.z:8081`): Direct high-performance Apple Silicon inference.
3.  **Groq ⚡** (Cloud): Primary fast cloud fallback.
4.  **OpenRouter 🧠** (Cloud): High-fidelity fallback for complex reasoning.
5.  **VPS Local** (Docker: `localhost:8080`): Final fail-safe 0.5B Qwen model.

**Maintenance Note:** If your Mac IP changes, update it in the **Admin Settings > Mac Local AI** section immediately.

### Data Ingestion Flow
*   **Signals:** Ingested every 5 minutes via `FeedScheduler`.
*   **Jobs:** Ingested every 30 minutes via `JobsScheduler`.
*   **Companies:** Discovered manually via **Admin Radar** or **Directory Crawler**.

---

## 🚀 2. Deployment & VPS Operations

### Standard Deployment
Always use the zero-downtime script to update the production environment:
```bash
# On your local machine:
git push origin main && deploy-signal

# On the VPS directly:
cd ~/signal-stack && ./scripts/deploy.sh
```

### Rollback Strategy
If a deploy fails, the system auto-rolls back. To manually revert to the previous version:
```bash
./scripts/deploy.sh --rollback
```

### Essential VPS Commands
| Task | Command |
|---|---|
| **View All Logs** | Open `http://192.168.0.110:9999` (Dozzle) |
| **Check AI Health** | `curl -s http://localhost:3000/api/admin/ai/health` |
| **Prune Docker** | `docker system prune -f` (Done automatically during deploy) |
| **Manual DB Backup** | `docker exec signalstack-app npm run backup` |

### Known Issue: "Port Already Allocated" on Deploy

**Symptom:**
```
Error: Bind for 0.0.0.0:8080 failed: port is already allocated
```
Deploy fails on `signalstack-llama` startup.

**Root Cause:**  
A previously failed deploy leaves a stale stopped container in Docker's networking layer. Even though the container is exited, its port binding persists. The deploy script's `docker system prune --filter "until=24h"` skips containers stopped less than 24h ago, so the ghost binding survives.

**Fix (manual):**
```bash
docker container prune -f   # remove all stopped containers
docker network prune -f     # clear phantom port bindings
./scripts/deploy.sh         # redeploy
```

**Prevention:**  
`scripts/deploy.sh` now runs both prune commands automatically before the swap step. This was added on 2026-05-06.

---

## 🛠️ 3. Critical Configurations

### Environment Variables (`.env`)
*   `JWT_SECRET`: Essential for Admin session security.
*   `AI_DAILY_LIMIT`: Currently set to **500**. Monitor via Redis if signals stop processing.
*   `PICOCLAW_URL`: Must point to your LXC container IP for routing to work.

### Database Protection
SignalStack uses **Drizzle ORM**. 
*   **Schema changes:** Run `npm run db:push` in the backend folder.
*   **Backups:** Located in the `backups/` volume. Copy to host via: 
    `docker cp signalstack-app:/app/backups/latest.sql .`

---

## 🧪 4. Testing & Verification

Before any major code change, run the **Verification Suites**:
1.  **Job Leak Prevention:** `npm test src/feed/feed.scheduler.spec.ts`
2.  **AI Pipeline Fallback:** `npm test src/ai/ai.pipeline.spec.ts`

---

## 📬 5. Discord Routing Rules

The system enforces strict channel separation:
*   **Channel #signalstack:** Only high-severity (Score 7+) News/Tech/Geopolitics.
*   **Channel #signalstack-jobs:** Only items from sources marked as `type: 'job'` or matched via `JobPreferences`.

**Maintenance Rule:** If a news source starts posting too many "Hiring" posts, add the keywords to the `isJobRelated` regex in `feed.scheduler.ts`.

---

## 📈 6. System Cleanliness (The "Noise" Filter)
*   **Signal Retention:** 14 days (Auto-cleaned).
*   **Visitor Retention:** 90 days (Auto-cleaned).
*   **Geocoding Cache:** 24 hours (Redis: `geo_suggest:*`).

**Final Advice:** Every Sunday, check the **Admin Dashboard > AI Usage** section. If "Groq" usage is much higher than "Mac Local," your Mac might be offline or Tailscale might need a restart.
