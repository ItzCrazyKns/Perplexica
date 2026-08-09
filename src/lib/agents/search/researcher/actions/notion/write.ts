import z from 'zod';
import { ResearchAction, SearchActionOutput } from '../../../types';
import {
  resolveAuthorizedPage,
  NotionApiError,
  NotionNotConnectedError,
  type AuthorizedPage,
} from '@/lib/connectors/notion';
import { stageWrite } from '@/lib/agents/search/writes/staging';
import { buildUnauthorizedResult, buildNotConnectedResult } from './results';

/**
 * Write tools (ticket 06): notion_append_content, notion_update_page,
 * notion_create_page.
 *
 * These never execute a write — they validate the target (per-conversation
 * scope, same as the read tools) and stage the operation. All staged
 * writes for a response are grouped into a single confirmation card
 * (ADR-0003); only the user's approval executes them through the write
 * connector.
 */

async function authorizeTarget(
  input: {
    id: string;
    mustBePage: boolean;
  },
  additionalConfig: Parameters<ResearchAction<any>['execute']>[1],
): Promise<
  | { ok: true; page: AuthorizedPage }
  | { ok: false; result: SearchActionOutput }
> {
  let page: AuthorizedPage | null;
  try {
    page = await resolveAuthorizedPage(
      additionalConfig.notionDb,
      input.id,
      additionalConfig.notionPages,
    );
  } catch (err) {
    if (err instanceof NotionNotConnectedError) {
      return { ok: false, result: buildNotConnectedResult() };
    }
    if (err instanceof NotionApiError) {
      return {
        ok: false,
        result: {
          type: 'search_results',
          results: [
            {
              content: `The Notion API returned an error (${err.status}: ${err.code || err.message}). Ask the user to select the page and retry.`,
              metadata: { title: 'Notion: write target check failed', url: '' },
            },
          ],
        },
      };
    }
    return {
      ok: false,
      result: {
        type: 'search_results',
        results: [
          {
            content: `Checking the Notion write target failed (${err instanceof Error ? err.message : 'unknown error'}).`,
            metadata: { title: 'Notion: write target check failed', url: '' },
          },
        ],
      },
    };
  }

  if (!page || (input.mustBePage && page.type !== 'page')) {
    return { ok: false, result: buildUnauthorizedResult('notion write') };
  }

  return { ok: true, page };
}

function stagedResult(content: string): SearchActionOutput {
  return {
    type: 'search_results',
    results: [
      {
        content,
        metadata: { title: 'Notion: staged write', url: '' },
      },
    ],
  };
}

const appendSchema = z.object({
  pageId: z
    .string()
    .describe('The id of the page to append to, from notion_search results.'),
  content: z
    .string()
    .describe(
      'The content to append to the page, as plain text or light markdown (# headings, - bullets).',
    ),
});

const notionAppendContentAction: ResearchAction<typeof appendSchema> = {
  name: 'notion_append_content',
  schema: appendSchema,
  getToolDescription: () =>
    'Stage appending content to an existing Notion page. Does not write anything until the user approves the confirmation card.',
  getDescription: () => `
  Use this tool when the user asks you to save or append content to an existing Notion page
  (for example "把重點存到我的會議筆記" or "add this to the Roadmap page").

  How to use:
  1. Locate the page with notion_search first (or use a page the user selected in this conversation).
  2. Call notion_append_content with the page id and the content to append.
  3. The write is STAGED, not executed. After research the user approves or rejects a single
     confirmation card covering all staged writes; nothing is written before approval.
     Never claim the content was already saved before the user approves.

  Only write to pages the user explicitly named or selected in this conversation.
  `,
  enabled: (config) =>
    config.allowWrites !== false && config.sources.includes('notion'),
  execute: async (input, additionalConfig) => {
    const authorized = await authorizeTarget(
      { id: input.pageId, mustBePage: true },
      additionalConfig,
    );
    if (!authorized.ok) return authorized.result;

    stageWrite(additionalConfig.session, {
      kind: 'append',
      target: { id: authorized.page.id, title: authorized.page.title },
      content: input.content,
    });

    return stagedResult(
      `Staged: append content to the Notion page "${authorized.page.title}" (id: ${authorized.page.id}). This write is pending user confirmation — do not claim it was written.`,
    );
  },
};

const updateSchema = z.object({
  pageId: z
    .string()
    .describe('The id of the page to update, from notion_search results.'),
  title: z
    .string()
    .optional()
    .describe('Optional new title for the page.'),
  content: z
    .string()
    .describe(
      'The new content for the page, as plain text or light markdown. Appended to the page body.',
    ),
});

const notionUpdatePageAction: ResearchAction<typeof updateSchema> = {
  name: 'notion_update_page',
  schema: updateSchema,
  getToolDescription: () =>
    'Stage updating an existing Notion page (optionally its title, plus appended content). Does not write until the user approves the confirmation card.',
  getDescription: () => `
  Use this tool when the user asks you to update or correct an existing Notion page
  (for example "更新會議筆記" or "把這頁改成這樣").

  How to use:
  1. Locate the page with notion_search first (or use a page the user selected in this conversation).
  2. Call notion_update_page with the page id and the corrected content.
  3. The write is STAGED, not executed. After research the user approves or rejects a single
     confirmation card covering all staged writes; nothing is written before approval.

  Only write to pages the user explicitly named or selected in this conversation.
  `,
  enabled: (config) =>
    config.allowWrites !== false && config.sources.includes('notion'),
  execute: async (input, additionalConfig) => {
    const authorized = await authorizeTarget(
      { id: input.pageId, mustBePage: true },
      additionalConfig,
    );
    if (!authorized.ok) return authorized.result;

    stageWrite(additionalConfig.session, {
      kind: 'update',
      target: { id: authorized.page.id, title: authorized.page.title },
      ...(input.title ? { title: input.title } : {}),
      content: input.content,
    });

    return stagedResult(
      `Staged: update the Notion page "${authorized.page.title}" (id: ${authorized.page.id}). This write is pending user confirmation — do not claim it was written.`,
    );
  },
};

const createSchema = z.object({
  title: z.string().describe('The title of the new page.'),
  content: z
    .string()
    .describe(
      'The content of the new page, as plain text or light markdown (# headings, - bullets).',
    ),
  parentId: z
    .string()
    .optional()
    .describe(
      'The id of the page to create the new page under, from notion_search results. Omit to create at the workspace top level (only when the user explicitly asked for a new top-level page).',
    ),
});

const notionCreatePageAction: ResearchAction<typeof createSchema> = {
  name: 'notion_create_page',
  schema: createSchema,
  getToolDescription: () =>
    'Stage creating a new Notion page, as a child of a selected page or at the workspace top level. Does not write until the user approves the confirmation card.',
  getDescription: () => `
  Use this tool when the user asks you to create a new Notion page
  (for example "開一個新頁面紀錄這個" or "create a page for this").

  How to use:
  1. If the new page should live under an existing page, locate the parent with notion_search
     first (or use a page the user selected in this conversation) and pass its id as parentId.
  2. Call notion_create_page with the title and content; omit parentId only when the user
     explicitly asked for a brand-new top-level page in the workspace.
  3. The write is STAGED, not executed. After research the user approves or rejects a single
     confirmation card covering all staged writes; nothing is written before approval.

  Never create a page under a parent the user did not name or select in this conversation.
  `,
  enabled: (config) =>
    config.allowWrites !== false && config.sources.includes('notion'),
  execute: async (input, additionalConfig) => {
    let parent: { id: string | null; title: string } = {
      id: null,
      title: 'Workspace top level',
    };

    // Only `undefined` means "top level"; an empty supplied id must go
    // through authorization so it is rejected instead of silently
    // creating at the workspace root.
    if (input.parentId !== undefined) {
      const authorized = await authorizeTarget(
        { id: input.parentId, mustBePage: true },
        additionalConfig,
      );
      if (!authorized.ok) return authorized.result;
      parent = { id: authorized.page.id, title: authorized.page.title };
    }

    stageWrite(additionalConfig.session, {
      kind: 'create',
      parent,
      title: input.title,
      content: input.content,
    });

    return stagedResult(
      `Staged: create the Notion page "${input.title}"${
        parent.id ? ` under "${parent.title}"` : ' at the workspace top level'
      }. This write is pending user confirmation — do not claim it was written.`,
    );
  },
};

export {
  notionAppendContentAction,
  notionUpdatePageAction,
  notionCreatePageAction,
};
