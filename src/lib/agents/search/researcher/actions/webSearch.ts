import z from 'zod';
import { ResearchAction } from '../../types';
import { searchSearxng } from '@/lib/searxng';
import { Chunk } from '@/lib/types';

const actionSchema = z.object({
  type: z.literal('web_search'),
  queries: z
    .array(z.string())
    .describe('An array of search queries to perform web searches for.'),
});

const actionDescription = `
Use immediately after the ___plan call when you need information. Default to using this unless you already have everything needed to finish. Provide 1-3 short, SEO-friendly queries (keywords, not sentences) that cover the user ask. Always prefer current/contextual queries (e.g., include year for news).

You can search maximum of 3 queries at a time.

For fast mode, you can only use this tool once so make sure to get all needed information in one go.

For balanced and quality modes, you can use this tool multiple times as needed. 

In quality and balanced mode, first try to gather upper level information with broad queries, then use more specific queries based on what you find to find all information needed.
`;

const webSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'web_search',
  description: actionDescription,
  schema: actionSchema,
  enabled: (config) =>
    config.classification.classification.skipSearch === false,
  execute: async (input, _) => {
    input.queries = input.queries.slice(0, 3);
    
    let results: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchSearxng(q);

      res.results.forEach((r) => {
        results.push({
          content: r.content || r.title,
          metadata: {
            title: r.title,
            url: r.url,
          },
        });
      });
    };

    await Promise.all(input.queries.map(search));

    return {
      type: 'search_results',
      results,
    };
  },
};

export default webSearchAction;
