import z from 'zod';
import BaseLLM from '@/lib/models/base/llm';
import { FeatureProfile, RankedDocument } from '../schemas';

const filterSchema = z.object({
  decisions: z.array(
    z.object({
      publicationNumber: z.string(),
      keep: z.boolean(),
      reason: z
        .string()
        .describe(
          'One-line reason. If dropping: name the unrelated domain (e.g. "lithium battery", "electrical substation", "construction machinery"). If keeping: name the overlapping technical contribution.',
        ),
    }),
  ),
});
export type FilterDecision = z.infer<typeof filterSchema>['decisions'][number];

export type SemanticFilterResult = {
  kept: RankedDocument[];
  dropped: Array<{ doc: RankedDocument; reason: string }>;
};

const DEFAULT_BATCH = 25;

/**
 * Post-retrieval LLM-reasoned filter that drops refs which share keywords with
 * the feature but are in a different technical domain. Required when the feature
 * uses terms like "switchyard" (collides with electrical substations) or
 * "state management" (collides with solid-state battery patents).
 *
 * Single LLM call over the full top-K. Output is a per-reference keep/drop
 * decision with a one-line domain explanation. Cheaper than per-ref calls.
 */
export async function filterByDomain(
  llm: BaseLLM<unknown>,
  feature: FeatureProfile,
  refs: RankedDocument[],
  opts: { batch?: number; noiseDomainsToAvoid?: string[] } = {},
): Promise<SemanticFilterResult> {
  if (!refs.length) return { kept: [], dropped: [] };
  const batchSize = opts.batch ?? DEFAULT_BATCH;
  const noise = opts.noiseDomainsToAvoid ?? [];
  const kept: RankedDocument[] = [];
  const dropped: Array<{ doc: RankedDocument; reason: string }> = [];

  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = refs.slice(i, i + batchSize);
    const decisions = await judgeBatch(llm, feature, batch, noise).catch((err: Error) => {
      console.error(`[priorart] semanticFilter batch failed: ${err.message}`);
      // Fail-open: on LLM error, keep the batch (better noise than no results).
      return batch.map<FilterDecision>((b) => ({
        publicationNumber: b.publicationNumber,
        keep: true,
        reason: 'filter-error-keep',
      }));
    });
    const byPub = new Map(decisions.map((d) => [d.publicationNumber, d]));
    for (const ref of batch) {
      const d = byPub.get(ref.publicationNumber);
      if (!d || d.keep) {
        kept.push(ref);
      } else {
        dropped.push({ doc: ref, reason: d.reason });
      }
    }
  }
  return { kept, dropped };
}

async function judgeBatch(
  llm: BaseLLM<unknown>,
  feature: FeatureProfile,
  refs: RankedDocument[],
  noiseDomainsToAvoid: string[],
): Promise<FilterDecision[]> {
  const noiseBlock = noiseDomainsToAvoid.length
    ? `\n\nGROUNDED NOISE LIST (drop on contact — already established as off-domain by Deep Research):\n${noiseDomainsToAvoid
        .map((d) => `- ${d}`)
        .join('\n')}\nAny reference whose subject matter is in one of these domains MUST be dropped.`
    : '';
  const system = `You are a patent search relevance judge. The user retrieved a set of patent references via keyword + embedding search. Many will share words with the feature but belong to UNRELATED technical domains (a common source of noise: the word "switchyard" matches electrical substations; "state management" matches solid-state batteries; "control" matches construction machinery).

For each reference, decide: is this patent in the SAME technical domain as the feature, or did keyword pollution drag it in? Drop unless the reference plausibly discloses an aspect of the feature's actual technology.

You are not deciding novelty. You are deciding *technical-domain relevance only*. Be strict — drop liberally when the reference is clearly off-domain (industrial machinery, batteries, mechanical, chemical, biomedical) unless the feature explicitly covers that area.${noiseBlock}`;

  const featureBlock = `Feature: ${feature.title}
Summary: ${feature.summary}
Technical domain: software / ${feature.componentTechnologies.join(', ')}
Component technologies: ${feature.componentTechnologies.join(', ')}`;

  const refBlock = refs
    .map(
      (r, idx) =>
        `${idx + 1}. ${r.publicationNumber}
   Title: ${r.title}
   Abstract: ${(r.abstract ?? '').slice(0, 350) || '(none)'}
   CPC: ${(r.cpcCodes ?? []).slice(0, 6).join(', ') || '(none)'}
   Assignees: ${(r.assignees ?? []).slice(0, 3).join(', ') || '(none)'}`,
    )
    .join('\n\n');

  const user = `${featureBlock}

References:
${refBlock}

For each of the ${refs.length} references, emit a {publicationNumber, keep, reason} decision.`;

  const out = await llm.generateObject<typeof filterSchema>({
    schema: filterSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { temperature: 0.1, maxTokens: 4096 },
  });
  return filterSchema.parse(out).decisions;
}
