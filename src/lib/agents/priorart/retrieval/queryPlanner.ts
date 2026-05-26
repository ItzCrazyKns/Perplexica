import BaseLLM from '@/lib/models/base/llm';
import { FeatureProfile, QueryPlan, queryPlanSchema } from '../schemas';
import { loadPrompt, renderPrompt } from '../prompts';

export async function planQueries(
  llm: BaseLLM<unknown>,
  profile: FeatureProfile,
  claimText: string | undefined,
  priorityDate: string,
  refinedQueryExamples?: string[],
): Promise<QueryPlan> {
  const refinedBlock =
    refinedQueryExamples && refinedQueryExamples.length
      ? `\n\nReframe examples (already disambiguated by grounded web search — model these in style + targeting):\n${refinedQueryExamples
          .map((q) => `- ${q}`)
          .join(
            '\n',
          )}\n\nProduce your odpQueries in the same plain-keyword style. Do NOT echo these examples verbatim; expand and complement them.`
      : '';
  const user =
    renderPrompt('queryPlanning', {
      feature_profile_json: JSON.stringify(profile, null, 2),
      claim_text: claimText ?? '(none)',
      priority_date: priorityDate,
    }) + refinedBlock;
  const system = loadPrompt('system');

  const plan = await llm.generateObject<typeof queryPlanSchema>({
    schema: queryPlanSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { temperature: 0.2, maxTokens: 8192 },
  });

  return queryPlanSchema.parse({ ...plan, priorityDate });
}
