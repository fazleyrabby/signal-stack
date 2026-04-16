export interface RawSignal {
  source: string;
  categoryId: string;
  title: string;
  content: string | null;
  url: string;
  publishedAt: Date | null;
  countryCode?: string;
}

export class RawJob {
  source: string;
  sourceId?: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  jobType: string | null;
  salaryRange: string | null;
  experienceLevel: string | null;
  description: string | null;
  url: string;
  publishedAt: Date | null;
  tags: string[];
}

export class JobPreferences {
  keywords: string[];
  locations: string[];
  remote: boolean | null;
  excludeKeywords: string[];
  experienceLevels: string[];
}

export interface ScoredSignal extends RawSignal {
  score: number;
  severity: 'low' | 'medium' | 'high';
  hash: string;
  summary?: string;
  aiCategory?: string;
  aiProvider?: string;
  countryCode?: string;
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
  geopolitics?: number;
  technology?: number;
  aiProcessed?: number;
  aiFailed?: number;
  highPending?: number;
  translated?: number;
}

export interface HealthStatus {
  status: string;
  uptime: number;
  lastFetch: string | null;
  feedsActive: number;
}
