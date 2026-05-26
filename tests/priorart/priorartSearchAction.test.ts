import { describe, it, expect, vi, beforeEach } from 'vitest';

const odpSearch = vi.fn();
const bqSearch = vi.fn();
const odpFetch = vi.fn();
const bqFetch = vi.fn();

vi.mock('@/lib/agents/priorart/sources/usptoOdp', () => ({
  UsptoOdpSource: class {
    name = 'uspto_odp' as const;
    search = odpSearch;
    fetch = odpFetch;
  },
}));

vi.mock('@/lib/agents/priorart/sources/bigqueryPatents', () => ({
  BigQueryPatentsSource: class {
    name = 'bigquery_patents' as const;
    search = bqSearch;
    fetch = bqFetch;
  },
}));

vi.mock('@/lib/config', () => ({
  default: {
    getCurrentConfig: () => ({
      priorart: {
        usptoOdpApiKey: 'k',
        usptoOdpBaseUrl: 'https://api.uspto.gov',
        usptoOdpLegacyBaseUrl: 'https://developer.uspto.gov',
        oaUseLegacyHost: true,
        gcpProjectId: 'p',
        bigqueryPatentsDataset: 'patents-public-data.patents.publications',
        bigqueryBytesBilledCap: '1000000000',
        requestTimeoutSeconds: '30',
      },
    }),
  },
}));

import priorArtSearchAction from '@/lib/agents/search/researcher/actions/priorartSearch';

const makeDoc = (over: any) => ({
  publicationNumber: 'US-X',
  title: 't',
  assignees: [],
  inventors: [],
  cpcCodes: [],
  ipcCodes: [],
  source: 'uspto_odp' as const,
  ...over,
});

const fakeSession = {
  getBlock: vi.fn(() => ({
    id: 'rb',
    type: 'research',
    data: { subSteps: [] },
  })),
  emitBlock: vi.fn(),
};

const baseConfig = {
  llm: {} as any,
  embedding: {} as any,
  session: fakeSession as any,
  researchBlockId: 'rb',
  fileIds: [] as string[],
  mode: 'balanced' as const,
};

describe('priorartSearch action', () => {
  beforeEach(() => {
    odpSearch.mockReset();
    bqSearch.mockReset();
    fakeSession.getBlock.mockClear();
    fakeSession.emitBlock.mockClear();
  });

  it('registers under the expected name and enabled gate', () => {
    expect(priorArtSearchAction.name).toBe('priorart_search');
    const enabledTrue = priorArtSearchAction.enabled({
      classification: {
        classification: {
          skipSearch: false,
          personalSearch: false,
          academicSearch: false,
          discussionSearch: false,
          showWeatherWidget: false,
          showStockWidget: false,
          showCalculationWidget: false,
        },
        standaloneFollowUp: '',
      },
      fileIds: [],
      mode: 'balanced',
      sources: ['priorart'],
    });
    expect(enabledTrue).toBe(true);
    const enabledFalseNoSource = priorArtSearchAction.enabled({
      classification: {
        classification: {
          skipSearch: false,
          personalSearch: false,
          academicSearch: false,
          discussionSearch: false,
          showWeatherWidget: false,
          showStockWidget: false,
          showCalculationWidget: false,
        },
        standaloneFollowUp: '',
      },
      fileIds: [],
      mode: 'balanced',
      sources: ['web'],
    });
    expect(enabledFalseNoSource).toBe(false);
  });

  it('returns deduped chunks after date guard', async () => {
    odpSearch.mockResolvedValue([
      makeDoc({
        publicationNumber: 'US-1',
        publicationDate: '2024-01-01',
        title: 'A',
      }),
      makeDoc({
        publicationNumber: 'US-1',
        publicationDate: '2024-02-01',
        title: 'A dup family',
      }),
    ]);
    bqSearch.mockResolvedValue([
      makeDoc({
        publicationNumber: 'EP-2',
        publicationDate: '2024-03-01',
        title: 'B',
        source: 'bigquery_patents' as const,
      }),
      makeDoc({
        publicationNumber: 'US-3',
        publicationDate: '2026-12-01',
        title: 'too new',
        source: 'bigquery_patents' as const,
      }),
    ]);

    const out = await priorArtSearchAction.execute(
      { queries: ['merkle commitment'], priorityDate: '2025-01-01' },
      baseConfig,
    );

    expect(out.type).toBe('search_results');
    if (out.type !== 'search_results') throw new Error('unexpected');
    expect(out.results.map((r) => r.metadata.publicationNumber)).toEqual([
      'US-1',
      'EP-2',
    ]);
    expect(out.results[0].metadata.url).toContain('patents.google.com/patent/');
    expect(out.results[0].content).toContain('A');
  });

  it('returns empty (does not throw) on missing config', async () => {
    const mod = await import('@/lib/config');
    const original = mod.default.getCurrentConfig;
    (mod.default as any).getCurrentConfig = () => ({
      priorart: { usptoOdpApiKey: '', gcpProjectId: '' },
    });
    try {
      const out = await priorArtSearchAction.execute(
        { queries: ['merkle'] },
        baseConfig,
      );
      expect(out.type).toBe('search_results');
      if (out.type !== 'search_results') throw new Error('unexpected');
      expect(out.results).toEqual([]);
    } finally {
      (mod.default as any).getCurrentConfig = original;
    }
  });

  it('returns empty when both sources throw (catches per-source failures)', async () => {
    odpSearch.mockRejectedValue(new Error('odp down'));
    bqSearch.mockRejectedValue(new Error('bq down'));
    const out = await priorArtSearchAction.execute(
      { queries: ['merkle'], priorityDate: '2025-01-01' },
      baseConfig,
    );
    expect(out.type).toBe('search_results');
    if (out.type !== 'search_results') throw new Error('unexpected');
    expect(out.results).toEqual([]);
  });

  it('caps to 3 queries and trims blanks', async () => {
    odpSearch.mockResolvedValue([]);
    bqSearch.mockResolvedValue([]);
    await priorArtSearchAction.execute(
      { queries: ['a', '', 'b', 'c', 'd'], priorityDate: '2025-01-01' },
      baseConfig,
    );
    const plan = odpSearch.mock.calls[0][0];
    expect(plan.odpQueries).toHaveLength(3);
    expect(plan.odpQueries.map((q: any) => q.query)).toEqual(['a', 'b', 'c']);
  });

  it('emits searching subStep then reading subStep on success', async () => {
    odpSearch.mockResolvedValue([
      makeDoc({ publicationNumber: 'US-9', publicationDate: '2024-01-01' }),
    ]);
    bqSearch.mockResolvedValue([]);
    await priorArtSearchAction.execute(
      { queries: ['x'], priorityDate: '2025-01-01' },
      baseConfig,
    );
    expect(fakeSession.emitBlock).toHaveBeenCalledTimes(2);
    const lastCall = fakeSession.emitBlock.mock.calls[1][0] as any;
    const subSteps = lastCall.data.subSteps;
    expect(subSteps[0].type).toBe('searching');
    expect(subSteps[1].type).toBe('reading');
    expect(subSteps[1].reading).toHaveLength(1);
  });
});
