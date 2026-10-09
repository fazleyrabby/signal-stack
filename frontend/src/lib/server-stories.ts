import "server-only";
import { cache } from "react";
import type { Signal, SignalsResponse } from "./api";
const backend = process.env.API_BACKEND_URL || "http://localhost:3000";
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://signal.fazleyrabbi.xyz"
).replace(/\/$/, "");
export async function getStoryFeed(
  locale: string,
  topic?: string,
): Promise<SignalsResponse | null> {
  try {
    const query = new URLSearchParams({
      limit: "30",
      lang: locale,
      sort: "published_at",
      order: "desc",
    });
    if (topic) query.set("categoryId", topic);
    const response = await fetch(`${backend}/api/signals?${query}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}
export const getStory = cache(
  async (id: string, locale: string): Promise<Signal | null> => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return null;
    const response = await fetch(
      `${backend}/api/signals/${encodeURIComponent(id)}?lang=${encodeURIComponent(locale)}`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) },
    );
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new Error("Story service unavailable");
    return response.json();
  },
);
