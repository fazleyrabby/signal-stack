"use client";

import { cn } from "@/lib/utils";
import { 
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Signal } from "@/lib/api";

interface SignalCardProps {
  signal: Signal;
  isCompact: boolean;
  className?: string;
}

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

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 border-border/10",
      "bg-card hover:bg-accent/5 hover:border-primary/20 shadow-sm",
      isCompact ? "rounded-none border-b py-3 px-4 h-auto" : "rounded-lg border h-full",
      className
    )}>
      <div className={cn("p-0 relative flex flex-col h-full uppercase-none", isCompact ? "" : "p-4.5")}>
        <div className="flex flex-col h-full justify-between gap-3">
          <div className="space-y-3">
            {/* Metadata Line */}
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <span className={cn(
                   "text-[10px] font-black uppercase tracking-widest",
                   signal.score >= 8 ? "text-red-500" : signal.score >= 5 ? "text-amber-500" : "text-blue-500"
                 )}>
                   {signal.source.split(' ')[0]}
                 </span>
                 <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tabular-nums">
                    {getRelativeTime(signal.publishedAt)}
                 </span>
               </div>
               
               {isCompact && (
                 <a href={signal.url} target="_blank" rel="noopener noreferrer">
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 hover:text-primary transition-all" />
                 </a>
               )}
            </div>

            {/* Title: Dynamic Informational Portals */}
            <a 
              href={signal.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block group/title"
            >
              <h3 className={cn(
                "font-extrabold leading-tight text-foreground transition-colors group-hover/title:text-primary",
                isCompact ? "text-[13px] pr-8" : "text-[15px] line-clamp-2 tracking-tight"
              )}>
                {signal.title}
              </h3>
            </a>

            {/* AI Summary: Adaptive Briefing */}
            {!isCompact && (signal.aiSummary || signal.summary) && (
              <div className="p-3 bg-accent/10 rounded-md border border-border/10 relative group/brief overflow-hidden">
                 <div className="flex items-center gap-2 mb-1.5 opacity-40">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Analysis</span>
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
                   <div className={cn(
                     "px-1.5 py-0.5 rounded text-[9px] font-black tabular-nums whitespace-nowrap shrink-0",
                     signal.score >= 8 ? "bg-red-500 text-white" : signal.score >= 5 ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                   )}>
                     {signal.score} IMPACT
                   </div>
                </div>
                
                <a 
                  href={signal.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all group/link shrink-0"
                >
                  EXPLORE
                  <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-all" />
                </a>
             </div>
          )}
        </div>
      </div>
    </Card>
  );
}
