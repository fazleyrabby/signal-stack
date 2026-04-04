const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Failed to fetch health");
  return res.json();
}
