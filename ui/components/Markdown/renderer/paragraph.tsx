import { css, cx } from "@emotion/css";
import type { Node, Paragraph } from "@yozora/ast";
import { ImageReferenceType, ImageType } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";
import { NodesRenderer } from "../NodesRenderer";

/**
 * Render `paragraph`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#paragraph
 * @see https://www.npmjs.com/package/@yozora/tokenizer-paragraph
 */
export class ParagraphRenderer extends React.Component<Paragraph> {
  public override shouldComponentUpdate(nextProperties: Readonly<Paragraph>): boolean {
    const properties = this.props;
    return properties.children !== nextProperties.children;
  }

  public override render(): React.ReactElement {
    const childNodes: Node[] = this.props.children;

    // If there are some image / imageReferences element in the paragraph,
    // then wrapper the content with div to avoid the warnings such as:
    //
    //  validateDOMNesting(...): <figure> cannot appear as a descendant of <p>.
    const notValidParagraph: boolean = childNodes.some(
      child => child.type === ImageType || child.type === ImageReferenceType,
    );

    if (notValidParagraph) {
      return (
        <div className={paragraphDisplayCls}>
          <NodesRenderer nodes={childNodes} />
        </div>
      );
    }

    return (
      <p className={paragraphCls}>
        <NodesRenderer nodes={childNodes} />
      </p>
    );
  }
}

const paragraphCls: string = cx(
  astClasses.paragraph,
  css({
    overflow: "hidden",
    padding: 0,
    margin: "0px 0px 1.25em 0px",
    marginBottom: "1em",
    lineHeight: "1.8",
    hyphens: "auto",
    wordBreak: "normal",
    overflowWrap: "anywhere",
    "> :last-child": {
      marginBottom: 0,
    },
  }),
);
const paragraphDisplayCls: string = cx(
  paragraphCls,
  css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem 0",
    margin: 0,
  }),
);
