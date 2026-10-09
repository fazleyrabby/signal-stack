import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getStory, getStoryFeed, siteUrl } from "@/lib/server-stories";
import {
  storyPath,
  storySummary,
  sourceExcerpt,
  publishedLabel,
  signalPriority,
  safeSourceUrl,
} from "@/lib/stories";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SignalCard } from "@/components/SignalCard";
import { StoryActions } from "@/components/StoryActions";
import { locales } from "@/navigation";
interface Props {
  params: Promise<{ locale: string; id: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params,
    signal = await getStory(id, locale);
  if (!signal)
    return {
      title: "Story not found — SignalStack",
      robots: { index: false, follow: true },
    };
  const title = `${signal.title} — SignalStack`,
    description = (
      storySummary(signal) ||
      sourceExcerpt(signal.content) ||
      signal.title
    ).slice(0, 180);
  const url = `${siteUrl}${storyPath(id, locale)}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${siteUrl}${storyPath(id, l)}`]),
      ),
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [`${url}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
  };
}
export default async function Page({ params }: Props) {
  const { locale, id } = await params,
    signal = await getStory(id, locale);
  if (!signal) notFound();
  const t = await getTranslations({ locale, namespace: "Reader" });
  const summary = storySummary(signal),
    excerpt = sourceExcerpt(signal.content),
    sourceUrl = safeSourceUrl(signal.url);
  const related =
    (await getStoryFeed(locale, signal.categoryId))?.data
      .filter((s) => s.id !== id && s.url !== signal.url)
      .slice(0, 3) || [];
  return (
    <>
      <Header isRefreshing={false} showSearch={false} />
      <main className="reader-main">
        <article className="reader-article">
          <Link href={`/${locale}`} className="reader-text-link">
            <ArrowLeft className="size-4" />
            {t("back")}
          </Link>
          <h1>{signal.title}</h1>
          <div className="reader-article-meta">
            <span className="font-medium text-foreground">{signal.source}</span>
            {publishedLabel(signal.publishedAt, locale) && (
              <time dateTime={signal.publishedAt!}>
                {publishedLabel(signal.publishedAt, locale)}
              </time>
            )}
            <span>
              {t(signalPriority(signal.score))} · {signal.score}/12
            </span>
          </div>
          <div className="reader-article-actions">
            <StoryActions signal={signal} />
            {sourceUrl && (
              <a
                className="reader-primary-button sm:ml-auto"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("readSource")}
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
          <section className="reader-article-body">
            <h2>{signal.aiSummary ? t("aiSummary") : t("summary")}</h2>
            <p>{summary || t("noSummary")}</p>
            {signal.aiSummary && (
              <p className="mt-5 text-sm text-muted-foreground">
                {t("aiNote")}
              </p>
            )}
          </section>
          {excerpt && excerpt.toLowerCase() !== summary?.toLowerCase() && (
            <details className="reader-excerpt mt-8">
              <summary className="cursor-pointer py-3 font-medium">
                {t("sourceExcerpt")}
              </summary>
              <p className="text-sm text-muted-foreground">
                {t("excerptNote")}
              </p>
              <p className="text-base leading-8 mt-4">{excerpt}</p>
            </details>
          )}
          <details className="mt-6 text-sm text-muted-foreground">
            <summary className="cursor-pointer py-3">{t("aboutScore")}</summary>
            <p className="leading-6">{t("scoreHelp")}</p>
          </details>
        </article>
        {!!related.length && (
          <section className="pb-8">
            <div className="reader-section-heading">
              <h2>{t("related")}</h2>
            </div>
            <div className="reader-story-grid">
              {related.map((s) => (
                <SignalCard key={s.id} signal={s} isCompact={false} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
