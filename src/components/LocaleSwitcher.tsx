'use client';

import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  LOCALES,
  DEFAULT_LOCALE,
  type AppLocale,
  LOCALE_LABELS,
} from '@/i18n/locales';

function setLocaleCookie(value: AppLocale) {
  const oneYear = 60 * 60 * 24 * 365;
  const isSecure =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `locale=${value}; path=/; max-age=${oneYear}; samesite=lax${isSecure ? '; secure' : ''}`;
}

export default function LocaleSwitcher({
  onChange,
}: {
  onChange?: (next: AppLocale) => void;
}) {
  const router = useRouter();
  const current = useLocale();
  const currentLocale: AppLocale = useMemo(() => {
    return (LOCALES as readonly string[]).includes(current)
      ? (current as AppLocale)
      : DEFAULT_LOCALE;
  }, [current]);

  const [value, setValue] = useState<AppLocale>(currentLocale);

  useEffect(() => {
    setValue(currentLocale);
  }, [currentLocale]);

  return (
    <select
      value={value}
      onChange={(e) => {
        const next = e.target.value as AppLocale;
        setValue(next);
        setLocaleCookie(next);
        onChange?.(next);
        router.refresh();
      }}
      className={cn(
        'bg-light-secondary dark:bg-dark-secondary px-3 py-2 flex items-center overflow-hidden border border-light-200 dark:border-dark-200 dark:text-white rounded-lg appearance-none w-full pr-10 text-xs lg:text-sm',
        '!text-xs lg:!text-sm',
      )}
      aria-label="Language"
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_LABELS[loc]}
        </option>
      ))}
    </select>
  );
}
