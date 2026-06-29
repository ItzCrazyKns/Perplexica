import { describe, expect, it } from 'vitest';
import { cn, formatTimeDifference } from './utils';

describe('cn', () => {
  it('joins truthy class values', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('merges conflicting tailwind classes, keeping the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('formatTimeDifference', () => {
  it('formats a difference in seconds', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T00:00:30Z');
    expect(formatTimeDifference(a, b)).toBe('30 seconds');
  });

  it('formats a difference in minutes', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T00:05:00Z');
    expect(formatTimeDifference(a, b)).toBe('5 minutes');
  });

  it('uses singular units where appropriate', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T01:00:00Z');
    expect(formatTimeDifference(a, b)).toBe('1 hour');
  });
});
