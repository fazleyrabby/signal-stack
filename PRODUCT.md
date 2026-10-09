# SignalStack

SignalStack's public reader helps people follow world, technology, and AI news through readable headlines, short summaries, source attribution, and links to original reporting. English, Bengali, and Spanish are supported locales. The public reader is distinct from the existing administration and ingestion tools.

## Approved scope

- Preserve and refine the established purple dark/light public identity; keep administration surfaces and their theme intact.
- Make a brief selection of recent stories easy to scan, followed by the latest stories. Headline text remains fully readable.
- Keep priority subordinate to the reporting. The score is a sorting aid, not a measure of urgency, accuracy, or credibility.
- Offer a quick summary modal, an expandable stored source excerpt when available, and a link to the full publisher article.
- Provide dedicated, shareable story and topic pages with search and social metadata, plus search, filters, saved stories, and pagination in the reader.

## Product truth

The quick briefing selects the first three recent stories under the default feed conditions; it does not promise editorial importance or comprehensive coverage. Summaries may be AI generated and are labeled when they are. Stored excerpts are not guaranteed to contain the full article. A translation can still be pending. The header shows real active-reader and cumulative page-view counts when available; absent data is not replaced with invented activity. Missing summary and empty/error states are part of the product.

Topics are World (`geopolitics`), Technology (`technology`), and AI (`ai`). Story links use locale-specific IDs rather than publisher URLs; sharing uses native sharing when available and otherwise copies the link. Retention can remove stories, so these links are not a permanent archive.

## Verification boundary

The implementation received 14 passing backend tests, frontend/backend builds, and TypeScript/lint checks. The final frontend production build passed after the same-ID refresh correction. The subsequent production Docker build, local startup, homepage HTTP 200, and real reader counters were verified; TypeScript/lint also passed. Docker Compose configuration validation passed with optional unset-key warnings. One detector run returned no findings. Desktop/mobile feed and summary modal, mobile filter interaction, and a story page plus its social image response were checked in the browser.

Earlier preview screenshots used real news records through an isolated mock API. Final compact desktop/mobile captures used the real local Docker backend. Docker startup, homepage, and reader counters are verified; exhaustive full-flow integration, translated layout captures, and a complete light-theme capture were not performed. These checks establish implementation evidence, not measured reader outcomes, exhaustive accessibility compliance, or production SEO results.

See [DESIGN.md](DESIGN.md) for public visual rules and [the reader brief](docs/public-reader-design.md) for surface behavior.
