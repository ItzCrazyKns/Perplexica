import type { NotionConnectionDb } from './store';
import { getAccessToken } from './auth';
import { request, NotionApiError } from './client';

/**
 * Querying shared Notion databases and flattening their entries into
 * readable text for the LLM context.
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
}

interface NotionProperty {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  status?: { name: string } | null;
  checkbox?: boolean;
  number?: number | null;
  date?: { start: string } | null;
  url?: string | null;
  people?: { name: string }[];
  [key: string]: unknown;
}

export async function queryDatabase(
  db: NotionConnectionDb,
  databaseId: string,
): Promise<DatabaseEntry[]> {
  const token = getAccessToken(db);
  if (!token) {
    throw new NotionApiError('Notion is not connected', 0, 'not_connected');
  }

  const response = await request<QueryResponse>(
    `/databases/${databaseId}/query`,
    {
      token,
      method: 'POST',
      body: { page_size: 100 },
    },
  );

  return response.results.map((row) => {
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
  });
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
    default:
      return '';
  }
}
