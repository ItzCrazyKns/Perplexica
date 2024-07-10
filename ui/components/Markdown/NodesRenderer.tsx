import { isEqual } from "@guanghechen/equal";
import { useStateValue } from "@guanghechen/react-viewmodel";
import type { Node } from "@yozora/ast";
import React from "react";
import type { INodeRenderer, INodeRendererMap } from "./context";
import { useNodeRendererContext } from "./context";

export interface INodesRendererProperties {
  /**
   * Ast nodes.
   */
  nodes?: Node[];
}

export const NodesRenderer: React.FC<INodesRendererProperties> = properties => {
  const { nodes } = properties;
  const { viewmodel } = useNodeRendererContext();
  const rendererMap: Readonly<INodeRendererMap> = useStateValue(viewmodel.rendererMap$);
  if (!Array.isArray(nodes) || nodes.length <= 0) return <React.Fragment />;
  return <NodesRendererInner nodes={nodes} rendererMap={rendererMap} />;
};

interface IProperties {
  nodes: Node[];
  rendererMap: Readonly<INodeRendererMap>;
}

class NodesRendererInner extends React.Component<IProperties> {
  public override shouldComponentUpdate(nextProperties: Readonly<IProperties>): boolean {
    const properties = this.props;
    return !isEqual(properties.nodes, nextProperties.nodes) || properties.rendererMap !== nextProperties.rendererMap;
  }

  public override render(): React.ReactElement {
    const { nodes, rendererMap } = this.props;
    return (
      <React.Fragment>
        {nodes.map((node, index) => {
          const key = `${node.type}-${index}`;
          const Renderer: INodeRenderer = rendererMap[node.type] ?? rendererMap._fallback;
          return <Renderer key={key} {...node} />;
        })}
      </React.Fragment>
    );
  }
}
