import type {
  Definition,
  Blockquote,
  BlockquoteType,
  Break,
  BreakType,
  Code,
  CodeType,
  DefinitionType,
  Delete,
  DeleteType,
  Emphasis,
  EmphasisType,
  Heading,
  HeadingType,
  Image,
  ImageReference,
  ImageReferenceType,
  ImageType,
  InlineCode,
  InlineCodeType,
  Link,
  LinkReference,
  LinkReferenceType,
  LinkType,
  List,
  ListItem,
  ListItemType,
  ListType,
  Node,
  Paragraph,
  ParagraphType,
  Strong,
  StrongType,
  Table,
  TableType,
  Text,
  TextType,
  ThematicBreak,
  ThematicBreakType,
} from "@yozora/ast";
import type React from "react";

// Renderer for markdown AST node.
export type INodeRenderer<T extends Node = Node> = React.ComponentType<T> | React.FC<T>;

/**
 * Renderer map.
 */
export interface INodeRendererMap {
  [BlockquoteType]: INodeRenderer<Blockquote>;
  [BreakType]: INodeRenderer<Break>;
  [CodeType]: INodeRenderer<Code>;
  [DefinitionType]: INodeRenderer<Definition>;
  [DeleteType]: INodeRenderer<Delete>;
  [EmphasisType]: INodeRenderer<Emphasis>;
  [HeadingType]: INodeRenderer<Heading>;
  [ImageType]: INodeRenderer<Image>;
  [ImageReferenceType]: INodeRenderer<ImageReference>;
  [InlineCodeType]: INodeRenderer<InlineCode>;
  [LinkType]: INodeRenderer<Link>;
  [LinkReferenceType]: INodeRenderer<LinkReference>;
  [ListType]: INodeRenderer<List>;
  [ListItemType]: INodeRenderer<ListItem>;
  [ParagraphType]: INodeRenderer<Paragraph>;
  [StrongType]: INodeRenderer<Strong>;
  [TableType]: INodeRenderer<Table>;
  [TextType]: INodeRenderer<Text>;
  [ThematicBreakType]: INodeRenderer<ThematicBreak>;
  _fallback: INodeRenderer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: INodeRenderer<Node & any>;
}
