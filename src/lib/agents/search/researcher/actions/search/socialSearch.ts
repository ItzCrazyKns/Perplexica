import z from 'zod';
import { ResearchAction } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import { executeSearch } from './baseSearch';

const schema = z.object({
  queries: z.array(z.string()).describe('List of social search queries'),
});

const socialSearchDescription = `
Use this tool to perform social media searches for relevant posts, discussions, and trends related to the user's query. Provide a list of concise search queries that will help gather comprehensive social media information on the topic at hand.
You can provide up to 3 queries at a time. Make sure the queries are specific and relevant to the user's needs.

For example, if the user is interested in public opinion on electric vehicles, your queries could be:
1. "Electric vehicles public opinion 2024"
2. "Social media discussions on EV adoption"
3. "Trends in electric vehicle usage"

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed social media information.
`;

const socialSearchAction: ResearchAction<typeof schema> = {
  name: 'social_search',
  schema: schema,
  getDescription: () => socialSearchDescription,
  getToolDescription: () =>
    "Use this tool to perform social media searches for relevant posts, discussions, and trends related to the user's query. Provide a list of concise search queries that will help gather comprehensive social media information on the topic at hand.",
  enabled: (config) =>
    config.sources.includes('discussions') &&
    config.classification.classification.discussionSearch === true,
  execute: async (input, additionalConfig) => {
    input.queries = (
      Array.isArray(input.queries) ? input.queries : [input.queries]
    ).slice(0, 3);

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (!researchBlock) throw new Error('Failed to retrieve research block');

    const results = await executeSearch({
      llm: additionalConfig.llm,
      embedding: additionalConfig.embedding,
      mode: additionalConfig.mode,
      queries: input.queries,
      researchBlock: researchBlock,
      session: additionalConfig.session,
      searchConfig: {
        engines: ['reddit'],
      },
    });

    return {
      type: 'search_results',
      results: results,
    };
  },
};

export default socialSearchAction;
