import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "Reader" });
  return (
    <>
      <Header isRefreshing={false} showSearch={false} />
      <main className="reader-main">
        <article className="reader-article">
          <Link href={`/${locale}`} className="reader-text-link">
            {t("back")}
          </Link>
          <h1>{t("about")}</h1>
          <div className="reader-article-body">
            <p>{t("aboutText")}</p>
            <h2 className="mt-10">{t("aiSummary")}</h2>
            <p>{t("aiNote")}</p>
            <h2 className="mt-10">{t("aboutScore")}</h2>
            <p>{t("scoreHelp")}</p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
