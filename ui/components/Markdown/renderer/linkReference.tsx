import { useStateValue } from "@guanghechen/react-viewmodel";
import type { Definition, LinkReference } from "@yozora/ast";
import { useNodeRendererContext, type INodeRenderer, astClasses } from "../context";
import { LinkRendererInner } from "./inner/LinkRendererInner";

/**
 * Render `link-reference`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#linkReference
 * @see https://www.npmjs.com/package/@yozora/tokenizer-link-reference
 */
export const LinkReferenceRenderer: INodeRenderer<LinkReference> = properties => {
  const { viewmodel } = useNodeRendererContext();
  const definitionMap: Readonly<Record<string, Definition>> = useStateValue(viewmodel.definitionMap$);
  const definition = definitionMap[properties.identifier];
  const url: string = definition?.url ?? "";
  const title: string | undefined = definition?.title;
  return (
    <LinkRendererInner url={url} title={title} childNodes={properties.children} className={astClasses.linkReference} />
  );
};
