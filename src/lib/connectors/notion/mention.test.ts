import { describe, it, expect } from 'vitest';
import {
  hasNotionMention,
  parseNotionMentions,
  resolveMention,
} from './mention';
import type { AuthorizedPage } from './types';

const pages: AuthorizedPage[] = [
  { id: 'p1', title: 'Meeting Notes', type: 'page' },
  { id: 'p2', title: 'Product Roadmap', type: 'page' },
  { id: 'd1', title: 'Projects DB', type: 'database' },
];

describe('hasNotionMention', () => {
  it('detects the mention case-insensitively', () => {
    expect(hasNotionMention('讀 @Notion 會議筆記')).toBe(true);
    expect(hasNotionMention('讀 @notion 會議筆記')).toBe(true);
    expect(hasNotionMention('一般問題')).toBe(false);
    expect(hasNotionMention('Notion 是很好的工具')).toBe(false);
  });
});

describe('parseNotionMentions', () => {
  it('strips the marker and keeps the hint in the message text', () => {
    const { cleaned, names } = parseNotionMentions(
      '用 @Notion 會議筆記 幫我總結',
    );
    expect(cleaned).toBe('用 會議筆記 幫我總結');
    expect(names).toEqual(['會議筆記 幫我總結']);
  });

  it('bounds the name hint at sentence punctuation', () => {
    const { cleaned, names } = parseNotionMentions(
      '用 @Notion 會議筆記。幫我總結',
    );
    expect(cleaned).toBe('用 會議筆記。幫我總結');
    expect(names).toEqual(['會議筆記']);
  });

  it('handles multiple mentions', () => {
    const { cleaned, names } = parseNotionMentions(
      '@Notion Meeting Notes 和 @Notion 產品路線圖 的重點？',
    );
    expect(cleaned).toBe('Meeting Notes 和 產品路線圖 的重點？');
    expect(names).toEqual(['Meeting Notes 和', '產品路線圖 的重點']);
  });

  it('keeps the question text after a bare mention', () => {
    const { cleaned, names } = parseNotionMentions('@Notion 有什麼筆記？');
    expect(cleaned).toBe('有什麼筆記？');
    expect(names).toEqual(['有什麼筆記']);
  });

  it('leaves content untouched without mentions', () => {
    const { cleaned, names } = parseNotionMentions('一般問題');
    expect(cleaned).toBe('一般問題');
    expect(names).toEqual([]);
  });

  it('does not treat similar words as mentions', () => {
    const { cleaned, names } = parseNotionMentions('@Notionally 是一個字');
    expect(cleaned).toBe('@Notionally 是一個字');
    expect(names).toEqual([]);
  });

  it('consumes only the whitespace left by the marker, not the whole message', () => {
    const { cleaned, names } = parseNotionMentions(
      '用 @Notion 會議筆記  幫我總結',
    );
    // Marker + following spaces collapse to one space; other runs untouched.
    expect(cleaned).toBe('用 會議筆記  幫我總結');
    expect(names).toEqual(['會議筆記  幫我總結']);
  });

  it('does not collapse intentional newlines after the mention', () => {
    const { cleaned, names } = parseNotionMentions(
      '用 @Notion 會議筆記\n\n第二段',
    );
    expect(cleaned).toBe('用 會議筆記\n\n第二段');
    expect(names).toEqual(['會議筆記']);
  });
});

describe('resolveMention', () => {
  it('resolves a name through fuzzy search, tolerating trailing words', () => {
    expect(resolveMention(pages, 'Meeting Notes')?.id).toBe('p1');
    // Leading-word matching still finds the page with extra trailing text.
    expect(resolveMention(pages, 'Meeting Notes 和')?.id).toBe('p1');
    expect(resolveMention(pages, 'meet')?.id).toBe('p1');
  });

  it('returns null when nothing matches', () => {
    expect(resolveMention(pages, 'xyzzy')).toBeNull();
  });
});
