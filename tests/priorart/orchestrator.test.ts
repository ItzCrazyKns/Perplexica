import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MEMO_DISCLAIMER, memoSkeletonSchema } from '@/lib/agents/priorart/schemas';

const dryRunBytes = vi.fn(() => 1_000_000);
const queryFn = vi.fn(async () => [[]]);

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: class {
    createQueryJob = vi.fn(async () => [
      { metadata: { statistics: { totalBytesProcessed: dryRunBytes() } } },
    ]);
    query = queryFn;
  },
}));

vi.mock('@/lib/agents/priorart/sources/usptoOdp', () => ({
  UsptoOdpSource: class {
    name = 'uspto_odp' as const;
    async search() {
      return [
        {
          publicationNumber: 'US-11111111-B1',
          title: 'Existing system',
          abstract: 'a',
          filingDate: '2018-01-01',
          publicationDate: '2019-01-01',
          assignees: ['Acme'],
          inventors: ['I'],
          cpcCodes: ['G06F16'],
          ipcCodes: [],
          source: 'uspto_odp' as const,
        },
      ];
    }
    async fetch() {
      return null;
    }
  },
}));

const llm = {
  generateObject: vi.fn(async ({ schema }: any) => {
    if (String(schema._def.shape.featureId)) {
      // FeatureProfile
      return schemaResponses.featureProfile;
    }
    return {};
  }),
} as any;

const embedder = {
  embedText: vi.fn(async (texts: string[]) => texts.map(() => new Array(8).fill(0))),
  embedChunks: vi.fn(),
} as any;

const schemaResponses: any = {
  featureProfile: {
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
  },
  queryPlan: {
    odpQueries: [{ field: 'any', query: 'merkle commitment' }],
    bigqueryFragments: [{ whereClause: '1=1', params: [] }],
    semanticQueries: ['merkle commitment'],
    cpcClasses: ['G06F16'],
    priorityDate: '2026-01-01',
  },
  landscape: {
    topAssignees: [{ name: 'Acme', count: 1 }],
    cpcDistribution: [{ code: 'G06F16', count: 1 }],
    highlyCitedReferences: [],
    citationClusters: [],
    whitespaceCandidates: ['merkle commit + streaming embedding'],
  },
  memo: {
    featureDescription: 'Switchyard routes capital events.',
    searchStrategy: {
      cpcClasses: ['G06F16'],
      keywordClusters: ['routing'],
      priorityDate: '2026-01-01',
      sources: ['USPTO ODP'],
    },
    landscapeFindings: {
      topAssignees: [{ name: 'Acme', count: 1 }],
      cpcDistribution: [{ code: 'G06F16', count: 1 }],
      highlyCitedReferences: [],
      citationClusters: [],
      whitespaceCandidates: [],
    },
    referencesOfInterest: [
      {
        publicationNumber: 'US-11111111-B1',
        title: 'Existing system',
        relevanceNote: 'baseline routing system',
      },
    ],
    claimChart: null,
    openQuestionsForCounsel: ['Confirm assignee portfolio for Acme'],
    verificationWarnings: [],
  },
};

// route generateObject calls to the right schema response
llm.generateObject.mockImplementation(async ({ schema }: any) => {
  const keys = Object.keys((schema as any).shape ?? (schema as any)._def?.shape ?? {});
  if (keys.includes('featureId')) return schemaResponses.featureProfile;
  if (keys.includes('odpQueries')) return schemaResponses.queryPlan;
  if (keys.includes('topAssignees')) return schemaResponses.landscape;
  if (keys.includes('featureDescription')) return schemaResponses.memo;
  return {};
});

import { runPriorArt } from '@/lib/agents/priorart/orchestrator';

describe('priorart orchestrator e2e', () => {
  let tmpRoot = '';
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'priorart-'));
  });
  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('runs all 7 steps and writes a memo that carries the not-legal-opinion label', async () => {
    const result = await runPriorArt(
      {
        featureDescription:
          'Switchyard routes sovereign capital flow events to subscribers via merkle-committed streaming embeddings.',
        priorityDate: '2026-01-01',
        mode: 'clear',
      },
      {
        llm,
        embedder,
        uspto: {
          apiKey: 'k',
          baseUrl: 'https://api.uspto.gov',
          legacyBaseUrl: 'https://developer.uspto.gov',
          oaUseLegacyHost: true,
          requestTimeoutMs: 5000,
        },
        bigquery: {
          projectId: 'p',
          dataset: 'patents-public-data.patents.publications',
          bytesBilledCap: 1_000_000_000,
        },
        workspaceRoot: path.join(tmpRoot, 'workspaces'),
        vectorStoreRoot: path.join(tmpRoot, 'vectors'),
        maxResultsPerSource: 10,
        maxDocumentsToEmbed: 10,
        embeddingDimension: 8,
        topK: 5,
        coverageThreshold: 0.55,
      },
    );
    expect(fs.existsSync(result.markdownPath)).toBe(true);
    const md = fs.readFileSync(result.markdownPath, 'utf-8');
    expect(md).toContain(MEMO_DISCLAIMER);
    expect(md.indexOf(MEMO_DISCLAIMER)).toBeLessThan(md.lastIndexOf(MEMO_DISCLAIMER));
    expect(memoSkeletonSchema.safeParse(result.memo).success).toBe(true);
  });
});
