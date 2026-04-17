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
  }>(`${API_BASE}/api/admin/keys`, fetcher, { shouldRetryOnError: false });

  useEffect(() => { if (keysError) router.replace("/admin-login"); }, [keysError, router]);

  const { data: aiHealth, mutate: refreshAI } = useSWR<{
    groq: { status: string }; openrouter: { status: string };
  }>(`${API_BASE}/api/admin/ai/health`, fetcher, { shouldRetryOnError: false });

  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState<'groq' | 'openrouter' | null>(null);
  const [keySaved, setKeySaved] = useState<'groq' | 'openrouter' | null>(null);

  const handleSaveApiKey = async (provider: 'groq' | 'openrouter') => {
    const key = provider === 'groq' ? groqKeyInput : openrouterKeyInput;
    if (!key.trim()) return;
    setSavingKey(provider);
    try {
      await fetch(`${API_BASE}/api/admin/keys`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ provider, key: key.trim() }),
      });
      if (provider === 'groq') setGroqKeyInput('');
      else setOpenrouterKeyInput('');
      await fetch(`${API_BASE}/api/admin/ai/models/refresh`, { method: 'POST', credentials: 'include' });
      await Promise.all([refreshApiKeys(), refreshAI()]);
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
                <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('groq')} disabled={!groqKeyInput.trim() || savingKey === 'groq'}>
                  {savingKey === 'groq' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </Button>
              </div>
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
                <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleSaveApiKey('openrouter')} disabled={!openrouterKeyInput.trim() || savingKey === 'openrouter'}>
                  {savingKey === 'openrouter' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </Button>
              </div>
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
