"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  LayoutGrid,
  List,
  Maximize2,
  Globe2,
  Cpu,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { Column } from "@/components/column";
import { cn } from "@/lib/utils";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/signals`;
const fetcher = (url: string) => fetch(url).then(res => res.json());

interface StatsData {
  total: number;
  high: number;
  medium: number;
  low: number;
  last24h: number;
  topSource: string;
}

export default function SignalsDashboard() {
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [mobileTab, setMobileTab] = useState<'geopolitics' | 'technology'>('geopolitics');
  const [showControls, setShowControls] = useState(true);

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
        <div className="flex flex-col h-full">

          {/* Collapsible Top Section */}
          <div className={cn(
            "flex flex-col gap-3 shrink-0 transition-all duration-300 overflow-hidden",
            showControls ? "max-h-[400px] opacity-100 mb-3" : "max-h-0 opacity-0 mb-0"
          )}>
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

            {/* Layout + Fullscreen Controls */}
            <div className="flex items-center justify-end gap-2 shrink-0">
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

          {/* Toggle Bar */}
          <button
            onClick={() => setShowControls(!showControls)}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full h-7 shrink-0 rounded-md border border-border/10 bg-card/20 hover:bg-card/40 transition-all duration-300 mb-2",
              !showControls && "mb-2"
            )}
          >
            <BarChart3 className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              {showControls ? 'Hide Controls' : 'Show Controls'}
            </span>
            {showControls ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground/50" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
            )}
          </button>

          {/* Column Content */}
          <div className="flex-1 overflow-hidden">
            <div className="hidden md:grid grid-cols-2 gap-6 h-full">
              <Column
                title="World Geopolitics"
                icon={Globe2}
                categoryId="geopolitics"
                layoutMode={layoutMode}
                searchQuery={searchQuery}
                isFullWidth={isFullWidth}
              />
              <Column
                title="Technology Intelligence"
                icon={Cpu}
                categoryId="technology"
                layoutMode={layoutMode}
                searchQuery={searchQuery}
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
                  isFullWidth={false}
                />
              ) : (
                <Column
                  title="Technology Intelligence"
                  icon={Cpu}
                  categoryId="technology"
                  layoutMode={layoutMode}
                  searchQuery={searchQuery}
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