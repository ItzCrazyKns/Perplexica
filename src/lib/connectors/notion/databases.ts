import type { NotionConnectionDb } from './store';
import { getAccessToken } from './auth';
import { request, NotionApiError } from './client';

/**
 * Querying Notion databases through the data-sources API and flattening
 * their entries into readable text for the LLM context.
 *
 * Notion-Version 2026-03-11 queries go to
 * `POST /v1/data_sources/{data_source_id}/query`. Search returns
 * `data_source` objects whose id is accepted directly; ids from older
 * `database` objects are resolved through `GET /v1/databases/{id}`.
 */

export interface DatabaseEntry {
  id: string;
  title: string;
  /** "Property: value" lines, one per database property. */
  text: string;
}

interface QueryResponse {
  results: Array<{
    id: string;
    properties: Record<string, NotionProperty>;
  }>;
  has_more?: boolean;
  next_cursor?: string | null;
}

interface DatabaseResponse {
  data_sources?: Array<{ id: string }>;
}

interface NotionProperty {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  multi_select?: { name: string }[] | null;
  status?: { name: string } | null;
  checkbox?: boolean;
  number?: number | null;
  date?: { start: string } | null;
  url?: string | null;
  people?: { name: string }[] | null;
  formula?: { type: string; string?: string | null; number?: number | null };
  relation?: Array<{ id: string }> | null;
  [key: string]: unknown;
}

function isUnsupportedQueryError(err: unknown): boolean {
  return (
    err instanceof NotionApiError &&
    (err.status === 404 || err.status === 400 || err.status === 410)
  );
}

export async function queryDatabase(
  db: NotionConnectionDb,
  databaseId: string,
): Promise<DatabaseEntry[]> {
  const token = getAccessToken(db);
  if (!token) {
    throw new NotionApiError('Notion is not connected', 0, 'not_connected');
  }

  let dataSourceId: string;

  try {
    // Happy path: search hands us a data source id already.
    dataSourceId = databaseId;
    return await collectEntries(token, dataSourceId);
  } catch (err) {
    if (!isUnsupportedQueryError(err)) throw err;
  }

  // Legacy `database` id: resolve its first data source, then query.
  const database = await request<DatabaseResponse>(`/databases/${databaseId}`, {
    token,
  });
  const first = database.data_sources?.[0];
  if (!first) {
    throw new NotionApiError(
      `Database ${databaseId} has no queryable data source`,
      404,
      'data_source_not_found',
    );
  }

  return collectEntries(token, first.id);
}

async function collectEntries(
  token: string,
  dataSourceId: string,
): Promise<DatabaseEntry[]> {
  const entries: DatabaseEntry[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await request<QueryResponse>(
      `/data_sources/${dataSourceId}/query`,
      {
        token,
        method: 'POST',
        body: {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      },
    );

    entries.push(...response.results.map(toEntry));

    hasMore = response.has_more === true;
    cursor = response.next_cursor ?? undefined;

    // Defensive: never loop on a missing cursor.
    if (hasMore && !cursor) break;
  }

  return entries;
}

function toEntry(row: {
  id: string;
  properties: Record<string, NotionProperty>;
}): DatabaseEntry {
  const properties = Object.entries(row.properties);
  const titleProperty = properties.find(([, p]) => p.type === 'title');
  const title = titleProperty
    ? (titleProperty[1].title ?? []).map((t) => t.plain_text).join('')
    : 'Untitled';

  const lines = properties
    .map(([key, property]) => `${key}: ${propertyToText(property)}`)
    .filter((line) => !line.endsWith(': '));

  return {
    id: row.id,
    title: title || 'Untitled',
    text: lines.join('\n'),
  };
}

function propertyToText(property: NotionProperty): string {
  switch (property.type) {
    case 'title':
    case 'rich_text':
      return (property.title ?? property.rich_text ?? [])
        .map((t) => t.plain_text)
        .join('');
    case 'select':
      return property.select?.name ?? '';
    case 'multi_select':
      return (property.multi_select ?? []).map((s) => s.name).join(', ');
    case 'status':
      return property.status?.name ?? '';
    case 'checkbox':
      return property.checkbox ? 'Yes' : 'No';
    case 'number':
      return property.number === null || property.number === undefined
        ? ''
        : String(property.number);
    case 'date':
      return property.date?.start ?? '';
    case 'url':
      return property.url ?? '';
    case 'people':
      return (property.people ?? []).map((p) => p.name).join(', ');
    case 'formula':
      return property.formula?.string ?? String(property.formula?.number ?? '');
    case 'relation':
      return (property.relation ?? []).map((r) => r.id).join(', ');
    default:
      return '';
  }
}
