"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Rss, Layers, ShieldCheck, Brain, RefreshCw, BarChart3, Globe, Cpu, AlertTriangle, TrendingUp, Bot, XCircle, Zap, Server, Activity, Lightbulb, Search, ChevronDown, ChevronRight, Check, Users, Languages, Loader2, Clock, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SignalStats } from "@/lib/api";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized or server error");
  return r.json();
});

type ProviderHealth = {
  status: "healthy" | "unhealthy" | "no_api_key" | "disabled";
  latency?: number;
  error?: string;
  model?: string;
};

type AIHealth = {
  local: ProviderHealth;
  macLocal?: ProviderHealth;
  groq: ProviderHealth;
  openrouter: ProviderHealth;
  localEnabled: boolean;
  macLocalEnabled?: boolean;
  pipeline: string;
  queueSize: number;
  tokenUsage?: {
    groq: { today: { prompt: number; completion: number; total: number }; allTime: { prompt: number; completion: number; total: number } };
    openrouter: { today: { prompt: number; completion: number; total: number }; allTime: { prompt: number; completion: number; total: number } };
    macLocal?: { today: { prompt: number; completion: number; total: number }; allTime: { prompt: number; completion: number; total: number } };
  };
};

type LLMModel = {
  id: string;
  name: string;
  provider: "groq" | "openrouter";
  contextLength: number;
};

type ModelsResponse = {
  groq: LLMModel[];
  openrouter: LLMModel[];
  selected: { groqModel: string; openrouterModel: string };
  cached?: boolean;
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "healthy" ? "bg-emerald-500 shadow-emerald-500/50" :
    status === "disabled" || status === "no_api_key" ? "bg-yellow-500 shadow-yellow-500/50" :
    "bg-red-500 shadow-red-500/50";

  return <span className={cn("inline-block w-2 h-2 rounded-full shadow-sm", color)} />;
}

function StatusLabel({ status }: { status: string }) {
  const styles =
    status === "healthy" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    status === "disabled" ? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" :
    status === "no_api_key" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
    "text-red-400 bg-red-500/10 border-red-500/20";

  const label =
    status === "healthy" ? "ONLINE" :
    status === "disabled" ? "DISABLED" :
    status === "no_api_key" ? "NO KEY" :
    "OFFLINE";

  return (
    <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border", styles)}>
      {label}
    </span>
  );
}

function StatCard({ label, value, icon, accent, action }: { label: string; value: number | string | undefined; icon: React.ReactNode; accent?: string; action?: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-3 py-3 px-4 rounded-lg bg-secondary/30 border border-border/40">
      <div className={cn("w-9 h-9 rounded-md flex items-center justify-center", accent || "bg-primary/10")}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-xl font-black tracking-tight text-foreground">{value ?? "..."}</div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      {action && (
        <div className="absolute top-2 right-2">
          {action}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ name, icon, health }: { name: string; icon: React.ReactNode; health?: ProviderHealth }) {
  const status = health?.status || "unhealthy";

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/30 border border-border/40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status={status} />
            <span className="text-sm font-bold tracking-tight text-foreground">{name}</span>
          </div>
          {health?.latency !== undefined && (
            <span className="text-[10px] text-muted-foreground font-medium">{health.latency}ms latency</span>
          )}
          {health?.model && (
            <span className="text-[10px] text-blue-400 font-medium">{health.model}</span>
          )}
          {health?.error && (
            <span className="text-[10px] text-red-400 font-medium">{health.error}</span>
          )}
        </div>
      </div>
      <StatusLabel status={status} />
    </div>
  );
}

function SearchableModelSelect({
  models,
  value,
  onValueChange,
  disabled,
}: {
  models: LLMModel[];
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = models.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  const selectedModel = models.find((m) => m.id === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="flex w-full items-center justify-between h-7 px-2 text-xs rounded-md border border-input bg-transparent hover:bg-input/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="truncate text-left">
          {selectedModel?.name || "Select model"}
        </span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-3">No models found</div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onValueChange(m.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    m.id === value && "bg-accent/50"
                  )}
                >
                  <span className="truncate">{m.name}</span>
                  {m.id === value && <Check className="w-3 h-3 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type MetricsResponse = {
  translation: { enqueued: number; completed: number; failed: number; latency: Record<string, { avgMs: number; count: number }> };
  aiSummary: { enqueued: number; completed: number; failed: number };
  cache: { hits: number; misses: number; hitRatio: number };
  queue: { translationDepth: number; aiSummaryDepth: number };
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [isSendingTestDigest, setIsSendingTestDigest] = useState(false);
  const { data: statsData, mutate: refreshStats } = useSWR<SignalStats>(`${API_BASE}/api/signals/stats`, fetcher);
  const { data: aiHealth, isValidating: aiLoading, mutate: refreshAI, error: aiError } = useSWR<AIHealth>(
    `${API_BASE}/api/admin/ai/health`,
    fetcher,
    { refreshInterval: 60000, shouldRetryOnError: false }
  );
  const { data: metrics, mutate: refreshMetrics } = useSWR<MetricsResponse>(
    `${API_BASE}/api/admin/metrics`,
    fetcher,
    { refreshInterval: 30000 }
  );

  useEffect(() => {
    if (aiError) {
      router.replace("/admin-login");
    }
  }, [aiError, router]);
  const { data: modelsData, mutate: refreshModels } = useSWR<ModelsResponse>(
    `${API_BASE}/api/admin/ai/models`,
    fetcher
  );
  const { data: providerStats } = useSWR<{ provider: string; count: number }[]>(
    `${API_BASE}/api/signals/ai-providers`,
    fetcher
  );
  const { data: visitorStats } = useSWR<{ total: number; today: number; realtime: number }>(
    `${API_BASE}/api/visitors/stats`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const handleModelChange = async (provider: 'groq' | 'openrouter', modelId: string | null) => {
    if (!modelId) return;
    setIsUpdatingModel(true);
    try {
      await fetch(`${API_BASE}/api/admin/ai/models`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelId }),
        credentials: 'include',
      });
      await Promise.all([refreshModels(), refreshAI()]);
    } catch (err) {
      console.error('Failed to update model:', err);
    } finally {
      setIsUpdatingModel(false);
    }
  };

  const handleLocalAIToggle = async (enabled: boolean) => {
    try {
      await fetch(`${API_BASE}/api/admin/ai/models`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'local', enabled }),
        credentials: 'include',
      });
      await refreshAI();
    } catch (err) {
      console.error('Failed to toggle local AI:', err);
    }
  };

  const handleRefreshModels = async () => {
    await fetch(`${API_BASE}/api/admin/ai/models/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    await refreshModels();
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/backup`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        alert("Backup complete.");
      } else {
        alert("Backup failed.");
      }
    } catch {
      alert("Backup failed.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRetryHigh = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai/retry/high`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Queued ${data.queued} high severity signals.`);
        await refreshStats();
      } else {
        alert('Failed to queue.');
      }
    } catch {
      alert('Failed to queue.');
    } finally {
      setIsRetrying(false);
    }
  };

   const handleRetryAI = async () => {
     setIsRetrying(true);
     try {
       const res = await fetch(`${API_BASE}/api/admin/ai/retry`, {
         method: "POST",
         credentials: "include",
       });
       if (res.ok) {
         const data = await res.json();
         alert(`Queued ${data.queued} signals for AI retry.`);
       } else {
         alert("Retry failed.");
       }
     } catch {
       alert("Retry failed.");
     } finally {
       setIsRetrying(false);
     }
   };

   const handleTestDigest = async () => {
     setIsSendingTestDigest(true);
     try {
       const res = await fetch(`${API_BASE}/api/admin/digest/test`, {
         method: "POST",
         credentials: "include",
       });
       if (res.ok) {
         const data = await res.json();
         alert(data.message || "Test digest sent successfully!");
       } else {
         alert("Failed to send test digest.");
       }
     } catch {
       alert("Failed to send test digest.");
     } finally {
       setIsSendingTestDigest(false);
     }
   };

  const modules: Array<{ title: string; description: string; icon: React.ElementType; color: string; href?: string; onClick?: () => void; loading?: boolean }> = [
    { title: "Manage Signals",    description: "Review, edit, and translate signals.",        icon: Activity,    href: "/admin/signals",    color: "bg-blue-500/10" },
    { title: "News Sources",      description: "Add, edit, or remove news feed sources.",    icon: Rss,         href: "/admin/sources",    color: "bg-emerald-500/10" },
    { title: "Signal Categories", description: "Manage signal categories and settings.",     icon: Layers,      href: "/admin/categories", color: "bg-violet-500/10" },
    { title: "Database Backup",   description: "Download a full backup of the database.",    icon: ShieldCheck, onClick: handleBackup,     loading: isBackingUp,       color: "bg-amber-500/10" },
    { title: "Test Digest",       description: "Send a test email digest of recent signals.",icon: Zap,         onClick: handleTestDigest, loading: isSendingTestDigest, color: "bg-primary/10" },
  ];

  const healthyCount = aiHealth?.local
    ? [aiHealth.local, aiHealth.groq, aiHealth.openrouter].filter(p => p?.status === "healthy").length
    : 0;
  const totalProviders = aiHealth?.local
    ? [aiHealth.local, aiHealth.groq, aiHealth.openrouter].filter(p => p?.status !== "disabled").length
    : 0;

  // Shared section header pattern
  const SectionHeader = ({ icon: Icon, title, subtitle, right }: { icon: React.ElementType; title: string; subtitle?: string; right?: React.ReactNode }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-muted/70 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest leading-none text-foreground">{title}</h2>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );

  return (
    <div className="p-6 md:p-8 overflow-y-auto flex-1">
      <div className="max-w-6xl mx-auto pb-20 md:pb-10">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Command Center</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.25em] flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3 h-3 text-primary" />
              System Overview
            </p>
          </div>
          <Link href="/admin/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/50 hover:border-border shrink-0" title="Settings">
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="space-y-8">

          {/* ── AI Providers ──────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader
              icon={Brain}
              title="AI Providers"
              subtitle={
                aiHealth
                  ? `${healthyCount}/${totalProviders} online${aiHealth.queueSize ? ` · ${aiHealth.queueSize} queued` : ""}${modelsData?.cached ? " · cached" : ""}`
                  : "Loading..."
              }
              right={
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => refreshModels()} className="h-7 px-2 text-[10px] gap-1">
                    <RefreshCw className={cn("w-3 h-3", !modelsData && "animate-spin")} />
                    Models
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => refreshAI()} disabled={aiLoading} className="h-7 px-2 text-[10px] gap-1">
                    <RefreshCw className={cn("w-3 h-3", aiLoading && "animate-spin")} />
                    Status
                  </Button>
                </div>
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {/* VPS Local — Qwen */}
              <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={aiHealth?.local?.status || "unhealthy"} />
                    <span className="text-sm font-bold">VPS · Qwen</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-muted-foreground">
                      {aiHealth?.localEnabled ? "On" : "Off"}
                    </span>
                    <Switch checked={aiHealth?.localEnabled ?? false} onCheckedChange={handleLocalAIToggle} className="scale-75 origin-right" />
                  </div>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400/70 border border-indigo-400/20 bg-indigo-500/5 px-1.5 py-0.5 rounded w-fit">VPS Container</p>
                {aiHealth?.local?.model && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{aiHealth.local.model}</p>
                )}
                {aiHealth?.local?.latency !== undefined && (
                  <p className="text-[10px] text-muted-foreground">{aiHealth.local.latency}ms latency</p>
                )}
              </div>

              {/* Mac M1 Local — PicoClaw */}
              <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={aiHealth?.macLocal?.status || "unhealthy"} />
                    <span className="text-sm font-bold">Mac M1 · Local</span>
                  </div>
                  <StatusLabel status={aiHealth?.macLocal?.status || "unhealthy"} />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400/70 border border-orange-400/20 bg-orange-500/5 px-1.5 py-0.5 rounded w-fit">Mac · PicoClaw</p>
                {aiHealth?.macLocal?.model && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{aiHealth.macLocal.model}</p>
                )}
                {aiHealth?.macLocal?.latency !== undefined && (
                  <p className="text-[10px] text-muted-foreground">{aiHealth.macLocal.latency}ms latency</p>
                )}
                {aiHealth?.tokenUsage?.macLocal && (
                  <div className="pt-1.5 border-t border-border/10">
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      <span>Today</span>
                      <span>{aiHealth.tokenUsage.macLocal.today.total.toLocaleString()} tkn</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Groq */}
              <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={aiHealth?.groq?.status || "unhealthy"} />
                    <span className="text-sm font-bold">Groq</span>
                  </div>
                  <StatusLabel status={aiHealth?.groq?.status || "unhealthy"} />
                </div>
                {aiHealth?.groq?.model && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{aiHealth.groq.model}</p>
                )}
                {modelsData?.groq && (
                  <SearchableModelSelect models={modelsData.groq} value={modelsData.selected.groqModel || ""} onValueChange={(v) => handleModelChange("groq", v)} disabled={isUpdatingModel} />
                )}
              </div>

              {/* OpenRouter */}
              <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={aiHealth?.openrouter?.status || "unhealthy"} />
                    <span className="text-sm font-bold">OpenRouter</span>
                  </div>
                  <StatusLabel status={aiHealth?.openrouter?.status || "unhealthy"} />
                </div>
                {aiHealth?.openrouter?.model && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{aiHealth.openrouter.model}</p>
                )}
                {modelsData?.openrouter && (
                  <SearchableModelSelect models={modelsData.openrouter} value={modelsData.selected.openrouterModel || ""} onValueChange={(v) => handleModelChange("openrouter", v)} disabled={isUpdatingModel} />
                )}
              </div>
            </div>

            {/* Active pipeline display */}
            {aiHealth?.pipeline && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/20 bg-card/20">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="font-bold uppercase tracking-wider">Active Pipeline:</span>
                  <span className="font-mono text-primary/80">{aiHealth.pipeline}</span>
                </div>
                <Link href="/admin/pipeline">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground">
                    Edit
                  </Button>
                </Link>
              </div>
            )}
          </section>

          {/* ── Signal Intelligence ───────────────────────── */}
          <section className="space-y-3">
            <SectionHeader
              icon={BarChart3}
              title="Signal Overview"
              subtitle={statsData ? `${statsData.last24h?.toLocaleString()} signals in the last 24 hours` : "Loading..."}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard label="Total Signals"   value={statsData?.total?.toLocaleString()}       icon={<TrendingUp className="w-4 h-4 text-primary" />} />
              <StatCard label="Last 24H"        value={statsData?.last24h?.toLocaleString()}      icon={<Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}          accent="bg-blue-500/15 dark:bg-blue-500/10" />
              <StatCard label="High Severity"   value={statsData?.high?.toLocaleString()}         icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}        accent="bg-red-500/15 dark:bg-red-500/10" />
              <StatCard label="Medium Severity" value={statsData?.medium?.toLocaleString()}       icon={<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}    accent="bg-amber-500/15 dark:bg-amber-500/10" />
              <StatCard label="Low Severity"    value={statsData?.low?.toLocaleString()}          icon={<AlertTriangle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} accent="bg-emerald-500/15 dark:bg-emerald-500/10" />
              <StatCard label="Geopolitics"     value={statsData?.geopolitics?.toLocaleString()}  icon={<Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />}              accent="bg-blue-500/15 dark:bg-blue-500/10" />
              <StatCard label="Technology"      value={statsData?.technology?.toLocaleString()}   icon={<Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}            accent="bg-indigo-500/15 dark:bg-indigo-500/10" />
              <StatCard label="AI Processed"    value={statsData?.aiProcessed?.toLocaleString()}  icon={<Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />}            accent="bg-violet-500/15 dark:bg-violet-500/10" />
              <StatCard label="Translated"      value={statsData?.translated?.toLocaleString()}   icon={<Languages className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}          accent="bg-cyan-500/15 dark:bg-cyan-500/10" />
              <StatCard
                label="AI Failed"
                value={statsData?.aiFailed?.toLocaleString()}
                icon={<XCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                accent="bg-orange-500/15 dark:bg-orange-500/10"
                action={(statsData?.aiFailed ?? 0) > 0 ? (
                  <Button variant="ghost" size="sm" onClick={handleRetryAI} disabled={isRetrying} className="h-6 w-6 rounded-full p-0">
                    <RefreshCw className={cn("w-3 h-3", isRetrying && "animate-spin")} />
                  </Button>
                ) : undefined}
              />
              <StatCard
                label="High Pending"
                value={statsData?.highPending?.toLocaleString()}
                icon={<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                accent="bg-amber-500/15 dark:bg-amber-500/10"
                action={(statsData?.highPending ?? 0) > 0 ? (
                  <Button variant="ghost" size="sm" onClick={handleRetryHigh} disabled={isRetrying} className="h-6 w-6 rounded-full p-0">
                    <RefreshCw className={cn("w-3 h-3", isRetrying && "animate-spin")} />
                  </Button>
                ) : undefined}
              />
              <StatCard label="Visitors Today" value={visitorStats?.today?.toLocaleString()}    icon={<Users className="w-4 h-4 text-pink-600 dark:text-pink-400" />}        accent="bg-pink-500/15 dark:bg-pink-500/10" />
              <StatCard label="Live Viewers"   value={visitorStats?.realtime?.toLocaleString()} icon={<Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} accent="bg-emerald-500/15 dark:bg-emerald-500/10" />
            </div>
          </section>

          {/* ── AI Provider Breakdown (conditional) ──────── */}
          {providerStats && providerStats.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={Cpu}
                title="AI Usage by Provider"
                subtitle="Total signals processed per AI provider (all time)"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {providerStats.map((stat) => {
                  const cfg = {
                    local:       { label: "Local",       accent: "bg-emerald-500/15 dark:bg-emerald-500/10", icon: <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> },
                    groq:        { label: "Groq",        accent: "bg-blue-500/15 dark:bg-blue-500/10",       icon: <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" /> },
                    openrouter:  { label: "OpenRouter",  accent: "bg-violet-500/15 dark:bg-violet-500/10",   icon: <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" /> },
                  }[stat.provider] ?? { label: stat.provider, accent: "bg-zinc-500/15 dark:bg-zinc-500/10", icon: <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> };
                  return (
                    <StatCard key={stat.provider} label={cfg.label} value={stat.count.toLocaleString()} icon={cfg.icon} accent={cfg.accent} />
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Worker Intelligence (conditional) ─────────── */}
          {metrics && (
            <section className="space-y-3">
              <SectionHeader
                icon={Activity}
                title="Background Workers"
                subtitle="Live processing queues and cache performance"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Pending Translations"   value={metrics.queue.translationDepth}  icon={<Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}      accent="bg-blue-500/15 dark:bg-blue-500/10" />
                <StatCard label="Pending AI Summaries"  value={metrics.queue.aiSummaryDepth}    icon={<Activity className="w-4 h-4 text-violet-600 dark:text-violet-400" />}  accent="bg-violet-500/15 dark:bg-violet-500/10" />
                <StatCard label="Cache Hit Rate"        value={`${(metrics.cache.hitRatio * 100).toFixed(1)}%`} icon={<Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} accent="bg-emerald-500/15 dark:bg-emerald-500/10" />
                <StatCard
                  label="Avg Translation Time"
                  value={(() => {
                    const entries = Object.values(metrics.translation.latency);
                    if (entries.length === 0) return "—";
                    return `${Math.round(entries.reduce((s, p) => s + p.avgMs, 0) / entries.length)}ms`;
                  })()}
                  icon={<Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  accent="bg-amber-500/15 dark:bg-amber-500/10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Translation */}
                <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Translation · Today</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-black text-emerald-500">{metrics.translation.completed}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">done</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">enqueued <span className="font-bold text-foreground">{metrics.translation.enqueued}</span></p>
                      {metrics.translation.failed > 0 && (
                        <p className="text-[9px] text-red-500">failed <span className="font-bold">{metrics.translation.failed}</span></p>
                      )}
                    </div>
                  </div>
                  {Object.entries(metrics.translation.latency).length > 0 && (
                    <div className="flex gap-4 pt-2 border-t border-border/20">
                      {Object.entries(metrics.translation.latency).map(([mode, { avgMs, count }]) => (
                        <p key={mode} className="text-[9px] text-muted-foreground">
                          <span className="font-bold uppercase">{mode}</span> {avgMs}ms <span className="opacity-40">×{count}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Summaries */}
                <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">AI Summaries · Today</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-black text-violet-500">{metrics.aiSummary.completed}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">done</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">enqueued <span className="font-bold text-foreground">{metrics.aiSummary.enqueued}</span></p>
                      {metrics.aiSummary.failed > 0 && (
                        <p className="text-[9px] text-red-500">failed <span className="font-bold">{metrics.aiSummary.failed}</span></p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cache */}
                <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cache · Today</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-black text-emerald-500">{metrics.cache.hits}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">hits</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">misses <span className="font-bold text-foreground">{metrics.cache.misses}</span></p>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(metrics.cache.hitRatio * 100).toFixed(1)}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-right">{(metrics.cache.hitRatio * 100).toFixed(1)}% hit rate</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <SectionHeader
              icon={Server}
              title="Quick Actions"
              subtitle="Jump to key pages and run system tasks"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Navigation links */}
              {modules.filter(m => "href" in m).map((module) => (
                <Link key={module.title} href={module.href!}>
                  <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", module.color)}>
                      <module.icon className="w-4 h-4 text-foreground/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{module.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{module.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              ))}
              {/* Action buttons */}
              {modules.filter(m => "onClick" in m).map((module) => (
                <button
                  key={module.title}
                  onClick={module.onClick}
                  disabled={module.loading}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed w-full"
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", module.color)}>
                    {module.loading
                      ? <Loader2 className="w-4 h-4 animate-spin text-foreground/70" />
                      : <module.icon className="w-4 h-4 text-foreground/70" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{module.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{module.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
