import { describe, it, expect } from 'vitest';
import { extractCitations, stripUnverified } from '@/lib/agents/priorart/analysis/verifier';

describe('extractCitations', () => {
  it('finds US-style publication numbers', () => {
    const text = 'See US-20210123456-A1 and US20200012345A1 for prior art.';
    const out = extractCitations(text);
    expect(out).toContain('US20210123456A1');
    expect(out).toContain('US20200012345A1');
  });
  it('finds EP/WO style numbers', () => {
    const text = 'compare to EP-1234567 and WO2019123456';
    const out = extractCitations(text);
    expect(out).toContain('EP1234567');
    expect(out).toContain('WO2019123456');
  });
});

describe('stripUnverified', () => {
  it('replaces fabricated cites with sentinel', () => {
    const memo = { ref: 'See US20999999A1.' };
    const stripped = stripUnverified(memo, ['US20999999A1']) as typeof memo;
    expect(stripped.ref).toContain('[UNVERIFIED_CITATION_REMOVED]');
  });
});
