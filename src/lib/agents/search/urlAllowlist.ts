import { ChatTurnMessage } from '@/lib/types';

/*
 * scrape_url arguments come from the LLM, whose context contains
 * attacker-authored page text. Restricting targets to URLs the user
 * typed or SearXNG surfaced stops a scraped page from steering the
 * browser to a URL of its choosing.
 */

export const normalizeUrl = (raw: string): string => {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return raw.trim().replace(/\/+$/, '');
  }
};

const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/gi;

export const extractUserUrls = (text: string): string[] =>
  Array.from(new Set(text.match(URL_REGEX) ?? []));

/* Only user turns count: assistant turns quote scraped content. */
export const seedAllowedUrls = (
  chatHistory: ChatTurnMessage[],
  followUp: string,
): Set<string> => {
  const allowed = new Set<string>();

  const userText = [
    ...chatHistory.filter((m) => m.role === 'user').map((m) => m.content),
    followUp,
  ].join('\n');

  for (const match of userText.match(URL_REGEX) ?? []) {
    allowed.add(normalizeUrl(match));
  }

  return allowed;
};
