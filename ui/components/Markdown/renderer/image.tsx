import type { Image } from "@yozora/ast";
import React from "react";
import type { INodeRenderer } from "../context";
import { astClasses } from "../context";
import { ImageRendererInner } from "./inner/ImageRendererInner";

/**
 * Render `image`.
 *
 * @see https://www.npmjs.com/package/@yozora/ast#image
 * @see https://www.npmjs.com/package/@yozora/tokenizer-image
 */
export const ImageRenderer: INodeRenderer<Image> = properties => {
  const {
    url: source,
    alt,
    title,
    srcSet,
    sizes,
    loading,
  } = properties as Image & React.ImgHTMLAttributes<HTMLElement>;

  return (
    <ImageRendererInner
      alt={alt}
      src={source}
      title={title}
      srcSet={srcSet}
      sizes={sizes}
      loading={loading}
      className={astClasses.image}
    />
  );
};
