"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, ArrowLeft, Loader2, Database } from "lucide-react";
import Link from "next/link";
import { getAdminKey } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, {
  headers: { "x-admin-key": getAdminKey() || "" }
}).then((r) => r.json());

interface Category {
  slug: string;
  name: string;
  description: string;
}

export default function CategoriesAdmin() {
  const { data: categories, isLoading: categoriesLoading } = useSWR<Category[]>(`${API_BASE}/api/admin/categories`, fetcher);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      slug: formData.get("slug"),
      name: formData.get("name"),
      description: formData.get("description"),
    };

    try {
      if (editingCategory) {
        await fetch(`${API_BASE}/api/admin/categories/${editingCategory.slug}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey() || ""
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE}/api/admin/categories`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey() || ""
          },
          body: JSON.stringify(payload),
        });
      }
      mutate(`${API_BASE}/api/admin/categories`);
      setIsDialogOpen(false);
      setEditingCategory(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm("Are you sure? This may orphan many signals.")) return;
    await fetch(`${API_BASE}/api/admin/categories/${slug}`, { 
      method: "DELETE",
      headers: { "x-admin-key": getAdminKey() || "" }
    });
    mutate(`${API_BASE}/api/admin/categories`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      <Header 
        isRefreshing={false} 
        onRefresh={() => {}} 
        searchQuery="" 
        onSearchChange={() => {}} 
        showSearch={false} 
      />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold italic font-serif">Category Protocols</h1>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em] font-bold">
                  <Database className="w-3 h-3" />
                  <span>Schema Management</span>
                </div>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingCategory(null); }}>
              <DialogTrigger render={
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Protocol
              </Button>
            } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Update Protocol" : "Define New Protocol"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Unique Identifier (Slug)</Label>
                    <Input id="slug" name="slug" defaultValue={editingCategory?.slug} placeholder="e.g. tech-finance" required readOnly={!!editingCategory} className={editingCategory ? "bg-muted" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input id="name" name="name" defaultValue={editingCategory?.name} placeholder="e.g. Technology & Finance" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">System Description</Label>
                    <Input id="description" name="description" defaultValue={editingCategory?.description} placeholder="Short description..." required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingCategory ? "Save Update" : "Register Category"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden backdrop-blur-sm shadow-xl">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[200px]">Slug</TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriesLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 opacity-50 italic">Retrieving protocol manifest...</TableCell></TableRow>
                )}
                {categories?.map((cat) => (
                  <TableRow key={cat.slug} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-mono text-xs text-primary font-bold">{cat.slug}</TableCell>
                    <TableCell className="font-semibold">{cat.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground italic truncate max-w-[300px]">
                      {cat.description || "No description set"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCategory(cat); setIsDialogOpen(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => handleDelete(cat.slug)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
