"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ReaderFeed } from "./ReaderFeed";
import { useSearch } from "@/context/SearchContext";
import { TOPICS, type Topic } from "@/lib/stories";
import type { SignalsResponse } from "@/lib/api";

interface Props {
  initialData?: SignalsResponse | null;
  topic?: Topic;
}
function Dashboard({ initialData, topic }: Props) {
  const t = useTranslations("Reader"),
    locale = useLocale();
  const query = useSearchParams();
  const saved = query.get("bookmarks") === "true";
  const country = query.get("country") || "";
  const { searchQuery } = useSearch();
  const [search, setSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  useEffect(() => {
    void fetch("/api/visitors", { method: "POST" }).catch(() => {});
  }, []);
  return (
    <>
      <Header isRefreshing={false} />
      <main className="reader-main">
        <section className="reader-intro">
          <h1>{saved ? t("saved") : topic ? t(topic) : t("headline")}</h1>
          <p>
            {saved
              ? t("savedIntro")
              : topic
                ? t("topicIntro")
                : t("compactIntro")}
          </p>
        </section>
        <nav className="reader-topics" id="topics" aria-label={t("topics")}>
          <Link
            href={`/${locale}`}
            aria-current={!topic && !saved ? "page" : undefined}
          >
            {t("allTopics")}
          </Link>
          {TOPICS.map((id) => (
            <Link
              key={id}
              href={`/${locale}/topics/${id}`}
              aria-current={id === topic && !saved ? "page" : undefined}
            >
              {t(id === "ai" ? "aiShort" : id)}
            </Link>
          ))}
          <Link
            href={`/${locale}/?bookmarks=true`}
            aria-current={saved ? "page" : undefined}
            className="sm:ml-auto"
          >
            {t("saved")}
          </Link>
        </nav>
        <ReaderFeed
          key={`${locale}:${topic || ""}:${saved}:${country}:${search}`}
          locale={locale}
          topic={topic}
          saved={saved}
          country={country}
          search={search}
          initialData={!saved && !country && !search ? initialData : null}
        />
      </main>
      <Footer />
    </>
  );
}
export default function SignalsDashboardContent(props: Props) {
  return (
    <Suspense fallback={<div className="reader-main" aria-busy="true" />}>
      <Dashboard {...props} />
    </Suspense>
  );
}
