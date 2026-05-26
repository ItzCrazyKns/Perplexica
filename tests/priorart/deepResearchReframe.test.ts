import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import {
  deepResearchReframe,
  reframeResultSchema,
} from '@/lib/agents/priorart/analysis/deepResearchReframe';

const sampleResult = {
  trueTechnicalPillars: [
    {
      pillar: 'vsock-based microVM GPU brokering',
      domainContext: 'cloud GPU virtualization, NOT electrical substations',
      relatedKnownArt: ['Firecracker', 'gVisor nvproxy'],
    },
  ],
  nonPatentPriorArt: [
    {
      type: 'arxiv' as const,
      title: 'Tutti: SSD-Backed KV Cache',
      url: 'https://arxiv.org/abs/2605.03375',
      relevance: 'gio_uring async KV cache offload',
    },
  ],
  refinedUsptoQueries: [
    'GPU virtualization microVM passthrough',
    'inference admission control KV cache',
    'vsock guest host driver broker',
  ],
  refinedCpcClasses: ['G06N20', 'G06F9/50'],
  noiseDomainsToAvoid: ['electrical substations', 'lithium batteries'],
  ambiguousTerms: [
    {
      term: 'switchyard',
      intendedMeaning: 'inference exchange / control plane',
      collisions: ['electrical substation', 'JBoss SOA'],
    },
  ],
};

const wrapAsTextResponse = (obj: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
});

describe('deepResearchReframe', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('runs the 2-call grounded→structured flow for gemini-2.5-pro and returns a parsed ReframeResult', async () => {
    generateContent
      .mockResolvedValueOnce({
        candidates: [
          { content: { parts: [{ text: 'grounded analysis prose with URLs' }] } },
        ],
      })
      .mockResolvedValueOnce(wrapAsTextResponse(sampleResult));

    const out = await deepResearchReframe('feature description', {
      apiKey: 'k',
      model: 'gemini-2.5-pro',
    });

    expect(reframeResultSchema.safeParse(out).success).toBe(true);
    expect(out.trueTechnicalPillars).toHaveLength(1);
    expect(out.noiseDomainsToAvoid).toContain('electrical substations');

    expect(generateContent).toHaveBeenCalledTimes(2);
    const firstCall = generateContent.mock.calls[0][0];
    expect(firstCall.config.tools).toEqual([{ googleSearch: {} }]);
    const secondCall = generateContent.mock.calls[1][0];
    expect(secondCall.config.responseMimeType).toBe('application/json');
  });

  it('runs the single-call combined flow for gemini-3-pro', async () => {
    generateContent.mockResolvedValueOnce(wrapAsTextResponse(sampleResult));

    const out = await deepResearchReframe('feature', {
      apiKey: 'k',
      model: 'gemini-3-pro',
    });

    expect(out.refinedUsptoQueries).toHaveLength(3);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const call = generateContent.mock.calls[0][0];
    expect(call.config.tools).toEqual([{ googleSearch: {} }]);
    expect(call.config.responseMimeType).toBe('application/json');
  });

  it('throws when the SDK returns malformed JSON', async () => {
    generateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: 'not json' }] } }],
    });
    await expect(
      deepResearchReframe('feature', { apiKey: 'k', model: 'gemini-3-pro' }),
    ).rejects.toThrow();
  });
});
