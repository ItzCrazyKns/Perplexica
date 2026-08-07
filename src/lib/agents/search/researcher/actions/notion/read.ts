import z from 'zod';
import { ResearchAction } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import {
  getPageMarkdown,
  queryDatabase,
  NotionApiError,
  NotionNotConnectedError,
} from '@/lib/connectors/notion';
import {
  buildNotConnectedResult,
  buildApiErrorResult,
  buildGenericErrorResult,
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
    const attached = additionalConfig.notionPages;
    const page = attached.find((p) => p.id === input.pageId);
    const title = page?.title ?? 'Notion page';

    let markdown: string;
    try {
      markdown = await getPageMarkdown(additionalConfig.notionDb, input.pageId);
    } catch (err) {
      if (err instanceof NotionNotConnectedError) {
        return buildNotConnectedResult();
      }
      if (err instanceof NotionApiError) {
        return buildApiErrorResult(err, 'notion_get_page');
      }
      return buildGenericErrorResult(err);
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
    let entries;
    try {
      entries = await queryDatabase(
        additionalConfig.notionDb,
        input.databaseId,
      );
    } catch (err) {
      if (err instanceof NotionNotConnectedError) {
        return buildNotConnectedResult();
      }
      if (err instanceof NotionApiError) {
        return buildApiErrorResult(err, 'notion_query_database');
      }
      return buildGenericErrorResult(err);
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
