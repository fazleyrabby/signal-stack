"use client";

import { useState, useEffect } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  LayoutGrid,
  List,
  Maximize2,
  Globe2,
  Cpu,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Users,
  BrainCircuit,
} from "lucide-react";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { Column } from "@/components/column";
import { cn, fetchVisitorStats, trackVisit, type VisitorStats } from "@/lib/utils";
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

function SignalsDashboardContent({
  showBookmarksFromQuery = false,
}: {
  showBookmarksFromQuery?: boolean;
}) {
  const { searchQuery, setSearchQuery } = useSearch();
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [mobileTab, setMobileTab] = useState<'geopolitics' | 'technology' | 'ai'>(
    () => (typeof window !== 'undefined' && localStorage.getItem('signalstack_mobile_tab') as 'geopolitics' | 'technology' | 'ai') || 'geopolitics'
  );
  const [showControls, setShowControls] = useState(false);
  
  // Section visibility states
  const [showGeopolitics, setShowGeopolitics] = useState(true);
  const [showTechnology, setShowTechnology] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const [focusedColumn, setFocusedColumn] = useState<'geopolitics' | 'technology' | 'ai' | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persistence from localStorage
  useEffect(() => {
    const savedGeo = localStorage.getItem("signalstack_show_geopolitics");
    const savedTech = localStorage.getItem("signalstack_show_technology");
    const savedAi = localStorage.getItem("signalstack_show_ai");
    
    if (savedGeo !== null) setShowGeopolitics(savedGeo === "true");
    if (savedTech !== null) setShowTechnology(savedTech === "true");
    if (savedAi !== null) setShowAi(savedAi === "true");
    
    // Check if controls were previously shown
    const savedControls = localStorage.getItem("signalstack_show_controls");
    if (savedControls !== null) setShowControls(savedControls === "true");
    
    setIsLoaded(true);
  }, []);

  // Save persistence to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("signalstack_show_geopolitics", String(showGeopolitics));
      localStorage.setItem("signalstack_show_technology", String(showTechnology));
      localStorage.setItem("signalstack_show_ai", String(showAi));
      localStorage.setItem("signalstack_show_controls", String(showControls));
    }
  }, [showGeopolitics, showTechnology, showControls, isLoaded]);

  useEffect(() => {
    localStorage.setItem('signalstack_mobile_tab', mobileTab);
  }, [mobileTab]);

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

  const stats = statsResponse || { total: 0, high: 0, low: 0, last24h: 0, topSource: 'Scanning...' };

  const toggleGeopolitics = () => {
    if (showGeopolitics && !showTechnology) return; // Prevent hiding both
    setShowGeopolitics(!showGeopolitics);
  };

  const toggleTechnology = () => {
    if (showTechnology && !showGeopolitics && !showAi) return;
    setShowTechnology(!showTechnology);
  };

  const toggleAi = () => {
    if (showAi && !showGeopolitics && !showTechnology) return;
    setShowAi(!showAi);
  };

  const handleToggleFocus = (col: 'geopolitics' | 'technology' | 'ai') => {
    setFocusedColumn(prev => prev === col ? null : col);
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      <Header
        isRefreshing={false}
        isFullWidth={isFullWidth}
        showControls={showControls}
        onToggleControls={() => setShowControls(!showControls)}
        visitorCount={visitorData?.realtime}
      />

      <div className={cn(
        "mx-auto px-3 sm:px-4 w-full pt-2 pb-16 md:pb-0 transition-all duration-500 overflow-hidden flex flex-col flex-1",
        isFullWidth ? "max-w-full" : "max-w-[1400px] 2xl:max-w-[1800px]"
      )}>
        <div className="flex flex-col h-full">

          {/* Collapsible Top Section */}
          <div className={cn(
            "flex flex-col gap-2 shrink-0 transition-all duration-300 overflow-hidden",
            showControls ? "max-h-[400px] opacity-100 mb-2" : "max-h-0 opacity-0 mb-0"
          )}>
            <StatsBar stats={stats} />

            {/* Layout + Fullscreen + Visibility Controls */}
            <div className="flex items-center justify-end gap-3 shrink-0">
              {/* Section Visibility Toggles */}
              <div className="hidden md:flex items-center gap-2 mr-auto bg-accent/10 p-1 rounded-lg border border-border/5">
                <button
                  onClick={toggleGeopolitics}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[9px] font-black tracking-widest transition-all",
                    showGeopolitics ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "text-muted-foreground opacity-40 hover:opacity-100"
                  )}
                >
                  {showGeopolitics ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  GEOPOLITICS
                </button>
                <button
                  onClick={toggleTechnology}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[9px] font-black tracking-widest transition-all",
                    showTechnology ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/20" : "text-muted-foreground opacity-40 hover:opacity-100"
                  )}
                >
                  {showTechnology ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  TECHNOLOGY
                </button>
                <button
                  onClick={toggleAi}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[9px] font-black tracking-widest transition-all",
                    showAi ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-muted-foreground opacity-40 hover:opacity-100"
                  )}
                >
                  {showAi ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  ARTIFICIAL INTELLIGENCE
                </button>
              </div>

              <div className="flex items-center bg-accent/20 rounded-lg p-0.5 border border-border/10">
                <button
                  className={cn("p-1.5 rounded-md transition-all", layoutMode === 'list' && "bg-background text-primary shadow-sm")}
                  onClick={() => setLayoutMode('list')}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  className={cn("p-1.5 rounded-md transition-all", layoutMode === 'grid' && "bg-background text-primary shadow-sm")}
                  onClick={() => setLayoutMode('grid')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Column Content */}
          <div className="flex-1 overflow-hidden">
            <div className={cn(
              "hidden md:flex gap-4 h-full transition-all duration-500 overflow-x-auto pb-2 custom-scrollbar",
              isFullWidth ? "max-w-full" : ""
            )}>
              {showGeopolitics && (
                <div className={cn(
                  "h-full transition-all duration-500 min-w-[380px]",
                  focusedColumn === 'geopolitics' ? "flex-[2.5]" : focusedColumn ? "flex-1 opacity-40 grayscale-[0.5] hover:opacity-100 hover:grayscale-0" : "flex-1"
                )}>
                  <Column
                    title="World Geopolitics"
                    icon={Globe2}
                    categoryId="geopolitics"
                    layoutMode={layoutMode}
                    searchQuery={searchQuery}
                    isFullWidth={isFullWidth || !showTechnology}
                    isFocused={focusedColumn === 'geopolitics'}
                    onToggleFocus={() => handleToggleFocus('geopolitics')}
                    initialShowBookmarks={showBookmarksFromQuery}
                  />
                </div>
              )}
              {showTechnology && (
                <div className={cn(
                  "h-full transition-all duration-500 min-w-[380px]",
                  focusedColumn === 'technology' ? "flex-[2.5]" : focusedColumn ? "flex-1 opacity-40 grayscale-[0.5] hover:opacity-100 hover:grayscale-0" : "flex-1"
                )}>
                  <Column
                    title="Technology Intelligence"
                    icon={Cpu}
                    categoryId="technology"
                    layoutMode={layoutMode}
                    searchQuery={searchQuery}
                    isFullWidth={isFullWidth || (!showGeopolitics && !showAi)}
                    isFocused={focusedColumn === 'technology'}
                    onToggleFocus={() => handleToggleFocus('technology')}
                    initialShowBookmarks={showBookmarksFromQuery}
                  />
                </div>
              )}
              {showAi && (
                <div className={cn(
                  "h-full transition-all duration-500 min-w-[380px]",
                  focusedColumn === 'ai' ? "flex-[2.5]" : focusedColumn ? "flex-1 opacity-40 grayscale-[0.5] hover:opacity-100 hover:grayscale-0" : "flex-1"
                )}>
                  <Column
                    title="Artificial Intelligence"
                    icon={BrainCircuit}
                    categoryId="ai"
                    layoutMode={layoutMode}
                    searchQuery={searchQuery}
                    isFullWidth={isFullWidth || (!showGeopolitics && !showTechnology)}
                    isFocused={focusedColumn === 'ai'}
                    onToggleFocus={() => handleToggleFocus('ai')}
                    initialShowBookmarks={showBookmarksFromQuery}
                  />
                </div>
              )}
            </div>

            <div className="md:hidden h-full flex flex-col gap-2">
              <div className="flex items-center p-1 bg-card/40 border border-border/10 rounded-xl">
                <button
                  onClick={() => setMobileTab('geopolitics')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all",
                    mobileTab === 'geopolitics'
                      ? "bg-violet-600 text-white shadow-lg"
                      : "text-muted-foreground"
                  )}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  GEOPOLITICS
                </button>
                <button
                  onClick={() => setMobileTab('technology')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all",
                    mobileTab === 'technology'
                      ? "bg-indigo-500 text-white shadow-lg"
                      : "text-muted-foreground"
                  )}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  TECHNOLOGY
                </button>
                <button
                  onClick={() => setMobileTab('ai')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all",
                    mobileTab === 'ai'
                      ? "bg-emerald-600 text-white shadow-lg"
                      : "text-muted-foreground"
                  )}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  AI
                </button>
              </div>

              <div className="flex-1 min-h-0">
                {mobileTab === 'geopolitics' && (
                  <Column
                    title="World Geopolitics"
                    icon={Globe2}
                    categoryId="geopolitics"
                    layoutMode={layoutMode}
                    searchQuery={searchQuery}
                    isFullWidth={false}
                    initialShowBookmarks={showBookmarksFromQuery}
                  />
                )}
                {mobileTab === 'technology' && (
                  <Column
                    title="Technology Intelligence"
                    icon={Cpu}
                    categoryId="technology"
                    layoutMode={layoutMode}
                    searchQuery={searchQuery}
                    isFullWidth={false}
                    initialShowBookmarks={showBookmarksFromQuery}
                  />
                )}
                {mobileTab === 'ai' && (
                  <Column
                    title="Artificial Intelligence"
                    icon={BrainCircuit}
                    categoryId="ai"
                    layoutMode={layoutMode}
                    searchQuery={searchQuery}
                    isFullWidth={false}
                    initialShowBookmarks={showBookmarksFromQuery}
                  />
                )}
              </div>
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

  return <SignalsDashboardContent showBookmarksFromQuery={showBookmarksFromQuery} />;
}

export default function SignalsDashboard() {
  return (
    <Suspense fallback={<SignalsDashboardContent showBookmarksFromQuery={false} />}>
      <SignalsDashboardWithQuery />
    </Suspense>
  );
}
