import { State, ViewModel } from "@guanghechen/viewmodel";
import type { Definition } from "@yozora/ast";
import type { INodeRendererMap } from "./types";

export type IReactMarkdownThemeScheme = "lighten" | "darken" | string;

export interface IReactMarkdownViewModelProps {
  /**
   * Link / Image reference definitions.
   */
  readonly definitionMap: Readonly<Record<string, Definition>>;
  /**
   * Prefer code wrap.
   *
   * !!! Since the lineno would be weird if the code is wrapped,
   * !!! so the lineno will be hidden if the `preferCodeWrap` set to `true`.
   */
  readonly preferCodeWrap: boolean;
  /**
   * Ast node renderer map.
   */
  readonly rendererMap: Readonly<INodeRendererMap>;
  /**
   * Whether if show code lineno.
   */
  readonly showCodeLineno: boolean;
  /**
   * React markdown theme scheme.
   */
  readonly themeScheme: IReactMarkdownThemeScheme;
}

export class ReactMarkdownViewModel extends ViewModel {
  public readonly definitionMap$: State<Readonly<Record<string, Definition>>>;
  public readonly preferCodeWrap$ = new State<boolean>(false);
  public readonly rendererMap$: State<Readonly<INodeRendererMap>>;
  public readonly showCodeLineno$: State<boolean>;
  public readonly themeScheme$: State<IReactMarkdownThemeScheme>;

  constructor(props: IReactMarkdownViewModelProps) {
    super();

    const { definitionMap, rendererMap, showCodeLineno, themeScheme } = props;
    this.definitionMap$ = new State(definitionMap);
    this.rendererMap$ = new State(rendererMap);
    this.showCodeLineno$ = new State<boolean>(showCodeLineno);
    this.themeScheme$ = new State<IReactMarkdownThemeScheme>(themeScheme);
  }
}
