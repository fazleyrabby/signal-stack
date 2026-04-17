"use client";

import { cn } from "@/lib/utils";
import {
  Sparkles,
  ChevronRight,
  Cpu,
  Zap,
  Globe,
  Bookmark,
  Link2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/api";

interface SignalCardProps {
  signal: Signal;
  isCompact: boolean;
  className?: string;
  isBookmarked?: boolean;
  isBookmarking?: boolean;
  onToggleBookmark?: (signalId: string) => Promise<void> | undefined;
}

const getImpactColor = (score: number) => {
  if (score >= 9) return { bg: "bg-red-500", text: "text-red-400", ring: "ring-red-500/20", label: "critical" };
  if (score >= 7) return { bg: "bg-orange-500", text: "text-orange-400", ring: "ring-orange-500/20", label: "high" };
  if (score >= 5) return { bg: "bg-amber-500", text: "text-amber-400", ring: "ring-amber-500/20", label: "medium" };
  return { bg: "bg-emerald-500", text: "text-emerald-400", ring: "ring-emerald-500/20", label: "low" };
};

const getCategoryBorder = (cat: string) => {
  if (cat.includes('geopolitics')) return 'border-l-violet-500/30 hover:border-l-violet-500/50';
  if (cat.includes('technology')) return 'border-l-indigo-500/30 hover:border-l-indigo-500/50';
  if (cat.includes('ai')) return 'border-l-emerald-500/30 hover:border-l-emerald-500/50';
  return 'border-l-border/30 hover:border-l-border/50';
};

export function SignalCard({ signal, isCompact, className, isBookmarked, isBookmarking, onToggleBookmark }: SignalCardProps) {
  const t = useTranslations('Index');
  const impact = getImpactColor(signal.score);
  
  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return t("now");
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
      if (diffInMinutes < 1) return t("now");
      if (diffInMinutes < 60) return `${diffInMinutes}${t("minutesShort")}`;
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}${t("hoursShort")}`;
      return date.toLocaleDateString();
    } catch {
      return t("recent");
    }
  };

  const category = signal.categoryId || signal.aiCategory?.toLowerCase() || '';

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 cursor-pointer",
      "bg-muted/15 hover:bg-muted/30",
      isCompact ? "rounded-none border-b border-transparent hover:border-border/20" : "rounded-sm border-0",
      getCategoryBorder(category),
      className
    )}>
      <div className={cn("flex flex-col h-full", isCompact && "py-3 px-4")}>
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="space-y-3">
            {/* Header: Source + Time + Bookmark */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={cn(
                  "text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm shrink-0 max-w-[130px] truncate",
                  "bg-muted/50 text-muted-foreground/80"
                )}>
                  {signal.source}
                </span>
                <span className="text-[12px] text-muted-foreground/60 tabular-nums shrink-0">
                  {getRelativeTime(signal.publishedAt)}
                </span>
                {isCompact && (
                  <>
                    <span className="text-[12px] text-muted-foreground/40 shrink-0">|</span>
                    <span className="text-[12px] text-muted-foreground/60 truncate min-w-0">
                      {signal.categoryId || signal.aiCategory}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isBookmarking || !onToggleBookmark) return;
                  await onToggleBookmark(signal.id);
                }}
                disabled={isBookmarking}
                className="p-1.5 text-muted-foreground/50 hover:text-primary transition-all disabled:opacity-40"
              >
                {isBookmarking
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Bookmark className={cn("w-4 h-4", isBookmarked && "text-primary fill-primary")} />
                }
              </button>
            </div>

            {/* Title - Bigger text */}
            <h2 className={cn(
              "font-semibold leading-snug text-foreground/90 group-hover:text-foreground transition-colors",
              isCompact ? "text-[16px] line-clamp-2" : "text-[15px] line-clamp-2"
            )}>
              {signal.title}
            </h2>

            {/* Summary - More content in list view */}
            {(signal.aiSummary || signal.summary) && (
              <p className={cn(
                "text-muted-foreground/70 leading-relaxed",
                isCompact ? "text-[14px] line-clamp-4" : "text-[13px] line-clamp-3"
              )}>
                {signal.aiSummary || signal.summary}
              </p>
            )}
          </div>

          {/* Footer: Impact Score + Actions + More Info */}
          <div className={cn(
            "flex items-center justify-between pt-3 border-t border-border/10",
            isCompact && "mt-2"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center font-bold text-[14px] shadow-md",
                impact.bg, "text-white"
              )}>
                {Math.floor(signal.score)}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={cn("text-[12px] font-semibold uppercase tracking-wide", impact.text)}>
                  {signal.score >= 7 ? t('critical') : signal.score >= 5 ? t('elevated') : t('stable')}
                </span>
                {isCompact && signal.countryCode && (
                  <span className="text-[11px] text-muted-foreground/50">
                    {signal.countryCode}
                  </span>
                )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(signal.url);
                  toast.success("Link copied");
                }}
                className="p-2 rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <a
                href={signal.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex items-center gap-1 h-7 px-3 rounded-sm text-[11px] font-medium uppercase tracking-wider transition-all",
                  "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
                )}
              >
                {t('intel')}
                  <ChevronRight className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}