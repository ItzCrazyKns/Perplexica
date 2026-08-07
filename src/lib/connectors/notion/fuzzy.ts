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
  const overlap = Math.min(queryWords.length, titleWords.length);
  let leadingMatches = 0;
  for (let i = 0; i < overlap; i++) {
    if (titleWords[i].startsWith(queryWords[i])) {
      leadingMatches++;
    } else {
      break; // Leading words must match in order.
    }
  }

  // A partial overlap with a conflicting word means the user meant a
  // different page ("Meeting Budget" is not "Meeting Notes") — stay
  // unresolved so the user can confirm, even if a word is contained.
  if (leadingMatches > 0 && leadingMatches < overlap) return 0;

  // A leading match requires every overlapping word to match in order;
  // extra trailing query words are allowed ("Meeting Notes 2026" still
  // matches "Meeting Notes"). Capped below the exact/prefix tiers so an
  // exact title always wins.
  if (leadingMatches > 0) {
    return Math.min(89, 60 + leadingMatches * 10);
  }

  if (queryWords.some((word) => title.includes(word))) return 30;

  return 0;
}
