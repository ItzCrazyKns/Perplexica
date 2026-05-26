import { describe, it, expect, vi } from 'vitest';
import { computeCoverage } from '@/lib/agents/priorart/analysis/coverage';
import {
  LabeledTechnicalElement,
  RankedDocument,
} from '@/lib/agents/priorart/schemas';

const mkRef = (pub: string, text: string): RankedDocument => ({
  publicationNumber: pub,
  title: text,
  assignees: [],
  inventors: [],
  cpcCodes: [],
  ipcCodes: [],
  source: 'uspto_odp',
  fusedScore: 0.5,
  sourceRanks: {},
});

const makeEmbedder = (vectors: Record<string, number[]>) => ({
  embedText: vi.fn(async (texts: string[]) =>
    texts.map((t) => {
      const key = Object.keys(vectors).find((k) => t.includes(k));
      if (!key) throw new Error(`no mock vector for text starting "${t.slice(0, 40)}"`);
      return vectors[key];
    }),
  ),
  embedChunks: vi.fn(),
}) as any;

const elements: LabeledTechnicalElement[] = [
  {
    label: 'E1',
    name: 'admission control',
    description: 'multi-objective scoring of inference venues',
    noveltyHypothesis: 'KV-cache hit probability as first-class input',
  },
  {
    label: 'E2',
    name: 'federated capacity',
    description: 'signed offers across operator federation',
    noveltyHypothesis: 'cryptographically settled inter-operator delivery',
  },
  {
    label: 'E3',
    name: 'merkle agent memory',
    description: 'content-addressed state deltas',
    noveltyHypothesis: 'lattice composition reduces to single-agent ops',
  },
];

describe('computeCoverage', () => {
  it('buckets elements into likely_novel / partial / anticipated_risk', async () => {
    const embedder = makeEmbedder({
      'admission control': [1, 0, 0], // E1 element vec
      'federated capacity': [0, 1, 0], // E2 element vec
      'merkle agent memory': [0, 0, 1], // E3 element vec
      // Three refs that all match E1 (admission control), none match E2/E3
      'ref-admission-A': [1, 0, 0],
      'ref-admission-B': [0.9, 0.1, 0],
      'ref-admission-C': [0.85, 0.15, 0],
    });
    const refs = [
      mkRef('US-A', 'ref-admission-A'),
      mkRef('US-B', 'ref-admission-B'),
      mkRef('US-C', 'ref-admission-C'),
    ];
    const result = await computeCoverage(elements, refs, embedder, { threshold: 0.6 });
    expect(result.elementCoverage).toHaveLength(3);
    const e1 = result.elementCoverage.find((e) => e.label === 'E1')!;
    const e2 = result.elementCoverage.find((e) => e.label === 'E2')!;
    const e3 = result.elementCoverage.find((e) => e.label === 'E3')!;
    expect(e1.novelty).toBe('anticipated_risk');
    expect(e1.hitCount).toBe(3);
    expect(e2.novelty).toBe('likely_novel');
    expect(e2.hitCount).toBe(0);
    expect(e3.novelty).toBe('likely_novel');
    expect(e3.hitCount).toBe(0);
  });

  it('identifies primary reference when one ref covers ≥20% of elements', async () => {
    const embedder = makeEmbedder({
      'admission control': [1, 0, 0],
      'federated capacity': [0, 1, 0],
      'merkle agent memory': [0, 0, 1],
      // ref-broad matches E1 and E2 (covers 2/3 = 67%)
      'ref-broad': [0.7, 0.7, 0],
      'ref-narrow': [0.9, 0, 0],
    });
    const refs = [mkRef('US-broad', 'ref-broad'), mkRef('US-narrow', 'ref-narrow')];
    const result = await computeCoverage(elements, refs, embedder, { threshold: 0.6 });
    expect(result.primaryReference).not.toBeNull();
    expect(result.primaryReference!.publicationNumber).toBe('US-broad');
    expect(result.primaryReference!.coveredElements.sort()).toEqual(['E1', 'E2']);
    expect(result.primaryReference!.distinguishingElements).toEqual(['E3']);
    expect(result.primaryReference!.elementCoverageFraction).toBeCloseTo(2 / 3, 2);
  });

  it('returns null primaryReference when no ref covers ≥20%', async () => {
    const embedder = makeEmbedder({
      'admission control': [1, 0, 0],
      'federated capacity': [0, 1, 0],
      'merkle agent memory': [0, 0, 1],
      // None of these refs cover any element above threshold
      'ref-unrelated-A': [0.1, 0.1, 0.1],
      'ref-unrelated-B': [0.2, 0.2, 0.2],
    });
    const refs = [
      mkRef('US-A', 'ref-unrelated-A'),
      mkRef('US-B', 'ref-unrelated-B'),
    ];
    const result = await computeCoverage(elements, refs, embedder, {
      threshold: 0.6,
      primaryReferenceMinFraction: 0.2,
    });
    expect(result.primaryReference).toBeNull();
  });

  it('returns empty coverage when no elements or refs supplied', async () => {
    const embedder = makeEmbedder({});
    const out1 = await computeCoverage([], [mkRef('US-X', 'ref-x')], embedder, {
      threshold: 0.5,
    });
    expect(out1.elementCoverage).toEqual([]);
    expect(out1.primaryReference).toBeNull();
    const out2 = await computeCoverage(elements, [], embedder, { threshold: 0.5 });
    expect(out2.elementCoverage).toEqual([]);
    expect(out2.primaryReference).toBeNull();
  });
});
