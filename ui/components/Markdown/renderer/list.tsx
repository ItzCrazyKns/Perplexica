import { css, cx } from "@emotion/css";
import type { List } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";
import { NodesRenderer } from "../NodesRenderer";

/**
 * Render `list`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#list
 * @see https://www.npmjs.com/package/@yozora/tokenizer-list
 */
export class ListRenderer extends React.Component<List> {
  public override shouldComponentUpdate(nextProperties: Readonly<List>): boolean {
    const properties = this.props;
    return (
      properties.ordered !== nextProperties.ordered ||
      properties.orderType !== nextProperties.orderType ||
      properties.start !== nextProperties.start ||
      properties.children !== nextProperties.children
    );
  }

  public override render(): React.ReactElement {
    const { ordered, orderType, start, children } = this.props;

    if (ordered) {
      return (
        <ol className={cls} type={orderType} start={start}>
          <NodesRenderer nodes={children} />
        </ol>
      );
    }

    return (
      <ul className={cls}>
        <NodesRenderer nodes={children} />
      </ul>
    );
  }
}

const cls = cx(
  astClasses.list,
  css({
    padding: "0px",
    margin: "0 0 1em 2em",
    lineHeight: "2",
    "> :last-child": {
      marginBottom: "0px",
    },
  }),
);
