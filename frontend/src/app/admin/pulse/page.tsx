"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  Send,
  Activity,
  Settings,
  Database,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Cpu,
  UserCheck,
  Copy,
  RotateCcw,
  Star,
  Plus,
  Globe,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

// ─── Types ───────────────────────────────────────────────────────────────────

type DraftStatus = "pending" | "generated" | "approved" | "scheduled" | "published" | "failed" | "rejected";

type PulseDraft = {
  id: string;
  sourceSignalId: string;
  platform: string;
  text: string;
  status: DraftStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  signal: {
    id: string;
    title: string;
    url: string | null;
    score: number;
    severity: string;
    aiSummary: string | null;
  } | null;
};

type PulseSettings = {
  autoDraftEnabled: boolean;
  minSignalScore: number;
  maxDraftsPerDay: number;
  xConnected: boolean;
  xHandle: string | null;
};

type PublishLog = {
  id: string;
  draftId: string | null;
  platform: string;
  action: string;
  actorEmail: string | null;
  detail: string | null;
  xPostId: string | null;
  createdAt: string;
};

type PulseAccount = {
  id: string;
  platform: string;
  handle: string;
  isActive: boolean;
  createdAt: string;
};

type PlatformStatus = {
  limits: { dailyLimit: number; hourlyLimit: number };
  dailyCount: number;
  hourlyCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatScheduled(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

function getMinDateTimeLocal(): string {
  return new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 16);
}

function localToISO(dt: string): string {
  return new Date(dt).toISOString();
}

const STATUS_PILL: Record<string, string> = {
  generated: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  scheduled:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  published:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed:     "bg-red-500/15 text-red-400 border-red-500/30",
  rejected:   "bg-muted/40 text-muted-foreground border-border/30",
  approved:   "bg-violet-500/15 text-violet-400 border-violet-500/30",
  pending:    "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

const ACTION_PILL: Record<string, string> = {
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  generated: "bg-primary/10 text-primary border-primary/20",
  failed:    "bg-red-500/10 text-red-400 border-red-500/20",
  approved:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rejected:  "bg-muted/30 text-muted-foreground border-border/30",
  deleted:   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  scheduled: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border/40 rounded-xl w-full max-w-sm shadow-2xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm border border-border/40 text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onConfirm} className={cn("px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors", danger ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30" : "bg-primary text-primary-foreground hover:opacity-90")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PulseAdmin() {
  const [activeTab, setActiveTab] = useState<"overview" | "drafts" | "logs" | "settings">("overview");
  const [draftStatus, setDraftStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const [editingDraft, setEditingDraft] = useState<PulseDraft | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedSchedule, setEditedSchedule] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PulseDraft | null>(null);

  const [accountForm, setAccountForm] = useState({ 
    handle: "", 
    apiKey: "", 
    apiSecret: "", 
    accessToken: "", 
    accessTokenSecret: "", 
    platform: "x" as "x" | "facebook" 
  });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isConnectingAccount, setIsConnectingAccount] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState(false);

  const [settingsForm, setSettingsForm] = useState({ autoDraftEnabled: true, minSignalScore: 7, maxDraftsPerDay: 20 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // ─── Data ──────────────────────────────────────────────────────────────────

  const { data: draftsData, mutate: mutateDrafts } = useSWR<{ drafts: PulseDraft[]; total: number }>(
    `${API_BASE}/api/admin/pulse/drafts?status=${draftStatus}&page=${currentPage}&limit=${limit}`, fetcher
  );
  const { data: settingsData, mutate: mutateSettings } = useSWR<PulseSettings>(
    `${API_BASE}/api/admin/pulse/settings`, fetcher,
    { onSuccess: (d) => setSettingsForm({ autoDraftEnabled: d.autoDraftEnabled, minSignalScore: d.minSignalScore, maxDraftsPerDay: d.maxDraftsPerDay }) }
  );
  const { data: logsData, mutate: mutateLogs } = useSWR<PublishLog[]>(`${API_BASE}/api/admin/pulse/logs`, fetcher);
  const { data: accountsData, mutate: mutateAccounts } = useSWR<PulseAccount[]>(`${API_BASE}/api/admin/pulse/accounts?platform=x`, fetcher);
  const { data: limitsData, mutate: mutateLimits } = useSWR<Record<string, PlatformStatus>>(`${API_BASE}/api/admin/pulse/platform-limits`, fetcher);

  const isLoaded = draftsData && settingsData && logsData;
  const totalPages = draftsData ? Math.ceil(draftsData.total / limit) : 1;

  const refreshAll = useCallback(() => {
    mutateDrafts(); mutateSettings(); mutateLogs(); mutateAccounts(); mutateLimits();
  }, [mutateDrafts, mutateSettings, mutateLogs, mutateAccounts, mutateLimits]);

  // ─── Counts ────────────────────────────────────────────────────────────────

  const today = new Date().toDateString();
  const dailyGen = logsData?.filter(l => l.action === "generated" && new Date(l.createdAt).toDateString() === today).length ?? 0;
  const dailyPub = logsData?.filter(l => l.action === "published" && new Date(l.createdAt).toDateString() === today).length ?? 0;
  const pendingCount = draftsData?.drafts.filter(d => d.status === "generated").length ?? 0;
  const failedCount = draftsData?.drafts.filter(d => d.status === "failed").length ?? 0;
  const xLimits = limitsData?.x;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const patchDraft = async (id: string, body: object) => {
    const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), credentials: "include",
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
    await mutateDrafts(); await mutateLogs();
  };

  const handleSaveDraft = async () => {
    if (!editingDraft || editedText.length > 280) return;
    setIsSavingDraft(true);
    try {
      await patchDraft(editingDraft.id, { text: editedText, scheduledAt: editedSchedule ? localToISO(editedSchedule) : null });
      setEditingDraft(null);
    } catch (e: any) { alert(e.message); }
    finally { setIsSavingDraft(false); }
  };

  const handleApprove = async () => {
    if (!editingDraft || editedText.length > 280) return;
    if (editedSchedule && new Date(editedSchedule) <= new Date()) { alert("Schedule must be in the future."); return; }
    setIsSavingDraft(true);
    try {
      await patchDraft(editingDraft.id, {
        text: editedText,
        scheduledAt: editedSchedule ? localToISO(editedSchedule) : null,
        status: editedSchedule ? "scheduled" : "approved",
      });
      setEditingDraft(null);
    } catch (e: any) { alert(e.message); }
    finally { setIsSavingDraft(false); }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { const d = await res.json(); alert(d.message || "Delete failed"); return; }
    setDeleteTarget(null);
    await mutateDrafts(); await mutateLogs();
  };

  const handleRetry = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${id}/retry`, { method: "POST", credentials: "include" });
    if (!res.ok) { const d = await res.json(); alert(d.message || "Retry failed"); return; }
    await mutateDrafts(); await mutateLogs();
  };

  const handleActivateAccount = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${id}/activate`, { method: "PATCH", credentials: "include" });
    if (!res.ok) { alert("Activation failed"); return; }
    await mutateAccounts(); await mutateSettings();
  };

  const handleEditAccount = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${id}/credentials`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch credentials");
      const data = await res.json();
      setAccountForm({
        handle: data.handle,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        accessToken: data.accessToken,
        accessTokenSecret: data.accessTokenSecret,
        platform: data.platform as "x" | "facebook"
      });
      setEditingAccountId(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      alert("Error loading account: " + e.message);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { const d = await res.json(); alert(d.message || "Delete failed"); return; }
    await mutateAccounts(); await mutateSettings();
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingAccount(true); setConnectError(null); setConnectSuccess(false);
    try {
      // For Facebook, accessTokenSecret is unused — send empty string
      const payload = {
        ...accountForm,
        accessTokenSecret: accountForm.platform === "facebook" ? "" : accountForm.accessTokenSecret,
      };
      const method = editingAccountId ? "PATCH" : "POST";
      const url = editingAccountId 
        ? `${API_BASE}/api/admin/pulse/accounts/${editingAccountId}` 
        : `${API_BASE}/api/admin/pulse/accounts`;

      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), credentials: "include",
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      setConnectSuccess(true);
      await mutateSettings(); await mutateAccounts();
      setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: accountForm.platform });
      setEditingAccountId(null);
      setTimeout(() => setConnectSuccess(false), 3000);
    } catch (e: any) { setConnectError(e.message); }
    finally { setIsConnectingAccount(false); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm), credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      await mutateSettings();
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (e: any) { alert(e.message); }
    finally { setIsSavingSettings(false); }
  };

  const openEdit = (draft: PulseDraft) => {
    setEditingDraft(draft);
    setEditedText(draft.text);
    setEditedSchedule(draft.scheduledAt ? new Date(draft.scheduledAt).toISOString().slice(0, 16) : "");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto text-foreground">

      {/* Confirm modals */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Draft Permanently"
          message="This draft will be removed. The audit log is preserved. Cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ─── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-foreground">Pulse</h1>
        <div className="flex items-center gap-2">
          {settingsData?.xConnected ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <UserCheck className="w-3.5 h-3.5" /> {settingsData.xHandle}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" /> No account
            </span>
          )}
          <button onClick={refreshAll} className="p-1.5 rounded-lg border border-border/40 hover:bg-accent transition-colors text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border/20 mb-6 gap-1">
        {(["overview", "drafts", "logs", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "overview" && <><Activity className="w-3.5 h-3.5" /> Overview</>}
            {tab === "drafts" && (
              <>
                <Send className="w-3.5 h-3.5" /> Drafts
                {failedCount > 0 && (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-mono px-1 py-0.5 rounded">{failedCount}</span>
                )}
              </>
            )}
            {tab === "logs" && <><Database className="w-3.5 h-3.5" /> Audit Logs</>}
            {tab === "settings" && <><Settings className="w-3.5 h-3.5" /> Settings</>}
          </button>
        ))}
      </div>

      {!isLoaded ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════ */}
          {/*  OVERVIEW                                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Metric cards */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Daily AI Drafts",
                    value: dailyGen,
                    sub: `/ ${settingsForm.maxDraftsPerDay} max`,
                    icon: Cpu,
                    iconCls: "bg-primary/10 border-primary/20 text-primary",
                  },
                  {
                    label: "Pending Review",
                    value: pendingCount,
                    sub: null,
                    icon: Clock,
                    iconCls: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                  },
                  {
                    label: "Posted Today",
                    value: dailyPub,
                    sub: xLimits ? `/ ${xLimits.limits.dailyLimit} limit` : undefined,
                    icon: Send,
                    iconCls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                  },
                ].map(({ label, value, sub, icon: Icon, iconCls }) => (
                  <div key={label} className="bg-card border border-border/40 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className="text-2xl font-bold text-foreground mt-0.5">
                        {value}
                        {sub && <span className="text-xs font-normal text-muted-foreground ml-1">{sub}</span>}
                      </p>
                    </div>
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border", iconCls)}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pipeline Status + Recent Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pipeline Status */}
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-primary" /> Pipeline Status
                  </h3>
                  <div className="space-y-2 text-sm">
                    {[
                      {
                        label: "Auto-Draft",
                        value: settingsForm.autoDraftEnabled ? "Active" : "Disabled",
                        cls: settingsForm.autoDraftEnabled ? "text-emerald-400" : "text-muted-foreground",
                      },
                      {
                        label: "Min Score Threshold",
                        value: `${settingsForm.minSignalScore}/10`,
                        cls: "text-primary font-semibold",
                      },
                      {
                        label: "X API Connection",
                        value: settingsData?.xConnected ? "Connected" : "Action Required",
                        cls: settingsData?.xConnected ? "text-emerald-400" : "text-amber-400 font-semibold",
                      },
                      ...(xLimits ? [
                        {
                          label: "X Posts Today",
                          value: `${xLimits.dailyCount} / ${xLimits.limits.dailyLimit}`,
                          cls: xLimits.dailyCount / xLimits.limits.dailyLimit >= 0.8 ? "text-amber-400 font-semibold" : "text-muted-foreground",
                        },
                        {
                          label: "X Posts This Hour",
                          value: `${xLimits.hourlyCount} / ${xLimits.limits.hourlyLimit}`,
                          cls: xLimits.hourlyCount / xLimits.limits.hourlyLimit >= 0.8 ? "text-amber-400 font-semibold" : "text-muted-foreground",
                        },
                      ] : []),
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="flex justify-between py-1.5 border-b border-border/10 last:border-0">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={cls}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setActiveTab("drafts")} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                      Drafts Queue
                    </button>
                    <button onClick={() => setActiveTab("settings")} className="px-3 py-1.5 bg-muted border border-border/40 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
                      Settings
                    </button>
                  </div>
                </div>

                {/* Recent Actions */}
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-primary" /> Recent Actions
                  </h3>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {logsData.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No records yet.</p>
                    ) : (
                      logsData.slice(0, 8).map((log) => (
                        <div key={log.id} className="flex gap-2 text-xs pb-2 border-b border-border/10 last:border-0">
                          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border shrink-0 h-fit", ACTION_PILL[log.action] || "bg-muted/30 text-muted-foreground border-border/30")}>
                            {log.action}
                          </span>
                          <div className="min-w-0">
                            <p className="text-muted-foreground truncate">{log.detail}</p>
                            <p className="text-muted-foreground/50 mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button onClick={() => setActiveTab("logs")} className="text-xs text-primary mt-3 hover:underline">
                    View All Logs →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/*  DRAFTS                                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === "drafts" && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "All", val: "all" },
                  { label: "Generated", val: "generated" },
                  { label: "Approved", val: "approved" },
                  { label: "Scheduled", val: "scheduled" },
                  { label: "Published", val: "published" },
                  { label: "Failed", val: "failed" },
                  { label: "Rejected", val: "rejected" },
                ].map((f) => (
                  <button
                    key={f.val}
                    onClick={() => { setDraftStatus(f.val); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                      draftStatus === f.val
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-muted border-border/30 text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground self-center">
                  {draftsData?.total ?? 0} drafts
                </span>
              </div>

              {/* Draft list */}
              {!draftsData?.drafts.length ? (
                <div className="border border-dashed border-border/40 rounded-xl py-14 flex flex-col items-center gap-2 text-muted-foreground">
                  <Send className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No drafts match this filter.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {draftsData.drafts.map((draft) => (
                    <div key={draft.id} className="bg-card border border-border/40 rounded-xl p-4 hover:border-border/70 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Status pill */}
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono uppercase border shrink-0 mt-0.5", STATUS_PILL[draft.status])}>
                          {draft.status}
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed mb-1.5">
                            {draft.text.startsWith("[AI GENERATION FAILED]")
                              ? <span className="text-red-400">{draft.text}</span>
                              : draft.text}
                          </p>

                          {draft.signal && (
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              <span className="text-primary font-semibold">{draft.signal.score}</span>
                              {" · "}
                              {draft.signal.title}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {draft.scheduledAt && draft.status === "scheduled" && (
                              <span className="flex items-center gap-1 text-blue-400">
                                <Clock className="w-3 h-3" /> {formatScheduled(draft.scheduledAt)}
                              </span>
                            )}
                            {draft.status === "failed" && (
                              <span className="flex items-center gap-1 text-red-400">
                                <AlertCircle className="w-3 h-3" /> {draft.retryCount}/3 retries
                              </span>
                            )}
                            <span>{new Date(draft.createdAt).toLocaleDateString()}</span>
                            {draft.platform !== "x" && <span className="uppercase font-mono">{draft.platform}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(draft)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {draft.status === "generated" && (
                            <>
                              <button onClick={() => patchDraft(draft.id, { status: "approved" }).catch(e => alert(e.message))} className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors">
                                Approve
                              </button>
                              <button onClick={() => patchDraft(draft.id, { status: "rejected" }).catch(e => alert(e.message))} className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors" title="Reject">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {draft.status === "failed" && (
                            <button onClick={() => handleRetry(draft.id)} className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors" title="Retry AI Generation">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(draft.status === "failed" || draft.status === "rejected") && (
                            <button onClick={() => setDeleteTarget(draft)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors" title="Delete permanently">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => { navigator.clipboard.writeText(draft.text); setCopiedId(draft.id); setTimeout(() => setCopiedId(null), 2000); }}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {copiedId === draft.id && <span className="text-[10px] text-emerald-400">Copied</span>}

                          {draft.platform === "x" && (
                            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(draft.text)}`} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-sky-500/15 text-muted-foreground hover:text-sky-400 transition-colors" title="Open Tweet Intent">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-border/40 hover:bg-accent disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-border/40 hover:bg-accent disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/*  AUDIT LOGS                                                     */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === "logs" && (
            <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border/20">
                <h3 className="text-sm font-semibold text-foreground">Audit Logs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Chronological history of publishing, generation, and admin actions.</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground uppercase font-semibold">
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Detail</th>
                    <th className="px-4 py-3 text-left">Platform</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {logsData.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No logs found.</td></tr>
                  ) : logsData.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border", ACTION_PILL[log.action] || "bg-muted/30 text-muted-foreground border-border/30")}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-foreground">{log.detail}</p>
                        {log.xPostId && (
                          <a href={`https://x.com/i/web/status/${log.xPostId}`} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                            View post <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.platform}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.actorEmail || "system"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/*  SETTINGS                                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pipeline config */}
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-primary" /> Pipeline Configuration
                  </h3>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Auto Draft Generation</p>
                        <p className="text-xs text-muted-foreground">Auto-generate drafts for high-score signals.</p>
                      </div>
                      <input type="checkbox" checked={settingsForm.autoDraftEnabled}
                        onChange={e => setSettingsForm({ ...settingsForm, autoDraftEnabled: e.target.checked })}
                        className="w-4 h-4 rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Signal Score</label>
                      <input type="number" min="1" max="10" step="0.5" value={settingsForm.minSignalScore}
                        onChange={e => setSettingsForm({ ...settingsForm, minSignalScore: parseFloat(e.target.value) || 7 })}
                        className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max AI Drafts / Day</label>
                      <input type="number" min="1" max="200" value={settingsForm.maxDraftsPerDay}
                        onChange={e => setSettingsForm({ ...settingsForm, maxDraftsPerDay: parseInt(e.target.value, 10) || 20 })}
                        className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    {settingsSuccess && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5" /> Saved.
                      </div>
                    )}
                    <button type="submit" disabled={isSavingSettings}
                      className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                      {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Settings"}
                    </button>
                  </form>
                </div>

                {/* Add/Edit account */}
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  {/* Platform toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-primary" /> {editingAccountId ? "Edit Account" : "Connect Account"}
                    </h3>
                    <div className="flex rounded-lg border border-border/40 overflow-hidden text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => { setEditingAccountId(null); setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: "x" }); }}
                        className={cn("px-3 py-1.5 transition-colors", accountForm.platform === "x" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent")}
                      >
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                          X / Twitter
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingAccountId(null); setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: "facebook" }); }}
                        className={cn("px-3 py-1.5 transition-colors border-l border-border/40", accountForm.platform === "facebook" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent")}
                      >
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          Facebook
                        </span>
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleConnectAccount} className="space-y-3">
                    {/* Dynamic fields based on platform */}
                    {accountForm.platform === "x" ? (
                      <>
                        {[
                          { label: "Handle", key: "handle", placeholder: "@account", type: "text", hint: null },
                          { label: "API Key", key: "apiKey", placeholder: "Consumer key", type: "password", hint: "From developer.twitter.com → App → Keys & Tokens" },
                          { label: "API Secret", key: "apiSecret", placeholder: "Consumer secret", type: "password", hint: null },
                          { label: "Access Token", key: "accessToken", placeholder: "User token", type: "password", hint: null },
                          { label: "Access Token Secret", key: "accessTokenSecret", placeholder: "User secret", type: "password", hint: null },
                        ].map(({ label, key, placeholder, type, hint }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                            {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
                            <input type={type} placeholder={placeholder} value={(accountForm as any)[key]}
                              onChange={e => setAccountForm({ ...accountForm, [key]: e.target.value })}
                              required
                              className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
                          Requires a Meta Developer App with <code className="text-primary">pages_manage_posts</code> permission and a Page Access Token.
                        </div>
                        {[
                          { label: "Page Handle / Name", key: "handle", placeholder: "My Facebook Page", type: "text", hint: null },
                          { label: "Page ID", key: "apiKey", placeholder: "123456789012345", type: "text", hint: "Found under Page → About → Page ID" },
                          { label: "App Secret", key: "apiSecret", placeholder: "Meta app secret (optional)", type: "password", hint: null },
                          { label: "Page Access Token", key: "accessToken", placeholder: "Long-lived Page Access Token", type: "password", hint: "Generate via Meta Business Suite or Graph Explorer" },
                        ].map(({ label, key, placeholder, type, hint }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                            {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
                            <input type={type} placeholder={placeholder} value={(accountForm as any)[key]}
                              onChange={e => setAccountForm({ ...accountForm, [key]: e.target.value })}
                              required={key !== "apiSecret"}
                              className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                          </div>
                        ))}
                      </>
                    )}

                    {connectSuccess && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5" /> {editingAccountId ? "Updated!" : "Connected!"}
                      </div>
                    )}
                    {connectError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <XCircle className="w-3.5 h-3.5" /> {connectError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {editingAccountId && (
                        <button type="button" onClick={() => { setEditingAccountId(null); setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: accountForm.platform }); }}
                          className="px-4 py-2 border border-border/40 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors">
                          Cancel
                        </button>
                      )}
                      <button type="submit" disabled={isConnectingAccount}
                        className="flex-1 py-2 bg-muted border border-border/40 rounded-lg text-sm font-semibold text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2">
                        {isConnectingAccount ? <RefreshCw className="w-4 h-4 animate-spin" /> : `${editingAccountId ? "Update" : "Verify & Save"} ${accountForm.platform === "facebook" ? "Facebook Page" : "X Account"}`}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Connected accounts */}
              {accountsData && accountsData.length > 0 && (
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" /> Connected Accounts
                  </h3>
                  <div className="space-y-2">
                    {accountsData.map(acct => (
                      <div key={acct.id} className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", acct.isActive ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/20")}>
                        <div className="flex items-center gap-2.5">
                          <Star className={cn("w-3.5 h-3.5", acct.isActive ? "text-emerald-400 fill-emerald-400" : "text-muted-foreground")} />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{acct.handle}</p>
                            <p className="text-xs text-muted-foreground">{acct.isActive ? "Active publisher" : `Added ${new Date(acct.createdAt).toLocaleDateString()}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleEditAccount(acct.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit Credentials">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {acct.isActive ? (
                            <span className="text-xs text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">Active</span>
                          ) : (
                            <>
                              <button onClick={() => handleActivateAccount(acct.id)} className="text-xs text-primary font-semibold px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors">Set Active</button>
                              <button onClick={() => handleDeleteAccount(acct.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Edit Modal ─────────────────────────────────────────────────────── */}
      {editingDraft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border/40 rounded-xl w-full max-w-lg shadow-2xl p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Draft</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Review, edit and approve or schedule.</p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <label className="font-semibold">Post Content</label>
                  <span className={cn("font-mono", editedText.length > 280 ? "text-red-400 font-bold" : "")}>{editedText.length} / 280</span>
                </div>
                <textarea rows={5} value={editedText} onChange={e => setEditedText(e.target.value)}
                  className={cn("w-full bg-input border rounded-lg p-3 text-sm text-foreground focus:outline-none transition-colors resize-none",
                    editedText.length > 280 ? "border-red-500" : "border-border/40 focus:border-primary")} />
                {editedText.length > 280 && <p className="text-xs text-red-400 mt-1">Exceeds 280 characters.</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule (Optional)</label>
                  <span className="text-[10px] text-muted-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                </div>
                <input type="datetime-local" min={getMinDateTimeLocal()} value={editedSchedule}
                  onChange={e => setEditedSchedule(e.target.value)}
                  className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                {editedSchedule && (
                  <p className="text-[11px] text-muted-foreground mt-1">→ {formatScheduled(localToISO(editedSchedule))}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/10">
              <button onClick={() => setEditingDraft(null)} disabled={isSavingDraft}
                className="px-3 py-1.5 rounded-lg text-sm border border-border/40 text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <div className="flex gap-2">
                <button onClick={handleSaveDraft} disabled={isSavingDraft || editedText.length > 280}
                  className="px-3 py-1.5 rounded-lg text-sm bg-muted border border-border/40 hover:bg-accent text-foreground transition-colors font-medium">
                  Save
                </button>
                <button onClick={handleApprove} disabled={isSavingDraft || editedText.length > 280}
                  className="px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-semibold flex items-center gap-1.5">
                  {isSavingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (editedSchedule ? "Schedule" : "Approve")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
