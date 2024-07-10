import { css, cx } from "@emotion/css";
import type { Heading } from "@yozora/ast";
import React from "react";
import { astClasses } from "../context";
import { NodesRenderer } from "../NodesRenderer";

type IHeading = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface IProperties extends Heading {
  linkIcon?: React.ReactNode;
}

/**
 * Render `heading` content.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#heading
 * @see https://www.npmjs.com/package/@yozora/tokenizer-heading
 */
export class HeadingRenderer extends React.Component<IProperties> {
  public override shouldComponentUpdate(nextProperties: Readonly<IProperties>): boolean {
    const properties = this.props;
    return (
      properties.depth !== nextProperties.depth ||
      properties.identifier !== nextProperties.identifier ||
      properties.children !== nextProperties.children ||
      properties.linkIcon !== nextProperties.linkIcon
    );
  }

  public override render(): React.ReactElement {
    const { depth, identifier, children, linkIcon = "¶" } = this.props;

    const id = identifier == null ? undefined : encodeURIComponent(identifier);
    const h: IHeading = ("h" + depth) as IHeading;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const H: any = h as keyof JSX.IntrinsicElements;
    const cls = cx(astClasses.heading, classes.heading, classes[h]);

    return (
      <H id={id} className={cls}>
        <p className={classes.content}>
          <NodesRenderer nodes={children} />
        </p>
        {identifier && (
          <a className={classes.anchor} href={"#" + id}>
            {linkIcon}
          </a>
        )}
      </H>
    );
  }
}

const anchorCls = css({
  flex: "0 0 3rem",
  paddingLeft: "0.5rem",
  color: "var(--colorLink)",
  opacity: 0,
  transition: "color 0.2s ease-in-out, opacity 0.2s ease-in-out",
  userSelect: "none",
  textDecoration: "none",
  "> svg": {
    overflow: "hidden",
    display: "inline-block",
    verticalAlign: "middle",
    fill: "currentColor",
  },
});

const classes = {
  heading: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "0px",
    margin: "0px 0px 1.25em 0px",
    marginBottom: "1em",
    lineHeight: "1.25",
    fontFamily: "var(--fontFamilyHeading)",
    color: "var(--colorHeading)",
    [`&:active .${anchorCls}`]: {
      opacity: 0.8,
      color: "var(--colorLinkActive)",
    },
    [`&&:hover .${anchorCls}`]: {
      opacity: 0.8,
      color: "var(--colorLinkHover)",
    },
  }),
  anchor: anchorCls,
  content: css({
    flex: "0 1 auto",
    minWidth: 0,
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "pre-wrap",
    lineHeight: "1.7",
  }),
  h1: css({
    padding: "0.3rem 0",
    borderBottom: "1px solid var(--colorBorderHeading)",
    fontSize: "2rem",
    fontStyle: "normal",
    fontWeight: 500,
  }),
  h2: css({
    padding: "0.3rem 0",
    borderBottom: "1px solid var(--colorBorderHeading)",
    fontSize: "1.5rem",
    fontStyle: "normal",
    fontWeight: 500,
    marginBottom: "0.875rem",
  }),
  h3: css({
    fontSize: "1.25rem",
    fontStyle: "normal",
    fontWeight: 500,
  }),
  h4: css({
    fontSize: "1rem",
    fontStyle: "normal",
    fontWeight: 500,
  }),
  h5: css({
    fontSize: "0.875rem",
    fontStyle: "normal",
    fontWeight: 500,
  }),
  h6: css({
    fontSize: "0.85rem",
    fontStyle: "normal",
    fontWeight: 500,
  }),
};
