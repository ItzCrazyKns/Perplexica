import z from 'zod';
import { ResearchAction } from '../../../types';
import { Chunk, ResearchBlock } from '@/lib/types';
import { executeSearch } from './baseSearch';
import { isXquikEnabled, searchXquik } from '@/lib/xquik';

const schema = z.object({
  queries: z.array(z.string()).describe('List of social search queries'),
});

const getSocialSearchDescription = () => `
Use this tool to perform social media searches for relevant posts, discussions, and trends related to the user's query. Provide a list of concise search queries that will help gather comprehensive social media information on the topic at hand.
You can provide up to 3 queries at a time. Make sure the queries are specific and relevant to the user's needs.
${isXquikEnabled() ? 'This tool searches both Reddit and X for broader social media coverage.' : 'This tool searches Reddit for social media discussions.'}

For example, if the user is interested in public opinion on electric vehicles, your queries could be:
1. "Electric vehicles public opinion 2024"
2. "Social media discussions on EV adoption"
3. "Trends in electric vehicle usage"

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed social media information.
`;

const socialSearchAction: ResearchAction<typeof schema> = {
  name: 'social_search',
  schema: schema,
  getDescription: getSocialSearchDescription,
  getToolDescription: () =>
    "Use this tool to perform social media searches for relevant posts, discussions, and trends related to the user's query. Provide a list of concise search queries that will help gather comprehensive social media information on the topic at hand.",
  enabled: (config) =>
    config.sources.includes('discussions') &&
    config.classification.classification.skipSearch === false &&
    config.classification.classification.discussionSearch === true,
  execute: async (input, additionalConfig) => {
    input.queries = (
      Array.isArray(input.queries) ? input.queries : [input.queries]
    ).slice(0, 3);

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (!researchBlock) throw new Error('Failed to retrieve research block');

    const [redditResults, xquikResults] = await Promise.all([
      executeSearch({
        llm: additionalConfig.llm,
        embedding: additionalConfig.embedding,
        mode: additionalConfig.mode,
        queries: input.queries,
        researchBlock: researchBlock,
        session: additionalConfig.session,
        searchConfig: {
          engines: ['reddit'],
        },
      }),
      searchXquikQueries(input.queries),
    ]);

    return {
      type: 'search_results',
      results: deduplicateResults([...redditResults, ...xquikResults]),
    };
  },
};

const searchXquikQueries = async (queries: string[]): Promise<Chunk[]> => {
  if (!isXquikEnabled()) return [];

  const results = await Promise.all(
    queries.map(async (query) => {
      try {
        return await searchXquik(query, 5);
      } catch (err) {
        console.error(
          'Xquik social search failed:',
          err instanceof Error ? err.message : 'Unknown error',
        );
        return [];
      }
    }),
  );

  return results.flat().map((result) => ({
    content: result.content,
    metadata: {
      title: result.title,
      url: result.url,
    },
  }));
};

const deduplicateResults = (results: Chunk[]): Chunk[] => {
  const seenURLs = new Set<string>();

  return results.filter((result) => {
    const url = result.metadata.url;
    if (typeof url !== 'string' || seenURLs.has(url)) return false;
    seenURLs.add(url);
    return true;
  });
};

export default socialSearchAction;
