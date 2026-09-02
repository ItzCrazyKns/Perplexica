import z from 'zod';
import { ResearchAction } from '../../../types';
import { Chunk, ResearchBlock } from '@/lib/types';
import {
  fuzzyMatchPages,
  searchNotionPages,
  NotionApiError,
  NotionNotConnectedError,
} from '@/lib/connectors/notion';
import {
  buildNotConnectedResult,
  buildApiErrorResult,
  buildGenericErrorResult,
  emitResultsSubstep,
} from './results';

const schema = z.object({
  query: z
    .string()
    .describe(
      'The page or database name (or a distinctive part of it) the user referenced.',
    ),
});

const notionSearchAction: ResearchAction<typeof schema> = {
  name: 'notion_search',
  schema,
  getToolDescription: () =>
    "Search the user's Notion pages and databases by name. Call this to locate the page a user mentioned, then read it with notion_get_page (or notion_query_database for a database). Only used when the user's request concerns their Notion pages.",
  getDescription: () => `
  Use this tool to find a page or database inside the user's authorized Notion workspace.
  Call it whenever the user asks about content in their Notion pages (for example "讀《會議筆記》" or "what's in my roadmap page?").

  How to use:
  1. Call notion_search with the page name the user mentioned.
  2. The result contains matching pages with their \`notionId\`.
  3. Call notion_get_page (page) or notion_query_database (database) with that id to read the actual content.
  4. Answer the user from the content you read. Never invent page content.

  Only search Notion when the user's request concerns their Notion pages — do not use this tool for general web queries.
  `,
  enabled: (config) => config.sources.includes('notion'),
  execute: async (input, additionalConfig) => {
    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'notion_searching',
        queries: [input.query],
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    // 1. Resolve against the pages selected in this conversation first
    //    (fuzzy, leading-words matching — no API call needed).
    let matches = fuzzyMatchPages(additionalConfig.notionPages, input.query);

    // 2. Fall back to searching all authorized pages via the Notion API.
    if (matches.length === 0) {
      try {
        matches = await searchNotionPages(
          additionalConfig.notionDb,
          input.query,
        );
      } catch (err) {
        if (err instanceof NotionNotConnectedError) {
          return emitResultsSubstep(
            additionalConfig,
            buildNotConnectedResult(),
          );
        }
        if (err instanceof NotionApiError) {
          return emitResultsSubstep(
            additionalConfig,
            buildApiErrorResult(err, 'notion_search'),
          );
        }
        return emitResultsSubstep(
          additionalConfig,
          buildGenericErrorResult(err),
        );
      }
    }

    const results: Chunk[] = matches.map((page) => ({
      content: `Notion ${page.type} "${page.title}" (id: ${page.id}). To read it, call ${
        page.type === 'database' ? 'notion_query_database' : 'notion_get_page'
      } with the id "${page.id}".`,
      metadata: {
        title: page.title,
        type: page.type,
        notionId: page.id,
        url: '',
      },
    }));

    if (results.length === 0) {
      const candidates = additionalConfig.notionPages
        .map((page) => `"${page.title}"`)
        .join(', ');

      results.push({
        content: `No Notion page matched "${input.query}". ${
          candidates
            ? `The user may have meant one of these authorized pages: ${candidates}. `
            : ''
        }Ask the user which page they meant before proceeding — never guess and never read another page.`,
        metadata: {
          title: 'Notion: no matching page',
          url: '',
        },
      });
    }

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'notion_search_results',
        results,
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

export default notionSearchAction;
