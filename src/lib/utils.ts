import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...classes: ClassValue[]) => twMerge(clsx(...classes));

// Locale-aware absolute date formatting
export const formatDate = (
  date: Date | string,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  },
) => {
  const d = new Date(date);
  return new Intl.DateTimeFormat(locale || undefined, options).format(d);
};

// Locale-aware relative time using Intl.RelativeTimeFormat
export const formatRelativeTime = (
  date1: Date | string,
  date2: Date | string,
  locale: string,
): string => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffSeconds = Math.floor((d2.getTime() - d1.getTime()) / 1000); // positive if d2 > d1

  const abs = Math.abs(diffSeconds);
  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (abs < 60) {
    value = Math.round(diffSeconds);
    unit = 'second';
  } else if (abs < 3600) {
    value = Math.round(diffSeconds / 60);
    unit = 'minute';
  } else if (abs < 86400) {
    value = Math.round(diffSeconds / 3600);
    unit = 'hour';
  } else if (abs < 2629800) {
    // ~1 month (30.4 days)
    value = Math.round(diffSeconds / 86400);
    unit = 'day';
  } else if (abs < 31557600) {
    // ~1 year
    value = Math.round(diffSeconds / 2629800);
    unit = 'month';
  } else {
    value = Math.round(diffSeconds / 31557600);
    unit = 'year';
  }

  const rtf = new Intl.RelativeTimeFormat(locale || undefined, {
    numeric: 'auto',
  });
  return rtf.format(value, unit);
};
