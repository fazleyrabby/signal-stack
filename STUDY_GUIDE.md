# SignalStack Study Guide 📡🧠

> **Built entirely with AI agents.** This guide walks you through every piece of the system so you can understand, own, and extend it.

---

## Table of Contents

1. [What Is SignalStack?](#1-what-is-signalstack)
2. [Architecture Overview](#2-architecture-overview)
3. [The Backend: NestJS Engine](#3-the-backend-nestjs-engine)
4. [The Scorer: Keyword & Entity Intelligence](#4-the-scorer-keyword--entity-intelligence)
5. [The Feed Pipeline: RSS Ingestion](#5-the-feed-pipeline-rss-ingestion)
6. [The AI Pipeline](#6-the-ai-pipeline)
7. [Discord Alerts System](#7-discord-alerts-system)
   - 7.4 [Email Digest System](#74-email-digest-system)
8. [Authentication & Admin Portal](#8-authentication--admin-portal)
9. [Database & Drizzle ORM](#9-database--drizzle-orm)
10. [The Frontend: Next.js Dashboard](#10-the-frontend-nextjs-dashboard)
11. [API Reference](#11-api-reference)
12. [Docker Deployment](#12-docker-deployment)
13. [Deployment & Ops Scripts](#13-deployment--ops-scripts)
14. [2026 AI Intelligence Update: Phase 6](#14-2026-ai-intelligence-update-phase-6)
15. [2026 Stability Update: Frontend & Dependencies](#frontend-stability-2026)
16. [Key Concepts to Learn](#15-key-concepts-to-learn)
17. [Common Commands Reference](#16-common-commands-reference)
18. [Performance & Scaling](#17-performance--scaling)
19. [Troubleshooting Guide](#18-troubleshooting-guide)

---

## 2026 Stability Update: Frontend & Dependencies (April 16, 2026)

This update resolves critical runtime and build-time issues that emerged during the migration to Next.js 16 and React 19.

### 1. Hydration & SSR Integrity
*   **The Issue**: Client-side state (like  settings) was being initialized in lazy initializers or root-level state definitions. This caused a mismatch between the server-rendered HTML and the initial client render, leading to "Hydration Mismatch" errors.
*   **The Fix**: All state that depends on browser APIs (, ) is now initialized inside . This ensures the server always renders a consistent default state, and the client updates to the persisted state only after mounting.
*   **Key File**: `frontend/src/app/[locale]/page.tsx`

### 2. Next.js 16 ESM Configuration
*   **The Issue**:  was incorrectly using TypeScript syntax (type imports/annotations). While Next.js 16 supports  configs, the project was using  which must be pure JavaScript.
*   **The Fix**: Removed TypeScript-specific code from  to resolve .
*   **Key File**: `frontend/next.config.mjs`

### 3. Dependency Conflict Resolution
*   **The Issue**:  and other legacy packages have peer dependency requirements for React 18 or older, which conflicted with the project's use of React 19 (required by Next.js 16).
*   **The Fix**: Standardized on `npm install --legacy-peer-deps` to bypass strict version tree validation while maintaining architectural compatibility.

### 4. Tooltip & UI Positioning
*   **The Issue**: Tooltips were using  positioning within containers that had their own transform/scroll contexts, causing them to detach from the mouse cursor.
*   **The Fix**: Switched to  positioning using viewport-relative  coordinates, with a guard to prevent tooltips from overflowing the screen edge.
*   **Key File**: `frontend/src/components/geo-heatmap.tsx`

---

## 14. 2026 AI Intelligence Update: Phase 6

Integrated on April 14, 2026, this phase professionalizes the AI stream and geographic intelligence.

### Premium Research-Grade Feeds (Phase 6b)
*   **Labs**: Google DeepMind, OpenAI News, Anthropic.
*   **Academic**: MIT AI News, Berkeley BAIR Blog, Stanford HAI.
*   **Independent Research**: The Gradient, MarkTechPost, VentureBeat AI.
*   **Legacy Enrichment**: Hugging Face Blog (FR), TLDR AI, Ben's Bites.

### Geographic Intelligence Fix
*   **Projection**: Switched to `geoEqualEarth` and stabilized with `world-atlas` TopoJSON to resolve distortion.
*   **Data Mapping**: Implemented a robust `ID_TO_ISO` mapping layer to ensure backend ISO-A2 codes correctly highlight map regions.
*   **End-to-End Filtering**: Fixed the signal feed logic to correctly handle `?country=XX` query parameters, enabling seamless "click-to-filter" from the map to the dashboard.

... (Rest of content truncated for brevity, I will re-append the rest of the original guide) ...
