"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Bookmark,
  Share2,
  ExternalLink,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  storyPath,
  storySummary,
  sourceExcerpt,
  publishedLabel,
  signalPriority,
  shareStory,
  safeSourceUrl,
} from "@/lib/stories";
import type { Signal } from "@/lib/api";
interface SignalDetailModalProps {
  signal: Signal | null;
  onOpenChange: (signal: Signal | null) => void;
  isBookmarked?: boolean;
  isBookmarking?: boolean;
  onToggleBookmark?: (signalId: string) => Promise<void>;
}
export function SignalDetailModal({
  signal,
  onOpenChange,
  isBookmarked,
  isBookmarking,
  onToggleBookmark,
}: SignalDetailModalProps) {
  const t = useTranslations("Reader");
  const locale = useLocale();
  if (!signal) return null;
  const summary = storySummary(signal),
    excerpt = sourceExcerpt(signal.content),
    sourceUrl = safeSourceUrl(signal.url);
  return (
    <Dialog
      open={!!signal}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="public-surface reader-modal flex flex-col gap-0 p-0 overflow-hidden"
      >
        <DialogClose
          className="reader-icon-button absolute right-2 top-2"
          aria-label={t("close")}
        >
          <X className="size-5" />
        </DialogClose>
        <div className="overflow-y-auto min-h-0 flex-1 p-6 sm:p-9">
          <DialogHeader>
            <DialogDescription className="text-sm pr-8">
              {signal.source}{" "}
              {publishedLabel(signal.publishedAt, locale) &&
                `· ${publishedLabel(signal.publishedAt, locale)}`}
            </DialogDescription>
            <DialogTitle className="reader-modal-title">
              {signal.title}
            </DialogTitle>
          </DialogHeader>
          <div className="reader-briefing mt-8">
            <h2 className="text-base font-semibold mb-3">
              {signal.aiSummary ? t("aiSummary") : t("summary")}
            </h2>
            <p className="text-base leading-7">{summary || t("noSummary")}</p>
            {signal.aiSummary && (
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {t("aiNote")}
              </p>
            )}
          </div>
          {excerpt && excerpt.toLowerCase() !== summary?.toLowerCase() && (
            <details className="reader-excerpt mt-6">
              <summary className="cursor-pointer font-medium py-3">
                {t("sourceExcerpt")}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("excerptNote")}
              </p>
              <p className="mt-3 text-base leading-7">{excerpt}</p>
            </details>
          )}
          <details className="mt-6 text-sm text-muted-foreground">
            <summary className="cursor-pointer py-2">
              {t(signalPriority(signal.score))} · {signal.score}/12 —{" "}
              {t("aboutScore")}
            </summary>
            <p className="py-2 leading-6">{t("scoreHelp")}</p>
          </details>
        </div>
        <div className="reader-modal-actions border-t border-border p-4 sm:px-9 sm:py-5">
          <div className="flex items-center gap-2">
            {onToggleBookmark && (
              <button
                className="reader-icon-button"
                aria-label={isBookmarked ? t("unsave") : t("save")}
                aria-pressed={!!isBookmarked}
                disabled={isBookmarking}
                onClick={() => void onToggleBookmark(signal.id)}
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
            <button
              className="reader-icon-button"
              aria-label={t("share")}
              onClick={async () => {
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
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceUrl && (
              <a
                className="reader-secondary-button"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("readSource")}
                <ExternalLink className="size-4" />
              </a>
            )}
            <Link
              className="reader-primary-button"
              href={storyPath(signal.id, locale)}
              onClick={() => onOpenChange(null)}
            >
              {t("openStory")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
