# SignalStack 📡

SignalStack is a high-performance, backend-driven signal intelligence system. It monitors high-trust RSS streams, processes them through a dedicated scoring engine, and surfaces critical events in a real-time dashboard.

## 🏗 Project Structure

This is a **monorepo** containing the entire SignalStack ecosystem:

- **[`/backend`](./backend)**: NestJS API, PostgreSQL data layer, and the automated Signal Crawler.
- **[`/frontend`](./frontend)**: Next.js 14+ Dashboard with dual-column desktop views and mobile optimization.
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

## 🛡 Authentication

The administrative portal (`/admin`) is protected by **Basic Auth**.
- **Default Key**: `dev-admin-key`
- Configure your own in `backend/.env` using `ADMIN_API_KEY`.

## 📜 License

Private / Internal Protocol
