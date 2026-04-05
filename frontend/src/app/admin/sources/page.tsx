"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Edit2, Plus, Rss, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

import { getAdminKey } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, {
  headers: { "x-admin-key": getAdminKey() || "" }
}).then((r) => r.json());

interface Source {
  id: string;
  name: string;
  url: string;
  categoryId: string;
  trustScore: number;
  isActive: boolean;
}

interface Category {
  slug: string;
  name: string;
}

export default function SourcesAdmin() {
  const { data: sources, isLoading: sourcesLoading } = useSWR<Source[]>(`${API_BASE}/api/admin/sources`, fetcher);
  const { data: categories } = useSWR<Category[]>(`${API_BASE}/api/admin/categories`, fetcher);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      url: formData.get("url"),
      categoryId: formData.get("categoryId"),
      trustScore: parseInt(formData.get("trustScore") as string, 10),
      isActive: true, // Default to true for new ones
    };

    try {
      if (editingSource) {
        await fetch(`${API_BASE}/api/admin/sources/${editingSource.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey() || ""
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE}/api/admin/sources`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey() || ""
          },
          body: JSON.stringify(payload),
        });
      }
      mutate(`${API_BASE}/api/admin/sources`);
      setIsDialogOpen(false);
      setEditingSource(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure?")) return;
    await fetch(`${API_BASE}/api/admin/sources/${id}`, { 
      method: "DELETE",
      headers: { "x-admin-key": getAdminKey() || "" }
    });
    mutate(`${API_BASE}/api/admin/sources`);
  }

  async function toggleActive(source: Source) {
    await fetch(`${API_BASE}/api/admin/sources/${source.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "x-admin-key": getAdminKey() || ""
      },
      body: JSON.stringify({ isActive: !source.isActive }),
    });
    mutate(`${API_BASE}/api/admin/sources`);
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
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Manage Sources</h1>
                <p className="text-sm text-muted-foreground italic font-mono">SignalStack Ingestion Engine</p>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingSource(null); }}>
              <DialogTrigger render={
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Source
              </Button>
            } />
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingSource ? "Edit Source" : "Add New Feed Source"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Friendly Name</Label>
                    <Input id="name" name="name" defaultValue={editingSource?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">RSS Feed URL</Label>
                    <Input id="url" name="url" defaultValue={editingSource?.url} type="url" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="categoryId">Category</Label>
                      <Select name="categoryId" defaultValue={editingSource?.categoryId} required>
                        <SelectTrigger>
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
                      <Label htmlFor="trustScore">Trust Score (1-5)</Label>
                      <Input id="trustScore" name="trustScore" type="number" min="1" max="5" defaultValue={editingSource?.trustScore ?? 3} required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingSource ? "Save Changes" : "Create Source"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden backdrop-blur-sm shadow-xl">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[300px]">Source Details</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Trust</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourcesLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 opacity-50 italic">Scanning database for active nodes...</TableCell></TableRow>
                )}
                {sources?.map((source) => (
                  <TableRow key={source.id} className="hover:bg-muted/20 transition-colors group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{source.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[250px] font-mono break-all">{source.url}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="px-2 py-0.5 uppercase tracking-widest text-[9px]">
                        {source.categoryId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-1 w-3 rounded-full ${i <= source.trustScore ? "bg-emerald-500" : "bg-muted"}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={source.isActive} onCheckedChange={() => toggleActive(source)} />
                        <span className={`text-[10px] font-bold ${source.isActive ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {source.isActive ? "ONLINE" : "OFFLINE"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingSource(source); setIsDialogOpen(true); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => handleDelete(source.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
