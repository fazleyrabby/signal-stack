"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, BarChart3, Bookmark, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bookmarksOnly =
    pathname === "/" && searchParams.get("bookmarks") === "true";

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/20 pb-[env(safe-area-inset-bottom)]">
      <div className="h-[60px] grid grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive(pathname, bookmarksOnly);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-1 transition-colors duration-200"
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "absolute top-1.5 h-1.5 w-1.5 rounded-full transition-all duration-200",
                  active ? "bg-primary opacity-100" : "opacity-0",
                )}
              />
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground/60",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground/60",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
