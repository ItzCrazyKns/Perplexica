import z from 'zod';
import { ResearchAction } from '../../types';
import { searchSearxng } from '@/lib/searxng';

const actionSchema = z.object({
  type: z.literal('web_search'),
  queries: z
    .array(z.string())
    .describe('An array of search queries to perform web searches for.'),
});

const actionDescription = `
You have to use this action aggressively to find relevant information from the web to answer user queries. You can combine this action with other actions to gather comprehensive data. Always ensure that you provide accurate and up-to-date information by leveraging web search results.
When this action is present, you must use it to obtain current information from the web. 

### How to use:
1. For fast search mode, you can use this action once. Make sure to cover all aspects of the user's query in that single search.
2. If you're on quality mode, you'll get to use this action up to two times. Use the first search to gather general information, and the second search to fill in any gaps or get more specific details based on the initial findings.
3. If you're set on Deep research mode, then you will get to use this action multiple times to gather more information. Use your judgment to decide when additional searches are necessary to provide a thorough and accurate response.

Input: An array of search queries. Make sure the queries are relevant to the user's request and cover different aspects if necessary. You can include a maximum of 3 queries. Make sure the queries are SEO friendly and not sentences rather keywords which can be used to search a search engine like Google, Bing, etc.
`;

const webSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'web_search',
  description: actionDescription,
  schema: actionSchema,
  enabled: (config) => config.classification.intents.includes('web_search'),
  execute: async (input, _) => {
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
