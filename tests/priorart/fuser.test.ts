import { describe, it, expect } from 'vitest';
import { reciprocalRankFuse, familyPrefix } from '@/lib/agents/priorart/retrieval/fuser';
import { PatentDocument } from '@/lib/agents/priorart/schemas';

const make = (pub: string): PatentDocument => ({
  publicationNumber: pub,
  title: pub,
  assignees: [],
  inventors: [],
  cpcCodes: [],
  ipcCodes: [],
  source: 'uspto_odp',
});

describe('familyPrefix', () => {
  it('strips hyphens', () => {
    expect(familyPrefix('US-20210123456-A1')).toBe('US20210123456');
  });
  it('handles missing hyphens', () => {
    expect(familyPrefix('US20210123456A1')).toBe('US20210123456');
  });
});

describe('reciprocalRankFuse', () => {
  it('fuses ranks across signals and dedupes families', () => {
    const docs = [
      make('US-1'),
      make('US-2'),
      make('EP-3'),
      make('US-1'), // duplicate family
    ];
    const fused = reciprocalRankFuse(
      docs,
      [
        { signal: 'odp', ranking: ['US-1', 'US-2', 'EP-3'] },
        { signal: 'bigquery', ranking: ['EP-3', 'US-1'] },
        { signal: 'semantic', ranking: ['US-2'] },
      ],
      10,
    );
    expect(fused).toHaveLength(3);
    expect(fused[0].publicationNumber).toBe('US-1');
    expect(fused[0].sourceRanks.odp).toBe(1);
    expect(fused[0].sourceRanks.bigquery).toBe(2);
  });
});
