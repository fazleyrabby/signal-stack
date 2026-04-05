"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Zap, Sparkles, BrainCircuit } from "lucide-react";
import type { Signal } from "@/lib/api";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const severityConfig = {
  high: {
    label: "H",
    color: "text-red-400",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  medium: {
    label: "M",
    color: "text-orange-400",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  low: {
    label: "L",
    color: "text-emerald-400",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
};

export function SignalCard({ signal, isCompact = false }: { signal: Signal; isCompact?: boolean }) {
  const severity = severityConfig[signal.severity];
  const displayTime = signal.publishedAt || signal.createdAt;

  if (isCompact) {
    return (
      <Card className="group border-none bg-background/30 hover:bg-muted/40 transition-all duration-150 cursor-pointer border-b border-border/10 rounded-none first:rounded-t-lg last:rounded-b-lg">
        <CardContent className="p-2 sm:p-2.5 flex items-center gap-3">
          <div className={`w-1 h-3 rounded-full shrink-0 ${severity.color} bg-current opacity-60`} />
          
          <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
             {/* Title Group */}
             <a
                href={signal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex-1 min-w-0"
              >
                <h3 className="text-[11px] sm:text-[12px] font-bold leading-none text-foreground truncate group-hover/link:text-primary transition-colors">
                  {signal.title}
                </h3>
              </a>

              {/* Ultra-compact metadata */}
              <div className="flex items-center gap-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                 <span className="text-[9px] font-mono tracking-tighter uppercase font-black">{signal.source.slice(0, 10)}</span>
                 <span className="text-[9px] font-mono">{timeAgo(displayTime)}</span>
                 <Badge variant="outline" className={`h-4 text-[7px] px-1 font-black ${severity.className}`}>
                    {severity.label}
                 </Badge>
              </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group border-none bg-background/50 hover:bg-muted/30 transition-all duration-200 cursor-pointer overflow-hidden border-b border-border/20 rounded-none first:rounded-t-lg last:rounded-b-lg">
      <CardContent className="p-3 relative z-10">
        <div className="flex items-start gap-3">
          {/* Compact Severity indicator */}
          <div className={`mt-1.5 w-1 h-3 rounded-full shrink-0 ${severity.color} bg-current opacity-60`} />
          
          <div className="flex-1 min-w-0">
            {/* Metadata Line */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                {signal.source}
              </span>
              <span className="text-[10px] text-muted-foreground/40">•</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {timeAgo(displayTime)}
              </span>
              {signal.aiCategory && (
                <div className="ml-auto flex items-center gap-1 text-[9px] font-bold text-violet-400/80 uppercase tracking-tighter">
                  <Sparkles className="w-2 h-2" />
                  {signal.aiCategory}
                </div>
              )}
            </div>

            {/* Title */}
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link block"
            >
              <h3 className="text-xs sm:text-sm font-semibold leading-tight text-foreground transition-colors group-hover/link:text-primary">
                {signal.title}
              </h3>
            </a>

            {/* AI Engineering Highlights (The 'Why it Matters' Summary) */}
            {(signal.aiSummary || signal.summary) && (
              <div className="mt-3 group/ai">
                <div className="flex items-center gap-1.5 mb-1.5 opacity-60 group-hover/ai:opacity-100 transition-opacity">
                  <BrainCircuit className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400/80">Why it matters</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground/90 font-medium italic border-l-2 border-violet-500/20 pl-3">
                  {signal.aiSummary || signal.summary}
                </p>
              </div>
            )}

            {/* Processing State logic */}
            {signal.score >= 7 && !signal.aiProcessed && !signal.aiFailed && (
              <div className="mt-2 flex items-center gap-2 opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Analyzing Intelligence...</span>
              </div>
            )}

            {/* Footer Mini Stats */}
            <div className="flex items-center mt-2.5 gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-1 text-[9px] font-mono">
                <Zap className="w-2.5 h-2.5 text-amber-500" />
                <span>{signal.score} XP</span>
              </div>
              <Badge variant="outline" className={`h-4 text-[8px] px-1 font-black ${severity.className}`}>
                S-{severity.label}
              </Badge>
            </div>
          </div>
          
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
