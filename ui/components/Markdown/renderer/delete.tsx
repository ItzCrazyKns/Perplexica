import { css, cx } from "@emotion/css";
import type { Delete, Node } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";
import { NodesRenderer } from "../NodesRenderer";

/**
 * Render `delete`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#delete
 * @see https://www.npmjs.com/package/@yozora/tokenizer-delete
 */
export class DeleteRenderer extends React.Component<Delete> {
  public override shouldComponentUpdate(nextProperties: Readonly<Delete>): boolean {
    const properties = this.props;
    return properties.children !== nextProperties.children;
  }

  public override render(): React.ReactElement {
    const childNodes: Node[] = this.props.children;
    return (
      <del className={cls}>
        <NodesRenderer nodes={childNodes} />
      </del>
    );
  }
}

const cls = cx(
  astClasses.delete,
  css({
    marginRight: "4px",
    color: "var(--colorDelete)",
    fontStyle: "italic",
    textDecoration: "line-through",
  }),
);
