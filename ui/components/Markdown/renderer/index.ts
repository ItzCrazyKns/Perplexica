import {
  BlockquoteType,
  BreakType,
  CodeType,
  DefinitionType,
  DeleteType,
  EmphasisType,
  HeadingType,
  HtmlType,
  ImageReferenceType,
  ImageType,
  InlineCodeType,
  LinkReferenceType,
  LinkType,
  ListItemType,
  ListType,
  ParagraphType,
  StrongType,
  TableType,
  TextType,
  ThematicBreakType,
} from "@yozora/ast";
import { INodeRendererMap } from "../context";
import { BlockquoteRenderer } from "./blockquote";
import { BreakRenderer } from "./break";
import { CodeRenderer } from "./code";
import { DeleteRenderer } from "./delete";
import { EmphasisRenderer } from "./emphasis";
import { HeadingRenderer } from "./heading";
import { ImageRenderer } from "./image";
import { ImageReferenceRenderer } from "./imageReference";
import { InlineCodeRenderer } from "./inlineCode";
import { LinkRenderer } from "./link";
import { LinkReferenceRenderer } from "./linkReference";
import { ListRenderer } from "./list";
import { ListItemRenderer } from "./listItem";
import { ParagraphRenderer } from "./paragraph";
import { StrongRenderer } from "./strong";
import { TableRenderer } from "./table";
import { TextRenderer } from "./text";
import { ThematicBreakRenderer } from "./thematicBreak";

export function buildNodeRendererMap(
  customizedRendererMap?: Readonly<Partial<INodeRendererMap>>,
): Readonly<INodeRendererMap> {
  if (customizedRendererMap == null) return defaultNodeRendererMap;

  let hasChanged = false;
  const result: INodeRendererMap = {} as unknown as INodeRendererMap;
  for (const [key, val] of Object.entries(customizedRendererMap)) {
    if (val && val !== defaultNodeRendererMap[key]) {
      hasChanged = true;
      result[key] = val;
    }
  }

  return hasChanged ? { ...defaultNodeRendererMap, ...result } : defaultNodeRendererMap;
}

// Default ast renderer map.
export const defaultNodeRendererMap: Readonly<INodeRendererMap> = {
  [BlockquoteType]: BlockquoteRenderer,
  [BreakType]: BreakRenderer,
  [CodeType]: CodeRenderer,
  [DefinitionType]: () => null,
  [DeleteType]: DeleteRenderer,
  [EmphasisType]: EmphasisRenderer,
  [HeadingType]: HeadingRenderer,
  [HtmlType]: () => null,
  [ImageType]: ImageRenderer,
  [ImageReferenceType]: ImageReferenceRenderer,
  [InlineCodeType]: InlineCodeRenderer,
  [LinkType]: LinkRenderer,
  [LinkReferenceType]: LinkReferenceRenderer,
  [ListType]: ListRenderer,
  [ListItemType]: ListItemRenderer,
  [ParagraphType]: ParagraphRenderer,
  [StrongType]: StrongRenderer,
  [TableType]: TableRenderer,
  [TextType]: TextRenderer,
  [ThematicBreakType]: ThematicBreakRenderer,
  _fallback: function ReactMarkdownNodeFallback(node, key) {
    // eslint-disable-next-line no-console
    console.warn(`Cannot find render for \`${node.type}\` type node with key \`${key}\`:`, node);
    return null;
  },
};
