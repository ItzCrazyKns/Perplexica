import type { Link } from "@yozora/ast";
import { astClasses, type INodeRenderer } from "../context";
import { LinkRendererInner } from "./inner/LinkRendererInner";

/**
 * Render `link`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#link
 * @see https://www.npmjs.com/package/@yozora/tokenizer-link
 * @see https://www.npmjs.com/package/@yozora/tokenizer-autolink
 * @see https://www.npmjs.com/package/@yozora/tokenizer-autolink-extension
 */
export const LinkRenderer: INodeRenderer<Link> = props => {
  const { url, title, children: childNodes } = props;
  return <LinkRendererInner url={url} title={title} childNodes={childNodes} className={astClasses.link} />;
};
