"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ExternalLink, Bookmark, Link2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Signal } from "@/lib/api";

interface SignalDetailModalProps {
  signal: Signal | null;
  onOpenChange: (signal: Signal | null) => void;
  isBookmarked?: boolean;
  isBookmarking?: boolean;
  onToggleBookmark?: (signalId: string) => Promise<void>;
}

const SEVERITY_COLORS = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-500 text-white",
} as const;

export function SignalDetailModal({ signal, onOpenChange, isBookmarked, isBookmarking, onToggleBookmark }: SignalDetailModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onOpenChange(null);
  };

  if (!signal) return null;

  const publishedDate = signal.publishedAt
    ? format(new Date(signal.publishedAt), "MMM d, yyyy 'at' HH:mm")
    : "Unknown";

  const scoreColor = signal.score >= 8 ? "text-red-500" : signal.score >= 5 ? "text-amber-500" : "text-blue-500";

  return (
    <Dialog open={!!signal} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col">
        {/* Header with severity stripe */}
        <div className={cn(
          "border-l-4 px-6 pt-6 pb-4",
          signal.severity === "high" ? "border-l-red-500" : signal.severity === "medium" ? "border-l-amber-500" : "border-l-emerald-500"
        )}>
          <DialogHeader className="flex items-center justify-between space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span className="font-semibold">{signal.source}</span>
              <span>·</span>
              <span>{publishedDate}</span>
            </div>
            <div className="flex items-start gap-2 w-full">
              <DialogTitle className="text-base font-bold leading-snug flex-1">
                {signal.title}
              </DialogTitle>
              <button
                onClick={async () => {
                  if (isBookmarking || !onToggleBookmark) return;
                  await onToggleBookmark(signal.id);
                }}
                disabled={isBookmarking}
                className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all shrink-0 disabled:opacity-40"
              >
                {isBookmarking
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Bookmark className={cn("w-3.5 h-3.5", isBookmarked ? "text-primary fill-primary" : "text-muted-foreground/60")} />
                }
                BOOKMARK
              </button>
            </div>
          </DialogHeader>
          {/* Accessible description required by Dialog */}
          <DialogDescription className="sr-only">{signal.source} — {publishedDate}</DialogDescription>
        </div>

        {/* Body — scrollable */}
        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* AI Summary */}
          {(signal.aiSummary || signal.summary) && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">AI Analysis</span>
              </div>
              <p className="text-sm leading-relaxed">
                {signal.aiSummary || signal.summary}
              </p>
            </div>
          )}

          {/* Content Snippet */}
          {signal.content && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Content Preview</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {(() => {
                  const stripped = signal.content.replace(/<[^>]*>/g, '');
                  return stripped.length > 300 ? stripped.substring(0, 300) + "..." : stripped;
                })()}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border/30">
            <Badge variant="secondary" className={cn("text-[10px] font-bold", SEVERITY_COLORS[signal.severity])}>
              {signal.severity.toUpperCase()}
            </Badge>
            <span className={cn("text-sm font-bold tabular-nums", scoreColor)}>
              {signal.score} IMPACT
            </span>
            {signal.aiProvider && signal.aiProvider !== "none" && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                {signal.aiProvider}
              </Badge>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/30 px-6 py-4 bg-muted/30">
          <button
            onClick={() => {
              navigator.clipboard.writeText(signal.url);
              toast.success("Link copied");
            }}
            className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all mr-auto"
          >
            SHARE <Link2 className="w-3.5 h-3.5" />
          </button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(null)}>
            Close
          </Button>
          <a href={signal.url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-1.5">
              Read Original
              <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
