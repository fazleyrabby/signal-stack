"use client";

import useSWR from "swr";
import {
  AreaChart,
  BarChart,
  DonutChart,
  BarList,
} from "@tremor/react";
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
        { name: "High", value: data.severityDistribution.high },
        { name: "Medium", value: data.severityDistribution.medium },
        { name: "Low", value: data.severityDistribution.low },
      ]
    : [];

  const aiProviderData = data
    ? [
        { name: "local", value: data.aiStats.byProvider.local },
        { name: "groq", value: data.aiStats.byProvider.groq },
        { name: "openrouter", value: data.aiStats.byProvider.openrouter },
      ]
    : [];

  const sourceList = data
    ? data.topSources.map((s) => ({
        name: s.source,
        value: s.count,
        subValue: `${s.avgScore.toFixed(1)} avg`,
      }))
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
                  <AreaChart
                    className="h-[300px]"
                    data={data?.volumeByDay || []}
                    index="date"
                    categories={["high", "medium", "low"]}
                    colors={["red", "amber", "blue"]}
                    valueFormatter={(v) => v.toString()}
                    showLegend={true}
                    showGridLines={false}
                    curveType="monotone"
                  />
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
                  <BarList
                    data={sourceList}
                    className="mt-2"
                    color="violet"
                    showAnimation={true}
                  />
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
                    <BarChart
                      className="h-[200px]"
                      data={data?.categoryBreakdown || []}
                      index="category"
                      categories={["count"]}
                      colors={["violet"]}
                      valueFormatter={(v) => v.toString()}
                      showLegend={false}
                      showGridLines={false}
                    />
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
                  <div className="h-[200px] flex items-center justify-center">
                    <DonutChart
                      className="h-[200px]"
                      data={severityData}
                      category="value"
                      index="name"
                      colors={["red", "amber", "blue"]}
                      valueFormatter={(v) => v.toString()}
                      showLabel={true}
                    />
                  </div>
                  <div className="flex justify-center gap-4 mt-4 text-xs">
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Cpu className="w-4 h-4 text-violet-400" />
                    AI Provider Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <BarChart
                      className="h-[200px]"
                      data={aiProviderData}
                      index="name"
                      categories={["value"]}
                      colors={["violet", "cyan", "emerald"]}
                      valueFormatter={(v) => v.toString()}
                      showLegend={false}
                      showGridLines={false}
                    />
                  </div>
                  <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
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