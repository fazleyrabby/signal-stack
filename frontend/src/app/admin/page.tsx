"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rss, Layers, ShieldCheck, LogOut, Brain, RefreshCw, BarChart3, Globe, Cpu, AlertTriangle, TrendingUp, Bot, XCircle, Zap, Server, Activity, Lightbulb, Search, ChevronDown, Check, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SignalStats } from "@/lib/api";
import { cn } from "@/lib/utils";
import { logoutAdmin } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

type ProviderHealth = {
  status: "healthy" | "unhealthy" | "no_api_key" | "disabled";
  latency?: number;
  error?: string;
  model?: string;
};

type AIHealth = {
  local: ProviderHealth;
  groq: ProviderHealth;
  openrouter: ProviderHealth;
  localEnabled: boolean;
  pipeline: string;
  queueSize: number;
  tokenUsage?: {
    groq: { today: { prompt: number; completion: number; total: number }; allTime: { prompt: number; completion: number; total: number } };
    openrouter: { today: { prompt: number; completion: number; total: number }; allTime: { prompt: number; completion: number; total: number } };
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

export default function AdminDashboard() {
  const router = useRouter();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [isSendingTestDigest, setIsSendingTestDigest] = useState(false);
  const { data: statsData, mutate: refreshStats } = useSWR<SignalStats>(`${API_BASE}/api/signals/stats`, fetcher);
  const { data: aiHealth, isValidating: aiLoading, mutate: refreshAI } = useSWR<AIHealth>(
    `${API_BASE}/api/admin/ai/health`,
    fetcher,
    { refreshInterval: 60000 }
  );
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

   const handleLogout = async () => {
    await logoutAdmin();
    router.push("/admin/login");
    router.refresh();
  };

   const modules = [
     { title: "News Sources", description: "Manage intelligence telemetry feeds.", icon: Rss, href: "/admin/sources", variant: "default" as const, stat: statsData?.topSource || "Connecting..." },
     { title: "Signal Categories", description: "Tune classification & routing logic.", icon: Layers, href: "/admin/categories", variant: "secondary" as const, stat: "Active" },
     { title: "Database Backup", description: "Create a full corpus security snapshot.", icon: ShieldCheck, onClick: handleBackup, loading: isBackingUp, stat: "Ready" },
     { title: "Test Digest", description: "Send a test email digest of recent signals.", icon: Zap, onClick: handleTestDigest, loading: isSendingTestDigest, stat: "Ready" }
   ];

  const healthyCount = aiHealth
    ? [aiHealth.local, aiHealth.groq, aiHealth.openrouter].filter(p => p.status === "healthy").length
    : 0;
  const totalProviders = aiHealth
    ? [aiHealth.local, aiHealth.groq, aiHealth.openrouter].filter(p => p.status !== "disabled").length
    : 0;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header isRefreshing={false} onRefresh={() => {}} searchQuery="" onSearchChange={() => {}} />

      <main className="max-w-6xl mx-auto py-12 px-6 space-y-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold uppercase text-foreground">Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 text-[10px]">
            <LogOut className="w-3 h-3" />
          </Button>
        </div>

        {/* AI Health Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold uppercase text-foreground">AI Providers</span>
              <span className="text-[10px] text-muted-foreground">
                {aiHealth ? `${healthyCount}/${totalProviders}` : "..."}
                {aiHealth?.queueSize ? ` · ${aiHealth.queueSize}q` : ""}
              </span>
              {modelsData?.cached && <span className="text-[8px] text-yellow-500">cached</span>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => refreshModels()} className="h-6 px-2">
                <RefreshCw className={cn("w-3 h-3", !modelsData && "animate-spin")} />
                <span className="ml-1 text-[9px]">Refresh Models</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => refreshAI()} disabled={aiLoading} className="h-6 px-2">
                <RefreshCw className={cn("w-3 h-3", aiLoading && "animate-spin")} />
                <span className="ml-1 text-[9px]">Refresh Status</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2">
                <StatusDot status={aiHealth?.local?.status || "unhealthy"} />
                <div>
                  <div className="text-sm font-bold text-foreground">Local (Qwen)</div>
                  {aiHealth?.local?.model && <div className="text-[10px] text-muted-foreground">{aiHealth.local.model}</div>}
                </div>
              </div>
            </div>
            <div className="py-2 px-3 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={aiHealth?.groq?.status || "unhealthy"} />
                  <div>
                    <div className="text-sm font-bold text-foreground">Groq</div>
                    {aiHealth?.groq?.model && <div className="text-[10px] text-muted-foreground">{aiHealth.groq.model}</div>}
                    {(() => { const t = aiHealth?.tokenUsage?.groq?.today?.total ?? 0; return t > 0 ? <div className="text-[10px] text-blue-400">{t.toLocaleString()} tokens</div> : null; })()}
                  </div>
                </div>
                <StatusLabel status={aiHealth?.groq?.status || "unhealthy"} />
              </div>
              {modelsData?.groq && (
                <SearchableModelSelect
                  models={modelsData.groq}
                  value={modelsData.selected.groqModel || ''}
                  onValueChange={(v) => handleModelChange('groq', v)}
                  disabled={isUpdatingModel}
                />
              )}
            </div>
            <div className="py-2 px-3 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={aiHealth?.openrouter?.status || "unhealthy"} />
                  <div>
                    <div className="text-sm font-bold text-foreground">OpenRouter</div>
                    {aiHealth?.openrouter?.model && <div className="text-[10px] text-muted-foreground">{aiHealth.openrouter.model}</div>}
                    {(() => { const t = aiHealth?.tokenUsage?.openrouter?.today?.total ?? 0; return t > 0 ? <div className="text-[10px] text-blue-400">{t.toLocaleString()} tokens</div> : null; })()}
                  </div>
                </div>
                <StatusLabel status={aiHealth?.openrouter?.status || "unhealthy"} />
              </div>
              {modelsData?.openrouter && (
                <SearchableModelSelect
                  models={modelsData.openrouter}
                  value={modelsData.selected.openrouterModel || ''}
                  onValueChange={(v) => handleModelChange('openrouter', v)}
                  disabled={isUpdatingModel}
                />
              )}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground bg-secondary/20 px-3 py-2 rounded border border-border/30 flex items-start gap-2">
            <Lightbulb className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Recommended for summarization:</span> <span className="text-emerald-400">Local (Qwen2.5-0.5B)</span> · <span className="text-blue-400">Groq (llama-3.1-8b-instant)</span> · <span className="text-blue-400">OpenRouter (gemma-4-26b-a4b-it:free)</span>
            </div>
          </div>
        </div>

        {/* AI Provider Stats */}
        {providerStats && providerStats.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold uppercase text-foreground">AI Provider Breakdown</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {providerStats.map((stat) => {
                const label = stat.provider === 'local' ? 'Local' : stat.provider === 'groq' ? 'Groq' : stat.provider === 'openrouter' ? 'OpenRouter' : 'None';
                const color = stat.provider === 'local' ? 'bg-emerald-500/10' : stat.provider === 'groq' ? 'bg-blue-500/10' : stat.provider === 'openrouter' ? 'bg-violet-500/10' : 'bg-zinc-500/10';
                const icon = stat.provider === 'local' ? <Bot className="w-3 h-3 text-emerald-400" /> : stat.provider === 'groq' ? <Bot className="w-3 h-3 text-blue-400" /> : stat.provider === 'openrouter' ? <Bot className="w-3 h-3 text-violet-400" /> : <Bot className="w-3 h-3 text-zinc-400" />;
                return (
                  <div key={stat.provider} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-secondary/30 border border-border/40">
                    <div className={color + " w-7 h-7 rounded-md flex items-center justify-center"}>
                      {icon}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">{stat.count.toLocaleString()}</div>
                      <div className="text-[9px] text-muted-foreground font-medium uppercase">{label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signal Stats */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight uppercase text-foreground">Signal Intelligence</h2>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {statsData ? `${statsData.last24h} signals in last 24h` : "Loading..."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Total Signals"
              value={statsData?.total?.toLocaleString()}
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
            />
            <StatCard
              label="Total Today"
              value={visitorStats?.today?.toLocaleString()}
              icon={<Users className="w-4 h-4 text-blue-400" />}
              accent="bg-blue-500/10"
            />
            <StatCard
              label="Realtime"
              value={visitorStats?.realtime?.toLocaleString()}
              icon={<Users className="w-4 h-4 text-emerald-400" />}
              accent="bg-emerald-500/10"
            />
            <StatCard
              label="High"
              value={statsData?.high?.toLocaleString()}
              icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
              accent="bg-red-500/10"
            />
            <StatCard
              label="Medium"
              value={statsData?.medium?.toLocaleString()}
              icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
              accent="bg-amber-500/10"
            />
            <StatCard
              label="Low"
              value={statsData?.low?.toLocaleString()}
              icon={<AlertTriangle className="w-4 h-4 text-emerald-400" />}
              accent="bg-emerald-500/10"
            />
            <StatCard
              label="Geopolitics"
              value={statsData?.geopolitics?.toLocaleString()}
              icon={<Globe className="w-4 h-4 text-blue-400" />}
              accent="bg-blue-500/10"
            />
            <StatCard
              label="Tech"
              value={statsData?.technology?.toLocaleString()}
              icon={<Cpu className="w-4 h-4 text-emerald-400" />}
              accent="bg-emerald-500/10"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="AI Processed"
              value={statsData?.aiProcessed?.toLocaleString()}
              icon={<Bot className="w-4 h-4 text-violet-400" />}
              accent="bg-violet-500/10"
            />
            <StatCard
              label="AI Failed"
              value={statsData?.aiFailed?.toLocaleString()}
              icon={<XCircle className="w-4 h-4 text-orange-400" />}
              accent="bg-orange-500/10"
              action={(statsData?.aiFailed ?? 0) > 0 ? (
                <Button variant="ghost" size="sm" onClick={handleRetryAI} disabled={isRetrying} className="h-6 w-6 rounded-full p-0">
                  <RefreshCw className={cn("w-3 h-3", isRetrying && "animate-spin")} />
                </Button>
              ) : undefined}
            />
            <StatCard
              label="High Pending"
              value={statsData?.highPending?.toLocaleString()}
              icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
              accent="bg-amber-500/10"
              action={(statsData?.highPending ?? 0) > 0 ? (
                <Button variant="ghost" size="sm" onClick={handleRetryHigh} disabled={isRetrying} className="h-6 w-6 rounded-full p-0">
                  <RefreshCw className={cn("w-3 h-3", isRetrying && "animate-spin")} />
                </Button>
              ) : undefined}
            />
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card key={module.title} className="bg-card border-border shadow-sm hover:border-primary/40 transition-all duration-500 overflow-hidden group rounded-lg">
              <CardHeader className="pb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <module.icon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">{module.title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-medium">{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-[10px] font-sans py-2.5 px-3 rounded-md bg-secondary/50 border border-border/40 flex items-center justify-between">
                  <span className="text-muted-foreground uppercase font-black">Status</span>
                  <span className="font-bold text-foreground">{module.stat.toUpperCase()}</span>
                </div>
                {"onClick" in module ? (
                  <Button onClick={module.onClick} disabled={module.loading} className="w-full h-10 text-[9px] font-black tracking-widest uppercase rounded-lg">
                    {module.loading ? "Processing..." : `Run ${module.title}`}
                  </Button>
                ) : (
                  <Link href={module.href || "/"} className="block">
                    <Button className="w-full h-10 text-[9px] font-black tracking-widest uppercase rounded-lg" variant={module.variant}>
                      Access {module.title}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
