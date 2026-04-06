"use client";

import { useState, useEffect } from "react";
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
  Eye,
  EyeOff,
} from "lucide-react";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { Column } from "@/components/column";
import { cn } from "@/lib/utils";

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

export default function SignalsDashboard() {
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [mobileTab, setMobileTab] = useState<'geopolitics' | 'technology'>('geopolitics');
  const [showControls, setShowControls] = useState(true);
  
  // Section visibility states
  const [showGeopolitics, setShowGeopolitics] = useState(true);
  const [showTechnology, setShowTechnology] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persistence from localStorage
  useEffect(() => {
    const savedGeo = localStorage.getItem("signalstack_show_geopolitics");
    const savedTech = localStorage.getItem("signalstack_show_technology");
    
    if (savedGeo !== null) setShowGeopolitics(savedGeo === "true");
    if (savedTech !== null) setShowTechnology(savedTech === "true");
    
    setIsLoaded(true);
  }, []);

  // Save persistence to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("signalstack_show_geopolitics", String(showGeopolitics));
      localStorage.setItem("signalstack_show_technology", String(showTechnology));
    }
  }, [showGeopolitics, showTechnology, isLoaded]);

  const { data: statsResponse } = useSWR<StatsData>(
    `${API_BASE}/stats`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const stats = statsResponse || { total: 0, high: 0, low: 0, last24h: 0, topSource: 'Scanning...' };

  const toggleGeopolitics = () => {
    if (showGeopolitics && !showTechnology) return; // Prevent hiding both
    setShowGeopolitics(!showGeopolitics);
  };

  const toggleTechnology = () => {
    if (showTechnology && !showGeopolitics) return; // Prevent hiding both
    setShowTechnology(!showTechnology);
  };

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
            <div className={cn(
              "hidden md:grid gap-6 h-full transition-all duration-500",
              showGeopolitics && showTechnology ? "grid-cols-2" : "grid-cols-1"
            )}>
              {showGeopolitics && (
                <Column
                  title="World Geopolitics"
                  icon={Globe2}
                  categoryId="geopolitics"
                  layoutMode={layoutMode}
                  searchQuery={searchQuery}
                  isFullWidth={isFullWidth || !showTechnology}
                />
              )}
              {showTechnology && (
                <Column
                  title="Technology Intelligence"
                  icon={Cpu}
                  categoryId="technology"
                  layoutMode={layoutMode}
                  searchQuery={searchQuery}
                  isFullWidth={isFullWidth || !showGeopolitics}
                />
              )}
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