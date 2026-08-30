// This file is the engine-neutral project contract. Keep React/XYFlow types out.
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type DataFormat = "csv" | "shapefile" | "geojson" | "parquet";
export type TransportDataSource = { kind: "file"; path: string; format: DataFormat; dataType: string };
export type TransportPort = { id: string; label: string; dataType: string; required?: boolean };
export type TransportModelNode = {
  id: string;
  actionId: string;
  label: string;
  note: string;
  details: string;
  parameters: Record<string, JsonValue>;
  source?: TransportDataSource;
  outputNames: Record<string, string>;
  // Unsupported legacy configuration is retained for user-directed repair.
  legacy?: JsonValue;
};
export type TransportEndpoint = { nodeId: string; portId: string };
export type TransportModelEdge = { id: string; source: TransportEndpoint; target: TransportEndpoint };
export type TransportProject = {
  schemaVersion: 2;
  metadata: { name?: string; baseYear?: number; region?: string; updatedAt?: string };
  workflow: { nodes: TransportModelNode[]; edges: TransportModelEdge[] };
  ui: {
    nodes: Record<string, { position: { x: number; y: number } }>;
    viewport?: { x: number; y: number; zoom: number };
  };
};

export const TRANSPORT_PROJECT_SCHEMA_VERSION = 2 as const;
export const DATA_FORMATS: ReadonlyArray<{ id: DataFormat; label: string }> = [
  { id: "shapefile", label: "Shapefile" },
  { id: "csv", label: "CSV" },
  { id: "geojson", label: "GeoJSON" },
  { id: "parquet", label: "Parquet" },
];
export const DATA_TYPES = [
  { id: "any", label: "Not specified yet" },
  { id: "table.socioeconomic", label: "Socioeconomic data" },
  { id: "geometry.zones", label: "Zones" },
  { id: "table.trip_ends", label: "Trip productions / attractions" },
  { id: "matrix.od", label: "OD / demand matrix" },
  { id: "matrix.skim", label: "Skim / cost matrix" },
  { id: "network.road", label: "Road network" },
  { id: "network.transit", label: "Transit network" },
  { id: "table.link_flows", label: "Road link flows" },
  { id: "table.transit_flows", label: "Transit flows" },
] as const;

// These describe editor connections, not an implemented calculation engine.
export const MODEL_ACTIONS = [
  { actionId: "transport.trip_generation", label: "Trip Generation" },
  { actionId: "transport.trip_distribution", label: "Trip Distribution" },
  { actionId: "transport.modal_split", label: "Modal Split" },
  { actionId: "transport.traffic_assignment", label: "Traffic Assignment" },
  { actionId: "transport.transit_assignment", label: "Transit Assignment" },
  { actionId: "transport.skim", label: "Skim" },
] as const;

type Ports = { inputs: TransportPort[]; outputs: TransportPort[] };
const PORTS: Record<string, Ports> = {
  "transport.trip_generation": {
    inputs: [
      { id: "socioeconomic_data", label: "Socioeconomic data", dataType: "table.socioeconomic", required: true },
      { id: "zones", label: "Zones", dataType: "geometry.zones" },
    ],
    outputs: [
      { id: "productions", label: "Trip productions", dataType: "table.trip_ends" },
      { id: "attractions", label: "Trip attractions", dataType: "table.trip_ends" },
    ],
  },
  "transport.trip_distribution": {
    inputs: [
      { id: "productions", label: "Trip productions", dataType: "table.trip_ends", required: true },
      { id: "attractions", label: "Trip attractions", dataType: "table.trip_ends" },
      { id: "costs", label: "Skim / costs", dataType: "matrix.skim" },
    ],
    outputs: [{ id: "trips", label: "Trip matrix", dataType: "matrix.od" }],
  },
  "transport.modal_split": {
    inputs: [
      { id: "trips", label: "Trip matrix", dataType: "matrix.od", required: true },
      { id: "costs", label: "Skim / costs", dataType: "matrix.skim" },
    ],
    outputs: [
      { id: "road_demand", label: "Road demand", dataType: "matrix.od" },
      { id: "transit_demand", label: "Transit demand", dataType: "matrix.od" },
    ],
  },
  "transport.traffic_assignment": {
    inputs: [
      { id: "demand", label: "Road demand", dataType: "matrix.od", required: true },
      { id: "network", label: "Road network", dataType: "network.road", required: true },
    ],
    outputs: [
      { id: "link_flows", label: "Road link flows", dataType: "table.link_flows" },
      { id: "skim", label: "Skim matrix", dataType: "matrix.skim" },
    ],
  },
  "transport.transit_assignment": {
    inputs: [
      { id: "demand", label: "Transit demand", dataType: "matrix.od", required: true },
      { id: "network", label: "Transit network", dataType: "network.transit", required: true },
    ],
    outputs: [{ id: "transit_flows", label: "Transit flows", dataType: "table.transit_flows" }],
  },
  "transport.skim": {
    inputs: [{ id: "network", label: "Road network", dataType: "network.road", required: true }],
    outputs: [{ id: "skim", label: "Skim matrix", dataType: "matrix.skim" }],
  },
};

export function isDataAction(actionId: string): boolean {
  return DATA_FORMATS.some((format) => actionId === `data.${format.id}`);
}

export function getNodePorts(node: TransportModelNode): Ports {
  if (isDataAction(node.actionId)) {
    return { inputs: [], outputs: [{ id: "data", label: "Data", dataType: node.source?.dataType ?? "any" }] };
  }
  const ports = Object.hasOwn(PORTS, node.actionId) ? PORTS[node.actionId] : undefined;
  return { inputs: ports?.inputs.map((port) => ({ ...port })) ?? [], outputs: ports?.outputs.map((port) => ({ ...port })) ?? [] };
}

export function isCompatibleDataType(output: string, input: string): boolean {
  return input === "any" || (output !== "any" && output === input);
}

export function createModelNode(actionId: string, id: string): TransportModelNode {
  return {
    id,
    actionId,
    label: MODEL_ACTIONS.find((action) => action.actionId === actionId)?.label ?? actionId,
    note: "",
    details: "",
    parameters: {},
    outputNames: {},
  };
}

export function createDataNode(source: TransportDataSource, label: string, id: string): TransportModelNode {
  return { ...createModelNode(`data.${source.format}`, id), label, source: { ...source } };
}

export function createEmptyTransportProject(name = "Untitled Transport Project"): TransportProject {
  return { schemaVersion: TRANSPORT_PROJECT_SCHEMA_VERSION, metadata: { name }, workflow: { nodes: [], edges: [] }, ui: { nodes: {} } };
}

export const INITIAL_TRANSPORT_PROJECT = createEmptyTransportProject();
export { loadTransportProject, parseTransportProject } from "./transportProject.ts";
