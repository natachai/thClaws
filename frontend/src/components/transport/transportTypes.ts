import type { Edge, Node } from "@xyflow/react";

export type TransportNodeData = {
  label: string;
  transportType: string;
  category: "data" | "model";
  inputDataType?: string;
  outputDataType?: string;
};

export type TransportWorkflowNode = Node<TransportNodeData, "transport">;
export type TransportWorkflowEdge = Edge;

export type TransportProject = {
  schemaVersion: 1;
  nodes: TransportWorkflowNode[];
  edges: TransportWorkflowEdge[];
  metadata: {
    name?: string;
    baseYear?: number;
    region?: string;
    updatedAt?: string;
  };
};

export const TRANSPORT_PROJECT_SCHEMA_VERSION = 1 as const;

export const DATA_NODE_TYPES = [
  { label: "Shapefile", transportType: "data-shapefile", dataType: "Shapefile" },
  { label: "CSV", transportType: "data-csv", dataType: "CSV" },
  { label: "GeoJSON", transportType: "data-geojson", dataType: "GeoJSON" },
  { label: "Parquet", transportType: "data-parquet", dataType: "Parquet" },
] as const;

export const TRANSPORT_NODE_TYPES = [
  { label: "Trip Generation", transportType: "trip-generation", inputDataType: "Raw inputs", outputDataType: "Trip productions" },
  { label: "Trip Distribution", transportType: "trip-distribution", inputDataType: "Trip productions", outputDataType: "Trip matrix" },
  { label: "Modal Split", transportType: "modal-split", inputDataType: "Trip matrix", outputDataType: "Mode flows" },
  { label: "Traffic Assignment", transportType: "traffic-assignment", inputDataType: "Mode flows", outputDataType: "Road flows" },
  { label: "Transit Assignment", transportType: "transit-assignment", inputDataType: "Transit network", outputDataType: "Transit flows" },
  { label: "Skim", transportType: "skim", inputDataType: "Network", outputDataType: "Skim matrix" },
] as const;

export const ALL_TRANSPORT_NODE_TYPES = [...DATA_NODE_TYPES, ...TRANSPORT_NODE_TYPES] as const;

export function createEmptyTransportProject(name = "Untitled Transport Project"): TransportProject {
  return {
    schemaVersion: TRANSPORT_PROJECT_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    metadata: { name },
  };
}

export const INITIAL_TRANSPORT_PROJECT: TransportProject = createEmptyTransportProject();

export function parseTransportProject(value: unknown): TransportProject | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TransportProject>;
  if (candidate.schemaVersion !== TRANSPORT_PROJECT_SCHEMA_VERSION) return null;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) return null;
  if (!candidate.metadata || typeof candidate.metadata !== "object") return null;
  const validNodes = candidate.nodes.every((node) =>
    Boolean(
      node &&
      typeof node.id === "string" &&
      node.type === "transport" &&
      node.position &&
      typeof node.position.x === "number" &&
      typeof node.position.y === "number" &&
      node.data &&
      typeof node.data.label === "string" &&
      typeof node.data.transportType === "string" &&
      (node.data.category === "data" || node.data.category === "model"),
    ),
  );
  const validEdges = candidate.edges.every((edge) =>
    Boolean(edge && typeof edge.id === "string" && typeof edge.source === "string" && typeof edge.target === "string"),
  );
  return validNodes && validEdges ? candidate as TransportProject : null;
}

export type TransportNodeType = (typeof TRANSPORT_NODE_TYPES)[number];
