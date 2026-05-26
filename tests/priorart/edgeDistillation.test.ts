import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import {
  distillEdges,
  patentableEdgeSchema,
} from '@/lib/agents/priorart/analysis/edgeDistillation';
import type { ReframeResult } from '@/lib/agents/priorart/analysis/deepResearchReframe';

const reframe: ReframeResult = {
  trueTechnicalPillars: [
    {
      pillar: 'vsock-based microVM GPU brokering',
      domainContext: 'cloud GPU virtualization (not electrical substations)',
      relatedKnownArt: ['Firecracker', 'gVisor nvproxy'],
    },
    {
      pillar: 'SM-partitioned async gio_uring',
      domainContext: 'GPU-direct I/O for KV cache',
      relatedKnownArt: ['Tutti (arXiv:2605.03375)'],
    },
  ],
  nonPatentPriorArt: [],
  refinedUsptoQueries: ['vsock GPU broker', 'gio_uring SM partition', 'inference admission'],
  refinedCpcClasses: ['G06N20', 'G06F9/50'],
  noiseDomainsToAvoid: ['electrical substations'],
  ambiguousTerms: [],
};

const sampleEdges = {
  edges: [
    {
      pillar: 'vsock-based microVM GPU brokering',
      priorArtSummaries: [
        { art: 'Firecracker', teaching: 'Per-tenant microVM with hardware isolation in <125ms.' },
        { art: 'gVisor nvproxy', teaching: 'User-space kernel that brokers GPU ioctls.' },
      ],
      combinationEdge:
        'Persistent host-side GPU VM + ephemeral worker microVMs attaching via vsock ioctl broker eliminates both per-tenant driver cold-boot AND noisy-neighbor latency in a single design.',
      emergentProperty:
        'Sub-second microVM boot AND zero per-tenant driver cold-boot tax, simultaneously — neither Firecracker nor nvproxy alone produces this.',
      suggestedClaimLanguage:
        'A multi-tenant inference system comprising: a persistent host-side virtual machine holding GPU driver state; one or more ephemeral worker microVMs configured to attach to the persistent VM via a virtio-vsock ioctl broker; wherein each worker microVM boots in under 125 ms without performing a GPU driver cold-boot.',
      benchmarkDelta: null,
      strength: 'strong' as const,
    },
    {
      pillar: 'SM-partitioned async gio_uring',
      priorArtSummaries: [
        { art: 'Tutti', teaching: 'gio_uring-driven async KV-cache offload using NVMe Submission/Completion queues mapped into GPU HBM.' },
      ],
      combinationEdge:
        'Adds hardware-isolated SM partitioning into separate Compute and I/O Control Domains so storage kernels never block latency-sensitive inference compute.',
      emergentProperty: 'Contractable P99.999 SLA as a property of the toolchain, not a measurement of the deployment.',
      suggestedClaimLanguage:
        'A method comprising: partitioning streaming multiprocessors of a GPU into a Compute Domain and an I/O Control Domain; using gio_uring submission queues mapped into GPU high-bandwidth memory to issue NVMe I/O exclusively from the I/O Control Domain; wherein inference workloads in the Compute Domain achieve a contracted P99.999 latency bound.',
      benchmarkDelta: 'Beats Tutti baseline on P99.999 jitter by 6x at K=2048 IOCTX batch.',
      strength: 'strong' as const,
    },
  ],
};

const wrap = (obj: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
});

describe('distillEdges', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('runs 2-call grounded→structured flow for gemini-2.5-pro and returns PatentableEdge[] in pillar order', async () => {
    generateContent
      .mockResolvedValueOnce({
        candidates: [{ content: { parts: [{ text: 'grounded prose analysis' }] } }],
      })
      .mockResolvedValueOnce(wrap(sampleEdges));

    const out = await distillEdges('Feature summary text', reframe, {
      apiKey: 'k',
      model: 'gemini-2.5-pro',
    });

    expect(out).toHaveLength(2);
    expect(out[0].pillar).toBe('vsock-based microVM GPU brokering');
    expect(out[1].pillar).toBe('SM-partitioned async gio_uring');
    expect(out.every((e) => patentableEdgeSchema.safeParse(e).success)).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(2);
    const first = generateContent.mock.calls[0][0];
    expect(first.config.tools).toEqual([{ googleSearch: {} }]);
  });

  it('runs single-call combined flow for gemini-3-pro', async () => {
    generateContent.mockResolvedValueOnce(wrap(sampleEdges));
    const out = await distillEdges('Feature', reframe, {
      apiKey: 'k',
      model: 'gemini-3-pro',
    });
    expect(out).toHaveLength(2);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const call = generateContent.mock.calls[0][0];
    expect(call.config.responseMimeType).toBe('application/json');
    expect(call.config.tools).toEqual([{ googleSearch: {} }]);
  });

  it('returns [] when reframe has no pillars (no LLM call)', async () => {
    const empty = await distillEdges(
      'Feature',
      { ...reframe, trueTechnicalPillars: [] },
      { apiKey: 'k', model: 'gemini-3-pro' },
    );
    expect(empty).toEqual([]);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('threads benchmarkDeltas into the prompt', async () => {
    generateContent.mockResolvedValueOnce(wrap(sampleEdges));
    await distillEdges('Feature', reframe, { apiKey: 'k', model: 'gemini-3-pro' }, {
      benchmarkDeltas: 'Beats X by 5x on Y',
    });
    const call = generateContent.mock.calls[0][0];
    expect(call.contents).toContain('Beats X by 5x on Y');
  });
});
