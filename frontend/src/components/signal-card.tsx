"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Zap } from "lucide-react";
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
    label: "HIGH",
    className: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25",
  },
  medium: {
    label: "MED",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25",
  },
  low: {
    label: "LOW",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
  },
};

export function SignalCard({ signal }: { signal: Signal }) {
  const severity = severityConfig[signal.severity];
  const displayTime = signal.publishedAt || signal.createdAt;

  return (
    <Card className="group border-border/50 bg-card/50 backdrop-blur-sm hover:border-border hover:bg-card/80 transition-all duration-300 cursor-pointer">
      <CardContent className="p-4 sm:p-5">
        {/* Title row */}
        <a
          href={signal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 group/link"
        >
          <h3 className="text-sm sm:text-base font-medium leading-snug text-foreground group-hover/link:text-primary transition-colors flex-1">
            {signal.title}
          </h3>
          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </a>

        {/* Metadata row */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Badge variant="outline" className={severity.className}>
            {severity.label}
          </Badge>

          <span className="text-xs text-muted-foreground font-medium">
            {signal.source}
          </span>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="w-3 h-3" />
            <span>{signal.score}</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(displayTime)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
