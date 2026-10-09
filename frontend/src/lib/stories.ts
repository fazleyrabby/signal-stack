import type { Signal } from "./api";
import { cleanDisplaySummary } from "./utils";

export const TOPICS = ["geopolitics", "technology", "ai"] as const;
export type Topic = (typeof TOPICS)[number];
export function storyPath(id: string, locale = "en") {
  return `/${locale}/stories/${encodeURIComponent(id)}`;
}
// Match ingestion thresholds. This sorting aid does not measure urgency.
export function signalPriority(score: number): "high" | "medium" | "low" {
  return score >= 9 ? "high" : score >= 6 ? "medium" : "low";
}
export function storySummary(signal: Signal) {
  return (
    cleanDisplaySummary(signal.aiSummary) || cleanDisplaySummary(signal.summary)
  );
}
export function sourceExcerpt(content: string | null) {
  return (content || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function publishedLabel(date: string | null, locale: string) {
  if (!date || Number.isNaN(new Date(date).getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}
export function safeSourceUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
export function storyIdentity(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        ["traffic_source", "at_medium", "at_campaign"].includes(key)
      )
        parsed.searchParams.delete(key);
    }
    return parsed.href;
  } catch {
    return url;
  }
}
export async function shareStory(signal: Signal, locale: string) {
  const url = new URL(storyPath(signal.id, locale), window.location.origin)
    .href;
  if (navigator.share) {
    try {
      await navigator.share({ title: signal.title, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return "cancelled";
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
