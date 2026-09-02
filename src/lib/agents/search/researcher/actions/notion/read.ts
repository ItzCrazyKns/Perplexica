import z from 'zod';
import { ResearchAction } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import {
  getPageMarkdown,
  queryDatabase,
  resolveAuthorizedPage,
  NotionApiError,
  NotionNotConnectedError,
  type AuthorizedPage,
} from '@/lib/connectors/notion';
import {
  buildNotConnectedResult,
  buildApiErrorResult,
  buildGenericErrorResult,
  buildUnauthorizedResult,
  emitResultsSubstep,
} from './results';

const getPageSchema = z.object({
  pageId: z
    .string()
    .describe('The id of the page to read, from notion_search results.'),
});

const notionGetPageAction: ResearchAction<typeof getPageSchema> = {
  name: 'notion_get_page',
  schema: getPageSchema,
  getToolDescription: () =>
    'Read the full content of a Notion page by id. Use after notion_search returned the page id.',
  getDescription: () => `
  Use this tool to read the full content of a Notion page after locating it with notion_search.
  The pageId comes from the notion_search result (the "id" of the page).
  The content returned is the page's markdown — use it to answer the user's question about that page.
  Never call this tool with a page id that did not come from notion_search results.
  `,
  enabled: (config) => config.sources.includes('notion'),
  execute: async (input, additionalConfig) => {
    // Enforce the per-conversation scope (ADR-0001): only read pages
    // selected in this conversation or verified against the authorized
    // set — never an arbitrary id the model may have invented.
    let page: AuthorizedPage | null;
    try {
      page = await resolveAuthorizedPage(
        additionalConfig.notionDb,
        input.pageId,
        additionalConfig.notionPages,
      );
    } catch (err) {
      if (err instanceof NotionNotConnectedError) {
        return emitResultsSubstep(additionalConfig, buildNotConnectedResult());
      }
      if (err instanceof NotionApiError) {
        return emitResultsSubstep(
          additionalConfig,
          buildApiErrorResult(err, 'notion_get_page'),
        );
      }
      return emitResultsSubstep(additionalConfig, buildGenericErrorResult(err));
    }

    if (!page || page.type !== 'page') {
      return emitResultsSubstep(
        additionalConfig,
        buildUnauthorizedResult('notion_get_page'),
      );
    }

    const title = page.title;

    let markdown: string;
    try {
      markdown = await getPageMarkdown(additionalConfig.notionDb, input.pageId);
    } catch (err) {
      if (err instanceof NotionNotConnectedError) {
        return emitResultsSubstep(additionalConfig, buildNotConnectedResult());
      }
      if (err instanceof NotionApiError) {
        return emitResultsSubstep(
          additionalConfig,
          buildApiErrorResult(err, 'notion_get_page'),
        );
      }
      return emitResultsSubstep(additionalConfig, buildGenericErrorResult(err));
    }

    const result = {
      content: markdown,
      metadata: { title, notionId: input.pageId, url: '' },
    };

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'reading',
        reading: [result],
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    return {
      type: 'search_results',
      results: [result],
    };
  },
};

const queryDatabaseSchema = z.object({
  databaseId: z
    .string()
    .describe('The id of the database to query, from notion_search results.'),
});

const notionQueryDatabaseAction: ResearchAction<typeof queryDatabaseSchema> = {
  name: 'notion_query_database',
  schema: queryDatabaseSchema,
  getToolDescription: () =>
    'Query rows of a Notion database by id and read them as plain text. Use after notion_search returned the database id.',
  getDescription: () => `
  Use this tool to read the rows of a Notion database after locating it with notion_search.
  The databaseId comes from the notion_search result (the "id" of the database).
  Each returned row contains its properties flattened to "Property: value" lines.
  Use this data to answer the user's question about the database contents.
  Never call this tool with a database id that did not come from notion_search results.
  `,
  enabled: (config) => config.sources.includes('notion'),
  execute: async (input, additionalConfig) => {
    // Per-conversation scope: only databases selected in this
    // conversation or verified against the authorized set.
    let page: AuthorizedPage | null;
    try {
      page = await resolveAuthorizedPage(
        additionalConfig.notionDb,
        input.databaseId,
        additionalConfig.notionPages,
      );
    } catch (err) {
      if (err instanceof NotionNotConnectedError) {
        return emitResultsSubstep(additionalConfig, buildNotConnectedResult());
      }
      if (err instanceof NotionApiError) {
        return emitResultsSubstep(
          additionalConfig,
          buildApiErrorResult(err, 'notion_query_database'),
        );
      }
      return emitResultsSubstep(additionalConfig, buildGenericErrorResult(err));
    }

    if (!page || page.type !== 'database') {
      return emitResultsSubstep(
        additionalConfig,
        buildUnauthorizedResult('notion_query_database'),
      );
    }

    let entries;
    try {
      entries = await queryDatabase(
        additionalConfig.notionDb,
        input.databaseId,
      );
    } catch (err) {
      if (err instanceof NotionNotConnectedError) {
        return emitResultsSubstep(additionalConfig, buildNotConnectedResult());
      }
      if (err instanceof NotionApiError) {
        return emitResultsSubstep(
          additionalConfig,
          buildApiErrorResult(err, 'notion_query_database'),
        );
      }
      return emitResultsSubstep(additionalConfig, buildGenericErrorResult(err));
    }

    const results = entries.map((entry) => ({
      content: entry.text,
      metadata: {
        title: entry.title,
        notionId: entry.id,
        databaseId: input.databaseId,
        url: '',
      },
    }));

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'reading',
        reading: results,
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    return {
      type: 'search_results',
      results,
    };
  },
};

export { notionGetPageAction, notionQueryDatabaseAction };
