import { describe, it, expect, vi } from 'vitest';
import { planQueries } from '@/lib/agents/priorart/retrieval/queryPlanner';
import { queryPlanSchema, FeatureProfile } from '@/lib/agents/priorart/schemas';

const profile: FeatureProfile = {
  featureId: 'switchyard',
  title: 'Switchyard',
  summary: '...',
  technicalElements: [
    {
      name: 'streaming embedding',
      description: 'vec + merkle',
      noveltyHypothesis: 'combo is novel',
    },
  ],
  cpcClassesSuggested: ['G06F16'],
  keywordClusters: [{ label: 'routing', terms: ['event routing'] }],
  semanticQueries: ['streaming embedding'],
  componentTechnologies: ['merkle commitment'],
};

const fakeLlm = {
  generateObject: vi.fn(async () => ({
    odpQueries: [{ field: 'any', query: 'merkle commitment AND streaming' }],
    bigqueryFragments: [
      {
        whereClause: '1=1',
        params: [],
      },
    ],
    semanticQueries: ['streaming merkle commitment'],
    cpcClasses: ['G06F16'],
    priorityDate: '2026-01-01',
  })),
} as any;

describe('planQueries', () => {
  it('produces a schema-valid plan and respects supplied priority date', async () => {
    const plan = await planQueries(fakeLlm, profile, undefined, '2026-03-01');
    expect(queryPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.priorityDate).toBe('2026-03-01');
  });
});
