import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SignalsDashboardContent from "@/components/SignalsDashboardContent";
import { TOPICS, type Topic } from "@/lib/stories";
import { getStoryFeed, siteUrl } from "@/lib/server-stories";
import { locales } from "@/navigation";
interface Props {
  params: Promise<{ locale: string; topic: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, topic } = await params;
  if (!TOPICS.includes(topic as Topic)) notFound();
  const t = await getTranslations({ locale, namespace: "Reader" });
  const title = `${t(topic as Topic)} — SignalStack`,
    description = `${t(topic as Topic)}. ${t("topicIntro")}`;
  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/topics/${topic}`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${siteUrl}/${l}/topics/${topic}`]),
      ),
    },
    openGraph: { title, description, type: "website" },
  };
}
export default async function Page({ params }: Props) {
  const { locale, topic } = await params;
  if (!TOPICS.includes(topic as Topic)) notFound();
  return (
    <SignalsDashboardContent
      topic={topic as Topic}
      initialData={await getStoryFeed(locale, topic)}
    />
  );
}
