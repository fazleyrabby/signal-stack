"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import {
  LayoutGrid,
  List,
  Globe2,
  Cpu,
  Eye,
  EyeOff,
  BrainCircuit,
} from "lucide-react";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { SignalColumn } from "@/components/SignalColumn";
import { cn, trackVisit, type VisitorStats } from "@/lib/utils";
import { useSearch } from "@/context/SearchContext";

const API_BASE = '/api/signals';
const fetcher = (url: string) => fetch(url).then(res => res.json());

interface StatsData {
  total: number;
  high: number;
  medium: number;
  low: number;
  last24h: number;
  topSource: string;
}

const CATEGORIES = [
  { id: 'geopolitics', icon: Globe2, color: 'violet' },
  { id: 'technology', icon: Cpu, color: 'indigo' },
  { id: 'ai', icon: BrainCircuit, color: 'emerald' },
] as const;

function SignalsDashboardContent({
  showBookmarksFromQuery = false,
  countryFromQuery = null,
}: {
  showBookmarksFromQuery?: boolean;
  countryFromQuery?: string | null;
}) {
  const t = useTranslations('Index');
  const { searchQuery, setSearchQuery } = useSearch();
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'geopolitics' | 'technology' | 'ai'>('geopolitics');
  const [showControls, setShowControls] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedTab = localStorage.getItem('signalstack_active_tab') as 'geopolitics' | 'technology' | 'ai';
    const savedControls = localStorage.getItem("signalstack_show_controls");
    
    if (savedTab && ['geopolitics', 'technology', 'ai'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
    if (savedControls !== null) setShowControls(savedControls === "true");
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('signalstack_active_tab', activeTab);
      localStorage.setItem("signalstack_show_controls", String(showControls));
    }
  }, [activeTab, showControls, isLoaded]);

  const { data: statsResponse } = useSWR<StatsData>(
    `${API_BASE}/stats`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: visitorData } = useSWR<VisitorStats>(
    '/api/visitors/stats',
    fetcher,
    { refreshInterval: 60000 }
  );

  useEffect(() => {
    trackVisit();
  }, []);

  useEffect(() => {
    if (countryFromQuery) {
      setActiveTab('geopolitics');
    }
  }, [countryFromQuery]);

  const stats = useMemo(() => statsResponse || { total: 0, high: 0, low: 0, last24h: 0, topSource: 'Scanning...' }, [statsResponse]);

  const currentCategory = CATEGORIES.find(c => c.id === activeTab);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      <Header
        isRefreshing={false}
        isFullWidth={false}
        visitorCount={visitorData?.realtime}
      />

      <div className="flex-1 w-full flex flex-col overflow-hidden px-3 sm:px-6 pt-1 pb-4">
        <div className="w-[95%] mx-auto flex flex-col h-full gap-2">

          {/* Stats & Tabs Row - Desktop in one line, mobile stacked */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2 px-3 rounded-lg bg-muted/20 dark:bg-muted/20 border border-border/10 w-full">
            <div className="flex items-center gap-4">
              <StatsBar stats={stats} />
            </div>
            <div className="flex items-center md:gap-1 mt-2 md:mt-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                    activeTab === cat.id 
                      ? cat.color === 'violet' ? "bg-violet-500/20 dark:bg-violet-600/20 text-violet-700 dark:text-violet-400 border border-violet-500/30 dark:border-violet-500/20" 
                      : cat.color === 'indigo' ? "bg-indigo-500/20 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 dark:border-indigo-500/20"
                      : "bg-emerald-500/20 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 dark:border-emerald-500/20"
                      : "text-muted-foreground dark:text-muted-foreground/70 hover:text-foreground dark:hover:text-foreground border border-transparent"
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  {t(`${cat.id}Tab`)}
                </button>
              ))}
            </div>
          </div>

          {/* Single Active Column */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full">
              <SignalColumn
                title={currentCategory ? t(`${currentCategory.id}Title`) : ''}
                icon={currentCategory?.icon || Globe2}
                categoryId={activeTab}
                layoutMode={layoutMode}
                searchQuery={searchQuery}
                isFullWidth={true}
                initialShowBookmarks={showBookmarksFromQuery}
                initialCountry={countryFromQuery || undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalsDashboardWithQuery() {
  const searchParams = useSearchParams();
  const showBookmarksFromQuery = searchParams.get("bookmarks") === "true";
  const countryFromQuery = searchParams.get("country");

  return <SignalsDashboardContent showBookmarksFromQuery={showBookmarksFromQuery} countryFromQuery={countryFromQuery} />;
}

export default function SignalsDashboard() {
  return (
    <Suspense fallback={<SignalsDashboardContent showBookmarksFromQuery={false} />}>
      <SignalsDashboardWithQuery />
    </Suspense>
  );
}