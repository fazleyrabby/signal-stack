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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <Zap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("activity24h")}</span>
          <span className="font-bold text-xl tabular-nums">
            {stats?.last24h || 0}
          </span>
        </div>
      </div>
      <div className="w-px h-8 sm:h-10 bg-border/40 hidden sm:block" />
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />
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
      <div className="hidden md:flex items-center gap-2 ml-auto">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Globe2 className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("primarySource")}</span>
          <span className="font-bold text-sm">
            {stats?.topSource || t("scanning")}
          </span>
        </div>
      </div>
    </div>
  );
}