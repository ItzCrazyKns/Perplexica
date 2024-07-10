import { css, cx } from "@emotion/css";
import type { Break } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";

/**
 * Render `break`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#break
 * @see https://www.npmjs.com/package/@yozora/tokenizer-break
 */
export class BreakRenderer extends React.Component<Break> {
  public override shouldComponentUpdate(): boolean {
    return false;
  }

  public override render(): React.ReactElement {
    return <br className={cls} />;
  }
}

const cls = cx(
  astClasses.break,
  css({
    boxSizing: "border-box",
  }),
);
