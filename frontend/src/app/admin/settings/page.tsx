"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings, ShieldCheck, Zap, Check, Loader2, Sun, Moon,
  MessageSquare, Key, Palette, Activity, MapPin, Navigation, Globe,
  Database, Trash2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
});

function StatusDot({ status }: { status: string }) {
  const color =
    status === "healthy" ? "bg-emerald-500" :
    status === "disabled" || status === "no_api_key" ? "bg-yellow-500" :
    "bg-red-500";
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", color)} />;
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-6 py-3 border-b border-border/40">
      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
      <div>
        <p className="text-xs font-black uppercase tracking-widest leading-none">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  // Theme
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    setIsDark(localStorage.getItem("signalstack_theme") !== "light");
  }, []);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const val = next ? "dark" : "light";
    localStorage.setItem("signalstack_theme", val);
    document.documentElement.setAttribute("data-theme", val === "light" ? "light" : "");
  };

  const { data: aiHealth, mutate: refreshAI, error: aiError } = useSWR<{
    groq: { status: string; model: string };
    openrouter: { status: string; model: string };
    macLocal?: { status: string; model: string; latency?: number };
    picoClaw?: { status: string; model: string };
    pipeline: string;
    tokenUsage: {
      groq: { today: { total: number }; allTime: { total: number } };
      openrouter: { today: { total: number }; allTime: { total: number } };
      macLocal: { today: { total: number }; allTime: { total: number } };
    };
  }>(`${API_BASE}/api/admin/ai/health`, fetcher, { 
    shouldRetryOnError: false,
    refreshInterval: 10000 // Auto-refresh every 10s
  });

  // API Keys
  const { data: apiKeysData, mutate: refreshApiKeys, error: keysError } = useSWR<{
    groq: { masked: string; source: string };
    openrouter: { masked: string; source: string };
    google: { masked: string; source: string };
    mapbox: { masked: string; source: string };
  }>(`${API_BASE}/api/admin/keys`, fetcher, { shouldRetryOnError: false });

  useEffect(() => { 
    if (keysError?.message?.includes("Unauthorized") || aiError?.message?.includes("Unauthorized")) {
      router.replace("/admin-login"); 
    }
  }, [keysError, aiError, router]);

  // Mac Local Config
  const { data: macLocalConfig, mutate: refreshMacLocal } = useSWR<{
    enabled: boolean; endpoint: string; timeout: number;
  }>(`${API_BASE}/api/admin/ai/mac-local/config`, fetcher);

  const [macEndpointInput, setMacEndpointInput] = useState('');
  const [macTimeoutInput, setMacTimeoutInput] = useState(3000);
  const [isSavingMac, setIsSavingMac] = useState(false);
  const [macSaved, setMacSaved] = useState(false);
  const [isTestingMac, setIsTestingMac] = useState(false);
  const [macTestResult, setMacTestResult] = useState<{ ok: boolean; latency?: number; error?: string } | null>(null);

  useEffect(() => {
    if (macLocalConfig) {
      setMacEndpointInput(macLocalConfig.endpoint || '');
      setMacTimeoutInput(macLocalConfig.timeout || 3000);
    }
  }, [macLocalConfig]);

  const handleSaveMacLocal = async (enabled?: boolean) => {
    setIsSavingMac(true);
    try {
      await fetch(`${API_BASE}/api/admin/ai/mac-local/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ 
          enabled: enabled ?? macLocalConfig?.enabled,
          endpoint: macEndpointInput.trim(),
          timeout: macTimeoutInput
        }),
      });
      await Promise.all([refreshMacLocal(), refreshAI()]);
      setMacSaved(true);
      setTimeout(() => setMacSaved(false), 3000);
    } finally { setIsSavingMac(false); }
  };

  const handleTestMacLocal = async () => {
    setIsTestingMac(true);
    setMacTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai/mac-local/test`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      setMacTestResult({ ok: data.status === 'healthy', latency: data.latency, error: data.error });
    } catch { setMacTestResult({ ok: false, error: 'Request failed' }); }
    finally {
      setIsTestingMac(false);
      setTimeout(() => setMacTestResult(null), 5000);
    }
  };

  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [googleKeyInput, setGoogleKeyInput] = useState('');
  const [mapboxKeyInput, setMapboxKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState<'groq' | 'openrouter' | 'google' | 'mapbox' | null>(null);
  const [keySaved, setKeySaved] = useState<'groq' | 'openrouter' | 'google' | 'mapbox' | null>(null);
  const [testingKey, setTestingKey] = useState<'groq' | 'openrouter' | 'google' | 'mapbox' | null>(null);
  const [keyTestResult, setKeyTestResult] = useState<{ provider: string; ok: boolean; error?: string } | null>(null);

  const handleTestApiKey = async (provider: 'groq' | 'openrouter' | 'google' | 'mapbox') => {
    setTestingKey(provider);
    setKeyTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/keys/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      setKeyTestResult({ provider, ok: data.status === 'healthy', error: data.error });
    } catch { setKeyTestResult({ provider, ok: false, error: 'Request failed' }); }
    finally {
      setTestingKey(null);
      setTimeout(() => setKeyTestResult(null), 5000);
    }
  };

  const handleSaveApiKey = async (provider: 'groq' | 'openrouter' | 'google' | 'mapbox') => {
    const key = provider === 'groq' ? groqKeyInput : provider === 'openrouter' ? openrouterKeyInput : provider === 'google' ? googleKeyInput : mapboxKeyInput;
    if (!key.trim()) return;
    setSavingKey(provider);
    try {
      await fetch(`${API_BASE}/api/admin/keys`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ provider, key: key.trim() }),
      });
      if (provider === 'groq') setGroqKeyInput('');
      else if (provider === 'openrouter') setOpenrouterKeyInput('');
      else if (provider === 'google') setGoogleKeyInput('');
      else setMapboxKeyInput('');

      if (provider !== 'google' && provider !== 'mapbox') {
        await fetch(`${API_BASE}/api/admin/ai/models/refresh`, { method: 'POST', credentials: 'include' });
        await Promise.all([refreshApiKeys(), refreshAI()]);
      } else {
        await refreshApiKeys();
      }
      setKeySaved(provider);
      setTimeout(() => setKeySaved(null), 3000);
    } finally { setSavingKey(null); }
  };

  // Discord Webhooks
  const { data: webhookData, mutate: refreshWebhooks } = useSWR<{
    webhookUrl: string; jobsWebhookUrl: string;
  }>(`${API_BASE}/api/admin/webhooks`, fetcher);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [jobsWebhookUrl, setJobsWebhookUrl] = useState('');
  const [isSavingWebhooks, setIsSavingWebhooks] = useState(false);
  const [webhooksSaved, setWebhooksSaved] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<'signals' | 'jobs' | null>(null);
  const [webhookTestResult, setWebhookTestResult] = useState<{ type: string; ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (webhookData) {
      setWebhookUrl(webhookData.webhookUrl || '');
      setJobsWebhookUrl(webhookData.jobsWebhookUrl || '');
    }
  }, [webhookData]);

  const handleSaveWebhooks = async () => {
    setIsSavingWebhooks(true);
    try {
      await fetch(`${API_BASE}/api/admin/webhooks`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ webhookUrl, jobsWebhookUrl }),
      });
      await refreshWebhooks();
      setWebhooksSaved(true);
      setTimeout(() => setWebhooksSaved(false), 3000);
    } finally { setIsSavingWebhooks(false); }
  };

  const handleTestWebhook = async (type: 'signals' | 'jobs') => {
    setTestingWebhook(type);
    setWebhookTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/webhooks/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setWebhookTestResult({ type, ok: data.success, error: data.error });
    } catch { setWebhookTestResult({ type, ok: false, error: 'Request failed' }); }
    finally {
      setTestingWebhook(null);
      setTimeout(() => setWebhookTestResult(null), 5000);
    }
  };

  // Radar Sources
  const { data: radarSources, mutate: refreshRadarSources } = useSWR<{
    osm: { enabled: boolean };
    google: { enabled: boolean };
    mapbox: { enabled: boolean };
    translationThreshold: number;
    forceAllTranslations: boolean;
  }>(`${API_BASE}/api/admin/companies/radar/sources`, fetcher);

  const toggleRadarSource = async (source: 'osm' | 'google' | 'mapbox' | 'force_all', current: boolean) => {
    try {
      const url = source === 'force_all' 
        ? `${API_BASE}/api/admin/companies/radar/settings`
        : `${API_BASE}/api/admin/companies/radar/sources`;
      
      const body = source === 'force_all'
        ? { forceAllTranslations: !current }
        : { source, enabled: !current };

      await fetch(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      await refreshRadarSources();
    } catch (e) { console.error(e); }
  };

  const updateThreshold = async (val: number) => {
    try {
      await fetch(`${API_BASE}/api/admin/companies/radar/settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ translationThreshold: val }),
      });
      await refreshRadarSources();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border/40 bg-card/30 shrink-0">
        <Settings className="w-4 h-4 text-primary" />
        <span className="font-bold text-sm">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Appearance ───────────────────────────────── */}
        <section>
          <SectionHeader icon={Palette} title="Appearance" subtitle="Interface theme preference" />
          <div className="px-6 py-4">
            <div className="flex items-center justify-between max-w-sm py-3 px-4 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center gap-3">
                {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <div>
                  <p className="text-xs font-bold">{isDark ? "Dark Mode" : "Light Mode"}</p>
                  <p className="text-[10px] text-muted-foreground">Current interface theme</p>
                </div>
              </div>
              <Switch checked={isDark} onCheckedChange={toggleTheme} />
            </div>
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* ── Radar Data Sources ─────────────────────────── */}
        <section>
          <SectionHeader
            icon={Activity}
            title="Radar Data Sources"
            subtitle="Enable or disable external location APIs"
          />
          <div className="px-6 py-4 space-y-4 max-w-2xl">
            {/* OSM */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-muted/40", radarSources?.osm?.enabled ? "text-primary" : "text-muted-foreground")}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">OpenStreetMap (OSM)</p>
                  <p className="text-[10px] text-muted-foreground">Community-driven data. Free, no API key needed.</p>
                </div>
              </div>
              <Switch checked={radarSources?.osm?.enabled ?? true} onCheckedChange={() => toggleRadarSource('osm', radarSources?.osm?.enabled ?? true)} />
            </div>

            {/* Mapbox */}
            <div className={cn("space-y-3 p-4 rounded-lg border transition-colors",
              radarSources?.mapbox?.enabled ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-muted/40", radarSources?.mapbox?.enabled ? "text-primary" : "text-muted-foreground")}>
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Mapbox Search API</p>
                    <p className="text-[10px] text-muted-foreground">High quality commercial data. Free tier available.</p>
                  </div>
                </div>
                <Switch checked={radarSources?.mapbox?.enabled ?? true} onCheckedChange={() => toggleRadarSource('mapbox', radarSources?.mapbox?.enabled ?? true)} />
              </div>

              {radarSources?.mapbox?.enabled && (
                <div className="space-y-2 pt-2 border-t border-border/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Token</label>
                    <div className="flex items-center gap-2">
                      {apiKeysData?.mapbox?.source && (
                        <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                          apiKeysData.mapbox.source === 'db' ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10" : "text-blue-600 border-blue-500/30 bg-blue-500/10"
                        )}>{apiKeysData.mapbox.source}</span>
                      )}
                      {keySaved === 'mapbox' && <span className="text-[10px] text-emerald-500 font-bold">✓ Saved</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={mapboxKeyInput}
                      onChange={(e) => setMapboxKeyInput(e.target.value)}
                      placeholder={apiKeysData?.mapbox?.masked || "pk.eyJ1Ijo••••••••••••••••"}
                      className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestApiKey('mapbox')} disabled={(!mapboxKeyInput && !apiKeysData?.mapbox?.masked) || testingKey === 'mapbox'}>
                      {testingKey === 'mapbox' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Test
                    </Button>
                    <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('mapbox')} disabled={!mapboxKeyInput.trim() || savingKey === 'mapbox'}>
                      {savingKey === 'mapbox' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </Button>
                  </div>
                  {keyTestResult?.provider === 'mapbox' && (
                    <p className={cn("text-[10px] font-bold mt-1", keyTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                      {keyTestResult.ok ? '✓ Key is valid and working' : `✗ ${keyTestResult.error || 'Connection failed'}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Google Places */}
            <div className={cn("space-y-3 p-4 rounded-lg border transition-colors",
              radarSources?.google?.enabled ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-muted/40", radarSources?.google?.enabled ? "text-primary" : "text-muted-foreground")}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Google Places API</p>
                    <p className="text-[10px] text-muted-foreground">The most complete data, but requires billing/card.</p>
                  </div>
                </div>
                <Switch checked={radarSources?.google?.enabled ?? true} onCheckedChange={() => toggleRadarSource('google', radarSources?.google?.enabled ?? true)} />
              </div>

              {radarSources?.google?.enabled && (
                <div className="space-y-2 pt-2 border-t border-border/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">API Key</label>
                    <div className="flex items-center gap-2">
                      {apiKeysData?.google?.source && (
                        <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                          apiKeysData.google.source === 'db' ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10" : "text-blue-600 border-blue-500/30 bg-blue-500/10"
                        )}>{apiKeysData.google.source}</span>
                      )}
                      {keySaved === 'google' && <span className="text-[10px] text-emerald-500 font-bold">✓ Saved</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={googleKeyInput}
                      onChange={(e) => setGoogleKeyInput(e.target.value)}
                      placeholder={apiKeysData?.google?.masked || "AIza••••••••••••••••"}
                      className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestApiKey('google')} disabled={(!googleKeyInput && !apiKeysData?.google?.masked) || testingKey === 'google'}>
                      {testingKey === 'google' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Test
                    </Button>
                    <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('google')} disabled={!googleKeyInput.trim() || savingKey === 'google'}>
                      {savingKey === 'google' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </Button>
                  </div>
                  {keyTestResult?.provider === 'google' && (
                    <p className={cn("text-[10px] font-bold mt-1", keyTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                      {keyTestResult.ok ? '✓ Key is valid and working' : `✗ ${keyTestResult.error || 'Connection failed'}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* ── Translation Logic ─────────────────────────── */}
        <section>
          <SectionHeader
            icon={Zap}
            title="Translation Logic"
            subtitle="Control how and when signals are translated"
          />
          <div className="px-6 py-4 space-y-4 max-w-2xl">
            {/* Force All */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-muted/40", radarSources?.forceAllTranslations ? "text-primary" : "text-muted-foreground")}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Force Complete Translation</p>
                  <p className="text-[10px] text-muted-foreground">Translate every signal automatically to ensure a 100% native experience.</p>
                </div>
              </div>
              <Switch checked={radarSources?.forceAllTranslations ?? false} onCheckedChange={() => toggleRadarSource('force_all', radarSources?.forceAllTranslations ?? false)} />
            </div>

            {/* Threshold */}
            <div className="space-y-3 p-4 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/40 text-primary">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Quality Threshold: {radarSources?.translationThreshold || 7}</p>
                    <p className="text-[10px] text-muted-foreground">Signals above this score use high-power models; others use low-cost models.</p>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={radarSources?.translationThreshold || 7}
                  onChange={(e) => updateThreshold(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-mono">
                  <span>0 (All Low Power)</span>
                  <span>5 (Medium)</span>
                  <span>10 (All High Power)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* ── Mac Local ──────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Activity}
            title="Mac Local AI"
            subtitle="Local llama.cpp instance on your Mac"
          />
          <div className="px-6 py-4 space-y-4 max-w-2xl">
            <div className={cn("space-y-4 p-4 rounded-lg border transition-colors",
              macLocalConfig?.enabled ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-muted/40", macLocalConfig?.enabled ? "text-primary" : "text-muted-foreground")}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">Local llama.cpp (Mac)</p>
                      {macLocalConfig?.enabled && <StatusDot status={aiHealth?.macLocal?.status || 'unknown'} />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                       <p className="text-[10px] text-muted-foreground">Used as high-quality conditional tier for important signals.</p>
                       {aiHealth?.macLocal?.latency && (
                         <span className="text-[9px] font-mono text-emerald-500 bg-emerald-500/10 px-1 rounded">
                           {aiHealth.macLocal.latency}ms
                         </span>
                       )}
                    </div>
                  </div>
                </div>
                <Switch checked={macLocalConfig?.enabled ?? false} onCheckedChange={(val) => handleSaveMacLocal(val)} disabled={isSavingMac} />
              </div>

              <div className="space-y-3 pt-2 border-t border-border/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Endpoint URL</label>
                    <input
                      type="url"
                      value={macEndpointInput}
                      onChange={(e) => setMacEndpointInput(e.target.value)}
                      placeholder="http://192.168.0.x:8080"
                      className="w-full h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timeout (ms)</label>
                    <input
                      type="number"
                      value={macTimeoutInput}
                      onChange={(e) => setMacTimeoutInput(parseInt(e.target.value))}
                      className="w-full h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    {macTestResult && (
                      <p className={cn("text-[10px] font-bold", macTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                        {macTestResult.ok ? `✓ Connected (${macTestResult.latency}ms)` : `✗ ${macTestResult.error || 'Connection failed'}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={handleTestMacLocal} disabled={!macEndpointInput || isTestingMac}>
                      {isTestingMac ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Test
                    </Button>
                    <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveMacLocal()} disabled={isSavingMac}>
                      {isSavingMac ? <Loader2 className="w-3 h-3 animate-spin" /> : macSaved ? <Check className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      {macSaved ? 'Saved!' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {aiHealth?.pipeline && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 px-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                Current Pipeline: <span className="font-mono text-primary/80">{aiHealth.pipeline}</span>
              </p>
            )}
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* ── AI API Keys ───────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Key}
            title="AI API Keys"
            subtitle="Override .env keys — stored in database, applied immediately"
          />
          <div className="px-6 py-4 space-y-4 max-w-2xl">
            {/* Live Status Summary */}
            <div className="flex flex-wrap gap-6 px-4 py-2 bg-card/20 border border-border/20 rounded-lg mb-2">
              <div className="flex items-center gap-2">
                <StatusDot status={aiHealth?.groq?.status || 'unknown'} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Groq Cloud</span>
              </div>
              <div className="flex items-center gap-2 border-l border-border/20 pl-6">
                <StatusDot status={aiHealth?.openrouter?.status || 'unknown'} />
                <span className="text-[10px] font-bold uppercase tracking-wider">OpenRouter</span>
              </div>
              <div className="flex items-center gap-2 border-l border-border/20 pl-6">
                <StatusDot status={aiHealth?.picoClaw?.status || 'unknown'} />
                <span className="text-[10px] font-bold uppercase tracking-wider">PicoClaw Router</span>
              </div>
              <div className="flex items-center gap-2 border-l border-border/20 pl-6">
                <StatusDot status={aiHealth?.macLocal?.status || 'disabled'} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    PicoClaw Mac
                    {aiHealth?.macLocal?.latency && (
                      <span className="text-[8px] font-mono opacity-50">({aiHealth.macLocal.latency}ms)</span>
                    )}
                  </span>
                  {aiHealth?.tokenUsage?.macLocal && (
                    <span className="text-[8px] font-mono text-muted-foreground leading-none mt-0.5">
                      {aiHealth.tokenUsage.macLocal?.today?.total?.toLocaleString() ?? 0} tkn
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Groq */}
            <div className="space-y-2 p-4 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={aiHealth?.groq?.status || 'no_api_key'} />
                  <label className="text-xs font-bold">Groq API Key</label>
                </div>
                <div className="flex items-center gap-2">
                  {apiKeysData?.groq?.source && (
                    <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                      apiKeysData.groq.source === 'db' ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                      apiKeysData.groq.source === 'env' ? "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10" :
                      "text-muted-foreground border-border/30"
                    )}>{apiKeysData.groq.source}</span>
                  )}
                  {keySaved === 'groq' && <span className="text-[10px] text-emerald-500 font-bold">✓ Saved</span>}
                </div>
              </div>
              {apiKeysData?.groq?.masked && (
                <p className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">{apiKeysData.groq.masked}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                  placeholder="gsk_••••••••••••••••"
                  className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestApiKey('groq')} disabled={(!groqKeyInput && !apiKeysData?.groq?.masked) || testingKey === 'groq'}>
                  {testingKey === 'groq' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </Button>
                <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('groq')} disabled={!groqKeyInput.trim() || savingKey === 'groq'}>
                  {savingKey === 'groq' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </Button>
              </div>
              {keyTestResult?.provider === 'groq' && (
                <p className={cn("text-[10px] font-bold mt-1", keyTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                  {keyTestResult.ok ? '✓ Key is valid and working' : `✗ ${keyTestResult.error || 'Connection failed'}`}
                </p>
              )}
            </div>

            {/* OpenRouter */}
            <div className="space-y-2 p-4 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={aiHealth?.openrouter?.status || 'no_api_key'} />
                  <label className="text-xs font-bold">OpenRouter API Key</label>
                </div>
                <div className="flex items-center gap-2">
                  {apiKeysData?.openrouter?.source && (
                    <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                      apiKeysData.openrouter.source === 'db' ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                      apiKeysData.openrouter.source === 'env' ? "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10" :
                      "text-muted-foreground border-border/30"
                    )}>{apiKeysData.openrouter.source}</span>
                  )}
                  {keySaved === 'openrouter' && <span className="text-[10px] text-emerald-500 font-bold">✓ Saved</span>}
                </div>
              </div>
              {apiKeysData?.openrouter?.masked && (
                <p className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">{apiKeysData.openrouter.masked}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={openrouterKeyInput}
                  onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                  placeholder="sk-or-••••••••••••••••"
                  className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestApiKey('openrouter')} disabled={(!openrouterKeyInput && !apiKeysData?.openrouter?.masked) || testingKey === 'openrouter'}>
                  {testingKey === 'openrouter' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </Button>
                <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('openrouter')} disabled={!openrouterKeyInput.trim() || savingKey === 'openrouter'}>
                  {savingKey === 'openrouter' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </Button>
              </div>
              {keyTestResult?.provider === 'openrouter' && (
                <p className={cn("text-[10px] font-bold mt-1", keyTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                  {keyTestResult.ok ? '✓ Key is valid and working' : `✗ ${keyTestResult.error || 'Connection failed'}`}
                </p>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
              DB keys override .env. Saving auto-refreshes AI health and model list.
            </p>
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* ── Discord Webhooks ─────────────────────────── */}
        <section>
          <SectionHeader
            icon={MessageSquare}
            title="Discord Webhooks"
            subtitle="Override .env webhook URLs — stored in database, applied immediately"
          />
          <div className="px-6 py-4 space-y-4 max-w-2xl">
            <div className="space-y-3 p-4 rounded-lg border border-border/40 bg-card/30">
              {/* Signals webhook */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Signals Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestWebhook('signals')} disabled={!webhookUrl || testingWebhook === 'signals'}>
                    {testingWebhook === 'signals' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Test
                  </Button>
                </div>
                {webhookTestResult?.type === 'signals' && (
                  <p className={cn("text-[10px] font-bold", webhookTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                    {webhookTestResult.ok ? '✓ Test message sent' : `✗ ${webhookTestResult.error}`}
                  </p>
                )}
              </div>

              {/* Jobs webhook */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jobs Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={jobsWebhookUrl}
                    onChange={(e) => setJobsWebhookUrl(e.target.value)}
                    placeholder="Enter dedicated jobs channel webhook"
                    className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestWebhook('jobs')} disabled={!jobsWebhookUrl || testingWebhook === 'jobs'}>
                    {testingWebhook === 'jobs' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Test
                  </Button>
                </div>
                {webhookTestResult?.type === 'jobs' && (
                  <p className={cn("text-[10px] font-bold", webhookTestResult.ok ? "text-emerald-500" : "text-red-500")}>
                    {webhookTestResult.ok ? '✓ Test message sent' : `✗ ${webhookTestResult.error}`}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground">Strict separation: Job alerts only send if a dedicated URL is provided.</p>
                <Button size="sm" className="h-8 px-4 text-xs gap-1.5" onClick={handleSaveWebhooks} disabled={isSavingWebhooks}>
                  {isSavingWebhooks ? <Loader2 className="w-3 h-3 animate-spin" /> : webhooksSaved ? <Check className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                  {webhooksSaved ? 'Saved!' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* ── Cache Management ─────────────────────────────── */}
        <CacheSection apiBase={API_BASE} />

      </div>
    </div>
  );
}

// ── Cache Management Component ────────────────────────────────────────────────

interface CacheGroup {
  id: string;
  label: string;
  description: string;
  pattern: string;
  count: number;
}

interface CacheQueue {
  id: string;
  label: string;
  description: string;
  count: number;
}

function CacheSection({ apiBase }: { apiBase: string }) {
  const { data, mutate, isLoading } = useSWR<{ groups: CacheGroup[]; queues: CacheQueue[] }>(
    `${apiBase}/api/admin/cache`,
    (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json()),
    { refreshInterval: 10000 }
  );

  const [clearing, setClearing] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<{ id: string; deleted: number } | null>(null);

  async function clearGroup(id: string) {
    setClearing(id);
    setClearResult(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/cache/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      const d = await res.json();
      setClearResult({ id, deleted: d.deleted });
      await mutate();
    } finally {
      setClearing(null);
      setTimeout(() => setClearResult(null), 4000);
    }
  }

  async function clearAll() {
    setClearing('__all__');
    setClearResult(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/cache`, {
        method: 'DELETE', credentials: 'include',
      });
      const d = await res.json();
      setClearResult({ id: '__all__', deleted: d.deleted });
      await mutate();
    } finally {
      setClearing(null);
      setTimeout(() => setClearResult(null), 4000);
    }
  }

  const totalKeys = (data?.groups ?? []).reduce((s, g) => s + g.count, 0);

  return (
    <section>
      <div className="px-6 pt-5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold">Cache Management</p>
            <p className="text-[10px] text-muted-foreground">
              {isLoading ? 'Loading…' : `${totalKeys} cached entries across all groups`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1.5" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" className="h-7 px-3 text-[10px] gap-1.5" onClick={clearAll} disabled={!!clearing || totalKeys === 0}>
            {clearing === '__all__' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Clear All
          </Button>
        </div>
      </div>

      {clearResult && (
        <p className={cn("px-6 text-[10px] font-bold mb-2",
          clearResult.deleted > 0 ? "text-emerald-500" : "text-muted-foreground"
        )}>
          {clearResult.id === '__all__' ? 'All caches' : 'Cache group'} cleared — {clearResult.deleted} keys deleted
        </p>
      )}

      <div className="px-6 pb-6 space-y-2 max-w-2xl">
        {(data?.groups ?? []).map((g) => (
          <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold">{g.label}</p>
                <span className="text-[9px] font-mono border border-border/40 px-1.5 py-0.5 rounded text-muted-foreground">
                  {g.count} {g.count === 1 ? 'key' : 'keys'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 truncate">{g.description}</p>
              <p className="text-[9px] text-muted-foreground/30 font-mono mt-0.5">{g.pattern}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px] gap-1 shrink-0"
              disabled={!!clearing || g.count === 0}
              onClick={() => clearGroup(g.id)}
            >
              {clearing === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Clear
            </Button>
          </div>
        ))}

        {(data?.queues ?? []).length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold pt-2">Active Queues (read-only)</p>
            {(data?.queues ?? []).map((q) => (
              <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold">{q.label}</p>
                    <span className={cn(
                      "text-[9px] font-mono border px-1.5 py-0.5 rounded",
                      q.count > 0 ? "border-amber-500/30 text-amber-500 bg-amber-500/10" : "border-border/40 text-muted-foreground"
                    )}>
                      {q.count} pending
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">{q.description}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
