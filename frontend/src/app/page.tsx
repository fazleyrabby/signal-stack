"use client";

import { useState } from "react";
import useSWR from "swr";
import { Header } from "@/components/header";
import { SignalCard } from "@/components/signal-card";
import { FeedSkeleton } from "@/components/signal-skeleton";
import { StatsBar } from "@/components/stats-bar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio, SearchX, Globe2, Cpu, ChevronDown, Loader2, LayoutGrid, List, Maximize2, Minimize2, Activity } from "lucide-react";
import type { SignalsResponse, SignalStats } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Column({ 
  title, 
  icon: Icon, 
  categoryId, 
  params, 
  layoutMode 
}: { 
  title: string; 
  icon: any; 
  categoryId: string, 
  params: { severity: string, search: string },
  layoutMode: 'grid' | 'list'
}) {
  const [limit, setLimit] = useState(30);
  
  const {
    data: signalsData,
    error: signalsError,
    isLoading: signalsLoading,
    isValidating,
  } = useSWR<SignalsResponse>(
    `${API_BASE}/api/signals?limit=${limit}&categoryId=${categoryId}&severity=${params.severity === 'all' ? '' : params.severity}&search=${params.search || ''}&sort=created_at&order=desc`,
    fetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const signals = signalsData?.data || [];
  const hasSignals = signals.length > 0;
  const totalAvailable = signalsData?.meta?.total || 0;
  const hasMore = totalAvailable > signals.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] opacity-80">
            {title}
          </h2>
        </div>
        {signalsData?.meta && (
          <div className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-muted/30 border border-border/20 text-muted-foreground">
            {signals.length} / {totalAvailable}
          </div>
        )}
      </div>

      <div className="flex-1 bg-card/30 border border-border/50 rounded-xl overflow-hidden backdrop-blur-sm">
        {signalsLoading && signals.length === 0 && <div className="p-4"><FeedSkeleton /></div>}

        {signalsError && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6">
            <Radio className="w-8 h-8 text-red-400 mb-2 opacity-50" />
            <p className="text-xs text-muted-foreground">Node sync failure</p>
          </div>
        )}

        {!signalsLoading && !signalsError && !hasSignals && (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 text-muted-foreground">
            <SearchX className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs italic">Awaiting node transmission...</p>
          </div>
        )}

        {hasSignals && (
          <ScrollArea className="h-full">
            <div className={layoutMode === 'grid' ? "grid grid-cols-1 xl:grid-cols-2 gap-px bg-border/20" : "flex flex-col"}>
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} isCompact={layoutMode === 'list'} />
              ))}
              
              {hasMore && (
                <div className="col-span-full pt-4 pb-8 px-4">
                  <Button 
                    variant="ghost" 
                    className="w-full h-11 border-dashed border-border border-2 hover:bg-primary/5 hover:border-primary/50 group transition-all"
                    onClick={() => setLimit(prev => prev + 20)}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 mr-2 group-hover:translate-y-1 transition-transform" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      SYNC MORE DATA
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [mobileCategory, setMobileCategory] = useState<string>("geopolitics");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isWidescreen, setIsWidescreen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('list');

  const { data: statsData } = useSWR<SignalStats>(
    `${API_BASE}/api/signals/stats`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
    }
  );

  return (
    <div className={`flex flex-col min-h-screen bg-slate-950/40 selection:bg-violet-500/30 selection:text-white`}>
      <Header isLive={true} onRefresh={() => {}} isRefreshing={false} />

      <main className="flex-1 overflow-x-hidden pb-16">
        <div className={`${isWidescreen ? 'max-w-full px-6' : 'max-w-[1400px] mx-auto px-4'} py-4 space-y-4 transition-all duration-500`}>
          <StatsBar stats={statsData} />

          {/* Intelligence Switcher (Prominent Tabs on Mobile) */}
          <div className="flex md:hidden items-center p-1.5 bg-card/60 border border-border/50 rounded-2xl shadow-xl backdrop-blur-md">
            <button
              onClick={() => setMobileCategory("geopolitics")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                mobileCategory === "geopolitics"
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              WORLD AFFAIRS
            </button>
            <button
              onClick={() => setMobileCategory("technology")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                mobileCategory === "technology"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              TECH HUB
            </button>
          </div>

          {/* Master Control Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-2.5 bg-card/10 border border-border/20 rounded-2xl backdrop-blur-md relative z-30 shadow-2xl">
            {/* Search Hub */}
            <div className="relative w-full lg:w-[400px] group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <SearchX className="h-4 w-4 text-muted-foreground/30 group-focus-within:text-violet-400 transition-colors" />
              </div>
              <Input
                placeholder="PROBE WORLD INTELLIGENCE..."
                className="pl-10 h-10 bg-background/30 border-border/40 text-xs font-bold tracking-wider rounded-xl focus-visible:ring-violet-500/20 focus-visible:border-violet-500/50 transition-all placeholder:text-[9px] placeholder:font-black placeholder:uppercase placeholder:tracking-[0.2em] placeholder:opacity-30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* Severity Quick Toggles */}
              <div className="flex items-center gap-1 p-1 bg-background/40 rounded-xl border border-border/30">
                {['all', 'high', 'medium', 'low'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      severityFilter === sev
                        ? sev === 'high' ? "bg-red-500 text-white shadow-lg shadow-red-500/30" :
                          sev === 'medium' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30" :
                          sev === 'low' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" :
                          "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Layout Control Group */}
              <div className="flex items-center gap-1 p-1 bg-background/40 rounded-xl border border-border/30">
                 <button
                  onClick={() => setIsWidescreen(!isWidescreen)}
                  className={`p-2 rounded-lg transition-all ${isWidescreen ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground/40 hover:bg-muted/50"}`}
                >
                  {isWidescreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <Separator orientation="vertical" className="h-4 mx-1 opacity-20" />
                <button
                  onClick={() => setLayoutMode('list')}
                  className={`p-2 rounded-lg transition-all ${layoutMode === 'list' ? "bg-violet-500/20 text-violet-400 shadow-xl" : "text-muted-foreground/40 hover:bg-muted/50"}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`p-2 rounded-lg transition-all ${layoutMode === 'grid' ? "bg-violet-500/20 text-violet-400 shadow-xl" : "text-muted-foreground/40 hover:bg-muted/50"}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Intelligence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start min-h-[600px]">
            {/* Column 1 (Geopolitics) - Hidden on mobile if tech is selected */}
            <div className={`${mobileCategory !== "geopolitics" ? "hidden md:block" : "block"} h-full`}>
               <Column 
                title="World Geopolitics" 
                icon={Globe2} 
                categoryId="geopolitics" 
                params={{ severity: severityFilter, search: searchQuery }}
                layoutMode={layoutMode}
              />
            </div>

            {/* Column 2 (Technology) - Hidden on mobile if geopolitics is selected */}
            <div className={`${mobileCategory !== "technology" ? "hidden md:block" : "block"} h-full`}>
              <Column 
                title="Technology Intelligence" 
                icon={Cpu} 
                categoryId="technology" 
                params={{ severity: severityFilter, search: searchQuery }}
                layoutMode={layoutMode}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/10 bg-slate-950/90 backdrop-blur-3xl py-4">
        <div className="max-w-[1400px] mx-auto px-6 text-center sm:text-left">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                 <div className="flex items-center gap-2 text-violet-500/80 font-black text-[10px] tracking-[0.2em]">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    SIGNALSTACK TERMINAL
                 </div>
                 <div className="hidden sm:block h-3 w-px bg-border/20" />
                 <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                    Active Uplink: <span className={mobileCategory === 'geopolitics' ? 'text-violet-400' : 'text-blue-400'}>
                       {mobileCategory === 'geopolitics' ? 'World Intelligence' : 'Technology Hub'}
                    </span>
                 </div>
              </div>

              <div className="flex items-center gap-3">
                 <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-border/20 bg-background/50`}>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${mobileCategory === 'geopolitics' ? 'bg-violet-500' : 'bg-blue-500'}`} />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                       {mobileCategory.toUpperCase()}_TRANSMISSION_LIVE
                    </span>
                 </div>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
}
