import type { NotionConnectionDb } from './store';
import { NotionNotConnectedError, getAccessToken } from './auth';
import { request, type RequestOptions } from './client';
import type { AuthorizedPage } from './types';
import { fuzzyMatchPages } from './fuzzy';

export { fuzzyMatchPages };

/**
 * Listing and searching Authorized Pages.
 *
 * Under the current Notion API (Notion-Version 2026-03-11) search
 * returns `page` and `data_source` objects; databases are represented
 * by their data sources. `data_source` results map to our domain type
 * `type: 'database'`, and their id is the data source id that the
 * data-sources query endpoint accepts.
 *
 * Fuzzy matching lives in the pure `./fuzzy` module so the client can
 * use it too; a miss returns no candidates so the conversation can ask
 * the user to re-confirm.
 */

interface NotionSearchResult {
  id: string;
  object: 'page' | 'database' | 'data_source';
  properties?: Record<
    string,
    { type?: string; title?: { plain_text: string }[] }
  >;
  title?: { plain_text: string }[];
  name?: string | { plain_text: string }[];
}

interface NotionSearchResponse {
  results: NotionSearchResult[];
  has_more: boolean;
  next_cursor: string | null;
}

function extractTitle(result: NotionSearchResult): string {
  if (result.object === 'data_source') {
    if (typeof result.name === 'string') return result.name;
    return (result.name ?? []).map((t) => t.plain_text).join('');
  }

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
    // `data_source` (and legacy `database`) results are databases for
    // the user; the id is what the data-sources query endpoint accepts.
    type: result.object === 'page' ? 'page' : 'database',
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

async function collectSearchResults(
  token: string,
  body: Record<string, unknown>,
): Promise<NotionSearchResult[]> {
  const results: NotionSearchResult[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const options: RequestOptions = {
      token,
      method: 'POST',
      body: {
        ...body,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    };

    const response = await request<NotionSearchResponse>('/search', options);
    results.push(...response.results);

    hasMore = response.has_more === true;
    cursor = response.next_cursor ?? undefined;

    // Defensive: never loop on a missing cursor.
    if (hasMore && !cursor) break;
  }

  return results;
}

export async function listAuthorizedPages(
  db: NotionConnectionDb,
): Promise<AuthorizedPage[]> {
  const token = requireToken(db);

  const results = await collectSearchResults(token, {
    filter: { value: 'page_or_data_source', property: 'object' },
  });

  return results.map(toAuthorizedPage);
}

export async function searchNotionPages(
  db: NotionConnectionDb,
  query: string,
): Promise<AuthorizedPage[]> {
  const token = requireToken(db);

  const results = await collectSearchResults(token, { query });

  return results.map(toAuthorizedPage);
}

/**
 * Server-side authorization: returns only the requested pages that are
 * genuinely shared with the connection, remapped to the server's own
 * title/type data (callers can't spoof titles or smuggle in ids). Used
 * by the chat route before persisting caller-supplied page ids.
 */
export async function filterAuthorizedPages(
  db: NotionConnectionDb,
  requested: AuthorizedPage[],
): Promise<AuthorizedPage[]> {
  if (requested.length === 0) return [];

  const authorized = await listAuthorizedPages(db);
  const byId = new Map(authorized.map((page) => [page.id, page]));

  const result: AuthorizedPage[] = [];
  for (const req of requested) {
    const real = byId.get(req.id);
    if (real) result.push(real);
  }
  return result;
}

/**
 * Resolves a page id to its authorized entry (from the conversation's
 * attached pages first, then the full authorized set). Returns null when
 * the id is not shared with the connection — used by the agent tools to
 * enforce the per-conversation scope before reading (ADR-0001).
 */
export async function resolveAuthorizedPage(
  db: NotionConnectionDb,
  pageId: string,
  attached: AuthorizedPage[] = [],
): Promise<AuthorizedPage | null> {
  const inAttached = attached.find((page) => page.id === pageId);
  if (inAttached) return inAttached;

  const authorized = await listAuthorizedPages(db);
  return authorized.find((page) => page.id === pageId) ?? null;
}
