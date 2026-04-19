"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Users, RefreshCw, Globe, MapPin, Smartphone, Bot, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Visitor {
  id: string;
  ip: string;
  session_id: string;
  user_agent: string | null;
  is_bot: boolean;
  page_views: number;
  first_seen: string;
  last_seen: string;
  country: string | null;
  city: string | null;
}
interface VisitorsResponse { data: Visitor[]; meta: { page: number; limit: number; total: number; totalPages: number; }; }

export default function VisitorsAdmin() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "humans" | "bots">("all");
  const limit = 20;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  const { data: visitorsData, isLoading, error, mutate: refresh } = useSWR<VisitorsResponse>(
    `${API_BASE}/api/visitors?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: stats } = useSWR<{ total: number; today: number; realtime: number }>(
    `${API_BASE}/api/visitors/stats`,
    fetcher,
    { refreshInterval: 10000 }
  );

  useEffect(() => { if (error) router.replace("/admin-login"); }, [error, router]);

  const handleRefresh = () => refresh();

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  }

  function formatUserAgent(ua: string | null) {
    if (!ua) return "-";
    if (ua.length > 40) return ua.substring(0, 40) + "...";
    return ua;
  }

  const allVisitors = visitorsData?.data ?? [];
  const bots = allVisitors.filter(v => v.is_bot);
  const humans = allVisitors.filter(v => !v.is_bot);
  
  const filteredVisitors = filter === "all" 
    ? allVisitors 
    : filter === "bots" 
      ? bots 
      : humans;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Visitors</span>
          <span className="text-xs text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
            {stats?.total?.toLocaleString() ?? "…"} total
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-7 gap-1.5 px-2">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      {/* Compact Stats Row */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-2 border-b border-border/40 bg-muted/10 shrink-0 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>Total:</span>
          <span className="font-bold font-mono">{stats?.total?.toLocaleString() ?? "-"}</span>
        </div>
        <div className="w-px h-3 bg-border/40" />
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Globe className="w-3 h-3" />
          <span>Today:</span>
          <span className="font-bold font-mono">{stats?.today?.toLocaleString() ?? "-"}</span>
        </div>
        <div className="w-px h-3 bg-border/40" />
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>Live:</span>
          <span className="font-bold font-mono">{stats?.realtime?.toLocaleString() ?? "-"}</span>
        </div>
        <div className="w-px h-3 bg-border/40" />
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Bot className="w-3 h-3" />
          <span>Bots:</span>
          <span className="font-bold font-mono">{stats?.total ? (stats.total - (stats.today > 0 ? stats.today - (bots.length > 0 ? bots.length : 0) : 0)) : "-"}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 px-6 py-2 border-b border-border/40 shrink-0 bg-card/20">
        {(["all", "humans", "bots"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {f === "all" ? `All (${stats?.total ?? 0})` : f === "humans" ? `Humans (${humans.length})` : `Bots (${bots.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table className="min-w-max table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider w-36">IP</TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider w-20">Type</TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider w-16">Views</TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider w-28">Location</TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider">User Agent</TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider w-28">Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground/50">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredVisitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-xs text-muted-foreground/50 italic">
                  No visitors found.
                </TableCell>
              </TableRow>
            ) : (
              filteredVisitors.map((v) => (
                <TableRow key={v.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <TableCell className="px-3 py-2 font-mono text-xs truncate">{v.ip}</TableCell>
                  <TableCell className="px-3 py-2">
                    {v.is_bot ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-[10px] font-semibold">
                        <Bot className="w-2.5 h-2.5" />
                        Bot
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[10px] font-semibold">
                        <Smartphone className="w-2.5 h-2.5" />
                        Human
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 font-medium text-xs">{v.page_views}</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground truncate">
                    {v.city || v.country ? (
                      <span>{[v.city, v.country].filter(Boolean).join(", ")}</span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]" title={v.user_agent ?? undefined}>
                    {formatUserAgent(v.user_agent)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(v.last_seen)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {visitorsData && visitorsData.meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-2 border-t border-border/40 bg-muted/10 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground">
            Page {visitorsData.meta.page} / {visitorsData.meta.totalPages} · {visitorsData.meta.total.toLocaleString()} total
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-3 h-3" />Prev
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(p => Math.min(visitorsData.meta.totalPages, p + 1))} disabled={page === visitorsData.meta.totalPages}>
              Next<ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}