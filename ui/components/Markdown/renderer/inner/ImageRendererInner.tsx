import { css } from "@emotion/css";
import React from "react";

interface IProperties {
  src: string;
  alt: string;
  title: string | undefined;
  srcSet: string | undefined;
  sizes: string | undefined;
  loading: "eager" | "lazy" | undefined;
  className: string;
}

export class ImageRendererInner extends React.Component<IProperties> {
  public override shouldComponentUpdate(nextProperties: IProperties): boolean {
    const properties = this.props;
    return (
      properties.src !== nextProperties.src ||
      properties.alt !== nextProperties.alt ||
      properties.title !== nextProperties.title ||
      properties.srcSet !== nextProperties.srcSet ||
      properties.sizes !== nextProperties.sizes ||
      properties.loading !== nextProperties.loading ||
      properties.className !== nextProperties.className
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
