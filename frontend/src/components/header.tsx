"use client";

import { Radio, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export function Header({
  isLive,
  onRefresh,
  isRefreshing,
}: {
  isLive: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              Signal<span className="text-violet-400">Stack</span>
            </h1>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground mr-2">
            <span
              className={`relative flex h-2 w-2 ${isLive ? "" : "opacity-50"}`}
            >
              {isLive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLive ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
              />
            </span>
            <span className={isLive ? "text-emerald-500/80" : ""}>{isLive ? "Systems Live" : "Offline"}</span>
          </div>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 hover:bg-muted/50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block opacity-20" />

          {/* Admin link */}
          <Link href="/admin">
            <Button variant="outline" size="sm" className="h-8 gap-2 border-violet-500/30 hover:bg-violet-500/10 hover:border-violet-500 transition-all font-bold text-[10px] uppercase tracking-wider">
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Panel</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
