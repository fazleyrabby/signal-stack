"use client";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  Bookmark,
  Loader2,
  ArrowDown,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { SignalCard } from "./SignalCard";
import { SignalDetailModal } from "./SignalDetailModal";
import { signalPriority, storyIdentity, type Topic } from "@/lib/stories";
import type { Signal, SignalsResponse } from "@/lib/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load stories");
  return res.json();
}
interface Props {
  locale: string;
  topic?: Topic;
  saved: boolean;
  country: string;
  search: string;
  initialData?: SignalsResponse | null;
}
const filterCache = new Map<
  string,
  { priority: string; source: string; sort: string }
>();
const streamCache = new Map<
  string,
  {
    accepted: SignalsResponse | null;
    extra: Signal[];
    page: number;
    hasMore: boolean;
  }
>();
export function ReaderFeed(props: Props) {
  const t = useTranslations("Reader");
  const filterKey = `${props.locale}:${props.topic || ""}:${props.saved}:${props.country}:${props.search}`;
  const [priority, setPriority] = useState(
    () => filterCache.get(filterKey)?.priority || "",
  );
  const [source, setSource] = useState(
    () => filterCache.get(filterKey)?.source || "",
  );
  const [sort, setSort] = useState(
    () => filterCache.get(filterKey)?.sort || "newest",
  );
  useEffect(() => {
    filterCache.set(filterKey, { priority, source, sort });
    if (filterCache.size > 20)
      filterCache.delete(filterCache.keys().next().value!);
  }, [filterKey, priority, source, sort]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: sources = [] } = useSWR<{ source: string; count: number }[]>(
    `/api/signals/sources${props.topic ? `?categoryId=${props.topic}` : ""}`,
    fetchJson,
  );
  return (
    <>
      <div className="reader-filter-toolbar">
        <button
          className="reader-secondary-button reader-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="story-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal className="size-4" />
          {t("filters")}
        </button>
      </div>
      <div
        id="story-filters"
        className={`reader-filter-bar ${filtersOpen ? "reader-filters-open" : ""}`}
        aria-label={t("filters")}
      >
        <label>
          <span className="sr-only">{t("scoreLabel")}</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">{t("allPriorities")}</option>
            {(["high", "medium", "low"] as const).map((id) => (
              <option key={id} value={id}>
                {t(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("allSources")}</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{t("allSources")}</option>
            {sources.map((s) => (
              <option key={s.source} value={s.source}>
                {s.source}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:ml-auto">
          <span className="sr-only">{t("newest")}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">{t("newest")}</option>
            <option value="oldest">{t("oldest")}</option>
            <option value="score">{t("priority")}</option>
          </select>
        </label>
        {(priority || source || sort !== "newest") && (
          <button
            className="reader-text-link"
            onClick={() => {
              setPriority("");
              setSource("");
              setSort("newest");
            }}
          >
            {t("reset")}
          </button>
        )}
      </div>
      <StoryStream
        key={`${priority}:${source}:${sort}`}
        {...props}
        priority={priority}
        source={source}
        sort={sort}
        initialData={
          !priority && !source && sort === "newest" ? props.initialData : null
        }
      />
    </>
  );
}
function StoryStream({
  locale,
  topic,
  saved,
  country,
  search,
  initialData,
  priority,
  source,
  sort,
}: Props & { priority: string; source: string; sort: string }) {
  const t = useTranslations("Reader");
  const params = new URLSearchParams({
    limit: "30",
    lang: locale,
    sort: sort === "score" ? "score" : "published_at",
    order: sort === "oldest" ? "asc" : "desc",
  });
  if (topic) params.set("categoryId", topic);
  if (country) params.set("countryCode", country);
  if (search) params.set("search", search);
  if (priority) params.set("severity", priority);
  if (source) params.set("source", source);
  const url = saved
    ? `/api/bookmarks/signals?limit=30&offset=0&lang=${locale}`
    : `/api/signals?${params}`;
  const {
    data: latest,
    error,
    mutate,
  } = useSWR<SignalsResponse>(url, fetchJson, {
    fallbackData: initialData || undefined,
    refreshInterval: saved ? 0 : 60000,
    revalidateOnFocus: false,
  });
  const [accepted, setAccepted] = useState(
    () => streamCache.get(url)?.accepted || initialData || null,
  );
  const [extra, setExtra] = useState<Signal[]>(
    () => streamCache.get(url)?.extra || [],
  );
  const [page, setPage] = useState(() => streamCache.get(url)?.page || 1);
  const [hasMore, setHasMore] = useState(
    () =>
      streamCache.get(url)?.hasMore ??
      (!!initialData && initialData.meta.total > initialData.data.length),
  );
  useEffect(() => {
    streamCache.set(url, { accepted, extra, page, hasMore });
    if (streamCache.size > 20)
      streamCache.delete(streamCache.keys().next().value!);
  }, [url, accepted, extra, page, hasMore]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [selected, setSelected] = useState<Signal | null>(null);
  const pending = useRef(new Set<string>());
  const alive = useRef(true);
  const [pendingIds, setPendingIds] = useState(new Set<string>());
  const { data: bookmarks = [], mutate: updateBookmarks } = useSWR<string[]>(
    "/api/bookmarks",
    fetchJson,
    { revalidateOnFocus: true },
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (latest && !accepted) {
      setAccepted(latest);
      setHasMore(
        saved
          ? latest.data.length === 30
          : latest.meta.total > latest.data.length,
      );
    }
  }, [latest, accepted, saved]);
  // Keep ordering stable, but let translations and corrected fields refresh.
  const refreshedById = new Map(latest?.data.map((story) => [story.id, story]));
  const newStories =
    !!accepted &&
    !!latest &&
    latest.data.some((s) => !accepted.data.some((old) => old.id === s.id));
  const all = [...(accepted?.data || []), ...extra]
    .map((story) => refreshedById.get(story.id) || story)
    .filter(
      (s, i, list) =>
        list.findIndex(
          (other) =>
            other.id === s.id ||
            storyIdentity(other.url) === storyIdentity(s.url),
        ) === i,
    );
  const stories = saved
    ? all
        .filter(
          (s) =>
            bookmarks.includes(s.id) &&
            (!topic || s.categoryId === topic) &&
            (!priority || signalPriority(s.score) === priority) &&
            (!source || s.source === source) &&
            (!search ||
              `${s.title} ${s.aiSummary || ""}`
                .toLowerCase()
                .includes(search.toLowerCase())),
        )
        .sort((a, b) =>
          sort === "score"
            ? b.score - a.score
            : sort === "oldest"
              ? (a.publishedAt || "").localeCompare(b.publishedAt || "")
              : (b.publishedAt || "").localeCompare(a.publishedAt || ""),
        )
    : all;
  async function toggle(id: string) {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    setPendingIds(new Set(pending.current));
    try {
      const res = await fetch(`/api/bookmarks/${encodeURIComponent(id)}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Save failed");
      const result: { bookmarked: boolean } = await res.json();
      await updateBookmarks(
        (current) =>
          result.bookmarked
            ? [...(current || []).filter((x) => x !== id), id]
            : (current || []).filter((x) => x !== id),
        { revalidate: false },
      );
      toast.success(t(result.bookmarked ? "savedToast" : "removedToast"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      pending.current.delete(id);
      if (alive.current) setPendingIds(new Set(pending.current));
    }
  }
  async function loadMore() {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = new URLSearchParams(params);
      next.set("page", String(page + 1));
      const data = await fetchJson<SignalsResponse>(
        saved
          ? `/api/bookmarks/signals?limit=30&offset=${page * 30}&lang=${locale}`
          : `/api/signals?${next}`,
      );
      if (!alive.current) return;
      setExtra((current) => [...current, ...data.data]);
      setPage(page + 1);
      setHasMore(
        saved ? data.data.length === 30 : (page + 1) * 30 < data.meta.total,
      );
    } catch {
      if (alive.current) setMoreError(true);
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  }
  const briefing =
    !saved &&
    !search &&
    !priority &&
    !source &&
    !country &&
    sort === "newest" &&
    stories.length >= 3;
  const renderCard = (signal: Signal) => (
    <SignalCard
      key={signal.id}
      signal={signal}
      isCompact={false}
      onPreview={setSelected}
      isBookmarked={bookmarks.includes(signal.id)}
      isBookmarking={pendingIds.has(signal.id)}
      onToggleBookmark={toggle}
    />
  );
  return (
    <>
      {newStories && !saved && (
        <div className="reader-update" role="status">
          <span>{t("newStories")}</span>
          <button
            onClick={() => {
              setAccepted(latest!);
              setExtra([]);
              setPage(1);
              setHasMore(latest!.meta.total > latest!.data.length);
            }}
          >
            {t("refresh")}
            <RefreshCw className="size-4" />
          </button>
        </div>
      )}
      {!accepted && !error && (
        <div className="reader-loading" role="status">
          <Loader2 className="size-5 animate-spin" />
          {t("loading")}
        </div>
      )}
      {error && (
        <div className="reader-state" role="alert">
          <p>{t("feedError")}</p>
          <button
            className="reader-secondary-button"
            onClick={() => void mutate()}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {accepted && !stories.length && (
        <div className="reader-state">
          <Bookmark className="size-7 text-primary" />
          <h2>{saved ? t("saved") : t("empty")}</h2>
          <p>{saved ? t("emptySaved") : t("empty")}</p>
        </div>
      )}
      {briefing && (
        <section
          className="reader-briefing-section"
          aria-labelledby="briefing-title"
        >
          <div className="reader-section-heading">
            <h2 id="briefing-title">{t("briefing")}</h2>
            <p>{t("briefingNote")}</p>
          </div>
          <div className="reader-briefing-grid">
            {stories.slice(0, 3).map((s) => renderCard(s))}
          </div>
        </section>
      )}
      {!!stories.length && (
        <section aria-labelledby="latest-title">
          <div className="reader-section-heading">
            <h2 id="latest-title">
              {search ? t("searchResults") : saved ? t("saved") : t("latest")}
            </h2>
          </div>
          <div className="reader-story-grid">
            {(briefing ? stories.slice(3) : stories).map((s) => renderCard(s))}
          </div>
        </section>
      )}
      {moreError && (
        <p className="mt-8 text-center" role="alert">
          {t("feedError")}
        </p>
      )}
      {hasMore && (
        <div className="reader-pagination">
          <button
            className="reader-secondary-button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowDown className="size-4" />
            )}
            {t(loadingMore ? "loading" : moreError ? "retry" : "loadMore")}
          </button>
        </div>
      )}
      {accepted && !!stories.length && !hasMore && (
        <p className="reader-end">{t("end")}</p>
      )}
      <SignalDetailModal
        signal={
          selected
            ? all.find((story) => story.id === selected.id) || selected
            : null
        }
        onOpenChange={setSelected}
        isBookmarked={selected ? bookmarks.includes(selected.id) : false}
        isBookmarking={selected ? pendingIds.has(selected.id) : false}
        onToggleBookmark={toggle}
      />
    </>
  );
}
