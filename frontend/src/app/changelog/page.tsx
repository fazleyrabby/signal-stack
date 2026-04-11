import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const changelog = [
  {
    version: "Unreleased",
    sections: [
      {
        type: "Added",
        items: [
          "Error boundary components for all routes (error.tsx, global-error.tsx, not-found.tsx)",
          "Admin route error boundaries (admin, categories, sources)",
          "scripts/audit.sh — VPS environment health check",
          "scripts/deploy.sh — automated pull-and-deploy for production",
          "CHANGELOG.md — this file",
          "Infinite scroll with IntersectionObserver (auto-loads on scroll)",
          "Mobile category tab switcher (Geopolitics / Technology)",
          "ThemeProvider context with three themes: Onyx, Light, Cyberpunk",
          "Smooth theme transitions via temporary CSS class (avoids page-load flash)",
          "Custom scrollbar styling matching theme variables",
          "Root .env file template for Docker Compose",
          "docker-compose.prod.yml — production-ready with Dozzle log viewer",
          "Database backup service with daily cron + manual trigger",
          "Database seed script for bootstrapping categories/sources",
          "/changelog page — view changelog in-browser",
          "Column component — reusable category column with independent scroll",
          "Shell component — app shell layout wrapper",
          "Sidebar component — navigation sidebar",
          "Footer component — page footer",
          "Signal skeleton component — loading state placeholders",
          "frontend/.dockerignore — excludes node_modules and .next from build context",
          "Header: Show/Hide controls toggle button with text label",
          "Header: SIGNAL STACK logo now visible on mobile",
        ],
      },
      {
        type: "Changed",
        items: [
          "API_BASE now uses NEXT_PUBLIC_API_URL env var instead of hardcoded localhost",
          "Header: replaced theme dropdown with simple icon toggle button",
          "Dashboard: two-column category layout (Geopolitics + Technology)",
          "Dashboard: each category has independent infinite scroll",
          "Dashboard: responsive column breakpoints (1 → 2 → 3 → 4 columns)",
          "Dashboard: container max-width expands on 2xl screens (1800px)",
          "CSS: Tailwind v4 with oklch color space for all theme tokens",
          "CSS: added scroll-smooth to html/body",
          "CSS: custom scrollbar with theme-aware colors",
          "docker-compose.yml: volume mounts limited to src/ and public/ only (prevents cache corruption)",
          "docker-compose.yml: removed full ./frontend:/app mount that caused stale .next issues",
          "docker-compose.prod.yml: container renamed to signalstack-app",
          "docker-compose.prod.yml: added FRONTEND_URL, NODE_ENV, PORT env vars",
          "docker-compose.prod.yml: added Dozzle log viewer on port 9999",
          "Dockerfile: multi-stage build — production stage copies only build artifacts",
          ".gitignore: expanded patterns for backups and planning docs",
          "DOCS.md: complete rewrite with production deployment guide",
          "report.md: expanded into full study guide with code examples",
        ],
      },
      {
        type: "Fixed",
        items: [
          "Build: Button asChild prop not supported — replaced with plain <a> tags",
          "Build: theme-provider import paths broken — fixed to @/ alias",
          "Build: Maximize2 icon missing import",
          "Build: duplicate loadMore function definition",
          "Build: signals referenced before initialization (hook ordering)",
          "Build: revalidateOnMount=false prevented initial data fetch",
          "Build: striptags module missing from package.json",
          "Runtime: API response shape mismatch ({ data: [] } vs direct array)",
          "Runtime: stats prop shape mismatch between StatsBar and page",
          "Docker: frontend container serving blank page (stale build cache)",
          "Docker: missing tsconfig.json in production stage broke dev mode",
          "Docker: missing postcss.config.mjs caused Tailwind CSS not to load",
          "Docker: stale .next cache from host volume mount corrupting container builds",
          "Docker: docker compose v2 vs docker-compose v1 compatibility",
          "Git: merge conflict markers in docker-compose.prod.yml on VPS",
          "Git: untracked scripts/ folder blocking git pull on VPS",
          "CORS: browser blocking localhost:3000 fetches from HTTPS origin",
          "Scroll: infinite scroll jumping to top on load more",
          "Scroll: CSS columns redistributing items causing scroll reset",
          "RSS: HTML tags not being stripped properly from feed content — added striptags library",
          "UI: Show/Hide controls button moved to header for better UX",
          "Dev: next.config.ts default API backend changed to localhost:3000 for npm run dev",
        ],
      },
      {
        type: "Removed",
        items: [
          "docker-compose.prod.yml volume mounts (production isolation)",
          "Backend volume mounts in docker-compose.yml",
          "Full frontend directory mount in docker-compose.yml (replaced with src/ + public/ only)",
          "asChild prop usage on Button components",
          "ScrollArea component in favor of native overflow-y-auto",
          "Load More button replaced with infinite scroll sentinel",
          "Hardcoded localhost:3000 API URLs in frontend",
        ],
      },
    ],
  },
  {
    version: "2026-04-04 — Initial Release",
    sections: [
      {
        type: "Added",
        items: [
          "NestJS backend with RSS feed scheduler",
          "Drizzle ORM + PostgreSQL database",
          "Redis caching and AI rate limiting",
          "Groq + OpenRouter dual-provider AI pipeline",
          "Next.js 16 frontend dashboard",
          "Admin portal (login, categories, sources management)",
          "Docker Compose multi-container setup",
          "Signal scoring engine (keyword-based)",
          "Discord webhook alerts for high-impact signals",
          "Database backup system (daily cron + manual trigger)",
        ],
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header isRefreshing={false} showSearch={false} />

      <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-8 pb-16 md:pb-0">
        <div className="space-y-10">
          {changelog.map((release) => (
            <div key={release.version} className="space-y-4">
              <h2 className="text-lg font-black uppercase tracking-[0.2em] text-foreground border-b border-border/30 pb-2">
                {release.version}
              </h2>
              <div className="space-y-6">
                {release.sections.map((section) => (
                  <div key={section.type} className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {section.type}
                    </h3>
                    <ul className="space-y-1.5">
                      {section.items.map((item, i) => {
                        const [label, ...rest] = item.split(": ");
                        return (
                          <li key={i} className="flex gap-2 text-sm leading-relaxed">
                            <span className="text-muted-foreground/40 shrink-0 mt-0.5">•</span>
                            <span>
                              {rest.length > 0 ? (
                                <>
                                  <span className="font-semibold text-foreground">{label}:</span>
                                  <span className="text-muted-foreground"> {rest.join(": ")}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">{item}</span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
