'use client';

import { useEffect } from 'react';
import { LOCALES, DEFAULT_LOCALE, type AppLocale } from '@/i18n/locales';

export default function LocaleBootstrap({
  initialLocale,
}: {
  initialLocale: AppLocale;
}) {
  useEffect(() => {
    const hasCookie = /(?:^|; )locale=/.test(document.cookie);
    if (hasCookie) return;
    const supported = new Set<string>(LOCALES as readonly string[]);
    const loc = (initialLocale || DEFAULT_LOCALE) as string;
    const chosen = Array.from(supported).find(
      (s) => s.toLowerCase() === loc.toLowerCase(),
    ) as AppLocale | undefined;
    const finalLocale: AppLocale = chosen || DEFAULT_LOCALE;
    document.cookie = `locale=${finalLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [initialLocale]);

  return null;
}
