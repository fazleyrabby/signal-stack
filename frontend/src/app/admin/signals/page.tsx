"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, toggleSort } from "@/components/ui/sortable-head";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit2, Loader2, Languages, Search, SlidersHorizontal, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Activity, ChevronDown, Eye, EyeOff, FileDown, Download, FileText, Square, CheckSquare } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { cn, getProviderLabel } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Translation { title: string; aiSummary: string; v: number; }
interface Signal {
  id: string; title: string; content: string | null; summary: string | null;
  aiSummary: string | null; url: string; score: number; severity: "high" | "medium" | "low";
  categoryId: string; source: string; countryCode: string | null; aiProcessed: boolean;
  aiFailed: boolean; aiProvider: string | null; translations: Record<string, Translation>;
  publishedAt: string | null; createdAt: string; isRead: boolean;
}
interface SignalsResponse { data: Signal[]; meta: { page: number; limit: number; total: number; totalPages: number; }; }
interface Category { slug: string; name: string; }

export default function SignalsAdmin() {
  const router = useRouter();
  const params = useParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [hasTranslation, setHasTranslation] = useState<string>("all");
  const [lang, setLang] = useState<string>("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const queryParams = new URLSearchParams({
    page: page.toString(), limit: "20", sort, order,
    ...(search && { search }),
    ...(severity !== "all" && { severity }),
    ...(minScore !== "0" && { minScore }),
    ...(categoryId !== "all" && { categoryId }),
    ...(hasTranslation !== "all" && { hasTranslation }),
    ...(lang !== "all" && { lang }),
  });

  const { data: signalsData, isLoading: signalsLoading, error: signalsError } = useSWR<SignalsResponse>(
    `${API_BASE}/api/admin/signals?${queryParams.toString()}`, fetcher, { shouldRetryOnError: false }
  );
  const { data: categories } = useSWR<Category[]>(`${API_BASE}/api/admin/categories`, fetcher);

  useEffect(() => { if (signalsError) router.replace("/admin-login"); }, [signalsError, router]);

  const [editingSignal, setEditingSignal] = useState<Signal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  const [bulkLang, setBulkLang] = useState("bn");
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const { widths: colWidths, startResize } = useResizableColumns([260, 90, 90, 90, 70, 110, 90]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // New UI states
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteBulkTarget, setDeleteBulkTarget] = useState(false);

  const allIds = signalsData?.data.map(s => s.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  async function handleBulkDelete() {
    setDeleteBulkTarget(true);
  }

  async function handleMarkRead(id: string, isRead: boolean) {
    await fetch(`${API_BASE}/api/admin/signals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isRead }) });
    mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
  }

  async function handleMarkAllRead() {
    await fetch(`${API_BASE}/api/admin/signals/mark-all-read`, { method: "POST", credentials: "include" });
    mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
  }

  async function handleDelete(id: string) {
    setDeleteTargetId(id);
  }

  async function handleTranslate(id: string, targetLang: string) {
    setTranslatingId(id);
    try {
      await fetch(`${API_BASE}/api/admin/signals/${id}/translate?lang=${targetLang}`, { method: "POST", credentials: "include" });
      mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
    } finally {
      setTranslatingId(null);
    }
  }

  async function handleBulkTranslate(e: React.FormEvent) {
    e.preventDefault();
    setIsBulkTranslating(true);
    try {
      const payload = { lang: bulkLang, filter: { ...(severity !== "all" && { severity }), ...(minScore !== "0" && { minScore: parseInt(minScore) }), ...(categoryId !== "all" && { categoryId }) } };
      const res = await fetch(`${API_BASE}/api/admin/signals/translate/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      if (res.ok) { const data = await res.json(); alert(`Queued ${data.queued} signals for bulk translation to ${bulkLang}`); }
    } finally { setIsBulkTranslating(false); }
  }

  async function handleExportCsv(days: number) {
    window.open(`${API_BASE}/api/admin/signals/export/csv?days=${days}`, '_blank');
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSignal) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = { title: formData.get("title"), aiSummary: formData.get("aiSummary"), severity: formData.get("severity"), score: parseInt(formData.get("score") as string, 10), categoryId: formData.get("categoryId"), countryCode: formData.get("countryCode") || null };
    try {
      await fetch(`${API_BASE}/api/admin/signals/${editingSignal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
      setIsEditDialogOpen(false); setEditingSignal(null);
    } finally { setIsSubmitting(false); }
  }

  const activeFiltersCount = [
    severity !== "all",
    minScore !== "0",
    categoryId !== "all",
    hasTranslation !== "all",
    lang !== "all",
  ].filter(Boolean).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="feed" className="flex-1 flex flex-col overflow-hidden">
        {/* Tab nav */}
        <div className="shrink-0 border-b border-border/40 bg-card/30">
          <div className="flex items-center justify-between px-6">
            <TabsList className="h-9 bg-transparent p-0 gap-0 border-0">
              <TabsTrigger value="feed" className="h-9 px-4 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5">
                <Activity className="w-3.5 h-3.5" />Live Feed
              </TabsTrigger>
              <TabsTrigger value="reports" className="h-9 px-4 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5">
                <FileText className="w-3.5 h-3.5" />Export Reports
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
                {signalsData?.meta.total.toLocaleString() ?? "…"} rows
              </span>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5 rounded-lg border-border/50" onClick={handleMarkAllRead}>
                <Eye className="w-3 h-3" />Mark All Read
              </Button>
              <form onSubmit={handleBulkTranslate} className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:block">Bulk</span>
                <Select value={bulkLang} onValueChange={(val) => { if (typeof val === 'string') setBulkLang(val); }}>
                  <SelectTrigger className="w-[80px] h-7 text-xs rounded-lg border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">Bengali</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" className="h-7 gap-1.5 px-3 text-xs rounded-lg" disabled={isBulkTranslating}>
                  {isBulkTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                  Translate
                </Button>
              </form>
            </div>
          </div>
        </div>

        <TabsContent value="feed" className="flex-1 flex flex-col overflow-hidden m-0 relative">

          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2 border-b border-border/40 bg-muted/10 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <Input placeholder="Search signals..." className="pl-8 h-8 text-xs bg-background/50 border-border/50 rounded-lg focus-visible:ring-primary/20" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>

              <Select value={sort} onValueChange={(val) => { if (typeof val === 'string') { setSort(val); setPage(1); } }}>
                <SelectTrigger className="h-8 text-xs w-[120px] bg-background/50 border-border/50 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created</SelectItem>
                  <SelectItem value="publishedAt">Published</SelectItem>
                  <SelectItem value="score">Score</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" size="icon" className="h-8 w-8 border border-border/40 rounded-lg shrink-0 hover:bg-muted/50" onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')} title={order}>
                <SlidersHorizontal className={cn("w-3.5 h-3.5 transition-transform", order === 'asc' && "rotate-180")} />
              </Button>

              <div className="w-px h-5 bg-border/40 mx-1 hidden sm:block" />

              <Button
                variant={showFilters || activeFiltersCount > 0 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8 gap-1.5 text-xs rounded-lg shrink-0 border-border/50"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[8px] font-black text-primary-foreground px-1 leading-none">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
              
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSeverity("all");
                    setMinScore("0");
                    setCategoryId("all");
                    setHasTranslation("all");
                    setLang("all");
                    setPage(1);
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent px-2 hidden md:inline-flex"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Collapsible Filter Panel */}
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 border-b border-border/30 bg-card/10 backdrop-blur-md animate-in slide-in-from-top-2 duration-200 shrink-0">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Severity</label>
                <Select value={severity} onValueChange={(val) => { if (typeof val === 'string') { setSeverity(val); setPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="high">High (≥8)</SelectItem>
                    <SelectItem value="medium">Medium (5–7)</SelectItem>
                    <SelectItem value="low">Low (&lt;5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Min Score</label>
                <Select value={minScore} onValueChange={(val) => { if (typeof val === 'string') { setMinScore(val); setPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any score</SelectItem>
                    <SelectItem value="5">5+</SelectItem>
                    <SelectItem value="7">7+</SelectItem>
                    <SelectItem value="8">8+ critical</SelectItem>
                    <SelectItem value="10">10+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                <Select value={categoryId} onValueChange={(val) => { if (typeof val === 'string') { setCategoryId(val); setPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories?.map((cat) => <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Translation</label>
                <Select value={hasTranslation} onValueChange={(val) => { if (typeof val === 'string') { setHasTranslation(val); setPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Translated</SelectItem>
                    <SelectItem value="false">Not translated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Language</label>
                <Select value={lang} onValueChange={(val) => { if (typeof val === 'string') { setLang(val); setPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All langs</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="bn">BN</SelectItem>
                    <SelectItem value="es">ES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Floating Bulk Action Bar */}
          {someSelected && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-2.5 rounded-full border border-primary/25 bg-card/85 backdrop-blur-lg shadow-2xl shadow-black/55 animate-in slide-in-from-bottom-8 duration-300">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-bold text-foreground">{selectedIds.size} selected</span>
              </div>
              <div className="w-px h-4 bg-border/60" />
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-4 text-xs gap-1.5 rounded-full shadow-lg hover:shadow-red-500/10 transition-all duration-300"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground rounded-full"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table className="min-w-max table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
                  <TableHead className="h-8 px-3 w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                      {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                  </TableHead>
                  <SortableHead label="Signal" column="title" sort={sort} order={order as "asc"|"desc"} onSort={(col) => { const n = toggleSort({sort, order: order as "asc"|"desc"}, col); setSort(n.sort); setOrder(n.order); setPage(1); }} width={colWidths[0]}><ResizeHandle onMouseDown={(e) => startResize(0, e)} /></SortableHead>
                  <SortableHead label="Score" column="score" sort={sort} order={order as "asc"|"desc"} onSort={(col) => { const n = toggleSort({sort, order: order as "asc"|"desc"}, col); setSort(n.sort); setOrder(n.order); setPage(1); }} width={colWidths[1]}><ResizeHandle onMouseDown={(e) => startResize(1, e)} /></SortableHead>
                  <SortableHead label="Category" column="aiCategory" sort={sort} order={order as "asc"|"desc"} onSort={(col) => { const n = toggleSort({sort, order: order as "asc"|"desc"}, col); setSort(n.sort); setOrder(n.order); setPage(1); }} width={colWidths[2]}><ResizeHandle onMouseDown={(e) => startResize(2, e)} /></SortableHead>
                  <SortableHead label="AI Status" column="aiProcessed" sort={sort} order={order as "asc"|"desc"} onSort={(col) => { const n = toggleSort({sort, order: order as "asc"|"desc"}, col); setSort(n.sort); setOrder(n.order); setPage(1); }} width={colWidths[3]}><ResizeHandle onMouseDown={(e) => startResize(3, e)} /></SortableHead>
                  <SortableHead label="Languages" column="translationLang" sort={sort} order={order as "asc"|"desc"} onSort={(col) => { const n = toggleSort({sort, order: order as "asc"|"desc"}, col); setSort(n.sort); setOrder(n.order); setPage(1); }} width={colWidths[4]}><ResizeHandle onMouseDown={(e) => startResize(4, e)} /></SortableHead>
                  <SortableHead label="Date" column="createdAt" sort={sort} order={order as "asc"|"desc"} onSort={(col) => { const n = toggleSort({sort, order: order as "asc"|"desc"}, col); setSort(n.sort); setOrder(n.order); setPage(1); }} width={colWidths[5]}><ResizeHandle onMouseDown={(e) => startResize(5, e)} /></SortableHead>
                  <SortableHead label="Actions" column="" sort={sort} order={order as "asc"|"desc"} onSort={() => {}} width={colWidths[6]} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {signalsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground/50">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : signalsData?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-xs text-muted-foreground/50 italic">No signals match current filters.</TableCell>
                  </TableRow>
                ) : (
                  signalsData?.data.map((signal) => (
                    <TableRow key={signal.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors group", !signal.isRead && "bg-primary/[0.03]", selectedIds.has(signal.id) && "bg-primary/5")}>
                      <TableCell className="px-3 py-2 w-8">
                        <button onClick={() => toggleSelect(signal.id)} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                          {selectedIds.has(signal.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {!signal.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Unread" />}
                            <span className="text-xs font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors max-w-[210px] block truncate" title={signal.title}>
                              {signal.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] uppercase bg-muted px-1 py-0.5 rounded text-muted-foreground font-bold">{signal.source}</span>
                            <a href={signal.url} target="_blank" className="text-[10px] text-muted-foreground/50 hover:text-primary truncate max-w-[180px] font-mono">{signal.url}</a>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border leading-none",
                              signal.severity === 'high' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                              signal.severity === 'medium' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            )}>{signal.severity}</span>
                            <span className="text-xs font-mono font-bold">{signal.score.toFixed(1)}</span>
                          </div>
                          <div className="w-12 h-0.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full", signal.score > 20 ? "bg-red-500" : signal.score > 10 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min((signal.score / 30) * 100, 100)}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{signal.categoryId}</span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {signal.aiProcessed ? (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Processed</span>
                          </div>
                        ) : signal.aiFailed ? (
                          <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-3 h-3 shrink-0" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Failed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Pending</span>
                          </div>
                        )}
                        {signal.aiProvider && <span className="text-[8px] text-muted-foreground font-mono block uppercase mt-0.5">{getProviderLabel(signal.aiProvider)}</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-wrap gap-0.5">
                          {Object.keys(signal.translations).length > 0 ? (
                            Object.keys(signal.translations).map(l => (
                              <span key={l} className="text-[9px] font-black uppercase px-1 py-0.5 rounded border border-blue-400/20 bg-blue-500/5 text-blue-400">{l}</span>
                            ))
                          ) : (
                            <span className="text-[9px] text-muted-foreground/40 italic">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col font-mono leading-none">
                          <span className="text-[10px] text-foreground/80">{new Date(signal.createdAt).toLocaleDateString()}</span>
                          <span className="text-[9px] text-muted-foreground/50 mt-0.5">{new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-lg", signal.isRead ? "text-muted-foreground/30 hover:text-muted-foreground" : "text-primary hover:text-primary/70")} title={signal.isRead ? "Mark unread" : "Mark read"} onClick={() => handleMarkRead(signal.id, !signal.isRead)}>
                            {signal.isRead ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                          <TranslateButton
                            signalId={signal.id}
                            isTranslating={translatingId === signal.id}
                            onTranslate={handleTranslate}
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted" onClick={() => { setEditingSignal(signal); setIsEditDialogOpen(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(signal.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {signalsData && signalsData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-2 border-t border-border/40 bg-muted/10 shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground">
                Page {signalsData.meta.page} / {signalsData.meta.totalPages} · {signalsData.meta.total.toLocaleString()} total
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 rounded-lg border-border/50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-3 h-3" />Prev
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 rounded-lg border-border/50" onClick={() => setPage(p => Math.min(signalsData.meta.totalPages, p + 1))} disabled={page === signalsData.meta.totalPages}>
                  Next<ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

        </TabsContent>

        <TabsContent value="reports" className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl space-y-8">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Intelligence Reports</h2>
              <p className="text-sm text-muted-foreground">Download signal history in CSV format for offline analysis and archival.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[7, 15, 30, 60].map((days) => (
                <div key={days} className="p-6 rounded-xl border border-border/40 bg-card/30 flex items-center justify-between hover:border-primary/30 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Last {days} Days</h3>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">History since {new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button onClick={() => handleExportCsv(days)} size="sm" className="gap-2 h-8 px-4 text-xs">
                    <FileDown className="w-4 h-4" /> Export CSV
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-8 rounded-2xl border border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="text-sm font-bold text-muted-foreground/80 italic">Advanced Analytics Dashboard Coming Soon</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  We are working on automated PDF executive summaries, trend forecasting, and competitive landscape mapping.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTargetId !== null || deleteBulkTarget} onOpenChange={(open) => { if (!open) { setDeleteTargetId(null); setDeleteBulkTarget(false); } }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-red-500">
              <Trash2 className="w-5 h-5 shrink-0 animate-pulse" />
              <h2 className="text-base font-black uppercase tracking-wider">Confirm Destruction</h2>
            </div>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground leading-relaxed">
            {deleteBulkTarget
              ? `Are you absolutely sure you want to permanently delete the ${selectedIds.size} selected signals? This process is irreversible.`
              : "Are you absolutely sure you want to permanently delete this signal? This process is irreversible."
            }
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDeleteTargetId(null); setDeleteBulkTarget(false); }} className="rounded-lg">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg gap-1.5 shadow-lg shadow-red-500/10"
              onClick={async () => {
                const isBulk = deleteBulkTarget;
                const id = deleteTargetId;
                setDeleteTargetId(null);
                setDeleteBulkTarget(false);
                if (isBulk) {
                  setIsBulkDeleting(true);
                  try {
                    await Promise.all([...selectedIds].map(id => fetch(`${API_BASE}/api/admin/signals/${id}`, { method: "DELETE", credentials: "include" })));
                    setSelectedIds(new Set());
                    mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
                  } finally { setIsBulkDeleting(false); }
                } else if (id) {
                  await fetch(`${API_BASE}/api/admin/signals/${id}`, { method: "DELETE", credentials: "include" });
                  mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
                }
              }}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setEditingSignal(null); }}>
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              <h2 className="text-base font-bold">Edit Signal</h2>
            </div>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest">Title</Label>
              <Input name="title" defaultValue={editingSignal?.title} required className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest">AI Summary</Label>
              <textarea name="aiSummary" defaultValue={editingSignal?.aiSummary || ""} rows={4} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Category</Label>
                <Select name="categoryId" defaultValue={editingSignal?.categoryId} required>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories?.map((cat) => <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Severity</Label>
                <Select name="severity" defaultValue={editingSignal?.severity} required>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">HIGH</SelectItem>
                    <SelectItem value="medium">MEDIUM</SelectItem>
                    <SelectItem value="low">LOW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Score (1–30)</Label>
                <Input name="score" type="number" min="1" max="30" step="0.1" defaultValue={editingSignal?.score} required className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Country (ISO)</Label>
                <Input name="countryCode" placeholder="US, BD…" defaultValue={editingSignal?.countryCode || ""} maxLength={2} className="h-9 font-mono uppercase" />
              </div>
            </div>
            <DialogFooter className="pt-2 border-t border-border/40">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" className="gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TranslateButton({ signalId, isTranslating, onTranslate }: {
  signalId: string;
  isTranslating: boolean;
  onTranslate: (id: string, lang: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const langs = [
    { code: 'bn', label: 'Bengali' },
    { code: 'es', label: 'Spanish' },
    { code: 'en', label: 'English' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !isTranslating && setOpen(v => !v)}
        className="flex items-center justify-center h-7 w-7 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
        title="Translate"
        disabled={isTranslating}
      >
        {isTranslating
          ? <Loader2 className="w-3 h-3 animate-spin text-primary" />
          : <Languages className="w-3 h-3" />
        }
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden min-w-[110px]">
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => { setOpen(false); onTranslate(signalId, l.code); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <span className="text-muted-foreground">→</span>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
