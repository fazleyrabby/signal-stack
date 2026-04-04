export interface RawSignal {
  source: string;
  categoryId: string;
  title: string;
  content: string | null;
  url: string;
  publishedAt: Date | null;
}

export interface ScoredSignal extends RawSignal {
  score: number;
  severity: 'low' | 'medium' | 'high';
  hash: string;
  summary?: string;
  aiCategory?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
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

export interface HealthStatus {
  status: string;
  uptime: number;
  lastFetch: string | null;
  feedsActive: number;
}
