# Public reader surface brief

## Direction and boundary

Refine the incumbent purple dark/light identity into a clearer briefing and reading experience. This is a code-led refinement, using the actual reader and news records as evidence. It does not introduce a new brand world, generated comps, a seed system, or a quality score card. [PRODUCT.md](../PRODUCT.md) owns product scope; [DESIGN.md](../DESIGN.md) owns extracted visual rules. Administration is outside this work.

The main surfaces are `/{locale}`, `/{locale}/topics/{topic}`, and `/{locale}/stories/{id}`, with `en`, `bn`, and `es` locales. A locale wrapper supplies the public theme, and the portaled modal explicitly receives that same scope.

## Composition and behavior

- Feed: header/search, a compact introduction row, topics and saved navigation, filters, an optional three-story quick briefing, then latest stories. Default recent-order feeds with at least three records show the briefing; saved, search, priority, source, country, or alternate-sort views do not. A topic feed can show its own briefing.
- Header activity: polls `GET /api/visitors/stats` every 30 seconds for active readers over the last five minutes and cumulative page views. Counts use compact locale formatting; mobile hides total views. Counters remain absent until real data is available, and a real zero stays visible.
- Cards: equal-width columns with 16px desktop / 12px mobile gaps, one consistent card surface, 20px padding, 10px corners, subtle borders, and a shared 21px headline size. Full headlines, source/date, summary or translation-pending state, and a quiet priority footer. A normal headline click opens the summary modal when preview is available; modifier clicks and the explicit story link preserve page navigation.
- Mobile: compact introductory copy, scrolling topic navigation, filters behind a labeled toggle, one story column, and fixed Feed/Topics/Search/Saved navigation. The summary modal fills the screen and keeps its actions below scrollable content.
- Reading: distinguish AI summary from other summary text. A stored excerpt appears in a native expandable disclosure only when present and different from the summary. The publisher link opens the full original article when its URL is valid. A story page offers save/share, original reporting, the same disclosures, and related stories when available.
- Feed state: search is debounced; source, priority, and ordering controls refine results. Load more has a retry state. New IDs are announced for an explicit refresh so the reader's order stays stable, while same-ID corrected or translated fields update in place. Duplicate IDs and equivalent tracking URLs are removed from the visible stream.
- Saving/sharing: save actions display pending state and success/error feedback. Sharing uses the locale story permalink through native sharing or clipboard fallback. These are retained records, not permanent archival links.

## Metadata

Story pages generate title, description, canonical and locale alternatives, Open Graph and Twitter metadata, and a social image URL. Topic pages generate localized title/description, canonical and locale alternatives, and Open Graph metadata. The localized layout sets the metadata base to the configured public site URL for convention-generated social images. Invalid topics and missing story records resolve to not-found behavior. Metadata implementation does not establish search ranking or indexing success.

## Verification record — 2026-10-09

The provided verification record reports 14 passing backend tests, passing frontend/backend builds, and TypeScript/lint checks. The final frontend production build passed after the same-ID refresh correction; TypeScript also passed after the localized metadata-base addition. Docker Compose configuration validation passed with optional unset-key warnings. One detector invocation returned an empty findings list.

Browser checks covered desktop/mobile feed and modal, a native click on the mobile filter toggle, and a story page with a successful social-image response. Captures are in `.impeccable/review/`: `desktop.jpg`, `mobile.jpg`, `modal-desktop.jpg`, `modal-mobile.jpg`, and `story-mobile.jpg`. They show the dark English reader, including complete wrapped headlines and source/priority hierarchy.

Earlier preview captures used real news records with an isolated mock API. Final `compact-desktop.jpg` and `compact-mobile.jpg` captures use the real local Docker backend. The production Docker build passed, local startup and homepage HTTP 200 were verified, real counters were checked, and TypeScript/lint passed. The bounded final review disposition was ship. Exhaustive full-flow Docker integration, translated layout captures, and a complete light-theme capture remain unverified. No reader success metric or exhaustive accessibility certification is claimed. Retention may expire story permalinks.

## Implementation references

The authoritative implementation is `frontend/src/app/globals.css`, `frontend/src/components/ReaderFeed.tsx`, `SignalCard.tsx`, `SignalDetailModal.tsx`, `SignalsDashboardContent.tsx`, and the locale topic/story route files. Public story utilities are in `frontend/src/lib/stories.ts` and `server-stories.ts`. Keep this brief descriptive of shipped behavior; update it when those surfaces change.

The unified-card refinement was rebuilt in the local Docker frontend and checked on desktop and mobile. Briefing cards share equal widths, the same surface and 21px headline size; mobile uses a verified 12px gap. TypeScript and targeted lint passed. Captures: `.impeccable/review/unified-desktop.jpg` and `unified-mobile.jpg`.
