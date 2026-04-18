"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings, ShieldCheck, Zap, Check, Loader2, Sun, Moon,
  MessageSquare, Key, Palette, RefreshCw, Activity
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

  // API Keys
  const { data: apiKeysData, mutate: refreshApiKeys, error: keysError } = useSWR<{
    groq: { masked: string; source: string };
    openrouter: { masked: string; source: string };
    google: { masked: string; source: string };
    mapbox: { masked: string; source: string };
  }>(`${API_BASE}/api/admin/keys`, fetcher, { shouldRetryOnError: false });

  useEffect(() => { if (keysError) router.replace("/admin-login"); }, [keysError, router]);

  const { data: aiHealth, mutate: refreshAI } = useSWR<{
    groq: { status: string }; openrouter: { status: string };
  }>(`${API_BASE}/api/admin/ai/health`, fetcher, { shouldRetryOnError: false });

  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [googleKeyInput, setGoogleKeyInput] = useState('');
  const [mapboxKeyInput, setMapboxKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState<'groq' | 'openrouter' | 'google' | 'mapbox' | null>(null);
  const [keySaved, setKeySaved] = useState<'groq' | 'openrouter' | 'google' | 'mapbox' | null>(null);

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

  // Radar Sources
  const { data: radarSources, mutate: refreshRadarSources } = useSWR<{
    osm: { enabled: boolean };
    google: { enabled: boolean };
    mapbox: { enabled: boolean };
  }>(`${API_BASE}/api/admin/companies/radar/sources`, fetcher);

  const toggleRadarSource = async (source: 'osm' | 'google' | 'mapbox', current: boolean) => {
    try {
      await fetch(`${API_BASE}/api/admin/companies/radar/sources`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ source, enabled: !current }),
      });
      await refreshRadarSources();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
...
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
                    <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('mapbox')} disabled={!mapboxKeyInput.trim() || savingKey === 'mapbox'}>
                      {savingKey === 'mapbox' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </Button>
                  </div>
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
                    <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('google')} disabled={!googleKeyInput.trim() || savingKey === 'google'}>
                      {savingKey === 'google' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
            {/* Groq */}
            <div className="space-y-2 p-4 rounded-lg border border-border/40 bg-card/30">
...
            </div>

            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
              DB keys override .env. Saving auto-refreshes AI health and model list.
            </p>
          </div>
        </section>

        <div className="border-t border-border/30" />
...

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
                    placeholder="Leave blank to use signals webhook"
                    className="flex-1 h-8 px-3 rounded-md bg-background border border-border/40 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={() => handleTestWebhook('jobs')} disabled={(!jobsWebhookUrl && !webhookUrl) || testingWebhook === 'jobs'}>
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
                <p className="text-[10px] text-muted-foreground">Jobs falls back to signals webhook if empty.</p>
                <Button size="sm" className="h-8 px-4 text-xs gap-1.5" onClick={handleSaveWebhooks} disabled={isSavingWebhooks}>
                  {isSavingWebhooks ? <Loader2 className="w-3 h-3 animate-spin" /> : webhooksSaved ? <Check className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                  {webhooksSaved ? 'Saved!' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
