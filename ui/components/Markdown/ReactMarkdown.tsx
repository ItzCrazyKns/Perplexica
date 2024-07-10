import { css, cx } from "@emotion/css";
import { Definition, Root } from "@yozora/ast";
import { calcDefinitionMap } from "@yozora/ast-util";
import React from "react";
import {
  INodeRendererContext,
  INodeRendererMap,
  IReactMarkdownThemeScheme,
  NodeRendererContextType,
  ReactMarkdownViewModel,
  astClasses,
} from "./context";
import { NodesRenderer } from "./NodesRenderer";
import { parser } from "./parser";
import { buildNodeRendererMap } from "./renderer";

export interface IMarkdownProperties {
  /**
   * Text content of markdown.
   */
  text: string | string[];
  /**
   * Customized node renderer mpa.
   */
  customizedRendererMap?: Readonly<Partial<INodeRendererMap>>;
  /**
   * React markdown theme scheme.
   */
  themeScheme?: IReactMarkdownThemeScheme;
  /**
   * Preset Link / Image reference definitions.
   */
  presetDefinitionMap?: Readonly<Record<string, Definition>>;
  /**
   * Prefer code wrap.
   *
   * !!! Since the lineno would be weird if the code is wrapped,
   * !!! so the lineno will be hidden if the `preferCodeWrap` set to `true`.
   */
  preferCodeWrap?: boolean;
  /**
   * Whether if show lineno for code block.
   */
  showCodeLineno?: boolean;
  /**
   * Root css class of the component.
   */
  className?: string;
  /**
   * Root css style.
   */
  style?: React.CSSProperties;
}

export const ReactMarkdown: React.FC<IMarkdownProperties> = properties => {
  const {
    presetDefinitionMap,
    customizedRendererMap,
    preferCodeWrap = false,
    showCodeLineno = true,
    text,
    themeScheme = "lighten",
    className,
    style,
  } = properties;
  const ast: Root = React.useMemo(() => {
    const asts: Root[] = Array.isArray(text) ? text.map(t => parser.parse(t)) : [parser.parse(text)];
    if (asts.length === 0) {
      return parser.parse("");
    }
    const root: Root = asts[0];
    for (let index = 1; index < asts.length; ++index) {
      root.children.push(...asts[index].children);
    }
    return root;
  }, [text]);
  const definitionMap: Record<string, Readonly<Definition>> = React.useMemo(
    () => calcDefinitionMap(ast).definitionMap,
    [ast],
  );

  const [viewmodel] = React.useState<ReactMarkdownViewModel>(
    () =>
      new ReactMarkdownViewModel({
        definitionMap: {
          ...presetDefinitionMap,
          ...definitionMap,
        },
        rendererMap: buildNodeRendererMap(customizedRendererMap),
        preferCodeWrap,
        showCodeLineno,
        themeScheme,
      }),
  );
  const context = React.useMemo<INodeRendererContext>(() => ({ viewmodel }), [viewmodel]);

  const cls: string = cx(rootCls, themeScheme === "darken" && astClasses.rootDarken, className);

  React.useEffect(() => {
    viewmodel.preferCodeWrap$.next(preferCodeWrap);
  }, [viewmodel, preferCodeWrap]);

  React.useEffect(() => {
    viewmodel.showCodeLineno$.next(showCodeLineno);
  }, [viewmodel, showCodeLineno]);

  React.useEffect(() => {
    viewmodel.themeScheme$.next(themeScheme);
  }, [viewmodel, themeScheme]);

  return (
    <div className={cls} style={style}>
      <NodeRendererContextType.Provider value={context}>
        <NodesRenderer nodes={ast.children} />
      </NodeRendererContextType.Provider>
    </div>
  );
};

const rootCls = cx(
  astClasses.root,
  css({
    wordBreak: "break-all",
    userSelect: "unset",
    [astClasses.listItem]: {
      [`> ${astClasses.list}`]: {
        marginLeft: "1.2em",
      },
    },
    "> :last-child": {
      marginBottom: 0,
    },
  }),
);
