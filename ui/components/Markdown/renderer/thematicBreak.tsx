import { css, cx } from "@emotion/css";
import type { ThematicBreak } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";

/**
 * Render `thematicBreak`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#thematicBreak
 * @see https://www.npmjs.com/package/@yozora/tokenizer-thematic-break
 */
export class ThematicBreakRenderer extends React.Component<ThematicBreak> {
  public override shouldComponentUpdate(): boolean {
    return false;
  }

  public override render(): React.ReactElement {
    return <hr className={cls} />;
  }
}

const cls = cx(
  astClasses.thematicBreak,
  css({
    boxSizing: "content-box",
    display: "block",
    height: 0,
    width: "100%",
    padding: 0,
    border: 0,
    borderBottom: `1px solid #dadada`,
    outline: 0,
    margin: "1.5em 0px",
  }),
);
