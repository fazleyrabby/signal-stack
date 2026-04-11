"use client";

import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import useSWR, { MutatorOptions, mutate } from "swr";
import {
  LayoutGrid,
  List,
  RefreshCw,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Bookmark,
  LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { toggleBookmark, API_BASE } from "@/lib/api";
import { SignalCard } from "@/components/signal-card";
import { FeedSkeleton } from "@/components/signal-skeleton";
import { SignalDetailModal } from "@/components/signal-detail-modal";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/api";

const SIGNALS_API_BASE = `${API_BASE}/api/signals`;
const BOOKMARKS_API_BASE = `${API_BASE}/api/bookmarks`;
const fetcher = (url: string) => fetch(url).then(res => res.json());

const PAGE_SIZE = 20;

interface SourceInfo {
  source: string;
  count: number;
}

interface SignalsResponse {
  data: Signal[];
  meta: Record<string, unknown>;
}

function ColumnControlBar({
  filter,
  setFilter,
  sourceFilter,
  setSourceFilter,
  sortBy,
  setSortBy,
  sources,
  sourceBtnRef,
  sortBtnRef,
  showSourceDropdown,
  setShowSourceDropdown,
  showSortDropdown,
  setShowSortDropdown,
  showBookmarks,
  setShowBookmarks,
}: {
  filter: string;
  setFilter: (f: string) => void;
  sourceFilter: string;
  setSourceFilter: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  sources: SourceInfo[];
  sourceBtnRef: React.RefObject<HTMLButtonElement | null>;
  sortBtnRef: React.RefObject<HTMLButtonElement | null>;
  showSourceDropdown: boolean;
  setShowSourceDropdown: (v: boolean) => void;
  showSortDropdown: boolean;
  setShowSortDropdown: (v: boolean) => void;
  showBookmarks: boolean;
  setShowBookmarks: (v: boolean) => void;
}) {
  const sortOptions = [
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
    { id: 'score', label: 'Highest Score' },
    { id: 'published_at', label: 'Published' },
  ];

  return (
    <>
      <div className="flex items-center gap-1.5 p-1.5 bg-card/30 border border-border/5 rounded-lg">
        <div className="flex items-center gap-0.5">
          {['all', 'high', 'medium', 'low'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-6 px-2 text-[11px] font-black uppercase tracking-wider rounded-md transition-all",
                filter === f ? "bg-primary text-primary-foreground shadow-md" : "opacity-50 hover:opacity-100 hover:bg-accent/30"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border/20 mx-1" />

        <button
          ref={sourceBtnRef}
          onClick={() => { setShowSourceDropdown(!showSourceDropdown); setShowSortDropdown(false); }}
          className={cn(
            "flex items-center gap-1 h-6 px-2 bg-accent/20 border border-border/10 rounded-md hover:bg-accent/40 transition-all text-[9px] font-bold uppercase tracking-wider",
            sourceFilter && "bg-primary/20 border-primary/20 text-primary"
          )}
        >
          <Filter className="w-3 h-3" />
          <span className="max-w-[60px] truncate">{sourceFilter || 'Source'}</span>
        </button>

        <button
          ref={sortBtnRef}
          onClick={() => { setShowSortDropdown(!showSortDropdown); setShowSourceDropdown(false); }}
          className="flex items-center gap-1 h-6 px-2 bg-accent/20 border border-border/10 rounded-md hover:bg-accent/40 transition-all text-[11px] font-bold uppercase tracking-wider"
        >
          <ArrowUpDown className="w-3 h-3" />
          <span className="max-w-[50px] truncate">{sortOptions.find(s => s.id === sortBy)?.label || 'Sort'}</span>
        </button>

        <button
          onClick={() => setShowBookmarks(!showBookmarks)}
          className={cn(
            "flex items-center gap-1 h-6 px-2 bg-accent/20 border border-border/10 rounded-md hover:bg-accent/40 transition-all text-[11px] font-bold uppercase tracking-wider",
            showBookmarks && "bg-primary text-primary-foreground"
          )}
        >
          <Bookmark className="w-3 h-3" />
          <span className="max-w-[50px] truncate">Bookmarks</span>
        </button>
      </div>

      {showSourceDropdown && (
        <SourceDropdown
          sources={sources}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          sourceBtnRef={sourceBtnRef}
          onClose={() => setShowSourceDropdown(false)}
        />
      )}

      {showSortDropdown && (
        <SortDropdown
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortBtnRef={sortBtnRef}
          onClose={() => setShowSortDropdown(false)}
        />
      )}

      {(showSourceDropdown || showSortDropdown) && (
        <div
          className="fixed inset-0 z-[99]"
          onClick={() => { setShowSourceDropdown(false); setShowSortDropdown(false); }}
        />
      )}
    </>
  );
}

function SourceDropdown({
  sources,
  sourceFilter,
  setSourceFilter,
  sourceBtnRef,
  onClose,
}: {
  sources: SourceInfo[];
  sourceFilter: string;
  setSourceFilter: (s: string) => void;
  sourceBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (sourceBtnRef.current) {
      const rect = sourceBtnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [sourceBtnRef]);

  return (
    <div
      className="fixed bg-popover border border-border/40 rounded-lg shadow-xl z-[100] w-48 max-h-60 overflow-y-auto overscroll-contain"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        onClick={() => { setSourceFilter(''); onClose(); }}
        className={cn(
          "w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/40 transition-colors",
          !sourceFilter ? "text-primary bg-accent/20" : "text-muted-foreground"
        )}
      >
        All Sources
      </button>
      {sources.map((s) => (
        <button
          key={s.source}
          onClick={() => { setSourceFilter(s.source); onClose(); }}
          className={cn(
            "w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/40 transition-colors flex justify-between items-center",
            sourceFilter === s.source ? "text-primary bg-accent/20" : "text-muted-foreground"
          )}
        >
          <span className="truncate">{s.source}</span>
          <span className="text-[8px] text-muted-foreground/50 ml-2">{s.count}</span>
        </button>
      ))}
    </div>
  );
}

function SortDropdown({
  sortBy,
  setSortBy,
  sortBtnRef,
  onClose,
}: {
  sortBy: string;
  setSortBy: (s: string) => void;
  sortBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (sortBtnRef.current) {
      const rect = sortBtnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [sortBtnRef]);

  const sortOptions = [
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
    { id: 'score', label: 'Highest Score' },
    { id: 'published_at', label: 'Published' },
  ];

  return (
    <div
      className="fixed bg-popover border border-border/40 rounded-lg shadow-xl z-[100] w-40"
      style={{ top: pos.top, left: pos.left }}
    >
      {sortOptions.map((s) => (
        <button
          key={s.id}
          onClick={() => { setSortBy(s.id); onClose(); }}
          className={cn(
            "w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/40 transition-colors",
            sortBy === s.id ? "text-primary bg-accent/20" : "text-muted-foreground"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function Column({
  title,
  icon: Icon,
  categoryId,
  layoutMode,
  searchQuery,
  isFullWidth,
}: {
  title: string;
  icon: LucideIcon;
  categoryId: string;
  layoutMode: 'grid' | 'list';
  searchQuery: string;
  isFullWidth: boolean;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [sourceFilter, setSourceFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);

  // Debounced search — 300ms delay before passing to API
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sourceBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  // Per-signal bookmark loading state
  const pendingBookmarks = useRef(new Set<string>());
  const [bookmarkingIds, setBookmarkingIds] = useState(new Set<string>());

  const sortParam = sortBy === 'published_at' ? 'published_at' : sortBy === 'score' ? 'score' : 'created_at';
  const orderParam = sortBy === 'oldest' ? 'asc' : 'desc';

  const { data: response, isLoading, isValidating } = useSWR<SignalsResponse>(
    `${SIGNALS_API_BASE}?limit=${PAGE_SIZE * page}&categoryId=${categoryId}&sort=${sortParam}&order=${orderParam}${sourceFilter ? `&source=${encodeURIComponent(sourceFilter)}` : ''}${countryFilter ? `&countryCode=${encodeURIComponent(countryFilter)}` : ''}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const { data: bookmarkedIds = [] } = useSWR<string[]>(
    `${BOOKMARKS_API_BASE}`,
    (url) => fetch(url).then(res => res.json()),
    { refreshInterval: 30000 }
  );

  const bookmarkedIdsSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  const { data: sourcesData } = useSWR<SourceInfo[]>(
    `${SIGNALS_API_BASE}/sources?categoryId=${categoryId}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const signals = response?.data ?? [];
  const hasMore = signals.length === PAGE_SIZE * page;
  const sources = sourcesData ?? [];

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setShowScrollIndicator(scrollRef.current.scrollTop < 10);
    }
  }, []);

  // Severity filter — score is the single source of truth
  const filtered = useMemo(() => {
    if (filter === 'all') return signals;
    return signals.filter(s => {
      if (filter === 'high') return s.score >= 8;
      if (filter === 'medium') return s.score >= 5 && s.score < 8;
      return s.score < 5;
    });
  }, [signals, filter]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch, sortBy, sourceFilter]);

  // Bookmark handler with loading state + toasts
  const handleToggleBookmark = useCallback(async (signalId: string) => {
    if (pendingBookmarks.current.has(signalId)) return;
    pendingBookmarks.current.add(signalId);
    setBookmarkingIds(new Set(pendingBookmarks.current));
    try {
      const result = await toggleBookmark(signalId);
      await mutate(
        `${BOOKMARKS_API_BASE}`,
        (currentBookmarks: string[] = []) =>
          result.bookmarked
            ? [...currentBookmarks, signalId]
            : currentBookmarks.filter(id => id !== signalId),
        false
      );
      toast.success(result.bookmarked ? "Signal saved" : "Bookmark removed");
    } catch {
      toast.error("Failed to save");
    } finally {
      pendingBookmarks.current.delete(signalId);
      setBookmarkingIds(new Set(pendingBookmarks.current));
    }
  }, []);

  // Infinite scroll — fire when sentinel enters viewport
  useEffect(() => {
    if (!hasMore || isValidating) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: '120px' }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, isValidating]);

  const hasSignals = filtered.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2 px-1 shrink-0">
        <div className="p-1 rounded-md bg-primary/10 text-primary">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">
          {title}
        </h2>
        <span className="text-[11px] font-mono text-muted-foreground/30 ml-auto tabular-nums bg-accent/20 px-2 py-0.5 rounded-full">
          {isLoading ? '--' : filtered.length} / {isLoading ? '--' : signals.length}
        </span>
      </div>

      <ColumnControlBar
        filter={filter}
        setFilter={setFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sources={sources}
        sourceBtnRef={sourceBtnRef}
        sortBtnRef={sortBtnRef}
        showSourceDropdown={showSourceDropdown}
        setShowSourceDropdown={setShowSourceDropdown}
        showSortDropdown={showSortDropdown}
        setShowSortDropdown={setShowSortDropdown}
        showBookmarks={showBookmarks}
        setShowBookmarks={setShowBookmarks}
      />

      <div className="flex-1 bg-card/25 border border-border/10 rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-500 flex flex-col mt-2">
        {/* Skeleton loading state */}
        {isLoading && signals.length === 0 && (
          <div className="p-3">
            <FeedSkeleton layoutMode={layoutMode} />
          </div>
        )}

        {!isLoading && !hasSignals && (
          <div className="flex flex-col items-center justify-center py-16 text-center opacity-30">
            <RefreshCw className="w-6 h-6 mb-2 text-muted-foreground" />
            <span className="text-[9px] font-black tracking-widest uppercase">Awaiting local uplink...</span>
          </div>
        )}

        {hasSignals && (
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative">
            {showScrollIndicator && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-bounce pointer-events-none">
                <ChevronDown className="w-4 h-4 text-primary/60" />
              </div>
            )}
            <div className={cn(
              "p-3 pr-4",
              layoutMode === 'grid'
                ? isFullWidth
                  ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 3xl:columns-6 gap-4"
                  : "columns-1 sm:columns-2 xl:columns-3 gap-4"
                : "flex flex-col space-y-3"
            )}>
              {showBookmarks
                ? signals
                    .filter(signal => bookmarkedIdsSet.has(signal.id))
                    .map((signal) => (
                      <div key={signal.id} className="break-inside-avoid mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                           onClick={() => setSelectedSignal(signal)}>
                        <SignalCard
                          signal={signal}
                          isCompact={layoutMode === 'list'}
                          isBookmarked={true}
                          isBookmarking={bookmarkingIds.has(signal.id)}
                          onToggleBookmark={handleToggleBookmark}
                        />
                      </div>
                    ))
                : filtered.map((signal) => (
                    <div key={signal.id} className="break-inside-avoid mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                         onClick={() => setSelectedSignal(signal)}>
                      <SignalCard
                        signal={signal}
                        isCompact={layoutMode === 'list'}
                        isBookmarked={bookmarkedIdsSet.has(signal.id)}
                        isBookmarking={bookmarkingIds.has(signal.id)}
                        onToggleBookmark={handleToggleBookmark}
                      />
                    </div>
                  ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <>
                <div ref={sentinelRef} className="h-1" />
                {isValidating && (
                  <div className="flex justify-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary/40" />
                  </div>
                )}
              </>
            )}

            {!hasMore && signals.length > 0 && (
              <div className="text-center py-3 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest">
                All signals loaded
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signal Detail Modal */}
      <SignalDetailModal
        signal={selectedSignal}
        onOpenChange={setSelectedSignal}
        isBookmarked={selectedSignal ? bookmarkedIdsSet.has(selectedSignal.id) : false}
        isBookmarking={selectedSignal ? bookmarkingIds.has(selectedSignal.id) : false}
        onToggleBookmark={handleToggleBookmark}
      />
    </div>
  );
}
