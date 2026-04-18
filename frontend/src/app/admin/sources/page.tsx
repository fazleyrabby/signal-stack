"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, toggleSort } from "@/components/ui/sortable-head";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Edit2, Plus, Rss, Loader2, Activity, CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Source { id: string; name: string; url: string; categoryId: string; trustScore: number; isActive: boolean; }
interface Category { slug: string; name: string; }

export default function SourcesAdmin() {
  const router = useRouter();
  const { data: sources, isLoading, error } = useSWR<Source[]>(`${API_BASE}/api/admin/sources`, fetcher, { shouldRetryOnError: false });
  const { data: categories } = useSWR<Category[]>(`${API_BASE}/api/admin/categories`, fetcher);

  useEffect(() => { if (error) router.replace("/admin-login"); }, [error, router]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
  const [healthResults, setHealthResults] = useState<Record<string, any>>({});
  const { widths: colWidths, startResize } = useResizableColumns([280, 110, 90, 120, 100]);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  function handleSort(col: string) { const n = toggleSort({ sort, order }, col); setSort(n.sort); setOrder(n.order); }

  const sortedSources = [...(sources ?? [])].sort((a: any, b: any) => {
    const av = a[sort] ?? ""; const bv = b[sort] ?? "";
    return order === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = { name: formData.get("name"), url: formData.get("url"), categoryId: formData.get("categoryId"), trustScore: parseInt(formData.get("trustScore") as string, 10), isActive: true };
    try {
      if (editingSource) {
        await fetch(`${API_BASE}/api/admin/sources/${editingSource.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      } else {
        await fetch(`${API_BASE}/api/admin/sources`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      }
      mutate(`${API_BASE}/api/admin/sources`);
      setIsDialogOpen(false); setEditingSource(null);
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this source?")) return;
    await fetch(`${API_BASE}/api/admin/sources/${id}`, { method: "DELETE", credentials: "include" });
    mutate(`${API_BASE}/api/admin/sources`);
  }

  async function handleHealthCheck(id: string) {
    setCheckingHealth(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/sources/${id}/health`, { method: 'POST', credentials: 'include' });
      const result = await res.json();
      setHealthResults(prev => ({ ...prev, [id]: result }));
    } catch { setHealthResults(prev => ({ ...prev, [id]: { status: 'error' } })); }
    finally { setCheckingHealth(null); }
  }

  async function toggleActive(source: Source) {
    await fetch(`${API_BASE}/api/admin/sources/${source.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isActive: !source.isActive }) });
    mutate(`${API_BASE}/api/admin/sources`);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Rss className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Intelligence Sources</span>
          <span className="text-xs text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
            {sources?.length ?? "…"} feeds
          </span>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingSource(null); }}>
          <DialogTrigger render={
            <Button size="sm" className="h-7 gap-1.5 px-3 text-xs">
              <Plus className="w-3 h-3" />Add Source
            </Button>
          } />
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{editingSource ? "Edit Source" : "Add Feed Source"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Name</Label>
                <Input name="name" defaultValue={editingSource?.name} required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">RSS URL</Label>
                <Input name="url" defaultValue={editingSource?.url} type="url" required className="h-9 font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest">Category</Label>
                  <Select name="categoryId" defaultValue={editingSource?.categoryId} required>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories?.map((cat) => <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest">Trust (1–5)</Label>
                  <Input name="trustScore" type="number" min="1" max="5" defaultValue={editingSource?.trustScore ?? 3} required className="h-9" />
                </div>
              </div>
              <Button type="submit" className="w-full h-9" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {editingSource ? "Save Changes" : "Create Source"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table className="min-w-max table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
              <SortableHead label="Source" column="name" sort={sort} order={order} onSort={handleSort} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider overflow-visible" style={{ width: colWidths[0] }}>
                <ResizeHandle onMouseDown={(e) => startResize(0, e)} />
              </SortableHead>
              <SortableHead label="Category" column="categoryId" sort={sort} order={order} onSort={handleSort} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider overflow-visible" style={{ width: colWidths[1] }}>
                <ResizeHandle onMouseDown={(e) => startResize(1, e)} />
              </SortableHead>
              <SortableHead label="Trust Score" column="trustScore" sort={sort} order={order} onSort={handleSort} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider overflow-visible" style={{ width: colWidths[2] }}>
                <ResizeHandle onMouseDown={(e) => startResize(2, e)} />
              </SortableHead>
              <SortableHead label="Status" column="isActive" sort={sort} order={order} onSort={handleSort} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider overflow-visible" style={{ width: colWidths[3] }}>
                <ResizeHandle onMouseDown={(e) => startResize(3, e)} />
              </SortableHead>
              <TableHead className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right" style={{ width: colWidths[4] }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-16 text-muted-foreground/50"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
            )}
            {sortedSources.map((source) => (
              <TableRow key={source.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                <TableCell className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold truncate max-w-[160px] block" title={source.name}>{source.name}</span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[220px] block">{source.url}</span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-wider bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{source.categoryId}</span>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1 w-2.5 rounded-sm ${i <= source.trustScore ? "bg-emerald-500" : "bg-muted"}`} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={source.isActive} onCheckedChange={() => toggleActive(source)} className="scale-75 origin-left" />
                    <span className={`text-[9px] font-bold uppercase ${source.isActive ? "text-emerald-500" : "text-muted-foreground/50"}`}>
                      {source.isActive ? "Online" : "Offline"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleHealthCheck(source.id)} disabled={checkingHealth === source.id} title="Check health">
                      {checkingHealth === source.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                       healthResults[source.id]?.status === 'healthy' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> :
                       healthResults[source.id]?.status === 'error' ? <XCircle className="w-3 h-3 text-red-500" /> :
                       <Activity className="w-3 h-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSource(source); setIsDialogOpen(true); }}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(source.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
