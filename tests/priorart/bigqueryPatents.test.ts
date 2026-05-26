import { describe, it, expect, vi } from 'vitest';
import { queryPlanSchema } from '@/lib/agents/priorart/schemas';

const dryRunBytes = vi.fn();
const queryFn = vi.fn();

vi.mock('@google-cloud/bigquery', () => {
  return {
    BigQuery: class {
      createQueryJob = vi.fn(async () => {
        const bytes = dryRunBytes();
        return [
          {
            metadata: {
              statistics: { totalBytesProcessed: bytes },
            },
          },
        ];
      });
      query = queryFn;
    },
  };
});

import bqFixture from './fixtures/bigquery_row_sample.json';
import { BigQueryPatentsSource } from '@/lib/agents/priorart/sources/bigqueryPatents';

const plan = queryPlanSchema.parse({
  odpQueries: [{ field: 'any', query: 'x' }],
  bigqueryFragments: [
    {
      whereClause:
        'EXISTS (SELECT 1 FROM UNNEST(title_localized) t WHERE LOWER(t.text) LIKE @term)',
      params: [{ name: 'term', type: 'STRING', value: '%merkle%' }],
    },
  ],
  semanticQueries: ['merkle'],
  cpcClasses: ['G06F16'],
  priorityDate: '2026-01-01',
});

describe('BigQueryPatentsSource', () => {
  it('refuses queries when dry-run estimate exceeds bytes-billed cap', async () => {
    dryRunBytes.mockReturnValueOnce(5_000_000_000);
    const src = new BigQueryPatentsSource({
      projectId: 'p',
      dataset: 'patents-public-data.patents.publications',
      bytesBilledCap: 1_000_000_000,
    });
    await expect(src.search(plan, 5)).rejects.toThrow(/exceeds cap/);
  });

  it('executes when dry-run is under cap and parameterizes inputs', async () => {
    dryRunBytes.mockReturnValueOnce(10_000_000);
    queryFn.mockResolvedValueOnce([[bqFixture]]);
    const src = new BigQueryPatentsSource({
      projectId: 'p',
      dataset: 'patents-public-data.patents.publications',
      bytesBilledCap: 1_000_000_000,
    });
    const docs = await src.search(plan, 5);
    expect(docs).toHaveLength(1);
    expect(docs[0].publicationNumber).toBe('US-20210123456-A1');
    expect(queryFn).toHaveBeenCalledTimes(1);
    const args = queryFn.mock.calls[0][0] as any;
    expect(args.query).not.toMatch(/--/);
    expect(args.params.term).toBe('%merkle%');
    expect(args.params.priorityDateInt).toBe(20260101);
    expect(args.params.rowLimit).toBe(5);
    expect(String(args.maximumBytesBilled)).toBe('1000000000');
  });
});
