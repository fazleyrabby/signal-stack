"use client";

import useSWR from "swr";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, TrendingUp, Tag, Cpu, AlertCircle, Activity, Shield, Clock, Database } from "lucide-react";
import { Header } from "@/components/header";
import { GeoHeatmap } from "@/components/geo-heatmap";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_BASE = "/api/signals";
const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CHART_COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  emerald: "#10b981",
};

interface TrendsData {
  volumeByDay: Array<{
    date: string;
    count: number;
    high: number;
    medium: number;
    low: number;
  }>;
  topSources: Array<{
    source: string;
    count: number;
    avgScore: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
  }>;
  severityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  aiStats: {
    processed: number;
    failed: number;
    byProvider: {
      local: number;
      groq: number;
      openrouter: number;
    };
  };
}

type TooltipPayloadEntry = {
  name: string;
  value: number;
  color?: string;
  fill?: string;
  payload?: { fill?: string };
};

function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground mb-2 text-xs">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="capitalize text-foreground">
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color ?? entry.fill ?? entry.payload?.fill }}
          />
          <span className="text-foreground font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.payload?.fill }} />
        <span className="text-foreground">
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </span>
      </div>
    </div>
  );
}

function ChartTick({ x, y, payload, textAnchor }: { x?: number; y?: number; payload?: { value: string }; textAnchor?: "inherit" | "end" | "middle" | "start" }) {
  return (
    <text x={x} y={y} textAnchor={textAnchor ?? "middle"} dy={12} className="fill-muted-foreground text-[11px]">
      {payload?.value}
    </text>
  );
}

function ChartTickY({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={y} textAnchor="end" dy={4} className="fill-muted-foreground text-[11px]">
      {payload?.value}
    </text>
  );
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="h-4 bg-muted rounded w-24" />
      </CardHeader>
      <CardContent>
        <div className="h-[220px] bg-muted/50 rounded" />
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconClass: string;
}) {
  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted flex-shrink-0">
            <Icon className={`w-4 h-4 ${iconClass}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold truncate">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrendsPage() {
  const { data, isLoading } = useSWR<TrendsData>(
    `${API_BASE}/trends`,
    fetcher,
    { refreshInterval: 300000 }
  );

  const severityData = data
    ? [
        { name: "High", value: data.severityDistribution.high, fill: CHART_COLORS.high },
        { name: "Medium", value: data.severityDistribution.medium, fill: CHART_COLORS.medium },
        { name: "Low", value: data.severityDistribution.low, fill: CHART_COLORS.low },
      ]
    : [];

  const totalSeverity = severityData.reduce((sum, d) => sum + d.value, 0);

  const aiProviderData = data
    ? [
        { name: "Local", value: data.aiStats.byProvider.local },
        { name: "Groq", value: data.aiStats.byProvider.groq },
        { name: "OpenRouter", value: data.aiStats.byProvider.openrouter },
      ]
    : [];

  const maxSourceCount = data?.topSources[0]?.count || 1;

  const totalSignals = data ? data.volumeByDay.reduce((sum, d) => sum + d.count, 0) : 0;
  const highSeverity = data?.severityDistribution.high ?? 0;
  const last24h = data?.volumeByDay[data.volumeByDay.length - 1]?.count ?? 0;
  const topSource = data?.topSources[0]?.source ?? "—";

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header isRefreshing={false} />

      <div className="flex-1 overflow-auto p-4 sm:p-6 pb-16 md:pb-0">
        <div className="max-w-[1400px] mx-auto space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse border border-border shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <div className="h-12 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatCard icon={Activity} label="Total Signals (30d)" value={totalSignals.toLocaleString()} iconClass="text-violet-400" />
                <StatCard icon={Shield} label="High Severity" value={highSeverity.toLocaleString()} iconClass="text-red-400" />
                <StatCard icon={Clock} label="Last 24h" value={last24h.toLocaleString()} iconClass="text-amber-400" />
                <StatCard icon={Database} label="Top Source" value={topSource} iconClass="text-blue-400" />
              </>
            )}
          </div>

          {/* Volume Chart — Full Width */}
          {isLoading ? (
            <Card className="animate-pulse border border-border shadow-sm">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-32" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-muted/50 rounded" />
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  Signal Volume (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.volumeByDay ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.high} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={CHART_COLORS.high} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradMedium" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.medium} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={CHART_COLORS.medium} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.low} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={CHART_COLORS.low} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                      <XAxis dataKey="date" tick={<ChartTick />} axisLine={false} tickLine={false} />
                      <YAxis tick={<ChartTickY />} axisLine={false} tickLine={false} />
                      <Tooltip content={<VolumeTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                        formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))", textTransform: "capitalize" }}>{value}</span>}
                      />
                      <Area
                        type="monotone"
                        dataKey="high"
                        stroke={CHART_COLORS.high}
                        strokeWidth={2}
                        fill="url(#gradHigh)"
                        style={{ filter: `drop-shadow(0 0 4px ${CHART_COLORS.high}80)` }}
                      />
                      <Area
                        type="monotone"
                        dataKey="medium"
                        stroke={CHART_COLORS.medium}
                        strokeWidth={2}
                        fill="url(#gradMedium)"
                        style={{ filter: `drop-shadow(0 0 4px ${CHART_COLORS.medium}80)` }}
                      />
                      <Area
                        type="monotone"
                        dataKey="low"
                        stroke={CHART_COLORS.low}
                        strokeWidth={2}
                        fill="url(#gradLow)"
                        style={{ filter: `drop-shadow(0 0 4px ${CHART_COLORS.low}80)` }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Geo Heatmap */}
          <GeoHeatmap />

          {/* 2×2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Top Sources */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="w-4 h-4 text-violet-400" />
                    Top Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mt-2">
                    {data?.topSources.map((s) => (
                      <div key={s.source} className="space-y-1">
                        <div className="flex justify-between items-baseline gap-2 text-sm">
                          <span className="text-foreground truncate">{s.source}</span>
                          <span className="text-muted-foreground text-xs whitespace-nowrap flex-shrink-0">
                            {s.count} · {s.avgScore.toFixed(1)} avg
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(s.count / maxSourceCount) * 100}%`,
                              background: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                              transition: "width 1s ease-out",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Category Breakdown */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.categoryBreakdown ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="category" tick={<ChartTick />} axisLine={false} tickLine={false} />
                        <YAxis tick={<ChartTickY />} axisLine={false} tickLine={false} />
                        <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                        <Bar dataKey="count" fill="url(#gradViolet)" radius={[6, 6, 0, 0]} activeBar={{ fill: "#a78bfa" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Severity Distribution */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="w-4 h-4 text-violet-400" />
                    Severity Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="hsl(var(--background))"
                          strokeWidth={3}
                        >
                          {severityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold">{totalSeverity}</span>
                      <span className="text-xs text-muted-foreground">total</span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 mt-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span>High: {data?.severityDistribution.high}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>Medium: {data?.severityDistribution.medium}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span>Low: {data?.severityDistribution.low}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Provider Stats */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Cpu className="w-4 h-4 text-violet-400" />
                    AI Provider Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiProviderData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradProvLocal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.violet} stopOpacity={1} />
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={1} />
                          </linearGradient>
                          <linearGradient id="gradProvGroq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={1} />
                            <stop offset="100%" stopColor="#0284c7" stopOpacity={1} />
                          </linearGradient>
                          <linearGradient id="gradProvOR" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={1} />
                            <stop offset="100%" stopColor="#047857" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="name" tick={<ChartTick />} axisLine={false} tickLine={false} />
                        <YAxis tick={<ChartTickY />} axisLine={false} tickLine={false} />
                        <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {aiProviderData.map((_, index) => {
                            const ids = ["gradProvLocal", "gradProvGroq", "gradProvOR"];
                            return <Cell key={index} fill={`url(#${ids[index]})`} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Processed: {data?.aiStats.processed ?? 0}</span>
                    <span>Failed: {data?.aiStats.failed ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
