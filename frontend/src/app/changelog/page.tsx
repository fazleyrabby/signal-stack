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
          "Theme toggle (light/dark) with smooth CSS transitions",
          "Custom scrollbar styling matching theme variables",
          "Root .env file template for Docker Compose",
          "docker-compose.prod.yml — production-ready, no volume mounts",
          "Database backup service with daily cron + manual trigger",
          "Database seed script for bootstrapping categories/sources",
          "/changelog page — view changelog in-browser",
        ],
      },
      {
        type: "Changed",
        items: [
          "API_BASE now uses NEXT_PUBLIC_API_URL env var instead of hardcoded localhost",
          "Header: replaced theme dropdown with simple icon toggle button",
          "Header: removed ThemeProvider dependency (self-contained theme state)",
          "Dashboard: two-column category layout (Geopolitics + Technology)",
          "Dashboard: each category has independent infinite scroll",
          "Dashboard: responsive column breakpoints (1 → 2 → 3 → 4 columns)",
          "Dashboard: container max-width expands on 2xl screens (1800px)",
          "Dashboard: removed h-screen lock, uses min-h-screen for natural scrolling",
          "CSS: added scroll-smooth to html/body",
          "CSS: custom scrollbar with theme-aware colors",
          "docker-compose.yml: added volume mounts + npm run dev for frontend hot-reload",
          "docker-compose.yml: removed volume mounts from backend",
          "docker-compose.prod.yml: container renamed to signalstack-app",
          "docker-compose.prod.yml: added FRONTEND_URL, NODE_ENV, PORT env vars",
          "docker-compose.prod.yml: configurable POSTGRES_PASSWORD and NEXT_PUBLIC_API_URL",
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
          "Runtime: API response shape mismatch ({ data: [] } vs direct array)",
          "Runtime: stats prop shape mismatch between StatsBar and page",
          "Docker: frontend container serving blank page (stale build)",
          "Docker: docker compose v2 vs docker-compose v1 compatibility",
          "Git: merge conflict markers in docker-compose.prod.yml on VPS",
          "Git: untracked scripts/ folder blocking git pull on VPS",
          "CORS: browser blocking localhost:3000 fetches from HTTPS origin",
          "Scroll: infinite scroll jumping to top on load more",
          "Scroll: CSS columns redistributing items causing scroll reset",
        ],
      },
      {
        type: "Removed",
        items: [
          "docker-compose.prod.yml volume mounts (production isolation)",
          "Backend volume mounts in docker-compose.yml",
          "asChild prop usage on Button components",
          "ThemeProvider context dependency in Header",
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

      <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-8">
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
