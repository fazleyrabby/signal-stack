"use client";

import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { BarChart3, TrendingUp, Tag, Cpu, AlertCircle } from "lucide-react";
import { Header } from "@/components/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_BASE = "/api/signals";
const fetcher = (url: string) => fetch(url).then((res) => res.json());

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

const COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  local: "#8b5cf6",
  groq: "#06b6d4",
  openrouter: "#10b981",
};

function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="h-4 bg-muted rounded w-24" />
      </CardHeader>
      <CardContent>
        <div className="h-[200px] bg-muted/50 rounded" />
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
        { name: "High", value: data.severityDistribution.high, color: COLORS.high },
        { name: "Medium", value: data.severityDistribution.medium, color: COLORS.medium },
        { name: "Low", value: data.severityDistribution.low, color: COLORS.low },
      ]
    : [];

  const aiProviderData = data
    ? [
        { name: "local", value: data.aiStats.byProvider.local, color: COLORS.local },
        { name: "groq", value: data.aiStats.byProvider.groq, color: COLORS.groq },
        { name: "openrouter", value: data.aiStats.byProvider.openrouter, color: COLORS.openrouter },
      ]
    : [];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header isRefreshing={false} />

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Volume Chart - Full Width */}
          {isLoading ? (
            <Card className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-32" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-muted/50 rounded" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  Signal Volume (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data?.volumeByDay || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.high} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.high} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.medium} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.medium} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.low} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.low} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => value.slice(5)}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="low"
                        stackId="1"
                        stroke={COLORS.low}
                        fill="url(#colorLow)"
                        name="Low"
                      />
                      <Area
                        type="monotone"
                        dataKey="medium"
                        stackId="1"
                        stroke={COLORS.medium}
                        fill="url(#colorMedium)"
                        name="Medium"
                      />
                      <Area
                        type="monotone"
                        dataKey="high"
                        stackId="1"
                        stroke={COLORS.high}
                        fill="url(#colorHigh)"
                        name="High"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Sources */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="w-4 h-4 text-violet-400" />
                    Top Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data?.topSources.map((source, index) => {
                      const maxCount = Math.max(...(data?.topSources.map((s) => s.count) || [1]));
                      const percentage = (source.count / maxCount) * 100;
                      return (
                        <div key={source.source} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium truncate flex-1">
                              {index + 1}. {source.source}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {source.count}
                              </span>
                              <span className="text-muted-foreground/60">
                                avg {source.avgScore.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-accent/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Category Breakdown */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data?.categoryBreakdown || []}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="category"
                          type="category"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          width={80}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="w-4 h-4 text-violet-400" />
                    Severity Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {severityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {severityData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Provider Stats */}
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Cpu className="w-4 h-4 text-violet-400" />
                    AI Provider Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiProviderData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {aiProviderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Processed: {data?.aiStats.processed || 0}</span>
                    <span>Failed: {data?.aiStats.failed || 0}</span>
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