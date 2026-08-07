import type { NotionConnectionDb } from './store';
import { NotionNotConnectedError, getAccessToken } from './auth';
import { request, type RequestOptions } from './client';
import type { AuthorizedPage } from './types';
import { fuzzyMatchPages } from './fuzzy';

export { fuzzyMatchPages };

/**
 * Listing and searching Authorized Pages.
 *
 * Fuzzy matching lives in the pure `./fuzzy` module so the client can
 * use it too; a miss returns no candidates so the conversation can ask
 * the user to re-confirm.
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
