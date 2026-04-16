"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit2, ArrowLeft, Loader2, Languages, Search, SlidersHorizontal, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Clock, Activity } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Translation {
  title: string;
  aiSummary: string;
  v: number;
}

interface Signal {
  id: string;
  title: string;
  content: string | null;
  summary: string | null;
  aiSummary: string | null;
  url: string;
  score: number;
  severity: "high" | "medium" | "low";
  categoryId: string;
  source: string;
  countryCode: string | null;
  aiProcessed: boolean;
  aiFailed: boolean;
  aiProvider: string | null;
  translations: Record<string, Translation>;
  publishedAt: string | null;
  createdAt: string;
}

interface SignalsResponse {
  data: Signal[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Category {
  slug: string;
  name: string;
}

export default function SignalsAdmin() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // State for filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [hasTranslation, setHasTranslation] = useState<string>("all");
  const [lang, setLang] = useState<string>("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  // Fetching data
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    sort,
    order,
    ...(search && { search }),
    ...(severity !== "all" && { severity }),
    ...(minScore !== "0" && { minScore }),
    ...(categoryId !== "all" && { categoryId }),
    ...(hasTranslation !== "all" && { hasTranslation }),
    ...(lang !== "all" && { lang }),
  });

  const { data: signalsData, isLoading: signalsLoading, error: signalsError } = useSWR<SignalsResponse>(
    `${API_BASE}/api/admin/signals?${queryParams.toString()}`,
    fetcher,
    { shouldRetryOnError: false }
  );

  const { data: categories } = useSWR<Category[]>(`${API_BASE}/api/admin/categories`, fetcher);

  useEffect(() => {
    if (signalsError) {
      router.replace("/admin-login");
    }
  }, [signalsError, router]);

  // Actions state
  const [editingSignal, setEditingSignal] = useState<Signal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  const [bulkLang, setBulkLang] = useState("bn");

  // Handlers
  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this signal?")) return;
    try {
      await fetch(`${API_BASE}/api/admin/signals/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
    } catch (error) {
      console.error("Failed to delete signal", error);
    }
  }

  async function handleTranslate(id: string, targetLang: string) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/signals/${id}/translate?lang=${targetLang}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        alert(`Queued translation for ${targetLang}`);
        mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
      }
    } catch (error) {
      console.error("Failed to queue translation", error);
    }
  }

  async function handleBulkTranslate(e: React.FormEvent) {
    e.preventDefault();
    setIsBulkTranslating(true);
    try {
      const payload = {
        lang: bulkLang,
        filter: {
          ...(severity !== "all" && { severity }),
          ...(minScore !== "0" && { minScore: parseInt(minScore) }),
          ...(categoryId !== "all" && { categoryId }),
        }
      };
      const res = await fetch(`${API_BASE}/api/admin/signals/translate/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Queued ${data.queued} signals for bulk translation to ${bulkLang}`);
      }
    } catch (error) {
      console.error("Bulk translation failed", error);
    } finally {
      setIsBulkTranslating(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSignal) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get("title"),
      aiSummary: formData.get("aiSummary"),
      severity: formData.get("severity"),
      score: parseInt(formData.get("score") as string, 10),
      categoryId: formData.get("categoryId"),
      countryCode: formData.get("countryCode") || null,
    };

    try {
      await fetch(`${API_BASE}/api/admin/signals/${editingSignal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      mutate((key) => typeof key === 'string' && key.startsWith(`${API_BASE}/api/admin/signals`));
      setIsEditDialogOpen(false);
      setEditingSignal(null);
    } catch (error) {
      console.error("Failed to update signal", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight">Signals Intelligence</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {signalsData?.meta.total.toLocaleString() || "..."} total signals detected
            </p>
          </div>

          {/* Bulk Translate Bar */}
          <form onSubmit={handleBulkTranslate} className="flex items-center gap-2 bg-card/50 p-2 rounded-2xl border border-border/10 shadow-sm backdrop-blur-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3">Bulk Queue</span>
            <Select value={bulkLang} onValueChange={(val) => { if (typeof val === 'string') setBulkLang(val); }}>
              <SelectTrigger className="w-[90px] h-9 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bn">Bengali</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-9 gap-2 px-4 rounded-lg shadow-lg shadow-primary/20" disabled={isBulkTranslating}>
              {isBulkTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-bold uppercase tracking-widest">Execute</span>
            </Button>
          </form>
        </div>

          {/* Filters Bar */}
          <div className="bg-card/30 p-4 rounded-lg border border-border/50 backdrop-blur-sm shadow-sm space-y-3">
            {/* Row 1: Search + Sort */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative group flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search title, source, content..."
                  className="pl-9 h-9 text-xs w-full"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <Select value={sort} onValueChange={(val) => { if (typeof val === 'string') { setSort(val); setPage(1); } }}>
                  <SelectTrigger className="h-9 text-xs w-[160px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Sort: Created</SelectItem>
                    <SelectItem value="publishedAt">Sort: Published</SelectItem>
                    <SelectItem value="score">Sort: Score</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 border border-border/50"
                  onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
                  title={order === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <SlidersHorizontal className={cn("w-3.5 h-3.5 transition-transform", order === 'asc' && "rotate-180")} />
                </Button>
              </div>
            </div>

            {/* Row 2: Dimension filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <Select value={severity} onValueChange={(val) => { if (typeof val === 'string') { setSeverity(val); setPage(1); } }}>
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High (≥8)</SelectItem>
                  <SelectItem value="medium">Medium (5–7)</SelectItem>
                  <SelectItem value="low">Low (&lt;5)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={minScore} onValueChange={(val) => { if (typeof val === 'string') { setMinScore(val); setPage(1); } }}>
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Min Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Min Score: Any</SelectItem>
                  <SelectItem value="5">Min Score: 5+</SelectItem>
                  <SelectItem value="6">Min Score: 6+</SelectItem>
                  <SelectItem value="7">Min Score: 7+ (High)</SelectItem>
                  <SelectItem value="8">Min Score: 8+ (Critical)</SelectItem>
                  <SelectItem value="9">Min Score: 9+</SelectItem>
                  <SelectItem value="10">Min Score: 10+</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryId} onValueChange={(val) => { if (typeof val === 'string') { setCategoryId(val); setPage(1); } }}>
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={hasTranslation} onValueChange={(val) => { if (typeof val === 'string') { setHasTranslation(val); setPage(1); } }}>
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Translation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Translations</SelectItem>
                  <SelectItem value="true">Has Translation</SelectItem>
                  <SelectItem value="false">No Translation</SelectItem>
                </SelectContent>
              </Select>

              <Select value={lang} onValueChange={(val) => { if (typeof val === 'string') { setLang(val); setPage(1); } }}>
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">Bengali</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Signals Table */}
          <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden backdrop-blur-sm shadow-xl">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[400px]">Signal Detail</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Translations</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signalsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2 opacity-50 italic">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Intercepting signals...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : signalsData?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20 opacity-50 italic">
                      No signals match current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  signalsData?.data.map((signal) => (
                    <TableRow key={signal.id} className="hover:bg-muted/20 transition-colors group">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                            {signal.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                            <span className="bg-secondary px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">{signal.source}</span>
                            <a href={signal.url} target="_blank" className="hover:underline truncate max-w-[200px]">{signal.url}</a>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Badge className={cn(
                              "text-[9px] font-black uppercase px-1.5 py-0 h-4 tracking-wider",
                              signal.severity === 'high' ? "bg-red-500/20 text-red-500 border-red-500/20" :
                              signal.severity === 'medium' ? "bg-amber-500/20 text-amber-500 border-amber-500/20" :
                              "bg-emerald-500/20 text-emerald-500 border-emerald-500/20"
                            )} variant="outline">
                              {signal.severity}
                            </Badge>
                            <span className="text-xs font-bold font-mono">
                              {signal.score.toFixed(1)}
                            </span>
                          </div>
                          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                signal.score > 20 ? "bg-red-500" : signal.score > 10 ? "bg-amber-500" : "bg-emerald-500"
                              )} 
                              style={{ width: `${(signal.score / 30) * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="px-2 py-0.5 uppercase tracking-widest text-[9px] font-bold">
                          {signal.categoryId}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {signal.aiProcessed ? (
                            <div className="flex items-center gap-1.5 text-emerald-500">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-tighter">Processed</span>
                            </div>
                          ) : signal.aiFailed ? (
                            <div className="flex items-center gap-1.5 text-red-500">
                              <XCircle className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-tighter">Failed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-500">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-tighter">Pending</span>
                            </div>
                          )}
                          {signal.aiProvider && (
                            <span className="text-[8px] text-muted-foreground font-mono uppercase">via {signal.aiProvider}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {Object.keys(signal.translations).length > 0 ? (
                            Object.keys(signal.translations).map(l => (
                              <Badge key={l} variant="outline" className="text-[8px] font-black uppercase px-1 py-0 h-4 min-w-[20px] justify-center bg-blue-500/5 text-blue-400 border-blue-400/20">
                                {l}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[9px] text-muted-foreground italic font-mono">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-[10px] font-mono leading-tight">
                          <span className="text-foreground">{new Date(signal.createdAt).toLocaleDateString()}</span>
                          <span className="text-muted-foreground opacity-50">{new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Translate Dropdown */}
                          <Select onValueChange={(val) => { if (typeof val === 'string') handleTranslate(signal.id, val); }}>
                            <SelectTrigger className="h-8 w-8 p-0 bg-transparent border-none shadow-none hover:bg-muted focus:ring-0">
                               <Languages className="w-3.5 h-3.5" />
                            </SelectTrigger>
                            <SelectContent align="end">
                               <SelectItem value="bn">Translate to Bengali</SelectItem>
                               <SelectItem value="es">Translate to Spanish</SelectItem>
                               <SelectItem value="en">Translate to English</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => { setEditingSignal(signal); setIsEditDialogOpen(true); }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleDelete(signal.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {signalsData && signalsData.meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-t border-border/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Page {signalsData.meta.page} of {signalsData.meta.totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1 rounded-lg border-border/50" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase">Prev</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1 rounded-lg border-border/50" 
                    onClick={() => setPage(p => Math.min(signalsData.meta.totalPages, p + 1))}
                    disabled={page === signalsData.meta.totalPages}
                  >
                    <span className="text-[10px] font-bold uppercase">Next</span>
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          </div>

          {/* Edit Dialog */}      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if(!open) setEditingSignal(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Edit2 className="w-4 h-4" />
              <h2 className="text-xl font-bold uppercase tracking-tight">Modify Intelligence Signal</h2>
            </div>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest">Signal Title</Label>
              <Input id="title" name="title" defaultValue={editingSignal?.title} required className="font-bold h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiSummary" className="text-[10px] font-black uppercase tracking-widest">AI Summary / Content Analysis</Label>
              <textarea 
                id="aiSummary" 
                name="aiSummary" 
                defaultValue={editingSignal?.aiSummary || ""} 
                rows={5}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="categoryId" className="text-[10px] font-black uppercase tracking-widest">Classification</Label>
                <Select name="categoryId" defaultValue={editingSignal?.categoryId} required>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity" className="text-[10px] font-black uppercase tracking-widest">Severity Level</Label>
                <Select name="severity" defaultValue={editingSignal?.severity} required>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">HIGH</SelectItem>
                    <SelectItem value="medium">MEDIUM</SelectItem>
                    <SelectItem value="low">LOW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="score" className="text-[10px] font-black uppercase tracking-widest">Intelligence Score (1-30)</Label>
                <Input id="score" name="score" type="number" min="1" max="30" step="0.1" defaultValue={editingSignal?.score} required className="h-10 font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryCode" className="text-[10px] font-black uppercase tracking-widest">Geographic Origin (ISO)</Label>
                <Input id="countryCode" name="countryCode" placeholder="e.g. US, BD, RU" defaultValue={editingSignal?.countryCode || ""} maxLength={2} className="h-10 font-mono uppercase" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="text-[10px] font-black uppercase tracking-widest">Cancel</Button>
              <Button type="submit" className="gap-2 h-10 px-8" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-widest">Commit Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
