"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  LayoutGrid,
  List,
  RefreshCw,
  Globe2,
  Cpu,
  Maximize2,
  ChevronDown,
} from "lucide-react";
import { SignalCard } from "@/components/signal-card";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/api";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/signals`;
const fetcher = (url: string) => fetch(url).then(res => res.json());

const PAGE_SIZE = 20;

interface StatsData {
  total: number;
  high: number;
  medium: number;
  low: number;
  last24h: number;
  topSource: string;
}

interface SignalsResponse {
  data: Signal[];
  meta: any;
}

function Column({ 
  title, 
  icon: Icon, 
  categoryId, 
  layoutMode,
  searchQuery,
  filter,
  isFullWidth,
}: { 
  title: string; 
  icon: any; 
  categoryId: string;
  layoutMode: 'grid' | 'list';
  searchQuery: string;
  filter: string;
  isFullWidth: boolean;
}) {
  const [page, setPage] = useState(1);

  const { data: response, isLoading, isValidating } = useSWR<SignalsResponse>(
    `${API_BASE}?limit=${PAGE_SIZE * page}&categoryId=${categoryId}&sort=created_at&order=desc`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const signals = response?.data ?? [];
  const hasMore = signals.length === PAGE_SIZE * page;

  const filtered = useMemo(() => {
    let result = signals;
    if (filter !== 'all') {
      result = result.filter(s => {
        const sev = s.severity?.toLowerCase() || 'low';
        if (filter === 'high') return sev === 'high' || s.score >= 8;
        if (filter === 'medium') return sev === 'medium' || (s.score >= 5 && s.score < 8);
        return sev === 'low' || s.score < 5;
      });
    }
    if (searchQuery) {
      result = result.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.source.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [signals, filter, searchQuery]);

  const hasSignals = filtered.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3 px-1 shrink-0">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
          {title}
        </h2>
        <span className="text-[9px] font-mono text-muted-foreground/30 ml-auto tabular-nums bg-accent/20 px-2 py-0.5 rounded-full">
           {isLoading ? '--' : filtered.length} / {isLoading ? '--' : signals.length}
        </span>
      </div>

      <div className="flex-1 bg-card/25 border border-border/10 rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-500 flex flex-col">
        {isLoading && signals.length === 0 && (
          <div className="flex items-center justify-center py-24 opacity-30">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && !hasSignals && (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-30 uppercase-none">
            <RefreshCw className="w-8 h-8 mb-3 text-muted-foreground" />
            <span className="text-[9px] font-black tracking-widest uppercase italic">Awaiting local uplink...</span>
          </div>
        )}

        {hasSignals && (
          <div className="flex-1 overflow-y-auto">
            <div className={cn(
              "p-3 pr-4",
              layoutMode === 'grid'
                ? isFullWidth
                  ? "columns-1 sm:columns-2 xl:columns-3 2xl:columns-4 gap-4"
                  : "columns-1 sm:columns-2 xl:columns-3 gap-4"
                : "flex flex-col space-y-3"
            )}>
              {filtered.map((signal) => (
                <div key={signal.id} className="break-inside-avoid mb-4">
                  <SignalCard signal={signal} isCompact={layoutMode === 'list'} />
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isValidating}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary bg-accent/20 hover:bg-accent/40 border border-border/10 rounded-lg transition-all disabled:opacity-40"
                >
                  {isValidating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {isValidating ? "Loading..." : "Load More"}
                </button>
              </div>
            )}

            {!hasMore && signals.length > 0 && (
              <div className="text-center py-4 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest">
                All signals loaded
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignalsDashboard() {
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [mobileTab, setMobileTab] = useState<'geopolitics' | 'technology'>('geopolitics');

  const { data: statsResponse } = useSWR<StatsData>(
    `${API_BASE}/stats`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const stats = statsResponse || { total: 0, high: 0, low: 0, last24h: 0, topSource: 'Scanning...' };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      <Header 
        isRefreshing={false}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isFullWidth={isFullWidth}
      />

      <div className={cn(
        "mx-auto px-4 sm:px-6 w-full py-4 transition-all duration-500 overflow-hidden flex flex-col flex-1",
        isFullWidth ? "max-w-full" : "max-w-[1400px] 2xl:max-w-[1800px]"
      )}>
        <div className="flex flex-col gap-4 h-full">
          <StatsBar stats={stats} />

          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden items-center p-1 bg-card/40 border border-border/10 rounded-xl">
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
          </div>

          {/* Control Bar */}
          <div className="flex items-center justify-between bg-card/10 backdrop-blur-sm p-1.5 rounded-lg border border-border/5 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {['all', 'high', 'medium', 'low'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "h-7 px-3 text-[10px] font-black uppercase tracking-widest rounded-md transition-all whitespace-nowrap px-4",
                    filter === f ? "bg-primary text-primary-foreground shadow-md" : "opacity-40 hover:opacity-100 hover:bg-accent/10"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
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
              <button 
                className={cn(
                   "flex items-center justify-center h-8 w-8 bg-accent/20 border border-border/10 rounded-lg hover:bg-accent/40 transition-all",
                   isFullWidth && "bg-primary/20 border-primary/20 text-primary shadow-[0_0_15px_-5px_rgba(var(--primary),0.3)]"
                )}
                onClick={() => setIsFullWidth(!isFullWidth)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="hidden md:grid grid-cols-2 gap-6 h-full">
              <Column 
                title="World Geopolitics" 
                icon={Globe2} 
                categoryId="geopolitics"
                layoutMode={layoutMode}
                searchQuery={searchQuery}
                filter={filter}
                isFullWidth={isFullWidth}
              />
              <Column 
                title="Technology Intelligence" 
                icon={Cpu} 
                categoryId="technology"
                layoutMode={layoutMode}
                searchQuery={searchQuery}
                filter={filter}
                isFullWidth={isFullWidth}
              />
            </div>

            <div className="md:hidden h-full">
              {mobileTab === 'geopolitics' ? (
                <Column 
                  title="World Geopolitics" 
                  icon={Globe2} 
                  categoryId="geopolitics"
                  layoutMode={layoutMode}
                  searchQuery={searchQuery}
                  filter={filter}
                  isFullWidth={false}
                />
              ) : (
                <Column 
                  title="Technology Intelligence" 
                  icon={Cpu} 
                  categoryId="technology"
                  layoutMode={layoutMode}
                  searchQuery={searchQuery}
                  filter={filter}
                  isFullWidth={false}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
