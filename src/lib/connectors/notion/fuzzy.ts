import type { AuthorizedPage } from './types';

/**
 * Fuzzy Page Search: resolves a user-typed page name against the leading
 * words of each page title, tolerating partial words. Pure module with no
 * Node or database imports so both the client and the server can use it.
 */

// Quote / corner-bracket characters users wrap page names in: straight
// and typographic quotes ("…", “…” — left/right single and double) plus
// CJK corner brackets (「…」『…』). Quotes are never part of a page title,
// so they are stripped before matching.
const QUOTE_CHARS =
  /[\u0022\u0027\u2018\u2019\u201C\u201D\u300C\u300E\u300D\u300F]/g;
const SURROUNDING_QUOTE_CHARS =
  /^[\u0022\u0027\u2018\u2019\u201C\u201D\u300C\u300E\u300D\u300F]+|[\u0022\u0027\u2018\u2019\u201C\u201D\u300C\u300E\u300D\u300F]+$/g;

/**
 * Strips a surrounding quote or corner-bracket pair from a user-typed
 * page name (`"會議筆記"`, `「會議筆記」`, `'Meeting Notes'`). A stray
 * leading/trailing quote is dropped too — quotes never belong to a title.
 */
export function stripSurroundingQuotes(name: string): string {
  return name.replace(SURROUNDING_QUOTE_CHARS, '').trim();
}

export interface FuzzyPageMatch {
  page: AuthorizedPage;
  score: number;
}

// Matches at or above this score are trustworthy title matches: exact
// (100), title-prefix (90), and leading-word (70–89). The 30-point loose
// "word contained in title" tier is deliberately below it — those pages
// only matched incidentally (a word inside the title), so they must not
// stand in for — or outrank — a real title match.
export const FUZZY_STRONG_SCORE = 60;

/**
 * Like {@link fuzzyMatchPages}, but returns each match with its score so
 * callers can distinguish a trustworthy title match (score >=
 * {@link FUZZY_STRONG_SCORE}) from an incidental word-containment match
 * (score 30).
 */
export function fuzzyRankPages(
  pages: AuthorizedPage[],
  name: string,
): FuzzyPageMatch[] {
  const query = stripSurroundingQuotes(name).toLowerCase();
  if (!query) return [];

  // Quote characters can also sit mid-hint ("Meeting Notes" 和 …); strip
  // them per word so leading-word matching still resolves the title.
  // Filter empties AFTER stripping so a quote-only token can never
  // vacuously match (''.startsWith is always true).
  const queryWords = query
    .split(/\s+/)
    .map((word) => word.replace(QUOTE_CHARS, ''))
    .filter(Boolean);

  return pages
    .map((page) => ({
      page,
      score: scorePage(page.title.toLowerCase(), query, queryWords),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title),
    );
}

export function fuzzyMatchPages(
  pages: AuthorizedPage[],
  name: string,
): AuthorizedPage[] {
  return fuzzyRankPages(pages, name).map((entry) => entry.page);
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
