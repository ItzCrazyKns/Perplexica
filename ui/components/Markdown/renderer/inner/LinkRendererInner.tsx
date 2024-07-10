import { css, cx } from "@emotion/css";
import type { Node } from "@yozora/ast";
import React from "react";
import { NodesRenderer } from "../../NodesRenderer";

interface IProps {
  url: string;
  title: string | undefined;
  childNodes: Node[] | undefined;
  className: string;
}

export class LinkRendererInner extends React.Component<IProps> {
  public override shouldComponentUpdate(nextProps: Readonly<IProps>): boolean {
    const props = this.props;
    return (
      props.url !== nextProps.url ||
      props.title !== nextProps.title ||
      props.childNodes !== nextProps.childNodes ||
      props.className !== nextProps.className
    );
  }

  public override render(): React.ReactElement {
    const { url, title, childNodes, className } = this.props;
    return (
      <a className={cx(cls, className)} href={url} title={title} rel="noopener, noreferrer" target="_blank">
        <NodesRenderer nodes={childNodes} />
      </a>
    );
  }
}

const cls = css({
  padding: "0.2rem 0",
  color: "var(--colorLink)",
  textDecoration: "none",
  "&:active": {
    color: "var(--colorLinkActive)",
  },
  "&&:hover": {
    color: "var(--colorLinkHover)",
    textDecoration: "underline",
  },
  "&:visited": {
    color: "var(--colorLinkVisited)",
  },
});
