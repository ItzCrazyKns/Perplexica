import BaseLLM from '@/lib/models/base/llm';
import { FeatureProfile, featureProfileSchema } from '../schemas';
import { loadPrompt, renderPrompt } from '../prompts';

export async function parseFeature(
  llm: BaseLLM<unknown>,
  featureDescription: string,
  pillarsContext?: string[],
): Promise<FeatureProfile> {
  const system = loadPrompt('system');
  const pillarsBlock =
    pillarsContext && pillarsContext.length
      ? `\n\nReframe context (grounded technical pillars from Deep Research):\n${pillarsContext
          .map((p) => `- ${p}`)
          .join(
            '\n',
          )}\n\nUse these as the authoritative interpretation of the feature's technical domain. Disregard any surface-level term collisions; the pillars name the actual subject matter.`
      : '';
  const user =
    renderPrompt('featureExtraction', {
      feature_description: featureDescription,
    }) + pillarsBlock;
  const profile = await llm.generateObject<typeof featureProfileSchema>({
    schema: featureProfileSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { temperature: 0.2, maxTokens: 8192 },
  });
  return featureProfileSchema.parse(profile);
}
