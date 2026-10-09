"use client";
import { LegacyBottomNav } from "./LegacyBottomNav";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Home, Layers, Bookmark, Search, X } from "lucide-react";
import { useSearch } from "@/context/SearchContext";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import es from "../../messages/es.json";
export function BottomNav() {
  const pathname = usePathname(),
    query = useSearchParams(),
    router = useRouter();
  const matched = pathname.match(/^\/(en|bn|es)(?:\/|$)/);
  const locale = matched?.[1] || "en";
  const t = { en, bn, es }[locale as "en" | "bn" | "es"].Reader;
  const {
    searchQuery,
    setSearchQuery,
    isMobileSearchOpen,
    setIsMobileSearchOpen,
  } = useSearch();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isMobileSearchOpen) input.current?.focus();
  }, [isMobileSearchOpen]);
  // Global component: public navigation must not alter admin surfaces.
  if (!matched) return <LegacyBottomNav />;
  const saved = query.get("bookmarks") === "true";
  const home = pathname === `/${locale}` || pathname === `/${locale}/`;
  const tabs = [
    { href: `/${locale}`, label: t.feed, icon: Home, active: home && !saved },
    {
      href: `/${locale}/#topics`,
      label: t.topics,
      icon: Layers,
      active: pathname.includes("/topics/"),
    },
    {
      href: `/${locale}/?bookmarks=true`,
      label: t.saved,
      icon: Bookmark,
      active: home && saved,
    },
  ];
  return (
    <>
      {isMobileSearchOpen && (
        <div className="reader-mobile-search public-surface">
          <label className="relative block">
            <span className="sr-only">{t.search}</span>
            <input
              ref={input}
              type="search"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="reader-icon-button absolute right-1 top-1"
              aria-label={t.close}
              onClick={() => setIsMobileSearchOpen(false)}
            >
              <X className="size-5" />
            </button>
          </label>
        </div>
      )}
      <nav className="reader-bottom-nav public-surface" aria-label={t.feed}>
        <div>
          {tabs.slice(0, 2).map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
          <button
            aria-pressed={isMobileSearchOpen}
            onClick={() => {
              if (!home) router.push(`/${locale}`);
              setIsMobileSearchOpen(!isMobileSearchOpen);
            }}
          >
            <Search className="size-5" />
            {t.search}
          </button>
          <Link
            href={tabs[2].href}
            aria-current={tabs[2].active ? "page" : undefined}
          >
            <Bookmark className="size-5" />
            {t.saved}
          </Link>
        </div>
      </nav>
    </>
  );
}
