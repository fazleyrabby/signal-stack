# Changelog

All notable changes to SignalStack will be documented in this file.

---

## [2026-04-14] — Phase 6b: Geographic & Source Intelligence

### Added
- **Premium Research-Grade AI Feeds**: Integrated 10+ high-reliability sources including **OpenAI**, **Anthropic**, **Google DeepMind**, **Hugging Face**, **BAIR (Berkeley)**, **MIT AI News**, **Stanford HAI**, **The Gradient**, **MarkTechPost**, and **VentureBeat AI**.
- **Interactive Map Zoom**: Added `ZoomableGroup` to the Geographic Intelligence heatmap for precision navigation and country inspection.
- **Global UI Footer**: Integrated a professional footer into **Trends** and **Admin** pages for improved navigation and branding.
- **Admin Layout**: Dedicated `AdminLayout` component ensures consistent UI and footer presence across all administrative sub-pages.
- **End-to-End Country Filtering**: Fixed signal feed logic to honor `?country=XX` parameters, enabling seamless "click-to-filter" from the geographic map.
- **Smart Tab Hiding**: Automatically hides empty columns during filtered views (country/search) to maximize relevance and screen real-estate.
- **UX Reset Logic**: Dashboard now force-enables all category sections when a country is selected from the heatmap to prevent empty result screens.
- **Mobile Map-to-Feed Sync**: Auto-switches to the most relevant tab (Geopolitics) when navigating from the map on mobile devices.

### Fixed
- **Geographic Projection**: Switched to `geoEqualEarth` and stabilized with `world-atlas` TopoJSON to resolve map distortion.
- **Data Mapping Layer**: Resolved mismatch between backend ISO-A2 codes and frontend numeric IDs via a robust `ID_TO_ISO` mapping.
- **Reactive Map Fix**: Removed invalid `maxZoom` property that caused production build failures.
- **Source Health Re-verification**: Replaced broken RSS feeds (Meta, Stability) with verified healthy alternatives.
- **JSX Syntax Errors**: Resolved component nesting and layout issues inherited from the AdminLayout migration.

---

## [2026-04-13] — Phase 6a: AI Pipeline & UI Resilience

### Added
- **AI Content Fallback**: Summarizer now defaults to the signal title if the RSS feed provides no description (targets TLDR-style feeds).
- **Boilerplate Suppression**: AI providers now block generic LLM error messages from polluting the database summaries.
- **Admin AI Cleanup Tool**: New endpoint and dashboard utility to reset signals containing boilerplate AI responses.
- **Focus Mode & Flexible Layout**: Implemented card layout optimizations to prevent squishing and ensure readability in high-density views.
- **Premium Diagnostic Suite**: `scripts/test-endpoints.sh` with animated terminal UI, payload previewing, and latency benchmarking.
- **Self-Healing AI Queue**: Automatically re-queues unprocessed high-score signals on container restart.

### Fixed
- **Local AI Race Condition**: Removed 4s hardcoded timeout that was causing local AI to prematurely failover to Groq.
- **AI Timeout Calibration**: Increased provider timeouts to 35s to accommodate low-RAM VPS inference speeds.
- **Retry Logic Expansion**: Admin retry tool now detects signals that were "pending" but never formally "failed."
- **Terminal UI Architecture**: Corrected ASCII diagrams and documentation for the triple-column stream.

### Changed
- **Deployment Strategy**: Replaced unsafe GitHub Actions with a secure `deploy-signal` shell alias and zero-downtime `deploy.sh` script.
- **UI Spacing Polish**: Refined margins and paddings globally for a tighter, "clinical" professional aesthetic.

---

## [2026-04-12] — Phase 5: Email Digest & Mobile Overhaul

### Added
- **Email Digest System**: Daily HTML summaries of high-impact signals delivered via Gmail SMTP.
- **Mobile Navigation 2.0**: 5-column bottom navigation with centered, animated search and tab switching.
- **Technology Focus Filter**: Restructured email digests to focus exclusively on the "technology" category.
- **Search Context**: Centralized search state allowing seamless transitions between desktop and mobile search bars.

### Fixed
- **Email Rendering**: "Bulletproof" CSS overhaul to fix badge/timestamp overlap in mobile mail clients.
- **Spam Prevention**: Removed on-startup email triggers to prevent duplicate notifications during maintenance.

---

## [2026-04-10] — Phase 4: Trends & Analytics

### Added
- **Trends Dashboard**: Interactive analytics suite with 6 charts (volume, top sources, category breakdown, severity, AI providers, geo heatmap).
- **Visitor Tracking**: Persistent visitor statistics with PostgreSQL storage and realtime dashboard counter.
- **Signal Detail Modal**: High-fidelity modal for deep-reading signal content without leaving the dashboard.
- **Severity Visuals**: Color-coded side stripes on cards for instant status scanning (High/Med/Low).
- **Bookmark System**: Personalized "Save for later" functionality with database persistence.

### Fixed
- **HTML Entity Decoding**: Full support for numeric entities (e.g., `'`) in titles and summaries.
- **Infinite Scroll Stability**: Fixed "jump to top" issues during data revalidation.

---

## [2026-04-04] — Initial Release

### Added
- NestJS backend with RSS feed scheduler
- Drizzle ORM + PostgreSQL database
- Redis caching and AI rate limiting
- Groq + OpenRouter dual-provider AI pipeline
- Next.js 16 frontend dashboard
- Admin portal (login, categories, sources management)
- Docker Compose multi-container setup
- Signal scoring engine (keyword-based)
- Discord webhook alerts for high-impact signals
