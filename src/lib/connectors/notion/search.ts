import type { NotionConnectionDb } from './store';
import { NotionNotConnectedError, getAccessToken } from './auth';
import { request, type RequestOptions } from './client';
import type { AuthorizedPage } from './types';

/**
 * Listing, searching, and fuzzy-matching Authorized Pages.
 *
 * Fuzzy Page Search resolves a user-typed page name by the leading
 * words of the page title, tolerating partial words; a miss returns no
 * candidates so the conversation can ask the user to re-confirm.
 */

interface NotionSearchResult {
  id: string;
  object: 'page' | 'database';
  properties?: Record<
    string,
    { type?: string; title?: { plain_text: string }[] }
  >;
  title?: { plain_text: string }[];
}

interface NotionSearchResponse {
  results: NotionSearchResult[];
  has_more: boolean;
  next_cursor: string | null;
}

function extractTitle(result: NotionSearchResult): string {
  if (result.object === 'database') {
    return (result.title ?? []).map((t) => t.plain_text).join('');
  }

  const properties = result.properties ?? {};
  const titleProperty = Object.values(properties).find(
    (property) =>
      property.type === 'title' && (property.title?.length ?? 0) > 0,
  );
  return (titleProperty?.title ?? []).map((t) => t.plain_text).join('');
}

function toAuthorizedPage(result: NotionSearchResult): AuthorizedPage {
  return {
    id: result.id,
    title: extractTitle(result) || 'Untitled',
    type: result.object,
  };
}

function requireToken(db: NotionConnectionDb): string {
  const token = getAccessToken(db);
  if (!token) {
    throw new NotionNotConnectedError(
      'Notion is not connected; connect it in Settings first',
    );
  }
  return token;
}

export async function listAuthorizedPages(
  db: NotionConnectionDb,
): Promise<AuthorizedPage[]> {
  const token = requireToken(db);
  const options: RequestOptions = {
    token,
    method: 'POST',
    body: {
      filter: { value: 'page_or_database', property: 'object' },
      page_size: 100,
    },
  };

  const response = await request<NotionSearchResponse>('/search', options);
  return response.results.map(toAuthorizedPage);
}

export async function searchNotionPages(
  db: NotionConnectionDb,
  query: string,
): Promise<AuthorizedPage[]> {
  const token = requireToken(db);
  const options: RequestOptions = {
    token,
    method: 'POST',
    body: {
      query,
      page_size: 20,
    },
  };

  const response = await request<NotionSearchResponse>('/search', options);
  return response.results.map(toAuthorizedPage);
}

/**
 * Fuzzy Page Search: matches a typed page name against the leading words
 * of each page title. Returns candidates ranked best-first; empty when
 * nothing plausibly matches.
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
