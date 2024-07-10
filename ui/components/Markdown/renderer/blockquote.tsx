import { css, cx } from "@emotion/css";
import type { Blockquote } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";
import { NodesRenderer } from "../NodesRenderer";

/**
 * Render `blockquote`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#blockquote
 * @see https://www.npmjs.com/package/@yozora/tokenizer-blockquote
 */
export class BlockquoteRenderer extends React.Component<Blockquote> {
  public override shouldComponentUpdate(nextProperties: Readonly<Blockquote>): boolean {
    const properties = this.props;
    return properties.children !== nextProperties.children;
  }

  public override render(): React.ReactElement {
    const childNodes = this.props.children;
    return (
      <blockquote className={cls}>
        <NodesRenderer nodes={childNodes} />
      </blockquote>
    );
  }
}

const cls = cx(
  astClasses.blockquote,
  css({
    boxSizing: "border-box",
    padding: "0.625em 1em",
    borderLeft: "0.25em solid var(--colorBorderBlockquote)",
    margin: "0px 0px 1.25em 0px",
    background: "var(--colorBgBlockquote)",
    boxShadow: "0 1px 2px 0 hsla(0deg, 0%, 0%, 0.1)",
    "> :last-child": {
      marginBottom: 0,
    },
  }),
);
