import { useStateValue } from "@guanghechen/react-viewmodel";
import type { Code } from "@yozora/ast";
import { useNodeRendererContext, type INodeRenderer, IReactMarkdownThemeScheme } from "../context";
import { CodeRendererInner } from "./inner/CodeRendererInner";

/**
 * Render `code`
 *
 * @see https://www.npmjs.com/package/@yozora/ast#code
 * @see https://www.npmjs.com/package/@yozora/tokenizer-indented-code
 * @see https://www.npmjs.com/package/@yozora/tokenizer-fenced-code
 */
export const CodeRenderer: INodeRenderer<Code> = properties => {
  const { lang } = properties;
  const value: string = properties.value.replace(/[\n\r]+$/, ""); // Remove trailing line endings.

  const { viewmodel } = useNodeRendererContext();
  const preferCodeWrap: boolean = useStateValue(viewmodel.preferCodeWrap$);
  const showCodeLineno: boolean = useStateValue(viewmodel.showCodeLineno$);
  const themeScheme: IReactMarkdownThemeScheme = useStateValue(viewmodel.themeScheme$);
  const darken: boolean = themeScheme === "darken";

  return (
    <CodeRendererInner
      darken={darken}
      lang={lang ?? "text"}
      value={value}
      preferCodeWrap={preferCodeWrap}
      showCodeLineno={showCodeLineno}
    />
  );
};
