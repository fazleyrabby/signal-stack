import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
export default async function NotFound() {
  const locale = await getLocale(),
    t = await getTranslations("Reader");
  return (
    <main className="reader-state">
      <h1>{t("notFound")}</h1>
      <p>{t("notFoundText")}</p>
      <Link href={`/${locale}`} className="reader-primary-button">
        {t("back")}
      </Link>
    </main>
  );
}
