import type { AuthorizedPage } from './types';

/**
 * Fuzzy Page Search: resolves a user-typed page name against the leading
 * words of each page title, tolerating partial words. Pure module with no
 * Node or database imports so both the client and the server can use it.
 */

export function fuzzyMatchPages(
  pages: AuthorizedPage[],
  name: string,
): AuthorizedPage[] {
  const query = name.trim().toLowerCase();
  if (!query) return [];

  const queryWords = query.split(/\s+/).filter(Boolean);

  return pages
    .map((page) => ({
      page,
      score: scorePage(page.title.toLowerCase(), query, queryWords),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title),
    )
    .map((entry) => entry.page);
}

function scorePage(title: string, query: string, queryWords: string[]): number {
  if (title === query) return 100;
  if (title.startsWith(query)) return 90;

  const titleWords = title.split(/\s+/);
  let leadingMatches = 0;
  for (let i = 0; i < Math.min(queryWords.length, titleWords.length); i++) {
    if (titleWords[i].startsWith(queryWords[i])) {
      leadingMatches++;
    } else {
      break; // Leading words must match in order.
    }
  }
  if (leadingMatches > 0) return 60 + leadingMatches * 10;

  if (queryWords.some((word) => title.includes(word))) return 30;

  return 0;
}
