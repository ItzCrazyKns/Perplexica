import { describe, it, expect } from 'vitest';
import { contentToBlocks } from './write';

const text = (content: string) => [{ type: 'text' as const, text: { content } }];

describe('contentToBlocks', () => {
  it('converts headings, paragraphs, bullets, and numbered items', () => {
    const blocks = contentToBlocks(
      '# Title\n\nBody text\n- item a\n- item b\n1. one\n2. two',
    );

    expect(blocks).toEqual([
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: text('Title') },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: text('Body text') },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: text('item a') },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: text('item b') },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: text('one') },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: text('two') },
      },
    ]);
  });

  it('maps ## and ### headings to heading_3', () => {
    const blocks = contentToBlocks('## Section\n### Sub section');
    expect(blocks.map((b) => b.type)).toEqual(['heading_3', 'heading_3']);
  });

  it('skips empty lines and empty headings', () => {
    expect(contentToBlocks('\n\n# \n\n')).toEqual([]);
    expect(contentToBlocks('a\n\n\nb')).toHaveLength(2);
  });

  it('returns an empty array for empty content', () => {
    expect(contentToBlocks('')).toEqual([]);
    expect(contentToBlocks('   ')).toEqual([]);
  });
});
