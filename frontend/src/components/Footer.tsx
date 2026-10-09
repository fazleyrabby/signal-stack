"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Rss } from "lucide-react";
export function Footer() {
  const locale = useLocale(),
    t = useTranslations("Reader");
  return (
    <footer className="reader-footer">
      <span>© {new Date().getFullYear()} SignalStack</span>
      <div className="flex flex-wrap items-center gap-6">
        <Link href={`/${locale}/about`}>{t("about")}</Link>
        <Link href={`/${locale}/trends`}>{t("trends")}</Link>
        <a href="/api/feed.xml" className="inline-flex items-center gap-2">
          <Rss className="size-4" />
          {t("rss")}
        </a>
      </div>
    </footer>
  );
}
