"use client";
import { useSyncExternalStore } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Search, Sun, Moon, Radio, BarChart3, Users, Eye } from "lucide-react";
import { useSearch } from "@/context/SearchContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

interface HeaderProps {
  isRefreshing: boolean;
  onRefresh?: () => void;
  showSearch?: boolean;
  isFullWidth?: boolean;
  showControls?: boolean;
  onToggleControls?: () => void;
  visitorCount?: number;
  totalViews?: number;
}
function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
export function Header({
  showSearch = true,
  visitorCount,
  totalViews,
}: HeaderProps) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("Reader");
  const { data: visitors } = useSWR<{ realtime: number; totalViews: number }>(
    "/api/visitors/stats",
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Visitor statistics unavailable");
      return response.json();
    },
    { refreshInterval: 30000 },
  );
  const active = visitorCount ?? visitors?.realtime;
  const views = totalViews ?? visitors?.totalViews;
  const formatCount = (count: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(count);
  const { searchQuery, setSearchQuery } = useSearch();
  const light = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.getAttribute("data-theme") === "light",
    () => false,
  );
  function toggleTheme() {
    const next = !light;
    document.documentElement.setAttribute(
      "data-theme",
      next ? "light" : "onyx",
    );
    localStorage.setItem("signalstack_theme", next ? "light" : "onyx");
    document.cookie = `signalstack_theme=${next ? "light" : "onyx"}; path=/; max-age=31536000; SameSite=Lax`;
  }
  return (
    <header className="reader-header">
      <div className="reader-header-inner">
        <Link
          href={`/${locale}`}
          className="reader-brand"
          aria-label="SignalStack"
        >
          <Radio className="size-7 text-primary" strokeWidth={2} />
          <span>
            Signal<span className="text-primary">Stack</span>
          </span>
        </Link>
        {showSearch && (
          <label className="reader-search hidden md:flex">
            <Search className="size-4 shrink-0" />
            <span className="sr-only">{t("search")}</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              type="search"
            />
          </label>
        )}
        <div className="flex items-center gap-1 sm:gap-3">
          {active !== undefined && (
            <span
              className="reader-visitor-count"
              title={t("activeReaders", { count: active })}
              aria-label={t("activeReaders", { count: active })}
            >
              <Users className="size-4" />
              <span>{formatCount(active)}</span>
            </span>
          )}
          {views !== undefined && (
            <span
              className="reader-visitor-count reader-total-views"
              title={t("pageViews", { count: views })}
              aria-label={t("pageViews", { count: views })}
            >
              <Eye className="size-4" />
              <span>{formatCount(views)}</span>
            </span>
          )}
          <Link
            href={`/${locale}/trends`}
            className="reader-icon-button reader-trends-link"
            aria-label={t("trends")}
          >
            <BarChart3 className="size-5" />
          </Link>
          <LanguageSwitcher />
          <button
            className="reader-icon-button"
            aria-label={t("theme")}
            onClick={toggleTheme}
          >
            {light ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
