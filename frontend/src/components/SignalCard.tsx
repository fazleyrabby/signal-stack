"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bookmark, Share2, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  storyPath,
  storySummary,
  signalPriority,
  publishedLabel,
  shareStory,
} from "@/lib/stories";
import type { Signal } from "@/lib/api";
interface SignalCardProps {
  signal: Signal;
  isCompact: boolean;
  className?: string;
  isBookmarked?: boolean;
  isBookmarking?: boolean;
  onToggleBookmark?: (signalId: string) => Promise<void> | undefined;
  onPreview?: (signal: Signal) => void;
}
export function SignalCard({
  signal,
  className,
  isBookmarked,
  isBookmarking,
  onToggleBookmark,
  onPreview,
}: SignalCardProps) {
  const t = useTranslations("Reader");
  const locale = useLocale();
  const summary = storySummary(signal);
  const date = publishedLabel(signal.publishedAt, locale);
  return (
    <article className={cn("story-card", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{signal.source}</span>
          {date && (
            <time className="mt-1 block text-xs" dateTime={signal.publishedAt!}>
              {date}
            </time>
          )}
        </div>
        {onToggleBookmark && (
          <button
            className="reader-icon-button shrink-0"
            aria-label={isBookmarked ? t("unsave") : t("save")}
            aria-pressed={!!isBookmarked}
            disabled={isBookmarking}
            onClick={(e) => {
              e.stopPropagation();
              void onToggleBookmark(signal.id);
            }}
          >
            {isBookmarking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bookmark
                className={cn(
                  "size-4",
                  isBookmarked && "fill-current text-primary",
                )}
              />
            )}
          </button>
        )}
      </div>
      <h3 className="story-headline">
        <Link
          href={storyPath(signal.id, locale)}
          prefetch={false}
          onClick={(e) => {
            e.stopPropagation();
            if (
              onPreview &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              onPreview(signal);
            }
          }}
        >
          {signal.title}
        </Link>
      </h3>
      {signal.translationPending ? (
        <p className="text-sm text-muted-foreground">
          {t("translationPending")}
        </p>
      ) : (
        summary && <p className="story-summary">{summary}</p>
      )}
      <div className="story-card-footer">
        <span className="text-xs text-muted-foreground" title={t("scoreHelp")}>
          {t(signalPriority(signal.score))}{" "}
          <span className="tabular-nums">{signal.score}/12</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            className="reader-icon-button"
            aria-label={t("share")}
            onClick={async (e) => {
              e.stopPropagation();
              try {
                if ((await shareStory(signal, locale)) === "copied")
                  toast.success(t("linkCopied"));
              } catch {
                toast.error(t("shareError"));
              }
            }}
          >
            <Share2 className="size-4" />
          </button>
          <Link
            href={storyPath(signal.id, locale)}
            prefetch={false}
            className="reader-text-link"
            onClick={(e) => e.stopPropagation()}
          >
            {t("story")}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
