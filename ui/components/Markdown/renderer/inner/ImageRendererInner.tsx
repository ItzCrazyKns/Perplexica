import { css } from "@emotion/css";
import React from "react";

interface IProps {
  src: string;
  alt: string;
  title: string | undefined;
  srcSet: string | undefined;
  sizes: string | undefined;
  loading: "eager" | "lazy" | undefined;
  className: string;
}

export class ImageRendererInner extends React.Component<IProps> {
  public override shouldComponentUpdate(nextProps: IProps): boolean {
    const props = this.props;
    return (
      props.src !== nextProps.src ||
      props.alt !== nextProps.alt ||
      props.title !== nextProps.title ||
      props.srcSet !== nextProps.srcSet ||
      props.sizes !== nextProps.sizes ||
      props.loading !== nextProps.loading ||
      props.className !== nextProps.className
    );
  }

  public override render(): React.ReactElement {
    const { src, alt, title, srcSet, sizes, loading, className } = this.props;
    return (
      <figure className={`${className} ${cls}`}>
        <img alt={alt} src={src} title={title} srcSet={srcSet} sizes={sizes} loading={loading} />
        {title && <figcaption>{title}</figcaption>}
      </figure>
    );
  }
}

const cls = css({
  boxSizing: "border-box",
  maxWidth: "80%", // Prevent images from overflowing the container.
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  margin: 0,
  "> img": {
    flex: "1 0 auto",
    boxSizing: "border-box",
    maxWidth: "100%",
    border: "1px solid var(--colorBorderImage)",
    boxShadow: "0 0 20px 1px rgba(126, 125, 150, 0.6)",
  },
  "> figcaption": {
    textAlign: "center",
    fontStyle: "italic",
    fontSize: "1em",
    color: "var(--colorImageTitle)",
  },
});
