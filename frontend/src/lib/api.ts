export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface Signal {
  id: string;
  source: string;
  categoryId: string;
  title: string;
  content: string | null;
  url: string;
  score: number;
  severity: "low" | "medium" | "high";
  publishedAt: string | null;
  createdAt: string;
  summary?: string;
  aiCategory?: string;
  aiSummary: string | null;
  aiProvider: string | null;
  aiProcessed: boolean;
  aiFailed: boolean;
}

export interface SignalsResponse {
  data: Signal[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SignalStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  last24h: number;
  topSource: string;
  geopolitics: number;
  technology: number;
  aiProcessed: number;
  aiFailed: number;
  highPending: number;
}

export interface VisitorStats {
  total: number;
  today: number;
  realtime: number;
}

export async function fetchSignals(
  params?: Record<string, string>
): Promise<SignalsResponse> {
  const searchParams = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}/api/signals?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch signals");
  return res.json();
}

export async function fetchStats(): Promise<SignalStats> {
  const res = await fetch(`${API_BASE}/api/signals/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function triggerBackup() {
  const res = await fetch(`${API_BASE}/api/admin/backup`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error("Failed to trigger backup");
  return res.json();
}

export async function fetchVisitorStats(): Promise<VisitorStats> {
  const res = await fetch(`${API_BASE}/api/visitors/stats`);
  if (!res.ok) throw new Error("Failed to fetch visitors");
  return res.json();
}

export async function trackVisit() {
  const res = await fetch(`${API_BASE}/api/visitors`, { method: 'POST' });
  return res.json();
}

export async function fetchBookmarks(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/bookmarks`);
  if (!res.ok) throw new Error("Failed to fetch bookmarks");
  return res.json();
}

export async function toggleBookmark(signalId: string): Promise<{ bookmarked: boolean }> {
  const res = await fetch(`${API_BASE}/api/bookmarks/${signalId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error("Failed to toggle bookmark");
  return res.json();
}

export async function fetchBookmarkedSignals(params?: Record<string, string>): Promise<{ data: Signal[]; meta: Record<string, unknown> }> {
  const searchParams = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}/api/bookmarks/signals?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch bookmarked signals");
  return res.json();
}
