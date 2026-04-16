"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { 
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
  const t = useTranslations('Index');
  
  return (
    <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20 dark:bg-emerald-900/30 ring-1 ring-emerald-500/20 dark:ring-0">
          <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("activity24h")}</span>
          <span className="font-bold text-xl tabular-nums">
            {stats?.last24h || 0}
          </span>
        </div>
      </div>
      <div className="w-px h-8 bg-border/40 shrink-0" />
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/20 dark:bg-red-900/30 ring-1 ring-red-500/20 dark:ring-0">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("criticalAlerts")}</span>
          <span className={cn(
            "font-bold text-xl tabular-nums",
            (stats?.high || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
          )}>
            {stats?.high || 0}
          </span>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
        <div className="w-px h-8 bg-border/40" />
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 dark:bg-amber-900/30 ring-1 ring-amber-500/20 dark:ring-0">
            <Globe2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("primarySource")}</span>
            <span className="font-bold text-sm">
              {stats?.topSource || t("scanning")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}