import type { NotionConnectionDb } from './store';
import { getAccessToken } from './auth';
import { request, NotionApiError } from './client';

/**
 * Writing to Notion pages: append content, update a page, create a page
 * (as a child of an authorized page, or at the top level of the
 * workspace). These functions only perform the write — they are called
 * after the user approved the batched write confirmation, never by the
 * agent tools directly (see ADR-0003).
 *
 * Capability note: the connection only requests read, insert, and update
 * content capabilities (ADR-0002), so "update" extends the page (sets
 * the title, appends the new content) instead of deleting existing
 * blocks, which would require the delete capability.
 */

export class WorkspaceParentUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceParentUnsupportedError';
  }
}

export interface CreatePageInput {
  /** Page id to create under, or null for the workspace top level. */
  parentId: string | null;
  title: string;
  content: string;
}

export interface UpdatePageInput {
  /** New page title; omitted to keep the current title. */
  title?: string;
  content: string;
}

type RichText = { type: 'text'; text: { content: string } };

type NotionChildBlock = {
  object: 'block';
  type: 'paragraph' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item';
  paragraph?: { rich_text: RichText[] };
  heading_2?: { rich_text: RichText[] };
  heading_3?: { rich_text: RichText[] };
  bulleted_list_item?: { rich_text: RichText[] };
  numbered_list_item?: { rich_text: RichText[] };
};

const MAX_BLOCKS_PER_REQUEST = 100;

function richText(content: string): RichText[] {
  return [{ type: 'text', text: { content } }];
}

/**
 * Converts plain text / light markdown into Notion child blocks:
 * `#`/`##`/`###` headings, `-`/`*` bullets, `1.` numbered items, and
 * paragraphs. Pure — no I/O, so it is unit-testable on its own.
 */
export function contentToBlocks(content: string): NotionChildBlock[] {
  const blocks: NotionChildBlock[] = [];

  for (const raw of content.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    // A bare heading marker (`#`) is not content — skip it.
    if (/^#{1,6}$/.test(line)) continue;

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (!text) continue;
      if (level === 1) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: richText(text) },
        });
      } else {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: richText(text) },
        });
      }
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      const text = bullet[1].trim();
      if (!text) continue;
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: richText(text) },
      });
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      const text = numbered[1].trim();
      if (!text) continue;
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: richText(text) },
      });
      continue;
    }

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(line) },
    });
  }

  return blocks;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function requireToken(db: NotionConnectionDb): string {
  const token = getAccessToken(db);
  if (!token) {
    throw new NotionApiError('Notion is not connected', 0, 'not_connected');
  }
  return token;
}

/** The standard shareable Notion URL for a page id. */
export function pageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

async function appendBlocks(
  token: string,
  pageId: string,
  blocks: NotionChildBlock[],
): Promise<void> {
  if (blocks.length === 0) return;
  for (const batch of chunk(blocks, MAX_BLOCKS_PER_REQUEST)) {
    // Notion 2026-03-11 appends block children with PATCH, not POST
    // (verified live: POST /blocks/{id}/children returns
    // 400 invalid_request_url).
    await request(`/blocks/${pageId}/children`, {
      token,
      method: 'PATCH',
      body: { children: batch },
    });
  }
}

/** Appends `content` as new child blocks of an existing page. */
export async function appendPageContent(
  db: NotionConnectionDb,
  pageId: string,
  content: string,
): Promise<void> {
  const token = requireToken(db);
  await appendBlocks(token, pageId, contentToBlocks(content));
}

/**
 * Updates a page: optionally sets its title, then appends the new
 * content as child blocks. Appending (not replacing) is deliberate —
 * replacing the body would require the delete content capability, which
 * this connection never requests (ADR-0002).
 */
export async function updatePageContent(
  db: NotionConnectionDb,
  pageId: string,
  input: UpdatePageInput,
): Promise<void> {
  const token = requireToken(db);

  if (input.title) {
    await request(`/pages/${pageId}`, {
      token,
      method: 'PATCH',
      body: { properties: { title: richText(input.title) } },
    });
  }

  await appendBlocks(token, pageId, contentToBlocks(input.content));
}

/**
 * Creates a new page. With `parentId` it lands as a child of that page;
 * with `parentId: null` it is created at the workspace top level.
 *
 * Workspace-top-level creation depends on the integration's allowed
 * parent types (ticket 06). When the API rejects it, a
 * {@link WorkspaceParentUnsupportedError} is thrown so the caller can
 * ask the user for an authorized parent page instead.
 */
export async function createPage(
  db: NotionConnectionDb,
  input: CreatePageInput,
): Promise<{ id: string; url: string }> {
  const token = requireToken(db);

  const parent = input.parentId
    ? { page_id: input.parentId }
    : { type: 'workspace', workspace: true };

  const blocks = contentToBlocks(input.content);

  try {
    const response = await request<{ id: string; url: string }>('/pages', {
      token,
      method: 'POST',
      body: {
        parent,
        properties: { title: richText(input.title) },
        children: blocks.slice(0, MAX_BLOCKS_PER_REQUEST),
      },
    });

    // The create endpoint accepts at most 100 children; append any
    // remaining blocks so long content is never silently dropped.
    if (blocks.length > MAX_BLOCKS_PER_REQUEST) {
      await appendBlocks(token, response.id, blocks.slice(MAX_BLOCKS_PER_REQUEST));
    }

    return { id: response.id, url: response.url };
  } catch (err) {
    if (
      !input.parentId &&
      err instanceof NotionApiError &&
      (err.status === 400 || err.status === 403) &&
      /parent/i.test(err.message)
    ) {
      throw new WorkspaceParentUnsupportedError(
        'This Notion integration cannot create pages at the workspace top level. Select or name an authorized parent page for the new page instead.',
      );
    }
    throw err;
  }
}
