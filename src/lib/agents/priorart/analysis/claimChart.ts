import BaseLLM from '@/lib/models/base/llm';
import { ClaimChart, claimChartSchema, RankedDocument } from '../schemas';
import { loadPrompt, renderPrompt } from '../prompts';

export async function buildClaimChart(
  llm: BaseLLM<unknown>,
  claimText: string,
  references: RankedDocument[],
): Promise<ClaimChart> {
  const system = loadPrompt('system');
  const compact = references.map((r) => ({
    publicationNumber: r.publicationNumber,
    title: r.title,
    abstract: r.abstract,
    firstIndependentClaim: r.firstIndependentClaim,
    cpcCodes: r.cpcCodes,
    assignees: r.assignees,
  }));
  const user = renderPrompt('claimAnalysis', {
    claim_text: claimText,
    references_json: JSON.stringify(compact, null, 2),
  });
  const chart = await llm.generateObject<typeof claimChartSchema>({
    schema: claimChartSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { temperature: 0.2, maxTokens: 8192 },
  });
  return claimChartSchema.parse(chart);
}
