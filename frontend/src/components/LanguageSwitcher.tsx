'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { locales } from '@/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-2">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => handleLocaleChange(l)}
          className={`px-2 py-1 text-xs font-mono border-2 transition-all ${
            locale === l 
              ? 'bg-primary text-primary-foreground border-primary shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
              : 'bg-background hover:bg-muted border-foreground'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
