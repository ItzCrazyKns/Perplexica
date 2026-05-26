import { describe, it, expect, vi } from 'vitest';
import { parseFeature } from '@/lib/agents/priorart/analysis/featureParser';
import { featureProfileSchema } from '@/lib/agents/priorart/schemas';

const fakeLlm = {
  generateObject: vi.fn(async () => ({
    featureId: 'switchyard-routing',
    title: 'Switchyard routing',
    summary: 'Routes sovereign capital flow events to subscribers.',
    technicalElements: [
      {
        name: 'merkle commitment',
        description: 'Per-event vector + merkle root.',
        noveltyHypothesis: 'Combines streaming embedding with cryptographic commitment.',
      },
    ],
    cpcClassesSuggested: ['G06F16'],
    keywordClusters: [{ label: 'routing', terms: ['event routing'] }],
    semanticQueries: ['streaming embedding merkle'],
    componentTechnologies: ['merkle-tree state commitment'],
  })),
} as any;

describe('parseFeature', () => {
  it('returns a profile that matches the schema', async () => {
    const profile = await parseFeature(fakeLlm, 'Switchyard description body.');
    expect(featureProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile.featureId).toBe('switchyard-routing');
    expect(fakeLlm.generateObject).toHaveBeenCalledTimes(1);
    const call = fakeLlm.generateObject.mock.calls[0][0];
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[1].role).toBe('user');
    expect(call.messages[1].content).toContain('Switchyard description body.');
  });
});
