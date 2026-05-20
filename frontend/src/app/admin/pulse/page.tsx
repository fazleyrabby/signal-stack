"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Send,
  Activity,
  Settings,
  Database,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
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
  Twitter,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function PulseAdmin() {
  const [activeTab, setActiveTab] = useState<"overview" | "drafts" | "logs" | "settings">("overview");

  // Filter/Paging State
  const [draftStatus, setDraftStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 8;

  // Modals & Forms State
  const [editingDraft, setEditingDraft] = useState<PulseDraft | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedSchedule, setEditedSchedule] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Account Connect State
  const [accountForm, setAccountForm] = useState({
    handle: "",
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  });
  const [isConnectingAccount, setIsConnectingAccount] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    autoDraftEnabled: true,
    minSignalScore: 7,
    maxDraftsPerDay: 20,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Data Fetching via SWR
  const { data: draftsData, error: draftsErr, mutate: mutateDrafts } = useSWR<{
    drafts: PulseDraft[];
    total: number;
    page: number;
    limit: number;
  }>(
    `${API_BASE}/api/admin/pulse/drafts?status=${draftStatus}&page=${currentPage}&limit=${limit}`,
    fetcher
  );

  const { data: settingsData, error: settingsErr, mutate: mutateSettings } = useSWR<PulseSettings>(
    `${API_BASE}/api/admin/pulse/settings`,
    fetcher,
    {
      onSuccess: (data) => {
        setSettingsForm({
          autoDraftEnabled: data.autoDraftEnabled,
          minSignalScore: data.minSignalScore,
          maxDraftsPerDay: data.maxDraftsPerDay,
        });
      },
    }
  );

  const { data: logsData, error: logsErr, mutate: mutateLogs } = useSWR<PublishLog[]>(
    `${API_BASE}/api/admin/pulse/logs`,
    fetcher
  );

  const isLoaded = draftsData && settingsData && logsData;

  const totalPages = draftsData ? Math.ceil(draftsData.total / limit) : 1;

  // Action Handlers
  const handleSaveDraft = async () => {
    if (!editingDraft) return;
    if (editedText.length > 280) {
      alert("Post exceeds X character limit of 280 characters.");
      return;
    }
    setIsSavingDraft(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${editingDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editedText,
          scheduledAt: editedSchedule || null,
          status: editingDraft.status === "failed" ? "scheduled" : editingDraft.status,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save draft");
      await mutateDrafts();
      await mutateLogs();
      setEditingDraft(null);
    } catch (err: any) {
      alert(err.message || "Failed to update draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      await mutateDrafts();
      await mutateLogs();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handlePublishNow = async (id: string) => {
    const confirmPublish = window.confirm("Are you sure you want to post this draft directly to X right now?");
    if (!confirmPublish) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to publish");
      }
      alert("Draft posted successfully to X!");
      await mutateDrafts();
      await mutateLogs();
    } catch (err: any) {
      alert(err.message || "Publishing failed");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save settings");
      await mutateSettings();
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingAccount(true);
    setConnectError(null);
    setConnectSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Credential verification failed");
      }
      setConnectSuccess(true);
      await mutateSettings();
      setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" });
      setTimeout(() => setConnectSuccess(false), 3000);
    } catch (err: any) {
      setConnectError(err.message || "Connection failed");
    } finally {
      setIsConnectingAccount(false);
    }
  };

  const openEditModal = (draft: PulseDraft) => {
    setEditingDraft(draft);
    setEditedText(draft.text);
    setEditedSchedule(
      draft.scheduledAt ? new Date(draft.scheduledAt).toISOString().slice(0, 16) : ""
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl min-h-screen text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-frost-400 via-frost-200 to-snow-100 bg-clip-text text-transparent">
            SignalStack Pulse
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated AI post drafting and social distribution management pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {settingsData?.xConnected ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium">
              <UserCheck className="w-4 h-4" />
              <span>X Account: {settingsData.xHandle}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2 rounded-xl text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>No X Account Connected</span>
            </div>
          )}
          <button
            onClick={() => {
              mutateDrafts();
              mutateSettings();
              mutateLogs();
            }}
            className="flex items-center justify-center p-2 rounded-xl bg-card border border-border/40 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border/20 mb-8 overflow-x-auto gap-2">
        {(["overview", "drafts", "logs", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-3 text-sm font-medium transition-all border-b-2 capitalize relative shrink-0",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/40"
            )}
          >
            {tab === "overview" && <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Overview</span>}
            {tab === "drafts" && <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Drafts Queue</span>}
            {tab === "logs" && <span className="flex items-center gap-2"><Database className="w-4 h-4" /> Audit Logs</span>}
            {tab === "settings" && <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings & API</span>}
          </button>
        ))}
      </div>

      {!isLoaded ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Synchronizing Pulse engine...</p>
        </div>
      ) : (
        <>
          {/* 1. OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Daily AI Draft Count</p>
                    <h3 className="text-3xl font-bold mt-1 text-foreground">
                      {logsData.filter(l => l.action === "generated" && new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
                      <span className="text-sm font-normal text-muted-foreground"> / {settingsForm.maxDraftsPerDay} max</span>
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-frost-500/10 flex items-center justify-center border border-frost-500/20 text-primary">
                    <Cpu className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Pending Review</p>
                    <h3 className="text-3xl font-bold mt-1 text-amber-400">
                      {draftsData?.drafts.filter(d => d.status === "generated").length || 0}
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">X Daily Post Count</p>
                    <h3 className="text-3xl font-bold mt-1 text-emerald-400">
                      {logsData.filter(l => l.action === "published" && new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
                      <span className="text-sm font-normal text-muted-foreground"> / 17 limit</span>
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                    <Send className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Status and Action Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Integration Details */}
                <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Platform Integration Status
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Pulse automatically consumes technology signals that meet score thresholds and enqueues them for social updates.
                      Once generated, posts are placed in a review state where you can schedule or publish them.
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex justify-between py-1 border-b border-border/10">
                        <span>Auto-Draft Pipeline</span>
                        <span className={settingsForm.autoDraftEnabled ? "text-emerald-400" : "text-muted-foreground"}>
                          {settingsForm.autoDraftEnabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/10">
                        <span>Min Signal Score Threshold</span>
                        <span className="text-primary font-semibold">{settingsForm.minSignalScore}/10</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>X API Connection Status</span>
                        <span className={settingsData?.xConnected ? "text-emerald-400" : "text-amber-400 font-semibold"}>
                          {settingsData?.xConnected ? "Connected" : "Action Required"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab("drafts")}
                      className="px-4 py-2 bg-frost-600 hover:bg-frost-500 transition-colors rounded-xl text-sm font-medium text-slate-900 flex items-center gap-1.5"
                    >
                      Go to Drafts Queue <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="px-4 py-2 bg-muted hover:bg-accent transition-colors border border-border/40 rounded-xl text-sm font-medium text-muted-foreground"
                    >
                      Modify Parameters
                    </button>
                  </div>
                </div>

                {/* Latest Logs summary */}
                <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" /> Recent Actions Feed
                    </h4>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                      {logsData.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-4 text-center">No action records found.</p>
                      ) : (
                        logsData.slice(0, 4).map((log) => (
                          <div key={log.id} className="flex gap-3 text-xs border-b border-border/10 pb-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md font-mono shrink-0 h-fit uppercase text-[10px]",
                              log.action === "published" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                              log.action === "generated" && "bg-frost-500/10 text-primary border border-frost-500/20",
                              log.action === "failed" && "bg-red-500/10 text-red-400 border border-red-500/20",
                              log.action === "approved" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                            )}>
                              {log.action}
                            </span>
                            <div className="flex-1">
                              <p className="text-muted-foreground font-medium">{log.detail}</p>
                              <p className="text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("logs")}
                    className="mt-4 text-sm text-primary hover:text-primary font-medium flex items-center gap-1 self-start"
                  >
                    View All Logs <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. DRAFTS QUEUE TAB */}
          {activeTab === "drafts" && (
            <div className="space-y-6">
              {/* Toolbar & Filters */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card/20 border border-border/20 p-4 rounded-2xl">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "All Statuses", val: "all" },
                    { label: "AI Generated", val: "generated" },
                    { label: "Scheduled", val: "scheduled" },
                    { label: "Published", val: "published" },
                    { label: "Failed", val: "failed" },
                    { label: "Rejected", val: "rejected" },
                  ].map((filter) => (
                    <button
                      key={filter.val}
                      onClick={() => {
                        setDraftStatus(filter.val);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all",
                        draftStatus === filter.val
                          ? "bg-frost-600 border-frost-500 text-slate-900"
                          : "bg-muted border-border/40 hover:bg-accent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {draftsData ? `${draftsData.total} Drafts found` : "Loading..."}
                </div>
              </div>

              {/* Draft Grid */}
              {!draftsData || draftsData.drafts.length === 0 ? (
                <div className="bg-card/20 border border-dashed border-border/40 py-20 rounded-2xl flex flex-col items-center justify-center gap-3">
                  <Send className="w-10 h-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm">No social drafts match this criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {draftsData.drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-card/40 backdrop-blur-md border border-border/40 p-5 rounded-2xl flex flex-col justify-between hover:border-frost-500/40 transition-colors shadow-lg group relative"
                    >
                      <div>
                        {/* Header Status */}
                        <div className="flex items-center justify-between border-b border-border/10 pb-3 mb-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold uppercase font-mono tracking-wider border",
                            draft.status === "generated" && "bg-amber-500/10 border-amber-500/30 text-amber-400",
                            draft.status === "scheduled" && "bg-blue-500/10 border-blue-500/30 text-blue-400",
                            draft.status === "published" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                            draft.status === "failed" && "bg-red-500/10 border-red-500/30 text-red-400",
                            draft.status === "rejected" && "bg-muted/30 border-border/40 text-muted-foreground"
                          )}>
                            {draft.status}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {new Date(draft.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Post Text */}
                        <p className="text-foreground text-sm font-medium leading-relaxed bg-muted/40 border border-border/10 p-3 rounded-xl mb-4 italic">
                          "{draft.text}"
                        </p>

                        {/* Source Signal Context */}
                        {draft.signal && (
                          <div className="bg-muted/60 p-3 rounded-xl border border-border/20 text-xs mb-4">
                            <div className="flex justify-between items-start gap-2 mb-1.5">
                              <span className="font-semibold text-muted-foreground line-clamp-1 flex-1">
                                {draft.signal.title}
                              </span>
                              <span className="bg-frost-500/15 text-primary font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-frost-500/20">
                                Score: {draft.signal.score}
                              </span>
                            </div>
                            {draft.signal.aiSummary && (
                              <p className="text-muted-foreground line-clamp-2 italic">{draft.signal.aiSummary}</p>
                            )}
                          </div>
                        )}

                        {/* Extra Status details */}
                        {draft.scheduledAt && draft.status === "scheduled" && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-4 bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Post scheduled for {new Date(draft.scheduledAt).toLocaleString()}</span>
                          </div>
                        )}
                        {draft.status === "failed" && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400 mb-4 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="truncate">Retries: {draft.retryCount}/3. Needs modification.</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between border-t border-border/10 pt-4 mt-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(draft)}
                            className="p-2 rounded-lg bg-muted border border-border/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit Draft"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {draft.status === "generated" && (
                            <button
                              onClick={() => handleUpdateStatus(draft.id, "rejected")}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Reject Draft"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {draft.status === "generated" && (
                            <button
                              onClick={() => handleUpdateStatus(draft.id, "approved")}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(draft.text);
                              setCopiedId(draft.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-muted border border-border/40 text-muted-foreground hover:bg-accent hover:text-foreground text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === draft.id ? "Copied!" : "Copy"}
                          </button>
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(draft.text)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Post on Twitter"
                          >
                            <Twitter className="w-3 h-3" /> Tweet
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-card border border-border/40 hover:bg-accent disabled:opacity-40 disabled:hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-card border border-border/40 hover:bg-accent disabled:opacity-40 disabled:hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. AUDIT LOGS TAB */}
          {activeTab === "logs" && (
            <div className="bg-card/45 backdrop-blur-md border border-border/40 rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h4 className="text-lg font-bold text-foreground mb-1">Pulse Audit logs</h4>
                <p className="text-sm text-muted-foreground">Chronological history of social publishing, errors, and approvals.</p>
              </div>

              <div className="border border-border/20 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted border-b border-border/40 text-muted-foreground font-semibold text-xs uppercase">
                      <th className="p-4">Action</th>
                      <th className="p-4">Detail</th>
                      <th className="p-4">Actor</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {logsData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">No logs found.</td>
                      </tr>
                    ) : (
                      logsData.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/20 text-foreground">
                          <td className="p-4 font-mono">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs uppercase font-mono border",
                              log.action === "published" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                              log.action === "generated" && "bg-frost-500/10 border-frost-500/20 text-primary",
                              log.action === "failed" && "bg-red-500/10 border-red-500/20 text-red-400",
                              log.action === "approved" && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                              log.action === "rejected" && "bg-muted/30 border-border/30 text-muted-foreground",
                            )}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 max-w-md">
                            <p className="font-medium text-foreground">{log.detail}</p>
                            {log.xPostId && (
                              <a
                                href={`https://x.com/i/web/status/${log.xPostId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1"
                              >
                                View Tweet <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </td>
                          <td className="p-4 font-mono text-muted-foreground">{log.actorEmail || "system"}</td>
                          <td className="p-4 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pipeline Tuning Form */}
              <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" /> Pipeline Configuration
                    </h3>
                    <p className="text-sm text-muted-foreground">Configure parameters for automatic drafting.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Auto-Draft Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted/40 border border-border/10 rounded-xl">
                      <div>
                        <label className="text-sm font-semibold text-foreground">Auto Draft Generation</label>
                        <p className="text-xs text-muted-foreground mt-0.5">Automatically trigger AI drafts for new summarized signals.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsForm.autoDraftEnabled}
                        onChange={(e) => setSettingsForm({ ...settingsForm, autoDraftEnabled: e.target.checked })}
                        className="w-4 h-4 rounded text-frost-600 focus:ring-frost-500 border-border bg-input"
                      />
                    </div>

                    {/* Min Score Input */}
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-muted-foreground">Minimum Signal Score</label>
                      <p className="text-xs text-muted-foreground mb-1.5">Only signals with this score or higher are automatically drafted.</p>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={settingsForm.minSignalScore}
                        onChange={(e) => setSettingsForm({ ...settingsForm, minSignalScore: parseFloat(e.target.value) || 7 })}
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors"
                      />
                    </div>

                    {/* Max Drafts Input */}
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-muted-foreground">Max AI Drafts / 24h</label>
                      <p className="text-xs text-muted-foreground mb-1.5">Daily limit on automated AI draft generation to preserve tokens.</p>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={settingsForm.maxDraftsPerDay}
                        onChange={(e) => setSettingsForm({ ...settingsForm, maxDraftsPerDay: parseInt(e.target.value, 10) || 20 })}
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors"
                      />
                    </div>
                  </div>

                  {settingsSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      <span>Settings updated successfully.</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full py-2.5 bg-frost-600 border border-frost-500 text-slate-900 hover:bg-frost-500 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isSavingSettings ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save Pipeline Settings"
                    )}
                  </button>
                </form>
              </div>

              {/* X Credential Setup Form */}
              <div className="bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                <form onSubmit={handleConnectAccount} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                      <Send className="w-5 h-5 text-primary" /> Connect X / Twitter API
                    </h3>
                    <p className="text-sm text-muted-foreground">Configure write credentials using an X Developer app.</p>
                  </div>

                  <div className="space-y-4">
                    {/* X Handle */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Handle</label>
                      <input
                        type="text"
                        placeholder="@MyXAccount"
                        value={accountForm.handle}
                        onChange={(e) => setAccountForm({ ...accountForm, handle: e.target.value })}
                        required
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors text-sm"
                      />
                    </div>

                    {/* API Key */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">App API Key (Consumer Key)</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={accountForm.apiKey}
                        onChange={(e) => setAccountForm({ ...accountForm, apiKey: e.target.value })}
                        required
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors text-sm"
                      />
                    </div>

                    {/* API Secret */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">App API Secret Key</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={accountForm.apiSecret}
                        onChange={(e) => setAccountForm({ ...accountForm, apiSecret: e.target.value })}
                        required
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors text-sm"
                      />
                    </div>

                    {/* Access Token */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Access Token</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={accountForm.accessToken}
                        onChange={(e) => setAccountForm({ ...accountForm, accessToken: e.target.value })}
                        required
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors text-sm"
                      />
                    </div>

                    {/* Access Token Secret */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Access Token Secret</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={accountForm.accessTokenSecret}
                        onChange={(e) => setAccountForm({ ...accountForm, accessTokenSecret: e.target.value })}
                        required
                        className="w-full bg-input border border-border/40 rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-frost-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  {connectSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      <span>X account connected successfully!</span>
                    </div>
                  )}

                  {connectError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>Verification failed: {connectError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isConnectingAccount}
                    className="w-full py-2.5 bg-muted hover:bg-accent transition-colors border border-border/40 font-semibold rounded-xl text-sm text-foreground flex items-center justify-center gap-2"
                  >
                    {isConnectingAccount ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      "Verify & Save X Account"
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. EDIT & SCHEDULE DRAFT MODAL */}
      {editingDraft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border/40 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col gap-4 text-card-foreground">
            <div>
              <h3 className="text-xl font-bold text-foreground">Review Social Update</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Refine the generated post and schedule it or post immediately.
              </p>
            </div>

            <div className="space-y-4">
              {/* Draft text Area */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <label className="font-semibold text-muted-foreground">Draft Content (Max 280 characters)</label>
                  <span className={cn(
                    "font-mono font-bold",
                    editedText.length > 280 ? "text-red-400" : "text-muted-foreground"
                  )}>
                    {editedText.length} / 280
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className={cn(
                    "w-full bg-input border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-frost-500 transition-colors resize-none leading-relaxed",
                    editedText.length > 280 ? "border-red-500 focus:border-red-500" : "border-border/40"
                  )}
                />
                {editedText.length > 280 && (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Post length exceeds 280 character limit.</span>
                  </p>
                )}
              </div>

              {/* Schedule time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Schedule Post (Optional)
                </label>
                <p className="text-xs text-muted-foreground mb-1">
                  Leave blank to queue as an approved draft or post manually.
                </p>
                <input
                  type="datetime-local"
                  value={editedSchedule}
                  onChange={(e) => setEditedSchedule(e.target.value)}
                  className="w-full bg-input border border-border/40 rounded-xl px-4 py-2 text-foreground text-sm focus:outline-none focus:border-frost-500 transition-colors"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-border/10 pt-4 mt-2">
              <button
                onClick={() => setEditingDraft(null)}
                disabled={isSavingDraft}
                className="px-4 py-2 rounded-xl text-sm border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>

              <div className="flex gap-2">
                {/* Save Draft */}
                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || editedText.length > 280}
                  className="px-4 py-2 rounded-xl text-sm bg-muted border border-border/40 hover:bg-accent text-foreground transition-colors font-medium"
                >
                  Save Draft
                </button>

                {/* Approve & Schedule */}
                <button
                  onClick={async () => {
                    if (editedText.length > 280) return;
                    setIsSavingDraft(true);
                    try {
                      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${editingDraft.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          text: editedText,
                          scheduledAt: editedSchedule || null,
                          status: editedSchedule ? "scheduled" : "approved",
                        }),
                        credentials: "include",
                      });
                      if (!res.ok) throw new Error("Failed to approve/schedule");
                      await mutateDrafts();
                      await mutateLogs();
                      setEditingDraft(null);
                    } catch (err: any) {
                      alert(err.message);
                    } finally {
                      setIsSavingDraft(false);
                    }
                  }}
                  disabled={isSavingDraft || editedText.length > 280}
                  className="px-4 py-2 rounded-xl text-sm bg-frost-600 border border-frost-500 hover:bg-frost-500 text-slate-900 font-semibold transition-colors flex items-center gap-1.5"
                >
                  {editedSchedule ? "Schedule Post" : "Approve Draft"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
