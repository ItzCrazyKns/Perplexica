import type { NotionConnectionDb } from './store';
import { getAccessToken } from './auth';
import { request, NotionApiError } from './client';

/**
 * Reading page content. Prefers Notion's markdown content endpoint;
 * falls back to walking block children when markdown is unavailable.
 */

interface MarkdownResponse {
  markdown: string;
  has_more: boolean;
  next_cursor: string | null;
}

interface BlockChildrenResponse {
  results: NotionBlock[];
}

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  paragraph?: { rich_text: RichText[] };
  heading_1?: { rich_text: RichText[] };
  heading_2?: { rich_text: RichText[] };
  heading_3?: { rich_text: RichText[] };
  bulleted_list_item?: { rich_text: RichText[] };
  numbered_list_item?: { rich_text: RichText[] };
  to_do?: { rich_text: RichText[] };
  quote?: { rich_text: RichText[] };
  code?: { rich_text: RichText[] };
  child_page?: { title: string };
}

interface RichText {
  plain_text: string;
}

export async function getPageMarkdown(
  db: NotionConnectionDb,
  pageId: string,
): Promise<string> {
  const token = getAccessToken(db);
  if (!token) {
    throw new NotionApiError('Notion is not connected', 0, 'not_connected');
  }

  try {
    return await fetchMarkdown(token, pageId);
  } catch (err) {
    if (err instanceof NotionApiError && err.status === 404) {
      // Markdown not available for this page; fall back to blocks.
      return fetchBlocksAsText(token, pageId);
    }
    throw err;
  }
}

async function fetchMarkdown(token: string, pageId: string): Promise<string> {
  const response = await request<MarkdownResponse>(
    `/pages/${pageId}/content/markdown`,
    { token },
  );
  return response.markdown;
}

async function fetchBlocksAsText(
  token: string,
  blockId: string,
  depth = 0,
): Promise<string> {
  if (depth > 3) return ''; // Guard against deeply nested pages.

  const response = await request<BlockChildrenResponse>(
    `/blocks/${blockId}/children`,
    { token, query: { page_size: '100' } },
  );

  const parts: string[] = [];
  for (const block of response.results) {
    const text = blockToText(block);
    if (text) parts.push(text);

    if (block.has_children) {
      const children = await fetchBlocksAsText(token, block.id, depth + 1);
      if (children) parts.push(children);
    }
  }

  return parts.join('\n');
}
function blockToText(block: NotionBlock): string {
  const content = (
    block as unknown as Record<string, { rich_text?: RichText[] }>
  )[block.type];
  if (content && Array.isArray(content.rich_text)) {
    return content.rich_text.map((t) => t.plain_text).join('');
  }

  if (block.child_page && typeof block.child_page.title === 'string') {
    return `[${block.child_page.title}]`;
  }

  return '';
}
