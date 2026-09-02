import type { NotionConnectionDb } from './store';
import { getAccessToken } from './auth';
import { request, NotionApiError } from './client';

/**
 * Reading page content. Uses Notion's page markdown endpoint
 * (`GET /v1/pages/{id}/markdown`); large pages are truncated with
 * `unknown_block_ids` that are fetched recursively. Falls back to
 * walking block children when markdown is unavailable.
 */

interface MarkdownResponse {
  markdown: string;
  truncated?: boolean;
  unknown_block_ids?: string[];
}

interface BlockChildrenResponse {
  results: NotionBlock[];
  has_more?: boolean;
  next_cursor?: string | null;
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
  table_row?: { cells?: RichText[][] };
  child_page?: { title: string };
}

interface RichText {
  plain_text: string;
}

const MAX_SUBTREE_DEPTH = 2;
const MAX_UNKNOWN_SUBTREES = 20;

export async function getPageMarkdown(
  db: NotionConnectionDb,
  pageId: string,
): Promise<string> {
  const token = getAccessToken(db);
  if (!token) {
    throw new NotionApiError('Notion is not connected', 0, 'not_connected');
  }

  try {
    return await fetchMarkdownWithSubtrees(token, pageId, 0, new Set());
  } catch (err) {
    if (err instanceof NotionApiError && err.status === 404) {
      // Markdown not available for this page; fall back to blocks.
      return fetchBlocksAsText(token, pageId);
    }
    throw err;
  }
}

async function fetchMarkdownWithSubtrees(
  token: string,
  blockId: string,
  depth: number,
  seen: Set<string>,
): Promise<string> {
  // Depth, cycle, and total-budget guards against runaway recursion.
  if (depth > MAX_SUBTREE_DEPTH || seen.has(blockId) || seen.size > 40) {
    return '';
  }
  seen.add(blockId);

  const response = await request<MarkdownResponse>(
    `/pages/${blockId}/markdown`,
    { token },
  );

  let markdown = response.markdown ?? '';

  // Large pages are truncated at Notion's record limit; each unknown
  // block can be fetched as its own markdown subtree.
  if (response.truncated && Array.isArray(response.unknown_block_ids)) {
    const subParts: string[] = [];
    for (const unknownId of response.unknown_block_ids.slice(
      0,
      MAX_UNKNOWN_SUBTREES,
    )) {
      try {
        const sub = await fetchMarkdownWithSubtrees(
          token,
          unknownId,
          depth + 1,
          seen,
        );
        if (sub) subParts.push(sub);
      } catch (err) {
        // A subtree without markdown support shouldn't fail the whole page.
        if (!(err instanceof NotionApiError && err.status === 404)) throw err;
      }
    }
    if (subParts.length > 0) {
      markdown += `\n\n${subParts.join('\n\n')}`;
    }
  }

  return markdown;
}

async function fetchBlocksAsText(
  token: string,
  blockId: string,
  depth = 0,
): Promise<string> {
  if (depth > 3) return ''; // Guard against deeply nested pages.

  const parts: string[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  let page = 0;

  while (hasMore && page < 20) {
    const response = await request<BlockChildrenResponse>(
      `/blocks/${blockId}/children`,
      {
        token,
        query: {
          page_size: '100',
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      },
    );

    for (const block of response.results) {
      const text = blockToText(block);
      if (text) parts.push(text);

      if (block.has_children) {
        const children = await fetchBlocksAsText(token, block.id, depth + 1);
        if (children) parts.push(children);
      }
    }

    hasMore = response.has_more === true;
    cursor = response.next_cursor ?? undefined;
    page++;

    // Defensive: never loop on a missing cursor.
    if (hasMore && !cursor) break;
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

  // Tables store their cells under `table_row.cells` (array of cells).
  if (block.table_row && Array.isArray(block.table_row.cells)) {
    return block.table_row.cells
      .map((cell) => cell.map((t) => t.plain_text).join(''))
      .join(' | ');
  }

  if (block.child_page && typeof block.child_page.title === 'string') {
    return `[${block.child_page.title}]`;
  }

  return '';
}
