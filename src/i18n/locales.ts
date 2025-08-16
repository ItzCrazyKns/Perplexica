export const LOCALES = [
  'en-US',
  'en-GB',
  'zh-TW',
  'zh-HK',
  'zh-CN',
  'ja',
  'ko',
  'fr-FR',
  'fr-CA',
  'de',
] as const;
export type AppLocale = (typeof LOCALES)[number];

// Default locale for fallbacks
export const DEFAULT_LOCALE: AppLocale = 'en-US';

// UI labels for language options
export const LOCALE_LABELS: Record<AppLocale, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'zh-TW': '繁體中文',
  'zh-HK': '繁體中文（香港）',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  'fr-FR': 'Français (France)',
  'fr-CA': 'Français (Canada)',
  de: 'Deutsch',
};

// Human-readable language name for prompt prefix
export function getPromptLanguageName(loc: string): string {
  const l = (loc || '').toLowerCase();
  const match = (
    Object.keys(LOCALE_LABELS) as Array<keyof typeof LOCALE_LABELS>
  ).find((k) => k.toLowerCase() === l);
  if (match) return LOCALE_LABELS[match];
  return LOCALE_LABELS[DEFAULT_LOCALE];
}
