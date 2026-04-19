"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Terminal, AlertTriangle, Info, AlertCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface LogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  context: string;
  message: string;
}

const LEVEL_STYLES: Record<string, string> = {
  info:  "text-blue-400 bg-blue-500/10 border-blue-500/20",
  warn:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  error: "text-red-400 bg-red-500/10 border-red-500/20",
};

const LEVEL_ICON: Record<string, React.ReactNode> = {
  info:  <Info className="w-2.5 h-2.5" />,
  warn:  <AlertTriangle className="w-2.5 h-2.5" />,
  error: <AlertCircle className="w-2.5 h-2.5" />,
};

function parseMessage(raw: string): { event?: string; data: Record<string, string> } {
  try {
    const obj = JSON.parse(raw);
    const { event, ...rest } = obj;
    return { event, data: rest };
  } catch {
    return { data: { message: raw } };
  }
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("30");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  async function fetchLogs(isRefreshing = false, q = search, d = days) {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500", days: d });
      if (q) params.set("search", q);
      const res = await fetch(`${API_BASE}/api/admin/logs?${params}`, { credentials: "include" });
      if (res.status === 401) { router.replace("/admin-login"); return; }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchLogs(); }, []);

  function handleSearch(val: string) {
    setSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchLogs(false, val, days), 400);
  }

  function handleDays(val: string) {
    setDays(val);
    fetchLogs(false, search, val);
  }

  const filtered = filter === "all" ? logs : logs.filter((l) => l.level === filter);
  const counts = { info: logs.filter(l => l.level === "info").length, warn: logs.filter(l => l.level === "warn").length, error: logs.filter(l => l.level === "error").length };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex items-center gap-2 mr-auto">
          <Terminal className="w-4 h-4 text-primary shrink-0" />
          <span className="font-bold text-sm">System Logs</span>
          <span className="text-[10px] text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">{total} total</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search logs…"
              className="h-6 pl-6 pr-6 text-[10px] font-mono bg-muted/20 border border-border/40 rounded outline-none focus:border-primary/50 w-44"
            />
            {search && (
              <button onClick={() => handleSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Days selector */}
          <select
            value={days}
            onChange={(e) => handleDays(e.target.value)}
            className="h-6 px-1.5 text-[10px] font-mono bg-muted/20 border border-border/40 rounded outline-none focus:border-primary/50"
          >
            <option value="1">1d</option>
            <option value="7">7d</option>
            <option value="14">14d</option>
            <option value="30">30d</option>
          </select>
          {/* Level filters */}
          {(["all", "info", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-mono uppercase ${filter === lvl ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:border-border"}`}
            >
              {lvl}{lvl !== "all" && ` (${counts[lvl]})`}
            </button>
          ))}
          <Button size="sm" variant="outline" className="h-6 px-2.5 text-[10px] gap-1" onClick={() => fetchLogs(true)} disabled={refreshing}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/40">
            <Terminal className="w-8 h-8" />
            <p className="text-xs">No log entries yet — logs appear after first feed cycle</p>
          </div>
        ) : (
          <Table className="min-w-max table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
                <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ width: 160 }}>Time</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ width: 60 }}>Level</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ width: 120 }}>Context</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ width: 180 }}>Event</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log, i) => {
                const { event, data } = parseMessage(log.message);
                const { timestamp, ...details } = data as any;
                return (
                  <TableRow key={i} className={`border-b border-border/20 hover:bg-muted/10 transition-colors ${log.level === "error" ? "bg-red-500/5" : log.level === "warn" ? "bg-amber-500/5" : ""}`}>
                    <TableCell className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground/60 whitespace-nowrap">
                      {new Date(log.ts).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 gap-1 flex items-center w-fit ${LEVEL_STYLES[log.level]}`}>
                        {LEVEL_ICON[log.level]}{log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground/70 truncate">{log.context}</TableCell>
                    <TableCell className="px-3 py-1.5 font-mono text-[10px] font-semibold truncate">{event || "—"}</TableCell>
                    <TableCell className="px-3 py-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {Object.entries(details).map(([k, v]) => (
                          <span key={k} className="text-[10px] font-mono text-muted-foreground/60">
                            <span className="text-muted-foreground/40">{k}:</span>{" "}
                            <span className={typeof v === "number" && (v as number) > 0 ? "text-emerald-400" : ""}>{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
