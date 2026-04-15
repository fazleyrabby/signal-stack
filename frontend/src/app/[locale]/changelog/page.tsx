"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronRight,
  Zap,
  Shield,
  Layout,
  Globe,
  Database,
  Code2,
  Bug,
  Trash2,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  version: string;
  date?: string;
  sections: {
    type: "Added" | "Changed" | "Fixed" | "Removed" | "Security";
    items: string[];
  }[];
}

const changelogData: ChangelogEntry[] = [
  {
    version: "Unreleased",
    sections: [
      {
        type: "Fixed",
        items: [
          "Frontend: Resolved SyntaxError in next.config.mjs by removing TypeScript type annotations from JavaScript file.",
          "Frontend: Fixed dependency resolution tree conflicts between Next.js 16, React 19, and react-simple-maps using legacy-peer-deps.",
          "Frontend: Resolved hydration mismatch in SignalsDashboard by moving localStorage-based state initialization to useEffect.",
          "Frontend: Fixed GeoHeatmap tooltip positioning by switching from absolute to fixed coordinates for viewport-relative tracking.",
          "Frontend: Refactored Column component imports and structure for improved maintainability.",
          "Documentation: Updated STUDY_GUIDE.md and DOCS.md to reflect latest architecture and deployment workflows."
        ]
      },
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
          "STUDY_GUIDE.md: expanded into full study guide with code examples",
          ],      },
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
        ],
      },
    ],
  },
];

const typeIcons = {
  Added: <Zap className="w-4 h-4 text-emerald-400" />,
  Changed: <RefreshCw className="w-4 h-4 text-violet-400" />,
  Fixed: <Bug className="w-4 h-4 text-amber-400" />,
  Removed: <Trash2 className="w-4 h-4 text-red-400" />,
  Security: <Shield className="w-4 h-4 text-cyan-400" />,
};

const typeColors = {
  Added: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Changed: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Fixed: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Removed: "bg-red-500/10 text-red-400 border-red-500/20",
  Security: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30">
               <Clock className="w-6 h-6 text-violet-400" />
             </div>
             <h1 className="text-3xl font-black tracking-tight uppercase">
               System <span className="text-violet-500">Changelog</span>
             </h1>
          </div>
          <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-2xl">
            Protocol updates, architectural shifts, and intelligence pipeline refinements.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-16 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-border/20">
          {changelogData.map((entry, idx) => (
            <div key={entry.version} className="relative pl-12 group">
              {/* Dot */}
              <div className={cn(
                "absolute left-0 top-1 w-9 h-9 rounded-full border-4 border-background flex items-center justify-center transition-all duration-500",
                idx === 0 ? "bg-violet-600 shadow-[0_0_15px_rgba(124,58,237,0.4)]" : "bg-muted border-border/20"
              )}>
                {idx === 0 ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Circle className="w-3 h-3 text-muted-foreground" />}
              </div>

              <div className="space-y-8">
                {/* Version Title */}
                <div className="flex flex-col gap-1">
                  <h2 className={cn(
                    "text-xl font-black tracking-tight uppercase",
                    idx === 0 ? "text-violet-400" : "text-foreground/80"
                  )}>
                    {entry.version}
                  </h2>
                  {entry.date && (
                    <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                      Released: {entry.date}
                    </span>
                  )}
                </div>

                {/* Sections */}
                <div className="grid gap-6">
                  {entry.sections.map((section) => (
                    <Card key={section.type} className="bg-card/30 border-border/10 overflow-hidden backdrop-blur-sm group-hover:bg-card/50 transition-colors">
                      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            {typeIcons[section.type]}
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              typeColors[section.type].split(' ')[1]
                            )}>
                              {section.type}
                            </span>
                         </div>
                         <Badge variant="outline" className={cn("text-[9px] font-bold tracking-tighter uppercase", typeColors[section.type])}>
                           {section.items.length} {section.items.length === 1 ? 'change' : 'changes'}
                         </Badge>
                      </div>
                      <ul className="p-4 space-y-3">
                        {section.items.map((item, i) => (
                          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-muted-foreground group/item">
                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-500/40 group-hover/item:text-violet-500 transition-colors" />
                            <span className="group-hover/item:text-foreground transition-colors">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="pt-12 border-t border-border/10 text-center">
          <p className="text-xs font-mono text-muted-foreground/40 uppercase tracking-[0.3em]">
            End of Record // Protocol Stable
          </p>
        </div>
      </div>
    </div>
  );
}
