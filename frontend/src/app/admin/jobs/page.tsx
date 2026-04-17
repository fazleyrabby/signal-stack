"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Briefcase, Search, RefreshCw, ExternalLink, MapPin, Building2,
  Settings2, CheckCircle2, XCircle, Clock, Loader2, Check, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Job {
  id: string; title: string; company: string; location: string | null;
  remote: boolean | null; jobType: string | null; salaryRange: string | null;
  url: string; source: string; tags: string[]; createdAt: string;
}
interface JobPreferences {
  keywords: string[]; locations: string[]; remote: boolean | null;
  excludeKeywords: string[]; experienceLevels: string[]; strictGlobalRemote?: boolean;
}

export default function JobsAdmin() {
  const [activeTab, setActiveTab] = useState("feed");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { widths: colWidths, startResize } = useResizableColumns([220, 140, 130, 90, 80, 90, 40]);

  const { data: jobsData, isLoading: jobsLoading } = useSWR(
    `${API_BASE}/api/admin/jobs?page=${page}&limit=30&search=${search}`, fetcher
  );
  const { data: preferences, mutate: mutatePrefs } = useSWR<JobPreferences>(
    `${API_BASE}/api/admin/jobs/preferences`, fetcher
  );

  const handleTriggerFetch = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/admin/jobs/trigger`, { method: 'POST', credentials: "include" });
      toast.success("Job fetch triggered");
      setTimeout(() => mutate(`${API_BASE}/api/admin/jobs?page=${page}&limit=30&search=${search}`), 5000);
    } catch { toast.error("Failed to trigger fetch"); }
    finally { setIsRefreshing(false); }
  };

  const totalPages = jobsData?.total ? Math.ceil(jobsData.total / 30) : 1;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Briefcase className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Job Intelligence</span>
          <span className="text-xs text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
            {jobsData?.total ?? "…"} rows
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-xs" onClick={handleTriggerFetch} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Fetch Jobs
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 border-b border-border/40 bg-muted/10 shrink-0">
          <TabsList className="h-9 bg-transparent p-0 gap-0 border-0">
            <TabsTrigger value="feed" className="h-9 px-4 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
              Live Feed
            </TabsTrigger>
            <TabsTrigger value="preferences" className="h-9 px-4 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
              Discord Filters
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="feed" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          {/* Search bar */}
          <div className="px-6 py-2 border-b border-border/40 shrink-0">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
              <Input placeholder="Search jobs…" className="pl-7 h-7 text-xs bg-background" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table className="min-w-max table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
                  {(["Job Title","Company","Location","Source","Type","Date",""] as const).map((label, i) => (
                    <TableHead key={i} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground overflow-visible" style={{ width: colWidths[i] }}>
                      {label}
                      {i < 6 && <ResizeHandle onMouseDown={(e) => startResize(i, e)} />}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobsLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground/50"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
                ) : jobsData?.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-16 text-xs text-muted-foreground/50 italic">No jobs found.</TableCell></TableRow>
                ) : (
                  jobsData?.data?.map((job: Job) => (
                    <TableRow key={job.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold leading-tight truncate max-w-[190px] block group-hover:text-primary transition-colors" title={job.title}>{job.title}</span>
                          {job.tags?.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {job.tags.slice(0, 4).map(tag => (
                                <span key={tag} className="text-[9px] text-muted-foreground/60 font-mono">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0 opacity-50" />
                          <span className="truncate max-w-[120px]">{job.company}</span>
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0 opacity-50" />
                          <span className="truncate max-w-[110px]">{job.location || "Remote / Global"}</span>
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{job.source}</span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {job.remote && (
                            <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Remote</span>
                          )}
                          {job.jobType && (
                            <span className="text-[9px] text-muted-foreground uppercase">{job.jobType}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span className="text-[10px] font-mono text-muted-foreground/60">{new Date(job.createdAt).toLocaleDateString()}</span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <a href={job.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-7 w-7 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-2 border-t border-border/40 bg-muted/10 shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground">Page {page} / {totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-3 h-3" />Prev
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next<ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden p-6">
          <JobPreferencesForm
            initialPrefs={preferences}
            onSave={async (newPrefs) => {
              await fetch(`${API_BASE}/api/admin/jobs/preferences`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                credentials: "include", body: JSON.stringify(newPrefs)
              });
              mutatePrefs();
              toast.success("Filters saved");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobPreferencesForm({ initialPrefs, onSave }: { initialPrefs?: JobPreferences; onSave: (p: JobPreferences) => Promise<void>; }) {
  const [isSaving, setIsSaving] = useState(false);
  const [remote, setRemote] = useState<boolean | null>(null);
  const [strictGlobalRemote, setStrictGlobalRemote] = useState(false);
  const [raw, setRaw] = useState({ keywords: '', locations: '', excludeKeywords: '', experienceLevels: '' });

  useEffect(() => {
    if (initialPrefs) {
      setRemote(initialPrefs.remote);
      setStrictGlobalRemote(initialPrefs.strictGlobalRemote ?? false);
      setRaw({
        keywords: initialPrefs.keywords.join(', '),
        locations: initialPrefs.locations.join(', '),
        excludeKeywords: initialPrefs.excludeKeywords.join(', '),
        experienceLevels: initialPrefs.experienceLevels.join(', '),
      });
    }
  }, [initialPrefs]);

  const parseField = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ keywords: parseField(raw.keywords), locations: parseField(raw.locations), excludeKeywords: parseField(raw.excludeKeywords), experienceLevels: parseField(raw.experienceLevels), remote, strictGlobalRemote });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/40">
        <Settings2 className="w-4 h-4 text-primary" />
        <div>
          <p className="text-sm font-bold">Discord Alert Filters</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Webhook matching logic</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />Target Keywords
          </Label>
          <Input value={raw.keywords} onChange={(e) => setRaw(r => ({ ...r, keywords: e.target.value }))} placeholder="php, laravel, typescript…" className="h-9 text-sm" />
          <p className="text-[10px] text-muted-foreground">ANY keyword match triggers alert.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
            <XCircle className="w-3 h-3 text-red-500" />Exclusion Keywords
          </Label>
          <Input value={raw.excludeKeywords} onChange={(e) => setRaw(r => ({ ...r, excludeKeywords: e.target.value }))} placeholder="senior, lead, manager…" className="h-9 text-sm" />
          <p className="text-[10px] text-muted-foreground">Any match = immediately discard.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-primary" />Locations
          </Label>
          <Input value={raw.locations} onChange={(e) => setRaw(r => ({ ...r, locations: e.target.value }))} placeholder="London, remote, Germany…" className="h-9 text-sm" />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest">Remote Preference</Label>
          <div className="flex items-center gap-2 pt-1">
            {(['All', 'Remote Only', 'On-Site'] as const).map((opt, idx) => {
              const val = idx === 0 ? null : idx === 1 ? true : false;
              const active = remote === val;
              return (
                <button key={opt} onClick={() => setRemote(val)} className={cn(
                  "px-3 py-1.5 rounded text-xs font-bold transition-all border",
                  active ? "bg-primary text-white border-primary" : "bg-muted/40 border-border/40 hover:bg-muted/70"
                )}>{opt}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Strict global remote */}
      <div className="flex items-start justify-between gap-4 pt-4 border-t border-border/40">
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
            <XCircle className="w-3 h-3 text-orange-500" />Strict Global Remote
          </Label>
          <p className="text-[10px] text-muted-foreground max-w-md">
            Filter out "remote" jobs that are country-locked (US Only, UK Only, EST timezone required, etc.)
          </p>
        </div>
        <button onClick={() => setStrictGlobalRemote(v => !v)} className={cn(
          "shrink-0 px-4 py-1.5 rounded text-xs font-black transition-all border",
          strictGlobalRemote ? "bg-orange-500 text-white border-orange-500" : "bg-muted/40 border-border/40 hover:bg-muted/70"
        )}>
          {strictGlobalRemote ? "ENABLED" : "DISABLED"}
        </button>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button className="h-9 gap-2 px-6" disabled={isSaving} onClick={handleSave}>
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Filters
        </Button>
      </div>
    </div>
  );
}
