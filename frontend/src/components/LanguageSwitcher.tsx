'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { locales } from '@/navigation';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  bn: 'বাং',
  es: 'ES',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.replace(pathname, { locale: e.target.value as (typeof locales)[number] });
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="h-9 px-2 text-[11px] font-bold bg-accent/20 border border-border/10 rounded-xl text-foreground hover:bg-accent/40 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/20"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l] ?? l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
