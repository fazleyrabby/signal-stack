import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SignalsDashboardContent from "@/components/SignalsDashboardContent";
import { getStoryFeed, siteUrl } from "@/lib/server-stories";
import { locales } from "@/navigation";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Reader" });
  const url = `${siteUrl}/${locale}`;
  return {
    title: `SignalStack — ${t("latest")}`,
    description: t("intro"),
    alternates: {
      canonical: url,
      languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}`])),
    },
    openGraph: {
      title: `SignalStack — ${t("latest")}`,
      description: t("intro"),
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `SignalStack — ${t("latest")}`,
      description: t("intro"),
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SignalsDashboardContent initialData={await getStoryFeed(locale)} />;
}
