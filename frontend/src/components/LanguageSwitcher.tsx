"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { locales } from "@/navigation";
import { useSearchParams } from "next/navigation";

const LOCALE_LABELS: Record<string, string> = {
  en: "EN",
  bn: "বাং",
  es: "ES",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.replace(`${pathname}${query.size ? `?${query}` : ""}`, {
      locale: e.target.value as (typeof locales)[number],
    });
  };

  return (
    <select
      value={locale}
      aria-label="Language / ভাষা / Idioma"
      onChange={handleChange}
      className="h-11 px-2 text-sm font-medium bg-transparent border border-border rounded-lg text-foreground cursor-pointer"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l] ?? l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
