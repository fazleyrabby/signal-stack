"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import { Bookmark, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shareStory } from "@/lib/stories";
import type { Signal } from "@/lib/api";
export function StoryActions({ signal }: { signal: Signal }) {
  const locale = useLocale(),
    t = useTranslations("Reader");
  const [pending, setPending] = useState(false);
  const { data: ids = [], mutate } = useSWR<string[]>(
    "/api/bookmarks",
    async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("Bookmarks unavailable");
      return r.json();
    },
  );
  const saved = ids.includes(signal.id);
  return (
    <>
      <button
        className="reader-secondary-button"
        disabled={pending}
        aria-pressed={saved}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          try {
            const r = await fetch(`/api/bookmarks/${signal.id}`, {
              method: "POST",
            });
            if (!r.ok) throw new Error("Save failed");
            const result = await r.json();
            await mutate(
              (current) =>
                result.bookmarked
                  ? [
                      ...(current || []).filter((id) => id !== signal.id),
                      signal.id,
                    ]
                  : (current || []).filter((id) => id !== signal.id),
              { revalidate: false },
            );
            toast.success(t(result.bookmarked ? "savedToast" : "removedToast"));
          } catch {
            toast.error(t("saveError"));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} />
        )}{" "}
        {t(saved ? "unsave" : "save")}
      </button>
      <button
        className="reader-secondary-button"
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
        {t("share")}
      </button>
    </>
  );
}
