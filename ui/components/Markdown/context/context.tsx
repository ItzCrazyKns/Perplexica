import React from "react";
import type { ReactMarkdownViewModel } from "./viewmodel";

export interface INodeRendererContext {
  readonly viewmodel: ReactMarkdownViewModel;
}

export const NodeRendererContextType = React.createContext<INodeRendererContext>(
  null as unknown as INodeRendererContext,
);
NodeRendererContextType.displayName = "NodeRendererContextType";

export const useNodeRendererContext = (): INodeRendererContext => {
  return React.useContext(NodeRendererContextType);
};
