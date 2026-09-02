import { describe, it, expect } from 'vitest';
import {
  fuzzyMatchPages,
  fuzzyRankPages,
  FUZZY_STRONG_SCORE,
  stripSurroundingQuotes,
} from './fuzzy';
import type { AuthorizedPage } from './types';

const exact: AuthorizedPage = {
  id: 'exact',
  title: '塔羅牌App開發BDD架構',
  type: 'page',
};
// Matches the query only because its content (not its title) mentions the
// spaced phrase — the exact bug the user hit with Notion's full-text search.
const contentMatch: AuthorizedPage = {
  id: 'wrong',
  title: '2026-06-29筆記 UX設計思維與產品開發流程',
  type: 'page',
};

describe('fuzzyRankPages', () => {
  it('ranks the exact CJK title above an incidental content match when the query has spaces', () => {
    const ranked = fuzzyRankPages(
      [contentMatch, exact],
      '塔羅牌 App 開發 BDD 架構',
    );
    expect(ranked[0].page.id).toBe('exact');
    expect(ranked[1].page.id).toBe('wrong');
  });

  it('gives the spaced query a strong score against the unspaced title', () => {
    const ranked = fuzzyRankPages([exact], '塔羅牌 App 開發 BDD 架構');
    expect(ranked[0].score).toBeGreaterThanOrEqual(FUZZY_STRONG_SCORE);
  });

  it('keeps a word-containment match below the strong threshold', () => {
    const ranked = fuzzyRankPages([contentMatch], '塔羅牌 App 開發 BDD 架構');
    expect(ranked[0].score).toBeLessThan(FUZZY_STRONG_SCORE);
  });

  it('strips corner-bracket quotes from the query before matching', () => {
    const ranked = fuzzyRankPages([exact], '「塔羅牌 App 開發 BDD 架構」');
    expect(ranked[0].page.id).toBe('exact');
  });

  it('delegates fuzzyMatchPages to the same ranked order', () => {
    expect(fuzzyMatchPages([contentMatch, exact], '塔羅牌 App 開發 BDD 架構')[0].id).toBe(
      'exact',
    );
  });
});

describe('stripSurroundingQuotes', () => {
  it('removes quote and corner-bracket pairs around a page name', () => {
    expect(stripSurroundingQuotes('「會議筆記」')).toBe('會議筆記');
    expect(stripSurroundingQuotes('"Meeting Notes"')).toBe('Meeting Notes');
    expect(stripSurroundingQuotes('“Meeting Notes”')).toBe('Meeting Notes');
    expect(stripSurroundingQuotes('‘單引號’')).toBe('單引號');
    expect(stripSurroundingQuotes('『雙引號』')).toBe('雙引號');
  });

  it('leaves an unquoted name untouched', () => {
    expect(stripSurroundingQuotes('塔羅牌 App 開發 BDD 架構')).toBe(
      '塔羅牌 App 開發 BDD 架構',
    );
  });

  it('collapses a quote-only name to empty', () => {
    expect(stripSurroundingQuotes('""')).toBe('');
  });
});
