"use client";

import { Activity, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react";
import type { SignalStats } from "@/lib/api";

export function StatsBar({ stats }: { stats: SignalStats | undefined }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        icon={<BarChart3 className="w-4 h-4" />}
        label="Total Signals"
        value={stats.total}
        color="text-blue-400"
      />
      <StatCard
        icon={<AlertTriangle className="w-4 h-4" />}
        label="High Severity"
        value={stats.high}
        color="text-red-400"
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4" />}
        label="Last 24h"
        value={stats.last24h}
        color="text-emerald-400"
      />
      <StatCard
        icon={<Activity className="w-4 h-4" />}
        label="Top Source"
        value={stats.topSource}
        color="text-orange-400"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-3">
      <div className={`${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{String(value)}</p>
      </div>
    </div>
  );
}
