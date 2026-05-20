"use client";

import * as React from "react";
import useSWR from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, CheckCircle2, XCircle, RefreshCw, Search } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface Company {
  id: string;
  name: string;
  website: string | null;
  careerUrl: string | null;
  careerPageFound: boolean;
  city: string | null;
  country: string | null;
  source: string;
  tags: string[];
  createdAt: string;
}

interface CheckResult {
  id: string;
  name: string;
  status: string;
  found?: boolean;
  url?: string | null;
  message?: string;
  error?: string;
}

interface CompaniesHiringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompaniesHiringModal({ open, onOpenChange }: CompaniesHiringModalProps) {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [filterHiring, setFilterHiring] = React.useState<"all" | "hiring" | "not_hiring">("all");
  const [checkingIds, setCheckingIds] = React.useState<Set<string>>(new Set());
  const [checkingAll, setCheckingAll] = React.useState(false);
  const [checkResults, setCheckResults] = React.useState<Map<string, CheckResult>>(new Map());

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
  });

  const { data, mutate, isLoading } = useSWR<{ data: Company[]; total: number }>(
    `${API_BASE}/api/admin/companies/saved?${queryParams}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  function applySearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function checkCompanyHiring(id: string) {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/check-hiring/${id}`, {
        method: "POST",
        credentials: "include",
      });
      const result: CheckResult = await res.json();
      setCheckResults((prev) => new Map(prev).set(id, result));
      mutate();
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function checkAllHiring() {
    if (!data?.data) return;
    const toCheck = data.data.filter((c) => c.website && !c.careerPageFound && !checkResults.has(c.id));
    if (!toCheck.length) return;
    setCheckingAll(true);
    try {
      const CHUNK = 5; // small chunk to avoid rate limiting
      for (let i = 0; i < toCheck.length; i += CHUNK) {
        const chunk = toCheck.slice(i, i + CHUNK);
        const ids = chunk.map((c) => c.id);
        const res = await fetch(`${API_BASE}/api/admin/companies/check-hiring-bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids }),
        });
        const results: CheckResult[] = await res.json();
        setCheckResults((prev) => {
          const next = new Map(prev);
          for (const r of results) next.set(r.id, r);
          return next;
        });
        mutate();
      }
    } finally {
      setCheckingAll(false);
    }
  }

  const companies = data?.data ?? [];
  const filtered = companies.filter((c) => {
    if (filterHiring === "hiring") return c.careerPageFound;
    if (filterHiring === "not_hiring") return !c.careerPageFound && !!c.website;
    return true;
  });

  const hiringCount = companies.filter((c) => c.careerPageFound).length;
  const hasWebsiteCount = companies.filter((c) => c.website).length;
  const notHiringCount = hasWebsiteCount - hiringCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>Company Hiring Status</span>
              <Badge variant="outline" className="text-[10px] font-bold">
                {data?.total ?? 0} total saved
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground/50 mt-0.5">
              Check if your saved companies have career/hiring pages
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {hiringCount} hiring
              </span>
              <span className="text-[10px] text-muted-foreground/40">·</span>
              <span className="text-[10px] text-red-400/60 flex items-center gap-1">
                <XCircle className="w-2.5 h-2.5" />
                {notHiringCount} not found
              </span>
              <span className="text-[10px] text-muted-foreground/40">·</span>
              <span className="text-[10px] text-muted-foreground/40">{hasWebsiteCount} with website</span>
            </div>

            {/* Check all button */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] gap-1.5"
              onClick={checkAllHiring}
              disabled={checkingAll || notHiringCount === 0}
            >
              {checkingAll ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking all…
                </>
              ) : (
                <>
                  <Search className="w-3 h-3" />
                  Check All ({notHiringCount})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border/30 bg-muted/10 shrink-0">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search company name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className="h-7 w-full pl-7 pr-2 text-[11px] bg-background border border-border/40 rounded focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Hiring filter tabs */}
          <div className="flex items-center gap-1 border border-border/40 rounded overflow-hidden">
            <button
              onClick={() => setFilterHiring("all")}
              className={`h-6 px-3 text-[10px] font-semibold transition-colors ${
                filterHiring === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/30"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterHiring("hiring")}
              className={`h-6 px-3 text-[10px] font-semibold transition-colors border-l border-border/40 ${
                filterHiring === "hiring" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "text-muted-foreground hover:bg-muted/30"
              }`}
            >
              Hiring ✓
            </button>
            <button
              onClick={() => setFilterHiring("not_hiring")}
              className={`h-6 px-3 text-[10px] font-semibold transition-colors border-l border-border/40 ${
                filterHiring === "not_hiring" ? "bg-red-500/10 text-red-400 border-red-500/30" : "text-muted-foreground hover:bg-muted/30"
              }`}
            >
              Not Hiring ✗
            </button>
          </div>

          {/* Clear check results */}
          {checkResults.size > 0 && (
            <button
              onClick={() => setCheckResults(new Map())}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline"
            >
              Clear results
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground/40">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs">Loading companies…</p>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/40">
              <XCircle className="w-6 h-6" />
              <p className="text-xs">
                {companies.length === 0
                  ? "No companies saved yet. Go to Companies page to add some."
                  : "No companies match the current filter."}
              </p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <table className="w-full min-w-[600px]">
              <thead className="sticky top-0 z-10 bg-card border-b border-border/40">
                <tr>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2">Company</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">Source</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">Website</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">Hiring Status</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company) => {
                  const result = checkResults.get(company.id);
                  const isChecking = checkingIds.has(company.id);
                  const hasResult = !!result;

                  return (
                    <tr key={company.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-semibold truncate">{company.name}</span>
                          {(company.city || company.country) && (
                            <span className="text-[9px] text-muted-foreground/50">
                              {[company.city, company.country].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 uppercase">
                          {company.source}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 truncate max-w-[140px]"
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            {company.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {company.careerPageFound ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Found
                            {company.careerUrl && (
                              <a
                                href={company.careerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 hover:underline opacity-70"
                              >
                                → view
                              </a>
                            )}
                          </span>
                        ) : company.careerUrl ? (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            {company.careerUrl}
                          </span>
                        ) : hasResult && result?.status === "no_website" ? (
                          <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            No website
                          </span>
                        ) : hasResult && !result?.found ? (
                          <span className="text-[10px] text-red-400/70 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Not hiring
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] gap-1"
                          disabled={isChecking || !company.website || company.careerPageFound}
                          onClick={() => checkCompanyHiring(company.id)}
                        >
                          {isChecking ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Search className="w-3 h-3" />
                          )}
                          {isChecking ? "Checking…" : "Check"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 shrink-0 bg-card">
            <span className="text-[10px] text-muted-foreground/60">
              {data?.total ?? 0} companies · Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}