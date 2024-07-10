import { isEqual } from "@guanghechen/equal";
import { useStateValue } from "@guanghechen/react-viewmodel";
import type { Node } from "@yozora/ast";
import React from "react";
import type { INodeRenderer, INodeRendererMap } from "./context";
import { useNodeRendererContext } from "./context";

export interface INodesRendererProps {
  /**
   * Ast nodes.
   */
  nodes?: Node[];
}

export const NodesRenderer: React.FC<INodesRendererProps> = props => {
  const { nodes } = props;
  const { viewmodel } = useNodeRendererContext();
  const rendererMap: Readonly<INodeRendererMap> = useStateValue(viewmodel.rendererMap$);
  if (!Array.isArray(nodes) || nodes.length <= 0) return <React.Fragment />;
  return <NodesRendererInner nodes={nodes} rendererMap={rendererMap} />;
};

interface IProps {
  nodes: Node[];
  rendererMap: Readonly<INodeRendererMap>;
}

class NodesRendererInner extends React.Component<IProps> {
  public override shouldComponentUpdate(nextProps: Readonly<IProps>): boolean {
    const props = this.props;
    return !isEqual(props.nodes, nextProps.nodes) || props.rendererMap !== nextProps.rendererMap;
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
