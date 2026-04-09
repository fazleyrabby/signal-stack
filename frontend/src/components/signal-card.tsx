"use client";

import { cn } from "@/lib/utils";
import { 
  Sparkles,
  ChevronRight,
  Cpu,
  Zap,
  Globe,
  Bookmark,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Signal } from "@/lib/api";

interface SignalCardProps {
  signal: Signal;
  isCompact: boolean;
  className?: string;
  isBookmarked?: boolean;
  onToggleBookmark?: (signalId: string) => Promise<void>;
}

// AI provider display config
const PROVIDER_CONFIG: Record<string, { label: string; color: string; icon: typeof Cpu }> = {
  local: { label: 'LOCAL', color: 'text-emerald-400', icon: Cpu },
  groq: { label: 'GROQ', color: 'text-violet-400', icon: Zap },
  openrouter: { label: 'OPENROUTER', color: 'text-cyan-400', icon: Globe },
  failed: { label: 'FAILED', color: 'text-red-400/50', icon: Sparkles },
};

export function SignalCard({ signal, isCompact, className }: SignalCardProps) {
  // Clinical relative time
  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "recent";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
      if (diffInMinutes < 1) return "now";
      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h`;
      return date.toLocaleDateString();
    } catch (e) {
      return "recent";
    }
  };

  // Severity-based left border
  const severityBorderClass = signal.score >= 8 ? "border-l-2 border-l-red-500"
    : signal.score >= 5 ? "border-l-2 border-l-amber-500"
    : "border-l-2 border-l-blue-500";

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 border-border/10",
      "bg-card hover:bg-accent/5 hover:border-primary/20 shadow-sm",
      isCompact ? "rounded-none border-b py-3 px-4 h-auto" : "rounded-lg border h-full",
      severityBorderClass, // Add severity border
      className
    )}>
      <div className={cn("p-0 relative flex flex-col h-full uppercase-none", isCompact ? "" : "p-4.5")}>
        <div className="flex flex-col h-full justify-between gap-3">
          <div className="space-y-3">
            {/* Metadata Line */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-[11px] font-black uppercase tracking-widest",
                    signal.score >= 8 ? "text-red-500" : signal.score >= 5 ? "text-amber-500" : "text-blue-500"
                  )}>
                    {signal.source.split(' ')[0]}
                  </span>
                  <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tabular-nums">
                     {getRelativeTime(signal.publishedAt)}
                  </span>
                </div>
               
                {isCompact && (
                  <div className="w-4 h-4 text-muted-foreground/30 hover:text-primary transition-all">
                    <ChevronRight />
                  </div>
                )}
            </div>

            {/* Title: Dynamic Informational Portals */}
            <h3 className={cn(
              "font-extrabold leading-tight text-foreground transition-colors group-hover/title:text-primary block group/title",
              isCompact ? "text-[13px] pr-8 line-clamp-1" : "text-[15px] line-clamp-2 tracking-tight"
            )}>
              {signal.title}
            </h3>

            {/* AI Summary: Adaptive Briefing */}
            {!isCompact && (signal.aiSummary || signal.summary) && (
              <div className="p-3 bg-accent/10 rounded-md border border-border/10 relative group/brief overflow-hidden">
                 <div className="flex items-center gap-2 mb-1.5 opacity-40">
                     <Sparkles className="w-3 h-3 text-primary" />
                     <span className="text-[11px] font-black uppercase tracking-widest">Analysis</span>
                     {signal.aiProvider && PROVIDER_CONFIG[signal.aiProvider] && (() => {
                       const cfg = PROVIDER_CONFIG[signal.aiProvider!];
                       const Icon = cfg.icon;
                       return (
                         <span className={cn("flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ml-auto", cfg.color)}>
                           <Icon className="w-2.5 h-2.5" />
                           {cfg.label}
                         </span>
                       );
                     })()}
                  </div>
                 <p className="text-[12px] text-muted-foreground leading-relaxed font-semibold">
                     {signal.aiSummary || signal.summary}
                  </p>
               </div>
            )}
          </div>

{!isCompact && (
              <div className="flex items-center justify-between gap-2 flex-wrap mt-auto pt-3 border-t border-border/10">
                 <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <Badge variant="outline" className="h-4.5 text-[8.5px] font-black tracking-widest uppercase px-1.5 bg-accent/20 border-border/10 text-muted-foreground/60 rounded-sm shrink-0">
                      {signal.aiCategory?.split('|')[0] || 'INTEL'}
                    </Badge>
                    {signal.aiProvider && PROVIDER_CONFIG[signal.aiProvider] && (
                       <Badge variant="outline" className={cn(
                         "h-4.5 text-[8px] font-black tracking-widest uppercase px-1.5 border-border/10 rounded-sm shrink-0",
                         PROVIDER_CONFIG[signal.aiProvider].color
                       )}>
                         {PROVIDER_CONFIG[signal.aiProvider].label}
                       </Badge>
                     )}
                     <div className={cn(
                       "px-1.5 py-0.5 rounded text-[11px] font-black tabular-nums whitespace-nowrap shrink-0",
                       signal.score >= 8 ? "bg-red-500 text-white" : signal.score >= 5 ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                     )}>
                       {signal.score} IMPACT
                     </div>
                 </div>
                 
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (onToggleBookmark) {
                          await onToggleBookmark(signal.id);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all group/bookmark shrink-0"
                    >
                      BOOKMARK
                      <Bookmark 
                        className={`w-3.5 h-3.5 ${isBookmarked ? 'text-primary' : 'text-muted-foreground/60'} group/bookmark:${isBookmarked ? 'text-primary' : 'hover:text-primary'}`} 
                      />
                    </button>
                    
                    <a 
                      href={signal.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all group/link shrink-0"
                    >
                      EXPLORE
                      <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-all" />
                    </a>
                  </div>
              </div>
           )}
        </div>
      </div>
    </Card>
  );
}
