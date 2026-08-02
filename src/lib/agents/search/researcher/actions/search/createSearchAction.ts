import z from 'zod';
import { ResearchAction, SearchAgentConfig } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import { executeSearch } from './baseSearch';

const schema = z.object({
  queries: z
    .array(z.string())
    .describe('An array of search queries to perform searches for.'),
});

/*
 * The three search actions (web, academic, social) share everything
 * but prompts, the enabled predicate and the engine list; they were
 * three copies that had already drifted apart.
 */
export const createSearchAction = (spec: {
  name: string;
  toolDescription: string;
  getDescription: (config: {
    mode: SearchAgentConfig['mode'];
  }) => string;
  enabled: ResearchAction<typeof schema>['enabled'];
  engines?: string[];
}): ResearchAction<typeof schema> => ({
  name: spec.name,
  schema,
  getToolDescription: () => spec.toolDescription,
  getDescription: spec.getDescription,
  enabled: spec.enabled,
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
      ...(spec.engines ? { searchConfig: { engines: spec.engines } } : {}),
    });

    return {
      type: 'search_results',
      results: results,
    };
  },
});
