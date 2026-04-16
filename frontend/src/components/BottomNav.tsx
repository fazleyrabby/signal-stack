"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useParams } from "next/navigation";
import { locales } from "@/navigation";
import { Home, BarChart3, Bookmark, Shield, Search as SearchIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/context/SearchContext";
import { Input } from "@/components/ui/input";
import { useEffect, useRef } from "react";

const mainTabs = [
  {
    id: "feed",
    label: "Feed",
    href: "/",
    icon: Home,
    isActive: (pathname: string, bookmarksOnly: boolean) =>
      pathname === "/" && !bookmarksOnly,
  },
  {
    id: "trends",
    label: "Trends",
    href: "/trends",
    icon: BarChart3,
    isActive: (pathname: string) => pathname.startsWith("/trends"),
  },
  {
    id: "saved",
    label: "Saved",
    href: "/?bookmarks=true",
    icon: Bookmark,
    isActive: (pathname: string, bookmarksOnly: boolean) =>
      pathname === "/" && bookmarksOnly,
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    icon: Shield,
    isActive: (pathname: string) => pathname.startsWith("/admin"),
  },
] as const;

export function BottomNav() {
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const { searchQuery, setSearchQuery, isMobileSearchOpen, setIsMobileSearchOpen } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  // Strip locale prefix so active checks work: /en/trends → /trends, /en → /
  const pathname = (locales as readonly string[]).reduce(
    (p, l) => p.replace(new RegExp(`^/${l}(?=/|$)`), '') || '/',
    rawPathname
  );

  const bookmarksOnly =
    pathname === "/" && searchParams.get("bookmarks") === "true";

  const hideOnRoutes = ["/admin-login"];
  const shouldHide = hideOnRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    if (isMobileSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  const getFullHref = (href: string, id: string) => {
    if (id === "admin") return href;
    const base = href.startsWith("/") ? href : `/${href}`;
    return `/${locale}${base}`.replace(/\/$/, '') || '/';
  };

  if (shouldHide) return null;

  return (
    <>
      {/* Mobile Search Overlay/Popup */}
      <div className={cn(
        "fixed bottom-[60px] left-0 right-0 z-[60] p-4 bg-card/95 backdrop-blur-xl border-t border-border/20 transition-all duration-300 ease-out transform",
        isMobileSearchOpen 
          ? "translate-y-0 opacity-100 visible" 
          : "translate-y-4 opacity-0 invisible"
      )}>
        <div className="relative group max-w-lg mx-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary transition-colors" />
          <Input 
            ref={inputRef}
            placeholder="Search signals..." 
            value={searchQuery}
            className="w-full bg-accent/20 border-primary/20 pl-10 pr-10 h-11 text-[14px] font-bold tracking-tight rounded-lg focus:ring-1 focus:ring-primary/40 transition-all"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button 
            onClick={() => {
              setSearchQuery("");
              setIsMobileSearchOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/40 hover:text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/20 pb-[env(safe-area-inset-bottom)] overflow-x-auto scrollbar-hide">
        <div className="h-[60px] grid grid-cols-5 min-w-[300px]">
          {mainTabs.slice(0, 2).map((tab) => {
            const Icon = tab.icon;
            const active = tab.isActive(pathname, bookmarksOnly);
            return (
              <Link
                key={tab.id}
                href={getFullHref(tab.href, tab.id)}
                className="relative flex flex-col items-center justify-center gap-1 transition-colors duration-200"
              >
                <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground/60")} />
                <span className={cn("text-[9px] font-bold uppercase tracking-wider", active ? "text-primary" : "text-muted-foreground/60")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* Center Search Button */}
          <button
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            className="relative flex flex-col items-center justify-center gap-1 transition-colors duration-200"
          >
            <div className={cn(
              "p-2 rounded-full transition-all duration-300",
              isMobileSearchOpen ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-muted-foreground/60 hover:text-primary"
            )}>
              <SearchIcon className="w-5 h-5" />
            </div>
            {!isMobileSearchOpen && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Search</span>
            )}
          </button>

          {mainTabs.slice(2).map((tab) => {
            const Icon = tab.icon;
            const active = tab.isActive(pathname, bookmarksOnly);
            return (
              <Link
                key={tab.id}
                href={getFullHref(tab.href, tab.id)}
                className="relative flex flex-col items-center justify-center gap-1 transition-colors duration-200"
              >
                <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground/60")} />
                <span className={cn("text-[8px] font-bold uppercase tracking-wider", active ? "text-primary" : "text-muted-foreground/60")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

