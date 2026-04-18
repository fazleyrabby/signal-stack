"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface CrawledCompany {
  name: string;
  website: string | null;
  city: string | null;
  country: string;
  source: string;
  tags: string[];
}

interface CrawlState {
  crawling: boolean;
  results: CrawledCompany[] | null;
  error: string | null;
  source: string | null;
  savedNames: Set<string>;
}

interface CrawlContextValue extends CrawlState {
  runCrawl: (source: string) => Promise<void>;
  setSavedNames: (fn: (prev: Set<string>) => Set<string>) => void;
  clearResults: () => void;
}

const CrawlContext = createContext<CrawlContextValue | null>(null);

export function CrawlProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrawlState>({
    crawling: false,
    results: null,
    error: null,
    source: null,
    savedNames: new Set(),
  });

  const runCrawl = useCallback(async (source: string) => {
    setState((s) => ({ ...s, crawling: true, results: null, error: null, source, savedNames: new Set() }));

    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const results: CrawledCompany[] = data.data || [];
      setState((s) => ({ ...s, crawling: false, results }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Crawl failed";
      setState((s) => ({ ...s, crawling: false, results: [], error: msg }));
    }
  }, []);

  const setSavedNames = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    setState((s) => ({ ...s, savedNames: fn(s.savedNames) }));
  }, []);

  const clearResults = useCallback(() => {
    setState((s) => ({ ...s, results: null, error: null, source: null, savedNames: new Set() }));
  }, []);

  return (
    <CrawlContext.Provider value={{ ...state, runCrawl, setSavedNames, clearResults }}>
      {children}
    </CrawlContext.Provider>
  );
}

export function useCrawl() {
  const ctx = useContext(CrawlContext);
  if (!ctx) throw new Error("useCrawl must be used inside CrawlProvider");
  return ctx;
}
