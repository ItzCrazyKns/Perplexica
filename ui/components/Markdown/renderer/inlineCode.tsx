import { css, cx } from "@emotion/css";
import type { InlineCode } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";

/**
 * Render `inline-code`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#inlinecode
 * @see https://www.npmjs.com/package/@yozora/tokenizer-inline-code
 */
export class InlineCodeRenderer extends React.Component<InlineCode> {
  public override shouldComponentUpdate(nextProps: Readonly<InlineCode>): boolean {
    const props = this.props;
    return props.value !== nextProps.value;
  }

  public override render(): React.ReactElement {
    return <code className={cls}>{this.props.value}</code>;
  }
}

const cls = cx(
  astClasses.inlineCode,
  css({
    padding: "1px 4px",
    borderRadius: "4px",
    margin: 0,
    background: "hsla(210deg, 15%, 60%, 0.15)",
    lineHeight: "1.375",
    color: "var(--colorInlineCode)",
    fontFamily: "var(--fontFamilyCode)",
    fontSize: "min(1rem, 18px)",
    fontWeight: 500,
  }),
);
