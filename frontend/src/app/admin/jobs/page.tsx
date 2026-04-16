"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Briefcase, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  MapPin, 
  Building2, 
  Settings2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean | null;
  jobType: string | null;
  salaryRange: string | null;
  url: string;
  source: string;
  tags: string[];
  createdAt: string;
}

interface JobPreferences {
  keywords: string[];
  locations: string[];
  remote: boolean | null;
  excludeKeywords: string[];
  experienceLevels: string[];
}

export default function JobsAdmin() {
  const [activeTab, setActiveTab] = useState("feed");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: jobsData, isLoading: jobsLoading } = useSWR(
    `${API_BASE}/api/admin/jobs?page=${page}&search=${search}`,
    fetcher
  );

  const { data: preferences, isLoading: prefsLoading, mutate: mutatePrefs } = useSWR<JobPreferences>(
    `${API_BASE}/api/admin/jobs/preferences`,
    fetcher
  );

  const handleTriggerFetch = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/admin/jobs/trigger`, { method: 'POST', credentials: "include" });
      toast.success("Job fetch triggered in background");
      setTimeout(() => mutate(`${API_BASE}/api/admin/jobs?page=${page}&search=${search}`), 5000);
    } catch (e) {
      toast.error("Failed to trigger fetch");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header isRefreshing={false} onRefresh={() => {}} showSearch={false} isFullWidth={true} />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black italic font-serif flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-primary" />
              Job Tactical Intelligence
            </h1>
            <p className="text-muted-foreground text-sm font-mono uppercase tracking-widest mt-1">
              Automated Acquisition & Filtering Node
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 font-bold"
              onClick={handleTriggerFetch}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Fetch Jobs
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1">
            <TabsTrigger value="feed" className="font-bold data-[state=active]:bg-background">
              LIVE FEED
            </TabsTrigger>
            <TabsTrigger value="preferences" className="font-bold data-[state=active]:bg-background">
              DISCORD FILTERS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-6 space-y-6">
            <div className="relative group max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input 
                placeholder="Search jobs in terminal..." 
                className="pl-10 bg-card border-border/50 font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid gap-4">
              {jobsLoading ? (
                <div className="py-20 text-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm font-mono italic opacity-50">Synchronizing tactical job data...</p>
                </div>
              ) : jobsData?.data?.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-xl">
                  <p className="text-muted-foreground italic">No tactical data found matching current criteria.</p>
                </div>
              ) : (
                jobsData?.data?.map((job: Job) => (
                  <JobCard key={job.id} job={job} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="mt-6">
            <JobPreferencesForm 
              initialPrefs={preferences} 
              onSave={async (newPrefs) => {
                await fetch(`${API_BASE}/api/admin/jobs/preferences`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: "include",
                  body: JSON.stringify(newPrefs)
                });
                mutatePrefs();
                toast.success("Filters updated successfully");
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <Card className="bg-card/50 border-border/40 hover:border-primary/30 transition-all group overflow-hidden">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1">
                {job.title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  {job.company}
                </span>
                <span className="flex items-center gap-1.5 italic">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location || "Remote / Global"}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] opacity-60">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <a 
              href={job.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="shrink-0 p-2 rounded-lg bg-accent/30 hover:bg-primary hover:text-white transition-all"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {job.remote && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-black tracking-tighter">
                REMOTE
              </Badge>
            )}
            {job.jobType && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                {job.jobType}
              </Badge>
            )}
            {job.tags?.slice(0, 5).map(tag => (
              <Badge key={tag} variant="secondary" className="bg-muted/50 text-[10px] font-medium lowercase">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobPreferencesForm({ initialPrefs, onSave }: { initialPrefs?: JobPreferences, onSave: (p: JobPreferences) => Promise<void> }) {
  const [isSaving, setIsSaving] = useState(false);
  const [prefs, setPrefs] = useState<JobPreferences>({
    keywords: [],
    locations: [],
    remote: null,
    excludeKeywords: [],
    experienceLevels: []
  });

  useEffect(() => {
    if (initialPrefs) setPrefs(initialPrefs);
  }, [initialPrefs]);

  const updateArrayField = (field: keyof JobPreferences, value: string) => {
    const items = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setPrefs(p => ({ ...p, [field]: items }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(prefs);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border/50 shadow-xl overflow-hidden">
      <div className="bg-primary/5 p-6 border-b border-border/10">
        <div className="flex items-center gap-3">
          <Settings2 className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Discord Alert Protocols</h2>
            <p className="text-xs text-muted-foreground font-mono uppercase mt-0.5">Control automated webhook matching logic</p>
          </div>
        </div>
      </div>
      
      <CardContent className="p-8 space-y-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="font-black text-[12px] uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Target Keywords (Comma Separated)
            </Label>
            <Input 
              value={prefs.keywords.join(', ')}
              onChange={(e) => updateArrayField('keywords', e.target.value)}
              placeholder="php, laravel, typescript, node..."
              className="bg-accent/10 border-border/30 h-11"
            />
            <p className="text-[11px] text-muted-foreground italic">Alerts sent if ANY of these keywords match Title, Tags, or Description.</p>
          </div>

          <div className="space-y-3">
            <Label className="font-black text-[12px] uppercase tracking-wider flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Exclusion Keywords
            </Label>
            <Input 
              value={prefs.excludeKeywords.join(', ')}
              onChange={(e) => updateArrayField('excludeKeywords', e.target.value)}
              placeholder="senior, lead, manager, recruitment..."
              className="bg-accent/10 border-border/30 h-11"
            />
            <p className="text-[11px] text-muted-foreground italic">IMMEDIATELY discard matches containing any of these terms.</p>
          </div>

          <div className="space-y-3">
            <Label className="font-black text-[12px] uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Locations
            </Label>
            <Input 
              value={prefs.locations.join(', ')}
              onChange={(e) => updateArrayField('locations', e.target.value)}
              placeholder="London, remote, Germany..."
              className="bg-accent/10 border-border/30 h-11"
            />
          </div>

          <div className="space-y-3">
            <Label className="font-black text-[12px] uppercase tracking-wider flex items-center gap-2">
              Remote Preference
            </Label>
            <div className="flex items-center gap-4 pt-2">
               {['All', 'Remote Only', 'On-Site Only'].map((opt, idx) => {
                  const val = idx === 0 ? null : idx === 1 ? true : false;
                  const active = prefs.remote === val;
                  return (
                    <button
                      key={opt}
                      onClick={() => setPrefs(p => ({ ...p, remote: val }))}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-black transition-all border",
                        active ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-accent/20 border-border/40 hover:bg-accent/40"
                      )}
                    >
                      {opt.toUpperCase()}
                    </button>
                  );
               })}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border/10 flex justify-end">
          <Button 
            className="w-full md:w-auto px-12 h-12 font-black gap-2 shadow-xl shadow-primary/10"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            COMMIT PROTOCOL UPDATES
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
