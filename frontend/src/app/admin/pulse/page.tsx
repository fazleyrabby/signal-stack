"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  Send, Settings, Database, RefreshCw, Edit2, Trash2,
  CheckCircle, XCircle, AlertCircle, ExternalLink, ChevronLeft,
  ChevronRight, Cpu, UserCheck, Copy, RotateCcw, Plus, Globe,
  Zap, Loader2, FileText, Sparkles, ChevronDown, ChevronUp, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftStatus = "pending" | "generated" | "approved" | "scheduled" | "published" | "failed" | "rejected";

type PulseDraft = {
  id: string;
  sourceSignalId: string;
  assetId: string | null;
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
  signal?: {
    id: string;
    title: string;
    url: string | null;
    score: number;
    severity: string;
    aiSummary: string | null;
  } | null;
};

type PulseAsset = {
  id: string;
  signalId: string;
  title: string;
  executiveSummary: string;
  detailedSummary: string | null;
  technicalBreakdown: string | null;
  whyItMatters: string | null;
  keyPoints: string[] | null;
  sourceUrl: string | null;
  relatedLinks: string[] | null;
  tags: string[] | null;
  category: string | null;
  severity: number | null;
  aiProvider: string | null;
  aiModel: string | null;
  createdAt: string;
  signal: { id: string; title: string; url: string | null; score: number } | null;
  drafts?: PulseDraft[];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ["x", "facebook", "linkedin", "bluesky"] as const;
type Platform = typeof PLATFORMS[number];

const PLATFORM_CHAR_LIMIT: Record<Platform, number> = {
  x: 280,
  facebook: 1200,
  linkedin: 3000,
  bluesky: 300,
};

const PLATFORM_COLOR: Record<Platform, string> = {
  x:        "text-sky-400 border-sky-500/30 bg-sky-500/10",
  facebook: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  linkedin: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  bluesky:  "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
};

const PLATFORM_ACTIVE: Record<Platform, string> = {
  x:        "border-sky-500/50 bg-sky-500/15 text-sky-300",
  facebook: "border-blue-500/50 bg-blue-500/15 text-blue-300",
  linkedin: "border-indigo-500/50 bg-indigo-500/15 text-indigo-300",
  bluesky:  "border-cyan-500/50 bg-cyan-500/15 text-cyan-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "x") return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
  if (platform === "facebook") return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
  if (platform === "linkedin") return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
  if (platform === "bluesky") return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 01-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
    </svg>
  );
  return <Globe className={className} />;
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

// ─── Platform Draft Panel ─────────────────────────────────────────────────────

function PlatformDraftPanel({
  asset,
  platform,
  onMutate,
}: {
  asset: PulseAsset;
  platform: Platform;
  onMutate: () => void;
}) {
  const draft = asset.drafts?.find(d => d.platform === platform) ?? null;
  const charLimit = PLATFORM_CHAR_LIMIT[platform];

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/assets/${asset.id}/generate/${platform}`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) { const d = await res.json(); alert(d.message || "Generate failed"); return; }
      onMutate();
    } finally { setGenerating(false); }
  };

  const publish = async () => {
    if (!draft) return;
    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${draft.id}/publish`, {
        method: "POST", credentials: "include",
      });
      const d = await res.json();
      if (!res.ok) { alert(d.message || "Publish failed"); return; }
      onMutate();
    } finally { setPublishing(false); }
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText }),
        credentials: "include",
      });
      if (!res.ok) { const d = await res.json(); alert(d.message || "Save failed"); return; }
      setEditing(false);
      onMutate();
    } finally { setSaving(false); }
  };

  const deleteDraft = async () => {
    if (!draft) return;
    const res = await fetch(`${API_BASE}/api/admin/pulse/drafts/${draft.id}`, {
      method: "DELETE", credentials: "include",
    });
    if (!res.ok) { const d = await res.json(); alert(d.message || "Delete failed"); return; }
    setDeleteTarget(false);
    onMutate();
  };

  const copy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformKey = platform as Platform;
  const colorCls = PLATFORM_COLOR[platformKey];

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", colorCls)}>
          <PlatformIcon platform={platform} className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">No {platform} variant yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Generate to create a platform-optimised draft</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors", colorCls, "hover:opacity-80")}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate {platform.charAt(0).toUpperCase() + platform.slice(1)} Version
        </button>
      </div>
    );
  }

  const charCount = (editing ? editText : draft.text).length;
  const overLimit = charCount > charLimit;

  return (
    <>
      {deleteTarget && (
        <ConfirmModal
          title="Delete Draft"
          message="This will permanently delete this platform variant. Cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={deleteDraft}
          onCancel={() => setDeleteTarget(false)}
        />
      )}

      <div className="space-y-3">
        {/* Status + meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono uppercase border", STATUS_PILL[draft.status])}>
              {draft.status}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{charCount} / {charLimit}</span>
            {overLimit && <span className="text-xs text-red-400 font-semibold">Over limit</span>}
          </div>
          <div className="flex items-center gap-1">
            {draft.status !== "published" && (
              <button onClick={() => { setEditing(true); setEditText(draft.text); }}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                <Edit2 className="w-3 h-3" />
              </button>
            )}
            <button onClick={copy} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Copy">
              {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              onClick={generate}
              disabled={generating}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-amber-400 transition-colors"
              title="Regenerate"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            </button>
            <button onClick={() => setDeleteTarget(true)}
              className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors" title="Delete variant">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Content */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              rows={6}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className={cn("w-full bg-input border rounded-lg p-3 text-sm text-foreground focus:outline-none transition-colors resize-none",
                overLimit ? "border-red-500" : "border-border/40 focus:border-primary")}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs border border-border/40 text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving || overLimit}
                className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 border border-border/20 rounded-lg p-3">
            {draft.text}
          </p>
        )}

        {/* Publish */}
        {(draft.status === "generated" || draft.status === "approved" || draft.status === "published") && !editing && (
          <button
            onClick={publish}
            disabled={publishing}
            className={cn("w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-colors", colorCls, "hover:opacity-80")}
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {draft.status === "published" ? `Repost to ${platform.charAt(0).toUpperCase() + platform.slice(1)}` : `Publish to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`}
          </button>
        )}

        {draft.status === "published" && draft.publishedAt && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Published {new Date(draft.publishedAt).toLocaleString()}
          </p>
        )}
      </div>
    </>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ asset, onMutate }: { asset: PulseAsset; onMutate: () => void }) {
  const [activeTab, setActiveTab] = useState<Platform>("x");
  const [expanded, setExpanded] = useState(false);

  const publishedPlatforms = asset.drafts?.filter(d => d.status === "published").map(d => d.platform) ?? [];
  const draftedPlatforms = asset.drafts?.map(d => d.platform) ?? [];

  return (
    <div className="bg-card border border-border/40 rounded-xl overflow-hidden hover:border-border/70 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {asset.category && (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">{asset.category}</span>
              )}
              {asset.severity !== null && asset.severity !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">sev {asset.severity}</span>
              )}
              {asset.tags?.map(tag => (
                <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/40 border border-border/20 text-muted-foreground">{tag}</span>
              ))}
            </div>
            <h3 className="text-sm font-bold text-foreground leading-snug">{asset.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{asset.executiveSummary}</p>
          </div>

          {/* Platform badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex gap-1">
              {PLATFORMS.map(p => {
                const has = draftedPlatforms.includes(p);
                const pub = publishedPlatforms.includes(p);
                return (
                  <div key={p} title={`${p}: ${pub ? "published" : has ? "drafted" : "not generated"}`}
                    className={cn("w-5 h-5 rounded flex items-center justify-center border",
                      pub ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                      has ? PLATFORM_COLOR[p] :
                      "bg-muted/20 border-border/20 text-muted-foreground/30"
                    )}>
                    <PlatformIcon platform={p} className="w-2.5 h-2.5" />
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">{new Date(asset.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Expand toggle & Asset Delete */}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide" : "Show"} intelligence detail
          </button>

          <button
            onClick={async () => {
              if (confirm('Are you sure you want to delete this entire intelligence asset and all its drafts?')) {
                const res = await fetch(`${API_BASE}/api/admin/pulse/assets/${asset.id}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) onMutate();
              }
            }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Delete Asset
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-border/10 pt-3">
            {asset.detailedSummary && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Summary</p>
                <p className="text-xs text-foreground leading-relaxed">{asset.detailedSummary}</p>
              </div>
            )}
            {asset.technicalBreakdown && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Technical Breakdown</p>
                <p className="text-xs text-foreground leading-relaxed">{asset.technicalBreakdown}</p>
              </div>
            )}
            {asset.whyItMatters && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Why It Matters</p>
                <p className="text-xs text-foreground leading-relaxed">{asset.whyItMatters}</p>
              </div>
            )}
            {asset.keyPoints && asset.keyPoints.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Key Points</p>
                <ul className="space-y-1">
                  {asset.keyPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5">
                      <span className="text-primary shrink-0 mt-0.5">·</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {asset.sourceUrl && (
              <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
          </div>
        )}
      </div>

      {/* Platform workspace */}
      <div>
        {/* Platform tabs */}
        <div className="flex border-b border-border/20 px-2 gap-1 bg-muted/10">
          {PLATFORMS.map(p => {
            const has = draftedPlatforms.includes(p);
            const pub = publishedPlatforms.includes(p);
            return (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all",
                  activeTab === p
                    ? cn("border-current", PLATFORM_ACTIVE[p])
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <PlatformIcon platform={p} className="w-3 h-3" />
                {p.charAt(0).toUpperCase() + p.slice(1)}
                {pub && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                {has && !pub && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Active platform draft */}
        <div className="p-4">
          <PlatformDraftPanel
            key={`${asset.id}-${activeTab}`}
            asset={asset}
            platform={activeTab}
            onMutate={onMutate}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PulseAdmin() {
  const [activeTab, setActiveTab] = useState<"assets" | "logs" | "settings">("assets");
  const [assetsPage, setAssetsPage] = useState(1);
  const assetsLimit = 10;

  type AccountPlatform = "x" | "facebook" | "linkedin" | "bluesky";
  const [accountForm, setAccountForm] = useState({
    handle: "", apiKey: "", apiSecret: "",
    accessToken: "", accessTokenSecret: "",
    platform: "x" as AccountPlatform,
  });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isConnectingAccount, setIsConnectingAccount] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{id: string, success: boolean, message: string} | null>(null);

  const [settingsForm, setSettingsForm] = useState({ autoDraftEnabled: true, minSignalScore: 7, maxDraftsPerDay: 20 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // ─── Data ────────────────────────────────────────────────────────────────────

  const { data: assetsData, mutate: mutateAssets } = useSWR<{ assets: PulseAsset[]; total: number }>(
    `${API_BASE}/api/admin/pulse/assets?page=${assetsPage}&limit=${assetsLimit}`, fetcher
  );
  const { data: settingsData, mutate: mutateSettings } = useSWR<PulseSettings>(
    `${API_BASE}/api/admin/pulse/settings`, fetcher,
    { onSuccess: (d) => setSettingsForm({ autoDraftEnabled: d.autoDraftEnabled, minSignalScore: d.minSignalScore, maxDraftsPerDay: d.maxDraftsPerDay }) }
  );
  const { data: logsData, mutate: mutateLogs } = useSWR<PublishLog[]>(`${API_BASE}/api/admin/pulse/logs`, fetcher);
  const { data: accountsData, mutate: mutateAccounts } = useSWR<PulseAccount[]>(`${API_BASE}/api/admin/pulse/accounts?platform=all`, fetcher);
  const { data: limitsData, mutate: mutateLimits } = useSWR<Record<string, PlatformStatus>>(`${API_BASE}/api/admin/pulse/platform-limits`, fetcher);

  const isLoaded = settingsData && logsData;
  const totalAssetPages = assetsData ? Math.ceil(assetsData.total / assetsLimit) : 1;

  const today = new Date().toDateString();
  const dailyGen = logsData?.filter(l => l.action === "generated" && new Date(l.createdAt).toDateString() === today).length ?? 0;
  const dailyPub = logsData?.filter(l => l.action === "published" && new Date(l.createdAt).toDateString() === today).length ?? 0;
  const xLimits = limitsData?.x;

  const refreshAll = useCallback(() => {
    mutateAssets(); mutateSettings(); mutateLogs(); mutateAccounts(); mutateLimits();
  }, [mutateAssets, mutateSettings, mutateLogs, mutateAccounts, mutateLimits]);

  // ─── Asset mutation (refresh individual asset w/ its drafts) ─────────────────

  const refreshAsset = useCallback(async (assetId: string) => {
    // Fetch fresh asset+drafts and merge into assetsData
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/assets/${assetId}`, { credentials: "include" });
      if (!res.ok) return;
      const updated: PulseAsset = await res.json();
      mutateAssets(current => {
        if (!current) return current;
        return {
          ...current,
          assets: current.assets.map(a => a.id === assetId ? updated : a),
        };
      }, false);
      mutateLogs();
    } catch {}
  }, [mutateAssets, mutateLogs]);

  const handleActivateAccount = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${id}/activate`, { method: "PATCH", credentials: "include" });
    if (!res.ok) { alert("Activation failed"); return; }
    await mutateAccounts(); await mutateSettings();
  };

  const handleEditAccount = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${id}/credentials`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load credentials");
      const data = await res.json();
      setAccountForm({
        handle: data.handle,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        accessToken: data.accessToken,
        accessTokenSecret: data.accessTokenSecret,
        platform: data.platform as AccountPlatform,
      });
      setEditingAccountId(id);
      setConnectError(null);
      setConnectSuccess(false);
    } catch (e: any) { alert("Error loading account: " + e.message); }
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
      const needsSecret = accountForm.platform === "x";
      const payload = {
        ...accountForm,
        accessTokenSecret: needsSecret ? accountForm.accessTokenSecret : "",
      };

      let res: Response;
      if (editingAccountId) {
        res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${editingAccountId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), credentials: "include",
        });
      } else {
        res = await fetch(`${API_BASE}/api/admin/pulse/accounts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), credentials: "include",
        });
      }

      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      setConnectSuccess(true);
      await mutateSettings(); await mutateAccounts();
      setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: accountForm.platform });
      setEditingAccountId(null);
      setTimeout(() => setConnectSuccess(false), 3000);
    } catch (e: any) { setConnectError(e.message); }
    finally { setIsConnectingAccount(false); }
  };

  const handleTestConnection = async (id: string) => {
    setTestingAccountId(id);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pulse/accounts/${id}/test-connection`, { method: "POST", credentials: "include" });
      const data = await res.json();
      setTestResult({ id, success: data.success, message: data.message || "Test completed" });
    } catch (e: any) {
      setTestResult({ id, success: false, message: e.message || "Test failed" });
    } finally {
      setTestingAccountId(null);
      setTimeout(() => setTestResult(null), 5000);
    }
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto text-foreground">

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pulse</h1>
          <p className="text-xs text-muted-foreground mt-0.5">AI-native intelligence publishing</p>
        </div>
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

      {/* Tabs */}
      <div className="flex border-b border-border/20 mb-6 gap-1">
        {(["assets", "logs", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "assets" && <><FileText className="w-3.5 h-3.5" /> Intelligence</>}
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
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/*  INTELLIGENCE ASSETS                                               */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "assets" && (
            <div className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Assets Today", value: dailyGen, icon: Cpu, cls: "bg-primary/10 border-primary/20 text-primary" },
                  { label: "Published Today", value: dailyPub, icon: Send, cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
                  { label: "Total Assets", value: assetsData?.total ?? 0, icon: FileText, cls: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
                ].map(({ label, value, icon: Icon, cls }) => (
                  <div key={label} className="bg-card border border-border/40 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold">{value}</p>
                    </div>
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border", cls)}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Asset cards */}
              {!assetsData?.assets.length ? (
                <div className="border border-dashed border-border/40 rounded-xl py-16 flex flex-col items-center gap-3 text-muted-foreground">
                  <Sparkles className="w-8 h-8 opacity-30" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No intelligence assets yet</p>
                    <p className="text-xs mt-1">Assets are generated automatically from high-score signals.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {assetsData.assets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onMutate={() => refreshAsset(asset.id)}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalAssetPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setAssetsPage(p => Math.max(1, p - 1))} disabled={assetsPage === 1}
                    className="p-1.5 rounded-lg border border-border/40 hover:bg-accent disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">Page {assetsPage} of {totalAssetPages}</span>
                  <button onClick={() => setAssetsPage(p => Math.min(totalAssetPages, p + 1))} disabled={assetsPage === totalAssetPages}
                    className="p-1.5 rounded-lg border border-border/40 hover:bg-accent disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/*  AUDIT LOGS                                                         */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "logs" && (
            <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border/20">
                <h3 className="text-sm font-semibold">Audit Logs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Chronological history of all publishing and generation actions.</p>
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
                  {logsData!.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No logs found.</td></tr>
                  ) : logsData!.map((log) => (
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
                      <td className="px-4 py-3 text-xs font-mono">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <PlatformIcon platform={log.platform} className="w-3 h-3" />
                          {log.platform}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.actorEmail || "system"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/*  SETTINGS                                                           */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pipeline config */}
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-primary" /> Pipeline Configuration
                  </h3>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">Auto Asset Generation</p>
                        <p className="text-xs text-muted-foreground">Auto-generate intelligence assets for high-score signals.</p>
                      </div>
                      <input type="checkbox" checked={settingsForm.autoDraftEnabled}
                        onChange={e => setSettingsForm({ ...settingsForm, autoDraftEnabled: e.target.checked })}
                        className="w-4 h-4 rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Signal Score</label>
                      <input type="number" min="1" max="10" step="0.5" value={settingsForm.minSignalScore}
                        onChange={e => setSettingsForm({ ...settingsForm, minSignalScore: parseFloat(e.target.value) || 7 })}
                        className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Assets / Day</label>
                      <input type="number" min="1" max="200" value={settingsForm.maxDraftsPerDay}
                        onChange={e => setSettingsForm({ ...settingsForm, maxDraftsPerDay: parseInt(e.target.value, 10) || 20 })}
                        className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
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

                {/* Connect account */}
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      {editingAccountId ? "Edit Account" : "Connect Account"}
                    </h3>
                    {/* Platform selector */}
                    <div className="flex rounded-lg border border-border/40 overflow-hidden text-xs font-semibold">
                      {(["x", "facebook", "linkedin", "bluesky"] as AccountPlatform[]).map((p, i) => (
                        <button key={p} type="button"
                          onClick={() => setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: p })}
                          className={cn("px-2.5 py-1.5 transition-colors flex items-center gap-1", i > 0 && "border-l border-border/40",
                            accountForm.platform === p ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent")}>
                          <PlatformIcon platform={p} className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleConnectAccount} className="space-y-3">
                    {accountForm.platform === "x" && (
                      <>
                        {[
                          { label: "Handle", key: "handle", placeholder: "@account", type: "text" },
                          { label: "API Key", key: "apiKey", placeholder: "Consumer key", type: "password" },
                          { label: "API Secret", key: "apiSecret", placeholder: "Consumer secret", type: "password" },
                          { label: "Access Token", key: "accessToken", placeholder: "User token", type: "password" },
                          { label: "Access Token Secret", key: "accessTokenSecret", placeholder: "User secret", type: "password" },
                        ].map(({ label, key, placeholder, type }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                            <input type={type} placeholder={placeholder} value={(accountForm as any)[key]}
                              onChange={e => setAccountForm({ ...accountForm, [key]: e.target.value })}
                              required className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                          </div>
                        ))}
                      </>
                    )}

                    {accountForm.platform === "facebook" && (
                      <>
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
                          Requires Meta Developer App with <code className="text-primary">pages_manage_posts</code> scope.
                        </div>
                        {[
                          { label: "Page Handle", key: "handle", placeholder: "My Facebook Page", type: "text" },
                          { label: "Page ID", key: "apiKey", placeholder: "123456789012345", type: "text" },
                          { label: "App Secret (optional)", key: "apiSecret", placeholder: "Meta app secret", type: "password", optional: true },
                          { label: "Page Access Token", key: "accessToken", placeholder: "Long-lived Page Access Token", type: "password" },
                        ].map(({ label, key, placeholder, type, optional }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                            <input type={type} placeholder={placeholder} value={(accountForm as any)[key]}
                              onChange={e => setAccountForm({ ...accountForm, [key]: e.target.value })}
                              required={!optional} className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                          </div>
                        ))}
                      </>
                    )}

                    {accountForm.platform === "linkedin" && (
                      <>
                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
                          Enter your Client ID and Secret. To post to a <strong>Company Page</strong>, enter your numeric <strong>Page ID</strong> in the Account Handle field. (Leave blank or type your name for personal profile).
                        </div>
                        {[
                          { label: "Account Handle (Page ID)", key: "handle", placeholder: "e.g. 12345678 (for Company Page)", type: "text" },
                          { label: "Client ID", key: "apiKey", placeholder: "App Client ID", type: "text" },
                          { label: "Client Secret", key: "apiSecret", placeholder: "App Client Secret", type: "password" },
                        ].map(({ label, key, placeholder, type }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                            <input type={type} placeholder={placeholder} value={(accountForm as any)[key]}
                              onChange={e => setAccountForm({ ...accountForm, [key]: e.target.value })}
                              required className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                          </div>
                        ))}
                        <a 
                          href={`${API_BASE}/api/admin/pulse/oauth/linkedin`}
                          className="w-full py-2 mt-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Authorize LinkedIn (Click after saving!)
                        </a>
                      </>
                    )}

                    {accountForm.platform === "bluesky" && (
                      <>
                        <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
                          Uses AT Protocol. Create an App Password at bsky.app → Settings → App Passwords.
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">Handle</label>
                          <input
                            type="text"
                            placeholder="user.bsky.social"
                            value={accountForm.handle}
                            onChange={e => setAccountForm({ ...accountForm, handle: e.target.value, apiKey: e.target.value })}
                            required
                            className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                          />
                          <p className="text-[10px] text-muted-foreground/60">Used as both display handle and AT Protocol identifier</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">App Password</label>
                          <input
                            type="password"
                            placeholder="xxxx-xxxx-xxxx-xxxx"
                            value={accountForm.accessToken}
                            onChange={e => setAccountForm({ ...accountForm, accessToken: e.target.value })}
                            required
                            className="w-full bg-input border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                          />
                        </div>
                      </>
                    )}

                    {connectSuccess && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5" /> Connected!
                      </div>
                    )}
                    {connectError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <XCircle className="w-3.5 h-3.5" /> {connectError}
                      </div>
                    )}
                    {accountForm.platform !== "linkedin" && (
                      <div className="flex gap-2">
                        {editingAccountId && (
                          <button type="button"
                            onClick={() => { setEditingAccountId(null); setAccountForm({ handle: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", platform: accountForm.platform }); setConnectError(null); }}
                            className="px-4 py-2 border border-border/40 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors">
                            Cancel
                          </button>
                        )}
                        <button type="submit" disabled={isConnectingAccount}
                          className="flex-1 py-2 bg-muted border border-border/40 rounded-lg text-sm font-semibold hover:bg-accent transition-colors flex items-center justify-center gap-2">
                          {isConnectingAccount
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : editingAccountId ? `Update ${accountForm.platform}` : `Verify & Connect ${accountForm.platform}`}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              </div>

              {/* Connected accounts */}
              {accountsData && accountsData.length > 0 && (
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" /> Connected Accounts
                  </h3>
                  <div className="space-y-2">
                    {accountsData.map(acct => (
                      <div key={acct.id} className="space-y-2">
                        <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border",
                          acct.isActive ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/20")}>
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", PLATFORM_COLOR[acct.platform as Platform] || "bg-muted/20 border-border/20 text-muted-foreground")}>
                              <PlatformIcon platform={acct.platform} className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{acct.handle}</p>
                              <p className="text-xs text-muted-foreground">{acct.isActive ? "Active publisher" : `Added ${new Date(acct.createdAt).toLocaleDateString()}`}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleTestConnection(acct.id)}
                              disabled={testingAccountId === acct.id}
                              className={cn("p-1.5 rounded-lg hover:bg-accent transition-colors", testingAccountId === acct.id ? "text-primary opacity-50" : "text-muted-foreground hover:text-foreground")}
                              title="Test connection"
                            >
                              {testingAccountId === acct.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleEditAccount(acct.id)}
                              className={cn("p-1.5 rounded-lg hover:bg-accent transition-colors", editingAccountId === acct.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                              title="Edit credentials"
                            >
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
                        {testResult?.id === acct.id && (
                          <div className={cn("flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 border", testResult.success ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20")}>
                            {testResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform limits */}
              {limitsData && (
                <div className="bg-card border border-border/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-primary" /> Platform Rate Limits
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(limitsData).map(([platform, status]) => (
                      <div key={platform} className="bg-muted/20 border border-border/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <PlatformIcon platform={platform} className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-xs font-semibold capitalize">{platform}</p>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Daily</span>
                            <span className={status.dailyCount / status.limits.dailyLimit >= 0.8 ? "text-amber-400" : "text-muted-foreground"}>
                              {status.dailyCount} / {status.limits.dailyLimit}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Hourly</span>
                            <span className={status.hourlyCount / status.limits.hourlyLimit >= 0.8 ? "text-amber-400" : "text-muted-foreground"}>
                              {status.hourlyCount} / {status.limits.hourlyLimit}
                            </span>
                          </div>
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

    </div>
  );
}
