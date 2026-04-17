"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, MapPin, Loader2, ExternalLink, CheckCircle2, XCircle,
  Database, Search, Navigation, Trash2, BookmarkPlus, Globe, Play, Filter, X
} from "lucide-react";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => {
  if (r.status === 401) throw new Error("Unauthorized");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

interface NearbyCompany {
  osmId: string;
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  tags: string[];
  careerPageFound: boolean;
  careerUrl: string | null;
}

interface CrawledCompany {
  name: string;
  website: string | null;
  city: string | null;
  country: string;
  source: string;
  tags: string[];
}

interface SavedCompany {
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

const RADIUS_OPTIONS = [
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
  { label: "50 km", value: 50000 },
];

const CRAWL_SOURCES = [
  { key: "basis",     label: "BASIS",      description: "Bangladesh Assoc. of Software & IT Services" },
  { key: "bacco",     label: "BACCO",      description: "Bangladesh Assoc. of Call Center & Outsourcing" },
  { key: "bdjobs",    label: "bdjobs",     description: "Bangladesh job board — unique hiring companies" },
  { key: "ecab",      label: "e-CAB",      description: "e-Commerce Association of Bangladesh (official)" },
  { key: "github_bd", label: "GitHub Tech", description: "Community-curated tech & startup list (high quality)" },
] as const;

type CrawlSourceKey = typeof CRAWL_SOURCES[number]["key"];

export default function CompaniesAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState("radar");

  // Location state
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedLoc, setSelectedLoc] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [radius, setRadius] = useState(10000);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // OSM search results
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NearbyCompany[] | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Crawler state
  const [crawlSource, setCrawlSource] = useState<CrawlSourceKey>("basis");
  const [crawling, setCrawling] = useState(false);
  const [crawlResults, setCrawlResults] = useState<CrawledCompany[] | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlSavedNames, setCrawlSavedNames] = useState<Set<string>>(new Set());

  // Crawler filters (persisted in localStorage)
  const [crawlLocationFilter, setCrawlLocationFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("crawl_filter_location") ?? "";
  });
  const [crawlKeywordFilter, setCrawlKeywordFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("crawl_filter_keywords") ?? "";
  });

  function updateLocationFilter(v: string) {
    setCrawlLocationFilter(v);
    localStorage.setItem("crawl_filter_location", v);
  }
  function updateKeywordFilter(v: string) {
    setCrawlKeywordFilter(v);
    localStorage.setItem("crawl_filter_keywords", v);
  }

  function applyFilters(companies: CrawledCompany[]): CrawledCompany[] {
    let result = companies;
    const loc = crawlLocationFilter.trim().toLowerCase();
    if (loc) {
      result = result.filter((c) => {
        const haystack = [c.city, c.country, c.name].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(loc);
      });
    }
    const rawKeywords = crawlKeywordFilter.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (rawKeywords.length) {
      result = result.filter((c) => {
        const haystack = [c.name, ...c.tags].join(" ").toLowerCase();
        return rawKeywords.some((kw) => haystack.includes(kw));
      });
    }
    return result;
  }

  // Saved companies
  const [savedPage, setSavedPage] = useState(1);
  const { data: savedData, error: savedError } = useSWR<{ data: SavedCompany[]; total: number }>(
    `${API_BASE}/api/admin/companies/saved?page=${savedPage}&limit=20`,
    fetcher,
    { shouldRetryOnError: false }
  );

  useEffect(() => { if (savedError?.message === "Unauthorized") router.replace("/admin-login"); }, [savedError, router]);

  async function geocodeLocation() {
    if (!locationQuery.trim()) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (!data.length) { setGeoError("Location not found. Try a different city name."); return; }
      setSelectedLoc({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name });
    } catch {
      setGeoError("Geocoding failed. Check network.");
    } finally {
      setGeocoding(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setGeocoding(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` };
        setSelectedLoc(loc);
        setGeocoding(false);
        setSearching(true);
        setResults(null);
        fetch(`${API_BASE}/api/admin/companies/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=${radius}`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => setResults(data.data || []))
          .catch(() => setResults([]))
          .finally(() => setSearching(false));
      },
      () => { setGeoError("Location access denied or timed out."); setGeocoding(false); },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  async function searchCompanies() {
    if (!selectedLoc) return;
    setSearching(true);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/nearby?lat=${selectedLoc.lat}&lng=${selectedLoc.lng}&radius=${radius}`, { credentials: "include" });
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function saveCompany(company: NearbyCompany) {
    await fetch(`${API_BASE}/api/admin/companies/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...company, source: "osm" }),
    });
    setSavedIds((prev) => new Set([...prev, company.osmId]));
    mutate(`${API_BASE}/api/admin/companies/saved?page=${savedPage}&limit=20`);
  }

  async function saveCrawledCompany(company: CrawledCompany) {
    await fetch(`${API_BASE}/api/admin/companies/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(company),
    });
    setCrawlSavedNames((prev) => new Set([...prev, company.name]));
    mutate(`${API_BASE}/api/admin/companies/saved?page=${savedPage}&limit=20`);
  }

  const [savingAll, setSavingAll] = useState(false);

  async function saveAllFiltered() {
    if (!crawlResults) return;
    const toSave = applyFilters(crawlResults).filter((c) => !crawlSavedNames.has(c.name));
    if (!toSave.length) return;
    setSavingAll(true);
    try {
      await Promise.all(
        toSave.map((company) =>
          fetch(`${API_BASE}/api/admin/companies/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(company),
          })
        )
      );
      setCrawlSavedNames((prev) => new Set([...prev, ...toSave.map((c) => c.name)]));
      mutate(`${API_BASE}/api/admin/companies/saved?page=${savedPage}&limit=20`);
    } finally {
      setSavingAll(false);
    }
  }

  async function deleteCompany(id: string) {
    if (!confirm("Remove this company?")) return;
    await fetch(`${API_BASE}/api/admin/companies/${id}`, { method: "DELETE", credentials: "include" });
    mutate(`${API_BASE}/api/admin/companies/saved?page=${savedPage}&limit=20`);
  }

  async function runCrawl() {
    setCrawling(true);
    setCrawlResults(null);
    setCrawlError(null);
    setCrawlSavedNames(new Set());
    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source: crawlSource }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCrawlResults(data.data || []);
    } catch (e) {
      setCrawlError(e instanceof Error ? e.message : "Crawl failed");
      setCrawlResults([]);
    } finally {
      setCrawling(false);
    }
  }

  const { widths: savedColWidths, startResize: savedStartResize } = useResizableColumns([200, 100, 120, 100, 140, 60]);
  const { widths: crawlColWidths, startResize: crawlStartResize } = useResizableColumns([220, 100, 120, 140, 60]);
  const savedTotal = savedData?.total ?? 0;
  const savedPages = Math.ceil(savedTotal / 20);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Company Radar</span>
          <span className="text-xs text-muted-foreground font-mono border border-border/40 px-1.5 py-0.5 rounded">
            {savedTotal} saved
          </span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full justify-start rounded-none border-b border-border/40 bg-transparent h-9 px-6 gap-0">
          <TabsTrigger value="radar" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 text-xs font-semibold">
            Nearby Search
          </TabsTrigger>
          <TabsTrigger value="crawler" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 text-xs font-semibold">
            Directory Crawler
          </TabsTrigger>
          <TabsTrigger value="saved" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 text-xs font-semibold">
            Saved ({savedTotal})
          </TabsTrigger>
        </TabsList>

        {/* ── Nearby Search Tab ─────────────────────────────────────────────── */}
        <TabsContent value="radar" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="px-6 py-4 border-b border-border/40 bg-muted/10 shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search city (e.g. Berlin, London, Tokyo...)"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && geocodeLocation()}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5" onClick={geocodeLocation} disabled={geocoding || !locationQuery.trim()}>
                {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Find
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5" onClick={useMyLocation} disabled={geocoding}>
                <Navigation className="w-3 h-3" />
                My Location
              </Button>
            </div>

            {geoError && <p className="text-[10px] text-red-400">{geoError}</p>}

            {selectedLoc && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 min-w-0">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate" title={selectedLoc.label}>{selectedLoc.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setRadius(opt.value)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors shrink-0 ${radius === opt.value ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:border-border"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" className="h-7 px-3 text-xs gap-1.5 ml-auto shrink-0" onClick={searchCompanies} disabled={searching}>
                    {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Building2 className="w-3 h-3" />}
                    Search Companies
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {searching && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground/50">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-xs">Querying OpenStreetMap + checking career pages…</p>
              </div>
            )}
            {!searching && results === null && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/40">
                <Building2 className="w-8 h-8" />
                <p className="text-xs">Select a location and click Search Companies</p>
              </div>
            )}
            {!searching && results !== null && results.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/40 text-center px-6">
                <XCircle className="w-6 h-6" />
                <p className="text-xs">No IT/tech companies found in this area via OpenStreetMap.</p>
                <div className="space-y-1">
                  <p className="text-[10px]">Try a larger radius or a different city.</p>
                  <p className="text-[10px] text-primary/60">If you are in Bangladesh, try the <strong>Directory Crawler</strong> tab instead.</p>
                </div>
              </div>
            )}
            {!searching && results && results.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {results.map((company) => {
                  const isSaved = savedIds.has(company.osmId);
                  return (
                    <div key={company.osmId} className="border border-border/40 rounded-lg p-4 bg-card/30 flex flex-col gap-2.5 hover:bg-muted/10 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold leading-tight">{company.name}</p>
                          {(company.city || company.country) && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {[company.city, company.country].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                        {company.tags.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 shrink-0">{company.tags[0]}</Badge>
                        )}
                      </div>
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 truncate">
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          {company.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <div className="flex items-center gap-1.5">
                          {company.careerPageFound ? (
                            <a href={company.careerUrl!} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 flex items-center gap-1 hover:underline">
                              <CheckCircle2 className="w-3 h-3" />Careers found
                            </a>
                          ) : company.website ? (
                            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><XCircle className="w-3 h-3" />No careers page</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">No website</span>
                          )}
                        </div>
                        <Button size="sm" variant={isSaved ? "secondary" : "outline"} className="h-6 px-2 text-[10px] gap-1" disabled={isSaved} onClick={() => saveCompany(company)}>
                          {isSaved ? <><Database className="w-2.5 h-2.5" />Saved</> : <><BookmarkPlus className="w-2.5 h-2.5" />Save</>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Directory Crawler Tab ─────────────────────────────────────────── */}
        <TabsContent value="crawler" className="flex-1 flex flex-col overflow-hidden mt-0">
          {/* Controls */}
          <div className="px-6 py-3 border-b border-border/40 bg-muted/10 shrink-0 flex flex-col gap-2">
            {/* Row 1: source pills + run button */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Source</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CRAWL_SOURCES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { setCrawlSource(s.key); setCrawlResults(null); setCrawlError(null); }}
                    className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${crawlSource === s.key ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:border-border"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Button size="sm" className="h-7 px-3 text-xs gap-1.5 ml-auto" onClick={runCrawl} disabled={crawling}>
                {crawling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {crawling ? "Crawling…" : "Run Crawl"}
              </Button>
            </div>
            {/* Row 2: description / status */}
            <p className="text-[10px] text-muted-foreground/50">
              {crawling
                ? "Fetching pages sequentially with delay — this may take 30–60s…"
                : CRAWL_SOURCES.find(s => s.key === crawlSource)?.description}
            </p>
            {/* Row 3: filters */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/20">
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">Filter</span>
              </div>
              <div className="relative">
                <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground/40" />
                <input
                  type="text"
                  placeholder="Location (e.g. chittagong)"
                  value={crawlLocationFilter}
                  onChange={(e) => updateLocationFilter(e.target.value)}
                  className="h-6 pl-6 pr-6 text-[10px] bg-background border border-border/40 rounded px-2 focus:outline-none focus:border-primary/50 w-44"
                />
                {crawlLocationFilter && (
                  <button onClick={() => updateLocationFilter("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground/40" />
                <input
                  type="text"
                  placeholder="Tech keywords (e.g. software, fintech, SaaS)"
                  value={crawlKeywordFilter}
                  onChange={(e) => updateKeywordFilter(e.target.value)}
                  className="h-6 pl-6 pr-6 text-[10px] bg-background border border-border/40 rounded px-2 focus:outline-none focus:border-primary/50 w-56"
                />
                {crawlKeywordFilter && (
                  <button onClick={() => updateKeywordFilter("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {(crawlLocationFilter || crawlKeywordFilter) && (
                <button
                  onClick={() => { updateLocationFilter(""); updateKeywordFilter(""); }}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline shrink-0"
                >
                  clear all
                </button>
              )}
            </div>
          </div>

          {/* Results table */}
          <div className="flex-1 overflow-auto">
            {!crawling && crawlResults === null && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/40">
                <Globe className="w-8 h-8" />
                <p className="text-xs">Select a source and click Run Crawl</p>
              </div>
            )}
            {crawlError && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-red-400/60">
                <XCircle className="w-6 h-6" />
                <p className="text-xs">{crawlError}</p>
              </div>
            )}
            {crawling && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground/50">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-xs">Crawling {CRAWL_SOURCES.find(s => s.key === crawlSource)?.label}…</p>
              </div>
            )}
            {!crawling && crawlResults !== null && (
              <Table className="min-w-max table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
                    {(["Company", "Location", "Source", "Website", "Save"] as const).map((label, i) => (
                      <TableHead key={label} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground overflow-visible" style={{ width: crawlColWidths[i] }}>
                        <span className={i === 4 ? "flex justify-end" : ""}>{label}</span>
                        {i < 4 && <ResizeHandle onMouseDown={(e) => crawlStartResize(i, e)} />}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applyFilters(crawlResults).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16 text-muted-foreground/30 text-xs">
                        {crawlResults.length === 0
                          ? "No companies found. The site structure may have changed."
                          : "No companies match the current filters."}
                      </TableCell>
                    </TableRow>
                  )}
                  {applyFilters(crawlResults).map((company, idx) => {
                    const isSaved = crawlSavedNames.has(company.name);
                    return (
                      <TableRow key={`${company.name}-${idx}`} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <TableCell className="px-4 py-2 overflow-hidden">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs font-semibold truncate" title={company.name}>{company.name}</span>
                            {company.tags.length > 0 && (
                              <span className="text-[9px] text-muted-foreground/50 truncate" title={company.tags.join(", ")}>{company.tags.join(", ")}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2 overflow-hidden">
                          <span className="text-[10px] text-muted-foreground/70 truncate block" title={[company.city, company.country].filter(Boolean).join(", ")}>
                            {[company.city, company.country].filter(Boolean).join(", ") || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 uppercase">{company.source}</Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {company.website ? (
                            <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 truncate max-w-[130px]">
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              {company.website.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant={isSaved ? "secondary" : "outline"}
                            className="h-6 px-2 text-[10px] gap-1"
                            disabled={isSaved}
                            onClick={() => saveCrawledCompany(company)}
                          >
                            {isSaved ? <><Database className="w-2.5 h-2.5" />Saved</> : <><BookmarkPlus className="w-2.5 h-2.5" />Save</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Result count footer */}
          {!crawling && crawlResults !== null && crawlResults.length > 0 && (() => {
            const filtered = applyFilters(crawlResults);
            const unsaved = filtered.filter((c) => !crawlSavedNames.has(c.name));
            return (
              <div className="px-6 py-2 border-t border-border/40 shrink-0 flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground/60 flex-1">
                  {filtered.length !== crawlResults.length
                    ? `${filtered.length} of ${crawlResults.length} companies (filtered)`
                    : `${crawlResults.length} companies found`}
                </span>
                {unsaved.length > 0 && (
                  <Button size="sm" className="h-6 px-3 text-[10px] gap-1.5" onClick={saveAllFiltered} disabled={savingAll}>
                    {savingAll ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Database className="w-2.5 h-2.5" />}
                    {savingAll ? "Saving…" : `Save All (${unsaved.length})`}
                  </Button>
                )}
                {unsaved.length === 0 && (
                  <span className="text-[10px] text-emerald-400/70 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />All saved
                  </span>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* ── Saved Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="saved" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="flex-1 overflow-auto">
            <Table className="min-w-max table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/30">
                  {(["Company", "Source", "Location", "Careers", "Website", "Del"] as const).map((label, i) => (
                    <TableHead key={label} className="relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground overflow-visible" style={{ width: savedColWidths[i] }}>
                      <span className={i === 5 ? "flex justify-end" : ""}>{label}</span>
                      {i < 5 && <ResizeHandle onMouseDown={(e) => savedStartResize(i, e)} />}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!savedData && (
                  <TableRow><TableCell colSpan={6} className="text-center py-16"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground/30" /></TableCell></TableRow>
                )}
                {savedData?.data.map((company) => (
                  <TableRow key={company.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <TableCell className="px-4 py-2 overflow-hidden">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-semibold truncate" title={company.name}>{company.name}</span>
                        {company.tags.length > 0 && (
                          <span className="text-[9px] text-muted-foreground/50 truncate" title={company.tags.join(", ")}>{company.tags.join(", ")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 uppercase">{company.source || "osm"}</Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 overflow-hidden">
                      <span className="text-[10px] text-muted-foreground/70 truncate block" title={[company.city, company.country].filter(Boolean).join(", ")}>
                        {[company.city, company.country].filter(Boolean).join(", ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {company.careerPageFound ? (
                        <a href={company.careerUrl!} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 flex items-center gap-1 hover:underline">
                          <CheckCircle2 className="w-3 h-3" />Found
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><XCircle className="w-3 h-3" />None</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {company.website ? (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 truncate max-w-[130px]">
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          {company.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : <span className="text-[10px] text-muted-foreground/30">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteCompany(company.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {savedData?.data.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground/30 text-xs">No saved companies yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {savedPages > 1 && (
            <div className="flex items-center justify-between px-6 py-2 border-t border-border/40 shrink-0">
              <span className="text-[10px] text-muted-foreground/60">{savedTotal} companies</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={savedPage === 1} onClick={() => setSavedPage(p => p - 1)}>Prev</Button>
                <span className="text-[10px] text-muted-foreground">{savedPage}/{savedPages}</span>
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={savedPage >= savedPages} onClick={() => setSavedPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
