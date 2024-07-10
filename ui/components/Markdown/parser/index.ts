import { Paragraph, ParagraphType, Root, TextType } from "@yozora/ast";
import { GfmExParser as Parser } from "@yozora/parser-gfm-ex";

export const parser = new Parser({
  defaultParseOptions: {
    shouldReservePosition: false,
  },
});

export const hasHighlightContent = (content: string): boolean => {
  const data: Root = parser.parse(content);
  if (data.children.length === 0) return false;
  for (const node of data.children) {
    if (node.type !== ParagraphType) return true;

    const paragraph = node as Paragraph;
    if (paragraph.children.some(v => v.type !== TextType)) return true;
  }
  return false;
};
