import { css, cx } from "@emotion/css";
import type { Emphasis, Node } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";
import { NodesRenderer } from "../NodesRenderer";

/**
 * Render `emphasis`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#emphasis
 * @see https://www.npmjs.com/package/@yozora/tokenizer-emphasis
 */
export class EmphasisRenderer extends React.Component<Emphasis> {
  public override shouldComponentUpdate(nextProperties: Readonly<Emphasis>): boolean {
    const properties = this.props;
    return properties.children !== nextProperties.children;
  }

  public override render(): React.ReactElement {
    const childNodes: Node[] = this.props.children;
    return (
      <em className={cls}>
        <NodesRenderer nodes={childNodes} />
      </em>
    );
  }
}

const cls = cx(
  astClasses.emphasis,
  css({
    fontStyle: "italic",
    margin: "0 6px 0 2px",
  }),
);
