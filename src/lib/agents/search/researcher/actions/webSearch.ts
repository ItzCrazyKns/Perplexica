import z from 'zod';
import { ResearchAction } from '../../types';
import { searchSearxng } from '@/lib/searxng';
import { Chunk, SearchResultsResearchBlock } from '@/lib/types';

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
  execute: async (input, additionalConfig) => {
    input.queries = input.queries.slice(0, 3);

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'searching',
        searching: input.queries,
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    let results: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchSearxng(q);

      const resultChunks: Chunk[] = res.results.map((r) => ({
        content: r.content || r.title,
        metadata: {
          title: r.title,
          url: r.url,
        },
      }));

      results.push(...resultChunks);

      if (
        !searchResultsEmitted &&
        researchBlock &&
        researchBlock.type === 'research'
      ) {
        searchResultsEmitted = true;

        researchBlock.data.subSteps.push({
          id: searchResultsBlockId,
          type: 'search_results',
          reading: resultChunks,
        });

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      } else if (
        searchResultsEmitted &&
        researchBlock &&
        researchBlock.type === 'research'
      ) {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );

        const subStep = researchBlock.data.subSteps[
          subStepIndex
        ] as SearchResultsResearchBlock;

        subStep.reading.push(...resultChunks);

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }
    };

    await Promise.all(input.queries.map(search));

    return {
      type: 'search_results',
      results,
    };
  },
};

export default webSearchAction;
