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

The AI pipeline uses fallback: `Local (llama.cpp) → Groq → OpenRouter`

## 🔔 Discord Alerts

Discord alerts can be filtered to only send tech-related signals:

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
