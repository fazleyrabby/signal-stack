"use client";

import { cn } from "@/lib/utils";
import { 
  Signal, 
  AlertTriangle, 
  Zap, 
  Globe2 
} from "lucide-react";

interface StatsBarProps {
  stats?: {
    total: number;
    high: number;
    low: number;
    last24h: number;
    topSource: string;
  };
}

export function StatsBar({ stats }: StatsBarProps) {
  const statsItems = [
    { label: "Total Signals", value: stats?.total || 0, icon: Signal, color: "text-blue-500" },
    { label: "Critical Alerts", value: stats?.high || 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "24h Activity", value: stats?.last24h || 0, icon: Zap, color: "text-emerald-500" },
    { label: "Primary Source", value: stats?.topSource || "Scanning...", icon: Globe2, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {statsItems.map((item, idx) => (
        <div key={idx} className={cn(
          "p-2.5 rounded-md border border-border/30 shadow-sm transition-all duration-300",
          "bg-card/30 hover:bg-[var(--card-hover)]"
        )}>
          <div className="flex items-center justify-between">
             <div className="flex flex-col gap-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {item.label}
                </span>
                <span className="text-md md:text-lg font-black tracking-tight tabular-nums text-foreground leading-none">
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
             </div>
             <item.icon className={cn("w-3.5 h-3.5 opacity-30", item.color)} />
          </div>
        </div>
      ))}
    </div>
  );
}
