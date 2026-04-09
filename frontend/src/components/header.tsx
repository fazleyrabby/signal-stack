"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Theme = "light" | "dark";

interface HeaderProps {
  isRefreshing: boolean;
  onRefresh?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  isFullWidth?: boolean;
  showControls?: boolean;
  onToggleControls?: () => void;
  visitorCount?: number;
}

export function Header({ 
  isRefreshing, 
  onRefresh, 
  searchQuery, 
  onSearchChange, 
  showSearch = true,
  isFullWidth = false,
  showControls = true,
  onToggleControls,
  visitorCount
}: HeaderProps) {
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

  return (
    <header className="sticky top-0 z-50 border-b border-border/10 bg-background/80 backdrop-blur-md h-13 transition-colors duration-500">
      <div className={cn(
        "mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-6 transition-all duration-500 ease-in-out",
        isFullWidth ? "max-w-full" : "max-w-[1400px]"
      )}>
        {/* 1. Branding: Adaptive Identity */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
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

        <div className="flex-1 max-w-sm hidden lg:block">
           {showSearch && (
             <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
               <Input 
                 placeholder="Search live insights..." 
                 value={searchQuery}
                 className="w-full bg-accent/10 border-border/10 pl-10 h-9 text-[13px] font-bold tracking-tight rounded-xl focus:ring-1 focus:ring-primary/20 transition-all font-sans"
                 onChange={(e) => onSearchChange?.(e.target.value)}
               />
             </div>
           )}
        </div>

        {/* 2. Tactical Display Selector */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/20 border border-border/10 hover:bg-accent/40 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.2)]" />
            )}
          </button>

          {onToggleControls && (
            <button
              onClick={onToggleControls}
              className="flex items-center gap-2 px-3 h-9 rounded-xl bg-accent/20 border border-border/10 hover:bg-accent/40 transition-all duration-300 shadow-sm"
              title={showControls ? "Hide controls" : "Show controls"}
            >
              <span className="text-[10px] font-bold tracking-wide text-muted-foreground">
                {showControls ? "Hide" : "Show"}
              </span>
              {showControls ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}

          <div className="flex items-center gap-4 border-l border-border/10 pl-4 hidden md:flex h-6">
             <div className="flex flex-col items-end leading-none">
                <div className="flex items-center gap-2">
                   {visitorCount !== undefined && visitorCount > 0 ? (
                     <>
                       <Users className="w-3 h-3 text-emerald-500" />
                       <span className="text-[10px] font-black tracking-widest text-emerald-500">{visitorCount}</span>
                     </>
                   ) : (
                     <>
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]" />
                       <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase">Live UPLINK</span>
                     </>
                   )}
                </div>
                <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest mt-1">
                  {visitorCount !== undefined ? "viewers" : "Protocol synced"}
                </span>
             </div>
          </div>
        </div>
      </div>
    </header>
  );
}
