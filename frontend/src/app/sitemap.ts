import type { MetadataRoute } from "next";
import { siteUrl, getStoryFeed } from "@/lib/server-stories";
import { locales } from "@/navigation";
import { TOPICS, storyPath } from "@/lib/stories";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stories = (await getStoryFeed("en"))?.data || [];
  const paths = ["", ...TOPICS.map((t) => `/topics/${t}`), "/about"];
  return [
    ...locales.flatMap((locale) =>
      paths.map((path) => ({
        url: `${siteUrl}/${locale}${path}`,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${siteUrl}/${l}${path}`]),
          ),
        },
      })),
    ),
    ...locales.flatMap((locale) =>
      stories.map((s) => ({
        url: `${siteUrl}${storyPath(s.id, locale)}`,
        lastModified: new Date(s.createdAt),
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${siteUrl}${storyPath(s.id, l)}`]),
          ),
        },
      })),
    ),
  ];
}
