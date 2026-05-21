"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Activity,
  Settings,
  Database,
  RefreshCw,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
  UserCheck,
  Copy,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

type PulseDraft = {
  id: string;
  sourceSignalId: string;
  platform: string;
  text: string;
  status: "pending" | "generated" | "approved" | "scheduled" | "published" | "failed" | "rejected";
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

const STATUS_FILTERS = [
  { label: "All", val: "all" },
  { label: "Generated", val: "generated" },
  { label: "Scheduled", val: "scheduled" },
  { label: "Published", val: "published" },
  { label: "Failed", val: "failed" },
  { label: "Rejected", val: "rejected" },
];

const ACTION_COLORS: Record<string, string> = {
  published: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  generated: "bg-primary/10 border-primary/20 text-primary",
  failed: "bg-red-500/10 border-red-500/20 text-red-400",
  approved: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  rejected: "bg-muted/30 border-border/30 text-muted-foreground",
};

const DRAFT_STATUS_COLORS: Record<string, string> = {
  generated: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  scheduled: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  published: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  failed: "bg-red-500/10 border-red-500/30 text-red-400",
  rejected: "bg-muted/30 border-border/40 text-muted-foreground",
};

export default function PulseAdmin() {
  const [draftStatus, setDraftStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 8;

  const [editingDraft, setEditingDraft] = useState<PulseDraft | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedSchedule, setEditedSchedule] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [accountForm, setAccountForm] = useState({
    handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "",
  });
  const [isConnectingAccount, setIsConnectingAccount] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    autoDraftEnabled: true, minSignalScore: 7, maxDraftsPerDay: 20,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const { data: draftsData, mutate: mutateDrafts } = useSWR<{
    drafts: PulseDraft[]; total: number; page: number; limit: number;
  }>(`${API_BASE}/api/admin/pulse/drafts?status=${draftStatus}&page=${currentPage}&limit=${limit}`, fetcher);

  const { data: settingsData, mutate: mutateSettings } = useSWR<PulseSettings>(
    `${API_BASE}/api/admin/pulse/settings`,
    fetcher,
    { onSuccess: (d) => setSettingsForm({ autoDraftEnabled: d.autoDraftEnabled, minSignalScore: d.minSignalScore, maxDraftsPerDay: d.maxDraftsPerDay }) }
  );

  const { data: logsData, mutate: mutateLogs } = useSWR<PublishLog[]>(
    `${API_BASE}/api/admin/pulse/logs`, fetcher
  );

  const totalPages = draftsData ? Math.ceil(draftsData.total / limit) : 1;

  const handleSaveDraft = async () => {
    if (!editingDraft) return;
    if (editedText.length > 280) return;
    setIsSavingDraft(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${editingDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editedText, scheduledAt: editedSchedule || null, status: editingDraft.status === "failed" ? "scheduled" : editingDraft.status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save draft");
      await mutateDrafts(); await mutateLogs();
      setEditingDraft(null);
    } catch (err: any) { alert(err.message); } finally { setIsSavingDraft(false); }
  };

  const handleApproveSchedule = async () => {
    if (!editingDraft || editedText.length > 280) return;
    setIsSavingDraft(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${editingDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editedText, scheduledAt: editedSchedule || null, status: editedSchedule ? "scheduled" : "approved" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve/schedule");
      await mutateDrafts(); await mutateLogs();
      setEditingDraft(null);
    } catch (err: any) { alert(err.message); } finally { setIsSavingDraft(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_BASE}/api/admin/pulse/drafts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }), credentials: "include",
      });
      await mutateDrafts(); await mutateLogs();
    } catch (err: any) { alert(err.message); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingSettings(true); setSettingsSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm), credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save settings");
      await mutateSettings(); setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) { alert(err.message); } finally { setIsSavingSettings(false); }
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault(); setIsConnectingAccount(true); setConnectError(null); setConnectSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/accounts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm), credentials: "include",
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Credential verification failed"); }
      setConnectSuccess(true); await mutateSettings();
      setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" });
      setTimeout(() => setConnectSuccess(false), 3000);
    } catch (err: any) { setConnectError(err.message); } finally { setIsConnectingAccount(false); }
  };

  const openEditModal = (draft: PulseDraft) => {
    setEditingDraft(draft); setEditedText(draft.text);
    setEditedSchedule(draft.scheduledAt ? new Date(draft.scheduledAt).toISOString().slice(0, 16) : "");
  };

  const refreshAll = () => { mutateDrafts(); mutateSettings(); mutateLogs(); };

  return (
    <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
      {/* ── Sticky top bar ── */}
      <div className="shrink-0 border-b border-border/40 bg-card/30">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span className="font-bold text-sm hidden sm:block">Pulse</span>
            <TabsList className="h-9 bg-transparent p-0 gap-0 border-0">
              {[
                { val: "overview", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Overview" },
                { val: "drafts", icon: <Send className="w-3.5 h-3.5" />, label: "Drafts" },
                { val: "logs", icon: <Database className="w-3.5 h-3.5" />, label: "Audit Logs" },
                { val: "settings", icon: <Settings className="w-3.5 h-3.5" />, label: "Settings" },
              ].map(({ val, icon, label }) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="h-9 px-4 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5"
                >
                  {icon}{label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="flex items-center gap-2">
            {settingsData?.xConnected ? (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded-md">
                <UserCheck className="w-3 h-3" />{settingsData.xHandle}
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2 py-1 rounded-md">
                <AlertCircle className="w-3 h-3" />No X Account
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 border border-border/40 rounded-lg" onClick={refreshAll} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Overview ── */}
      <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 m-0 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Daily AI Drafts",
              value: logsData?.filter(l => l.action === "generated" && new Date(l.createdAt).toDateString() === new Date().toDateString()).length ?? 0,
              suffix: `/ ${settingsForm.maxDraftsPerDay} max`,
              icon: <Cpu className="w-4 h-4" />,
              color: "text-primary bg-primary/10 border-primary/20",
            },
            {
              label: "Pending Review",
              value: draftsData?.drafts.filter(d => d.status === "generated").length ?? 0,
              icon: <Clock className="w-4 h-4" />,
              color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
            },
            {
              label: "Posted Today",
              value: logsData?.filter(l => l.action === "published" && new Date(l.createdAt).toDateString() === new Date().toDateString()).length ?? 0,
              icon: <Send className="w-4 h-4" />,
              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            },
          ].map(({ label, value, suffix, icon, color }) => (
            <div key={label} className="bg-card border border-border/40 p-5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium mb-1">{label}</p>
                <p className="text-2xl font-bold text-foreground">
                  {value}
                  {suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{suffix}</span>}
                </p>
              </div>
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center border", color)}>{icon}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border/40 p-5 rounded-xl space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Pipeline Status</h4>
            <div className="space-y-2 text-sm">
              {[
                { label: "Auto-Draft", value: settingsForm.autoDraftEnabled ? "Active" : "Disabled", ok: settingsForm.autoDraftEnabled },
                { label: "Min Score Threshold", value: `${settingsForm.minSignalScore}/10`, ok: true },
                { label: "X API Connection", value: settingsData?.xConnected ? "Connected" : "Action Required", ok: settingsData?.xConnected },
              ].map(({ label, value, ok }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border/10 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={ok ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border/40 p-5 rounded-xl space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Recent Actions</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {!logsData || logsData.length === 0 ? (
                <p className="text-muted-foreground text-xs py-3 text-center">No actions yet.</p>
              ) : (
                logsData.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex gap-2.5 text-xs pb-2 border-b border-border/10 last:border-0">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border shrink-0 h-fit", ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground border-border/30")}>
                      {log.action}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{log.detail}</p>
                      <p className="text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Drafts Queue ── */}
      <TabsContent value="drafts" className="flex-1 flex flex-col overflow-hidden m-0">
        {/* Filter bar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 border-b border-border/40 bg-muted/10">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map(({ label, val }) => (
              <button
                key={val}
                onClick={() => { setDraftStatus(val); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                  draftStatus === val
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
            {draftsData ? `${draftsData.total} drafts` : "…"}
          </span>
        </div>

        {/* Draft grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {!draftsData ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : draftsData.drafts.length === 0 ? (
            <div className="border border-dashed border-border/40 rounded-xl py-16 flex flex-col items-center gap-3">
              <Send className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No drafts match this filter.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {draftsData.drafts.map((draft) => (
                  <div key={draft.id} className="bg-card border border-border/40 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-colors">
                    {/* Card header */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono tracking-wider border", DRAFT_STATUS_COLORS[draft.status])}>
                          {draft.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(draft.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-sm text-foreground leading-relaxed bg-muted/30 border border-border/10 px-3 py-2 rounded-lg mb-3 italic">
                        "{draft.text}"
                      </p>

                      {draft.signal && (
                        <div className="bg-muted/40 px-3 py-2 rounded-lg border border-border/20 text-xs mb-3">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-muted-foreground line-clamp-1 flex-1">{draft.signal.title}</span>
                            <span className="text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] shrink-0">
                              {draft.signal.score}
                            </span>
                          </div>
                        </div>
                      )}

                      {draft.scheduledAt && draft.status === "scheduled" && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-3 bg-blue-500/5 px-2.5 py-1.5 rounded-lg border border-blue-500/10">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{new Date(draft.scheduledAt).toLocaleString()}</span>
                        </div>
                      )}
                      {draft.status === "failed" && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400 mb-3 bg-red-500/5 px-2.5 py-1.5 rounded-lg border border-red-500/10">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Retries: {draft.retryCount}/3</span>
                        </div>
                      )}
                    </div>

                    {/* Card footer actions */}
                    <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/10">
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 border border-border/40 rounded-lg" onClick={() => openEditModal(draft)} title="Edit">
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        {draft.status === "generated" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 border border-red-500/20 rounded-lg text-red-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleUpdateStatus(draft.id, "rejected")} title="Reject">
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {draft.status === "generated" && (
                          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs border-emerald-500/20 text-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleUpdateStatus(draft.id, "approved")}>
                            <CheckCircle className="w-3 h-3 mr-1" />Approve
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => { navigator.clipboard.writeText(draft.text); setCopiedId(draft.id); setTimeout(() => setCopiedId(null), 2000); }}>
                          <Copy className="w-3 h-3 mr-1" />{copiedId === draft.id ? "Copied!" : "Copy"}
                        </Button>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(draft.text)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-sky-500/20 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors font-medium"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                          Tweet
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentPage} / {totalPages}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </TabsContent>

      {/* ── Audit Logs ── */}
      <TabsContent value="logs" className="flex-1 overflow-y-auto p-6 m-0">
        <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40">
            <h4 className="text-sm font-bold">Pulse Audit Logs</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Chronological history of social publishing, errors, and approvals.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Detail</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {!logsData || logsData.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground text-sm">No logs found.</td></tr>
              ) : (
                logsData.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-mono border", ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground border-border/30")}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 max-w-sm">
                      <p className="text-foreground text-xs">{log.detail}</p>
                      {log.xPostId && (
                        <a href={`https://x.com/i/web/status/${log.xPostId}`} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                          View post <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">{log.actorEmail ?? "system"}</td>
                    <td className="px-5 py-3 text-[11px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>

      {/* ── Settings ── */}
      <TabsContent value="settings" className="flex-1 overflow-y-auto p-6 m-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Pipeline config */}
          <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40">
              <h4 className="text-sm font-bold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Pipeline Configuration</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Configure automatic drafting parameters.</p>
            </div>
            <form onSubmit={handleSaveSettings} className="p-5 space-y-5">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm font-semibold">Auto Draft Generation</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically draft AI posts for new signals.</p>
                </div>
                <Switch
                  checked={settingsForm.autoDraftEnabled}
                  onCheckedChange={(v) => setSettingsForm({ ...settingsForm, autoDraftEnabled: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Min Signal Score (1–10)</Label>
                <Input
                  type="number" min="1" max="10" step="0.5"
                  value={settingsForm.minSignalScore}
                  onChange={(e) => setSettingsForm({ ...settingsForm, minSignalScore: parseFloat(e.target.value) || 7 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Max AI Drafts / 24h</Label>
                <Input
                  type="number" min="1" max="200"
                  value={settingsForm.maxDraftsPerDay}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maxDraftsPerDay: parseInt(e.target.value, 10) || 20 })}
                  className="h-9"
                />
              </div>
              {settingsSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />Settings saved.
                </div>
              )}
              <Button type="submit" className="w-full h-9" disabled={isSavingSettings}>
                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Settings"}
              </Button>
            </form>
          </div>

          {/* X credentials */}
          <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                Connect X Account
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">Set write credentials from an X Developer app.</p>
            </div>
            <form onSubmit={handleConnectAccount} className="p-5 space-y-3">
              {[
                { key: "handle", label: "Account Handle", placeholder: "@MyXAccount", type: "text" },
                { key: "apiKey", label: "API Key (Consumer Key)", placeholder: "••••••••••••••••", type: "password" },
                { key: "apiSecret", label: "API Secret Key", placeholder: "••••••••••••••••", type: "password" },
                { key: "accessToken", label: "Access Token", placeholder: "••••••••••••••••", type: "password" },
                { key: "accessTokenSecret", label: "Access Token Secret", placeholder: "••••••••••••••••", type: "password" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest">{label}</Label>
                  <Input
                    type={type} placeholder={placeholder} required
                    value={accountForm[key as keyof typeof accountForm]}
                    onChange={(e) => setAccountForm({ ...accountForm, [key]: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
              {connectSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />X account connected!
                </div>
              )}
              {connectError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />{connectError}
                </div>
              )}
              <Button type="submit" variant="outline" className="w-full h-9 mt-1" disabled={isConnectingAccount}>
                {isConnectingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save Account"}
              </Button>
            </form>
          </div>
        </div>
      </TabsContent>

      {/* ── Edit Draft Dialog ── */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => { if (!open) setEditingDraft(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Draft</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Post Content</Label>
                <span className={cn("text-[10px] font-mono font-bold", editedText.length > 280 ? "text-red-400" : "text-muted-foreground")}>
                  {editedText.length} / 280
                </span>
              </div>
              <textarea
                rows={4}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className={cn(
                  "w-full bg-input border rounded-lg p-3 text-sm text-foreground focus:outline-none transition-colors resize-none leading-relaxed",
                  editedText.length > 280 ? "border-red-500 focus:border-red-500" : "border-border/40 focus:border-primary"
                )}
              />
              {editedText.length > 280 && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />Exceeds 280 character limit.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest">Schedule (optional)</Label>
              <Input
                type="datetime-local" value={editedSchedule}
                onChange={(e) => setEditedSchedule(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingDraft(null)} disabled={isSavingDraft}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || editedText.length > 280}>
              {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Draft"}
            </Button>
            <Button onClick={handleApproveSchedule} disabled={isSavingDraft || editedText.length > 280}>
              {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : editedSchedule ? "Schedule" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
