import { describe, expect, it } from 'vitest';
import { computeTokensPerSecond, estimateTokenCount } from './metrics';

describe('estimateTokenCount', () => {
  it('returns 0 for empty or whitespace-only text', () => {
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('   \n\t ')).toBe(0);
  });

  it('estimates roughly 4/3 tokens per word', () => {
    // 3 words -> round(3 * 4/3) = 4
    expect(estimateTokenCount('one two three')).toBe(4);
    // 6 words -> round(6 * 4/3) = 8
    expect(estimateTokenCount('a b c d e f')).toBe(8);
  });

  it('ignores extra whitespace between words', () => {
    expect(estimateTokenCount('hello     world')).toBe(
      estimateTokenCount('hello world'),
    );
  });
});

describe('computeTokensPerSecond', () => {
  it('returns null when timestamps are missing', () => {
    expect(
      computeTokensPerSecond({ text: 'some words here' }),
    ).toBeNull();
    expect(
      computeTokensPerSecond({ responseStartedAt: 1000, text: 'some words' }),
    ).toBeNull();
  });

  it('returns null when duration is zero or negative', () => {
    expect(
      computeTokensPerSecond({
        responseStartedAt: 2000,
        completedAt: 2000,
        text: 'some words here',
      }),
    ).toBeNull();
    expect(
      computeTokensPerSecond({
        responseStartedAt: 3000,
        completedAt: 2000,
        text: 'some words here',
      }),
    ).toBeNull();
  });

  it('returns null when there is no text to count', () => {
    expect(
      computeTokensPerSecond({
        responseStartedAt: 0,
        completedAt: 1000,
        text: '',
      }),
    ).toBeNull();
  });

  it('computes tokens per second over the elapsed duration', () => {
    // 6 words -> 8 tokens, over 2 seconds -> 4 tok/s
    const result = computeTokensPerSecond({
      responseStartedAt: 1_000,
      completedAt: 3_000,
      text: 'a b c d e f',
    });
    expect(result).toBeCloseTo(4, 5);
  });
});
