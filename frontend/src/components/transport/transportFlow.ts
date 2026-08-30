import type { Edge, Node } from "@xyflow/react";
import { getNodePorts, type TransportModelNode, type TransportProject } from "./transportTypes";

// React Flow belongs to the view adapter, never to the persisted workflow schema.
export type TransportFlowNode = Node<{
  model: TransportModelNode;
  unresolvedInputs: string[];
  unresolvedOutputs: string[];
  onEdit: () => void;
}, "transport">;
export type TransportFlowEdge = Edge;

export function toFlowNodes(project: TransportProject, selected: Set<string>, onEdit: (id: string) => void, measurements: Record<string, { width: number; height: number }>): TransportFlowNode[] {
  return project.workflow.nodes.map((model) => {
    const ports = getNodePorts(model);
    const incoming = project.workflow.edges.filter((edge) => edge.target.nodeId === model.id).map((edge) => edge.target.portId);
    const outgoing = project.workflow.edges.filter((edge) => edge.source.nodeId === model.id).map((edge) => edge.source.portId);
    return {
      id: model.id,
      type: "transport",
      position: project.ui.nodes[model.id]?.position ?? { x: 0, y: 0 },
      selected: selected.has(model.id),
      measured: measurements[model.id],
      data: {
        model,
        unresolvedInputs: [...new Set(incoming.filter((id) => !ports.inputs.some((port) => port.id === id)))],
        unresolvedOutputs: [...new Set(outgoing.filter((id) => !ports.outputs.some((port) => port.id === id)))],
        onEdit: () => onEdit(model.id),
      },
    };
  });
}

export function toFlowEdges(project: TransportProject, selected: Set<string>): TransportFlowEdge[] {
  return project.workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source.nodeId,
    sourceHandle: edge.source.portId,
    target: edge.target.nodeId,
    targetHandle: edge.target.portId,
    type: "smoothstep",
    selected: selected.has(edge.id),
  }));
}
