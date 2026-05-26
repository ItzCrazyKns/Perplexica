import { describe, it, expect } from 'vitest';
import { applyDateGuard, isStrictlyBefore } from '@/lib/agents/priorart/analysis/dateGuard';
import { PatentDocument } from '@/lib/agents/priorart/schemas';

const make = (over: Partial<PatentDocument>): PatentDocument => ({
  publicationNumber: 'US-X',
  title: 't',
  assignees: [],
  inventors: [],
  cpcCodes: [],
  ipcCodes: [],
  source: 'uspto_odp',
  ...over,
});

describe('isStrictlyBefore', () => {
  it('returns false on undefined', () => {
    expect(isStrictlyBefore(undefined, '2025-01-01')).toBe(false);
  });
  it('returns false on equal dates (strict-before required)', () => {
    expect(isStrictlyBefore('2025-01-01', '2025-01-01')).toBe(false);
  });
  it('returns true when candidate is earlier', () => {
    expect(isStrictlyBefore('2024-12-31', '2025-01-01')).toBe(true);
  });
  it('returns false when candidate is later', () => {
    expect(isStrictlyBefore('2025-01-02', '2025-01-01')).toBe(false);
  });
});

describe('applyDateGuard', () => {
  it('excludes equal-date references (§102 strict-before)', () => {
    const docs = [
      make({ publicationNumber: 'A', publicationDate: '2025-01-01' }),
      make({ publicationNumber: 'B', publicationDate: '2024-12-31' }),
      make({ publicationNumber: 'C', publicationDate: '2025-06-01' }),
    ];
    const kept = applyDateGuard(docs, '2025-01-01');
    expect(kept.map((d) => d.publicationNumber)).toEqual(['B']);
  });
  it('excludes refs missing both publication and filing dates', () => {
    const docs = [make({ publicationNumber: 'A' })];
    expect(applyDateGuard(docs, '2025-01-01')).toEqual([]);
  });
  it('keeps when filing date is before even if publicationDate is later', () => {
    const docs = [
      make({
        publicationNumber: 'A',
        filingDate: '2023-05-01',
        publicationDate: '2026-05-01',
      }),
    ];
    expect(applyDateGuard(docs, '2025-01-01')).toHaveLength(1);
  });
});
