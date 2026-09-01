"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Sun,
  Moon,
  Users,
  BarChart3,
  Rss,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSearch } from "@/context/SearchContext";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "./LanguageSwitcher";

const messages = {
  searchPlaceholder: "Search live insights...",
  liveUplink: "Live UPLINK",
  viewers: "viewers",
  protocolSynced: "Protocol synced",
};

function safeUseTranslations(namespace: string) {
  try {
    return useTranslations(namespace);
  } catch (e) {
    // Fallback for when context is missing (e.g. admin pages)
    return (key: string) => (messages as any)[key] || key;
  }
}

type Theme = "light" | "dark";

interface HeaderProps {
  isRefreshing: boolean;
  onRefresh?: () => void;
  showSearch?: boolean;
  isFullWidth?: boolean;
  showControls?: boolean;
  onToggleControls?: () => void;
  visitorCount?: number;
  totalViews?: number;
}

export function Header({ 
  showSearch = true,
  isFullWidth = false,
  showControls = true,
  onToggleControls,
  visitorCount,
  totalViews,
}: HeaderProps) {
  const t = safeUseTranslations('Index');
  const { searchQuery, setSearchQuery } = useSearch();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("signalstack_theme") as Theme;
    const initial = (saved && ["light", "dark"].includes(saved)) ? saved : "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial === "light" ? "light" : "");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("signalstack_theme", next);
    document.documentElement.setAttribute("data-theme", next === "light" ? "light" : "");
  };

  if (!mounted) return (
    <header className="sticky top-0 z-50 border-b border-border/10 bg-background/80 backdrop-blur-md h-11" />
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/10 bg-background/80 backdrop-blur-md h-11 transition-colors duration-500">
      <div className={cn(
        "mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-6 transition-all duration-500 ease-in-out",
        isFullWidth ? "max-w-full" : "max-w-[1400px]"
      )}>
        <Link href={`/${locale}`} className="flex items-center gap-3 shrink-0 group">
           <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20 transition-transform group-hover:scale-105 group-active:scale-95 duration-300">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12h2" />
                <path d="M6 8v8" />
                <path d="M10 4v16" />
                <path d="M14 8v8" />
                <path d="M18 6v12" />
                <path d="M22 12h0" />
              </svg>
           </div>
            <div className="flex flex-col leading-none select-none">
               <span className="text-[12px] font-black tracking-[0.35em] uppercase text-foreground">
                  SIGNAL
               </span>
               <span className="text-[12px] font-black tracking-[0.35em] uppercase bg-gradient-to-r from-violet-400 to-indigo-500 bg-clip-text text-transparent">
                  STACK
               </span>
            </div>
        </Link>

        {/* Search: Hidden on Mobile as it moves to Bottom Nav */}
        <div className="flex-1 max-w-sm hidden md:block">
            {showSearch && (
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder={t('searchPlaceholder')} 
                  value={searchQuery}
                  className="w-full bg-accent/10 border-border/10 pl-10 h-9 text-[13px] font-bold tracking-tight rounded-lg focus:ring-1 focus:ring-primary/20 transition-all font-sans"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            href={`/${locale}/trends`}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/20 border border-border/10 hover:bg-accent/40 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            aria-label="Trends"
          >
            <BarChart3 className="w-4 h-4 text-violet-400" />
          </Link>

          <a
            href="/api/feed.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-accent/20 border border-border/10 hover:bg-accent/40 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
            aria-label="RSS Feed"
          >
            <Rss className="w-4 h-4 text-orange-400" />
          </a>

          {params?.locale && <LanguageSwitcher />}

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/20 border border-border/10 hover:bg-accent/40 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.2)]" />
            )}
          </button>

          

<div className="flex items-center gap-4 border-l border-border/10 pl-4 hidden md:flex h-6">
            {/* Realtime viewers */}
            <div className="flex flex-col items-end leading-none gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                {visitorCount !== undefined && visitorCount > 0 ? (
                  <>
                    <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-black tabular-nums tracking-wide text-emerald-600 dark:text-emerald-400">{visitorCount}</span>
                  </>
                ) : (
                  <span className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-500 uppercase">{t('liveUplink')}</span>
                )}
              </div>
              <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                {t('viewers')}
              </span>
            </div>

            {/* Total views separator + stat */}
            {totalViews !== undefined && (
              <>
                <div className="w-px h-5 bg-border/20" />
                <div className="flex flex-col items-end leading-none gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-indigo-400 dark:text-indigo-400" />
                    <span className="text-[11px] font-black tabular-nums tracking-wide text-indigo-600 dark:text-indigo-400">
                      {totalViews >= 1000000
                        ? `${(totalViews / 1000000).toFixed(1)}M`
                        : totalViews >= 1000
                        ? `${(totalViews / 1000).toFixed(1)}K`
                        : totalViews}
                    </span>
                  </div>
                  <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">total views</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
