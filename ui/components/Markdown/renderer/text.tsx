import type { Text } from "@yozora/ast";
import React from "react";

/**
 * Render `text`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#text
 * @see https://www.npmjs.com/package/@yozora/tokenizer-text
 */
export class TextRenderer extends React.Component<Text> {
  public override shouldComponentUpdate(nextProps: Readonly<Text>): boolean {
    const props = this.props;
    return props.value !== nextProps.value;
  }

  public override render(): React.ReactElement {
    return <React.Fragment>{this.props.value}</React.Fragment>;
  }
}
