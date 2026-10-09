"use client";
import { useTranslations } from "next-intl";
export default function Error({ reset }: { reset: () => void }) {
  const t = useTranslations("Reader");
  return (
    <main className="reader-state" role="alert">
      <p>{t("feedError")}</p>
      <button className="reader-primary-button" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
