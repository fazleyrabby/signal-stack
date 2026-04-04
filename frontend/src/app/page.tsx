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
import { Radio, SearchX, Globe2, Cpu, ChevronDown, Loader2 } from "lucide-react";
import type { SignalsResponse, SignalStats } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Column({ title, icon: Icon, categoryId }: { title: string; icon: any; categoryId: string }) {
  const [limit, setLimit] = useState(30);
  
  const {
    data: signalsData,
    error: signalsError,
    isLoading: signalsLoading,
    isValidating,
  } = useSWR<SignalsResponse>(
    `${API_BASE}/api/signals?limit=${limit}&categoryId=${categoryId}&sort=created_at&order=desc`,
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            {title}
          </h2>
        </div>
        {signalsData?.meta && (
          <Badge variant="outline" className="text-[10px] font-mono opacity-70">
            {signals.length} / {totalAvailable}
          </Badge>
        )}
      </div>

      <div className="flex-1 bg-card/30 border border-border/50 rounded-xl overflow-hidden backdrop-blur-sm">
        {signalsLoading && signals.length === 0 && <div className="p-4"><FeedSkeleton /></div>}

        {signalsError && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Radio className="w-8 h-8 text-red-400 mb-2 opacity-50" />
            <p className="text-xs text-muted-foreground">Source unreachable</p>
          </div>
        )}

        {!signalsLoading && !signalsError && !hasSignals && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <SearchX className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs italic">Awaiting first signal...</p>
          </div>
        )}

        {hasSignals && (
          <ScrollArea className="h-full max-h-[700px] md:max-h-none">
            <div className="p-3 space-y-3">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
              
              {hasMore && (
                <div className="pt-2 pb-4 px-2">
                  <Button 
                    variant="ghost" 
                    className="w-full h-12 border-dashed border-border border-2 hover:bg-primary/5 hover:border-primary/50 group transition-all"
                    onClick={() => setLimit(prev => prev + 20)}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 mr-2 group-hover:translate-y-1 transition-transform" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Load More Signals
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

  const { data: statsData } = useSWR<SignalStats>(
    `${API_BASE}/api/signals/stats`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
    }
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-950/20">
      <Header isLive={true} onRefresh={() => {}} isRefreshing={false} />

      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
          <StatsBar stats={statsData} />

          <Separator className="opacity-20" />

          {/* Mobile Filter Buttons */}
          <div className="flex md:hidden items-center justify-center gap-2 p-1 bg-card/50 border border-border/50 rounded-xl mb-4">
            <button
              onClick={() => setMobileCategory("geopolitics")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                mobileCategory === "geopolitics"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              WORLD
            </button>
            <button
              onClick={() => setMobileCategory("technology")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                mobileCategory === "technology"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              TECH
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start min-h-[500px]">
            {/* Column 1 (Geopolitics) - Hidden on mobile if tech is selected */}
            <div className={`${mobileCategory !== "geopolitics" ? "hidden md:block" : "block"} h-full`}>
               <Column 
                title="World Geopolitics" 
                icon={Globe2} 
                categoryId="geopolitics" 
              />
            </div>

            {/* Column 2 (Technology) - Hidden on mobile if geopolitics is selected */}
            <div className={`${mobileCategory !== "technology" ? "hidden md:block" : "block"} h-full`}>
              <Column 
                title="Technology Intelligence" 
                icon={Cpu} 
                categoryId="technology" 
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/20 py-4 bg-background/50 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
          <div className="flex items-center gap-4">
            <span>SignalStack Next-Gen</span>
            <span className="opacity-30">|</span>
            <span>Real-time Ingestion</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>NRT Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
