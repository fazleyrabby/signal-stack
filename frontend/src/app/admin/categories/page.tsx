"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Loader2, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Category { slug: string; name: string; description: string; }

export default function CategoriesAdmin() {
  const router = useRouter();
  const { data: categories, isLoading, error } = useSWR<Category[]>(`${API_BASE}/api/admin/categories`, fetcher, { shouldRetryOnError: false });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { widths: colWidths, startResize } = useResizableColumns([160, 200, 320, 80]);

  useEffect(() => { if (error) router.replace("/admin-login"); }, [error, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = { slug: formData.get("slug"), name: formData.get("name"), description: formData.get("description") };
    try {
      if (editingCategory) {
        await fetch(`${API_BASE}/api/admin/categories/${editingCategory.slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      } else {
        await fetch(`${API_BASE}/api/admin/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      }
      mutate(`${API_BASE}/api/admin/categories`);
      setIsDialogOpen(false); setEditingCategory(null);
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(slug: string) {
    if (!confirm("Delete this category? This may orphan many signals.")) return;
    await fetch(`${API_BASE}/api/admin/categories/${slug}`, { method: "DELETE", credentials: "include" });
    mutate(`${API_BASE}/api/admin/categories`);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Categories</span>
          <span className="text-xs text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
            {categories?.length ?? "…"} protocols
          </span>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCategory(null); }}>
          <DialogTrigger render={
            <Button size="sm" className="h-7 gap-1.5 px-3 text-xs">
              <Plus className="w-3 h-3" />New Protocol
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Update Protocol" : "New Protocol"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Slug</Label>
                <Input name="slug" defaultValue={editingCategory?.slug} placeholder="e.g. tech-finance" required readOnly={!!editingCategory} className={`h-9 font-mono ${editingCategory ? "bg-muted" : ""}`} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Display Name</Label>
                <Input name="name" defaultValue={editingCategory?.name} placeholder="e.g. Technology & Finance" required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Description</Label>
                <Input name="description" defaultValue={editingCategory?.description} placeholder="Short description..." required className="h-9" />
              </div>
              <Button type="submit" className="w-full h-9" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {editingCategory ? "Save Update" : "Register Category"}
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
              {(["Slug","Name","Description","Actions"] as const).map((label, i) => (
                <TableHead key={label} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground overflow-visible" style={{ width: colWidths[i] }}>
                  <span className={i === 3 ? "flex justify-end" : ""}>{label}</span>
                  {i < 3 && <ResizeHandle onMouseDown={(e) => startResize(i, e)} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center py-16 text-muted-foreground/50"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
            )}
            {categories?.map((cat) => (
              <TableRow key={cat.slug} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <TableCell className="px-4 py-2 font-mono text-xs text-primary font-bold">{cat.slug}</TableCell>
                <TableCell className="px-3 py-2 text-xs font-semibold">{cat.name}</TableCell>
                <TableCell className="px-3 py-2 text-xs text-muted-foreground italic">{cat.description || "—"}</TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(cat); setIsDialogOpen(true); }}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(cat.slug)}>
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
