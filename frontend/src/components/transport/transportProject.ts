import {
  DATA_FORMATS,
  createDataNode,
  createEmptyTransportProject,
  createModelNode,
  getNodePorts,
  isDataAction,
} from "./transportTypes.ts";
import type { DataFormat, JsonValue, TransportDataSource, TransportModelEdge, TransportModelNode, TransportProject } from "./transportTypes.ts";

export type TransportProjectLoadResult = { project: TransportProject | null; migrated: boolean; warnings: string[]; error?: string };
type RecordValue = Record<string, unknown>;
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const LEGACY_ACTIONS: Record<string, string> = {
  "data-csv": "data.csv",
  "data-shapefile": "data.shapefile",
  "data-geojson": "data.geojson",
  "data-parquet": "data.parquet",
  "trip-generation": "transport.trip_generation",
  "trip-distribution": "transport.trip_distribution",
  "modal-split": "transport.modal_split",
  "traffic-assignment": "transport.traffic_assignment",
  "transit-assignment": "transport.transit_assignment",
  skim: "transport.skim",
};

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, where: string): RecordValue {
  if (!record(value)) throw new Error(`${where} must be an object.`);
  return value;
}

function requireString(value: unknown, where: string, identifier = false): string {
  if (typeof value !== "string") throw new Error(`${where} must be a string.`);
  if (identifier && (!value.trim() || UNSAFE_KEYS.has(value) || [...value].some((character) => character.charCodeAt(0) < 32))) {
    throw new Error(`${where} is not a safe identifier.`);
  }
  return value;
}

function requireNumber(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${where} must be finite.`);
  return value;
}

function onlyKeys(value: RecordValue, allowed: string[], where: string): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`${where} contains unsupported field "${unexpected}".`);
}

function ensureJson(value: unknown, depth = 0, ancestors = new Set<object>()): asserts value is JsonValue {
  if (depth > 100) throw new Error("Project JSON is nested too deeply.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || ancestors.has(value)) throw new Error("Project must contain finite, non-circular JSON values only.");
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error("Project must contain plain JSON objects only.");
  ancestors.add(value);
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error(`Unsafe project key "${key}".`);
    ensureJson(item, depth + 1, ancestors);
  }
  ancestors.delete(value);
}

function metadata(value: unknown): TransportProject["metadata"] {
  const candidate = requireRecord(value, "metadata");
  onlyKeys(candidate, ["name", "baseYear", "region", "updatedAt"], "metadata");
  const result: TransportProject["metadata"] = {};
  if (candidate.name !== undefined) result.name = requireString(candidate.name, "metadata.name");
  if (candidate.region !== undefined) result.region = requireString(candidate.region, "metadata.region");
  if (candidate.updatedAt !== undefined) result.updatedAt = requireString(candidate.updatedAt, "metadata.updatedAt");
  if (candidate.baseYear !== undefined) result.baseYear = requireNumber(candidate.baseYear, "metadata.baseYear");
  return result;
}

function stringMap(value: unknown, where: string): Record<string, string> {
  const candidate = requireRecord(value, where);
  return Object.fromEntries(Object.entries(candidate).map(([key, item]) => [requireString(key, where, true), requireString(item, `${where}.${key}`)]));
}

function source(value: unknown, where: string): TransportDataSource {
  const candidate = requireRecord(value, where);
  onlyKeys(candidate, ["kind", "format", "path", "dataType"], where);
  if (candidate.kind !== "file" || !DATA_FORMATS.some((format) => format.id === candidate.format)) throw new Error(`${where} must reference a supported file format.`);
  return { kind: "file", format: candidate.format as DataFormat, path: requireString(candidate.path, `${where}.path`), dataType: requireString(candidate.dataType, `${where}.dataType`, true) };
}

function v2Node(value: unknown): TransportModelNode {
  const candidate = requireRecord(value, "workflow node");
  onlyKeys(candidate, ["id", "actionId", "label", "note", "details", "parameters", "source", "outputNames", "legacy"], "workflow node");
  const result: TransportModelNode = {
    id: requireString(candidate.id, "node.id", true),
    actionId: requireString(candidate.actionId, "node.actionId", true),
    label: requireString(candidate.label, "node.label"),
    note: requireString(candidate.note, "node.note"),
    details: requireString(candidate.details, "node.details"),
    parameters: requireRecord(candidate.parameters, "node.parameters") as Record<string, JsonValue>,
    outputNames: stringMap(candidate.outputNames, "node.outputNames"),
  };
  if (candidate.source !== undefined) result.source = source(candidate.source, "node.source");
  if (candidate.legacy !== undefined) result.legacy = candidate.legacy as JsonValue;
  return result;
}

function endpoint(value: unknown, where: string): TransportModelEdge["source"] {
  const candidate = requireRecord(value, where);
  onlyKeys(candidate, ["nodeId", "portId"], where);
  return { nodeId: requireString(candidate.nodeId, `${where}.nodeId`, true), portId: requireString(candidate.portId, `${where}.portId`, true) };
}

function position(value: unknown): { x: number; y: number } {
  const candidate = requireRecord(value, "node position");
  onlyKeys(candidate, ["x", "y"], "node position");
  return { x: requireNumber(candidate.x, "position.x"), y: requireNumber(candidate.y, "position.y") };
}

function requireUniqueIds(items: { id: string }[], kind: "node" | "edge"): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Project has duplicate ${kind} id "${item.id}"; resolve it in a copy before opening.`);
    seen.add(item.id);
  }
}

function readV2(candidate: RecordValue): TransportProject {
  onlyKeys(candidate, ["schemaVersion", "metadata", "workflow", "ui"], "project");
  const workflow = requireRecord(candidate.workflow, "workflow");
  onlyKeys(workflow, ["nodes", "edges"], "workflow");
  if (!Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) throw new Error("workflow.nodes and workflow.edges must be arrays.");
  const nodes = workflow.nodes.map(v2Node);
  const edges = workflow.edges.map((value): TransportModelEdge => {
    const edge = requireRecord(value, "workflow edge");
    onlyKeys(edge, ["id", "source", "target"], "workflow edge");
    return { id: requireString(edge.id, "edge.id", true), source: endpoint(edge.source, "edge.source"), target: endpoint(edge.target, "edge.target") };
  });
  // Duplicate IDs cannot safely be represented by the canvas adapter. Reject
  // before mounting rather than allowing a library to merge or hide a block.
  requireUniqueIds(nodes, "node");
  requireUniqueIds(edges, "edge");
  const candidateUi = requireRecord(candidate.ui, "ui");
  onlyKeys(candidateUi, ["nodes", "viewport"], "ui");
  const candidatePositions = requireRecord(candidateUi.nodes, "ui.nodes");
  const ui: TransportProject["ui"] = { nodes: Object.fromEntries(Object.entries(candidatePositions).map(([id, value]) => {
    requireString(id, "ui node id", true);
    const layout = requireRecord(value, "ui node layout");
    onlyKeys(layout, ["position"], "ui node layout");
    return [id, { position: position(layout.position) }];
  })) };
  if (candidateUi.viewport !== undefined) {
    const viewport = requireRecord(candidateUi.viewport, "ui.viewport");
    onlyKeys(viewport, ["x", "y", "zoom"], "ui.viewport");
    ui.viewport = { x: requireNumber(viewport.x, "viewport.x"), y: requireNumber(viewport.y, "viewport.y"), zoom: requireNumber(viewport.zoom, "viewport.zoom") };
    if (ui.viewport.zoom <= 0) throw new Error("viewport.zoom must be positive.");
  }
  return { schemaVersion: 2, metadata: metadata(candidate.metadata), workflow: { nodes, edges }, ui };
}

// v1 had a single unnamed handle on each side. Use its advertised meaning, never
// infer from nearby nodes: transit-assignment input was network; every other
// known model maps its old input/output to the first registered port.
function legacyPort(node: TransportModelNode | undefined, handle: unknown, side: "inputs" | "outputs", warnings: string[], edgeId: string): string {
  const ports = node ? getNodePorts(node)[side] : [];
  if (typeof handle === "string" && handle.length > 0) {
    const retained = `legacy.${side}.${encodeURIComponent(handle)}`;
    warnings.push(`Connection ${edgeId}: legacy handle "${handle}" retained as ${retained}; select a port to repair it.`);
    return retained;
  }
  if (handle !== undefined && handle !== null && handle !== "") throw new Error(`Connection ${edgeId} has an invalid legacy handle.`);
  const defaultPort = node?.actionId === "transport.transit_assignment" && side === "inputs"
    ? ports.find((port) => port.id === "network")
    : ports[0];
  if (defaultPort) return defaultPort.id;
  const unresolved = `legacy.${side}.unresolved`;
  warnings.push(`Connection ${edgeId}: ${side === "inputs" ? "input" : "output"} port could not be mapped; connection retained for repair.`);
  return unresolved;
}

function migrateV1(candidate: RecordValue, warnings: string[]): TransportProject {
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) throw new Error("Legacy nodes and edges must be arrays.");
  const project = createEmptyTransportProject();
  project.metadata = metadata(candidate.metadata);
  const seen = new Set<string>();
  for (const raw of candidate.nodes) {
    const old = requireRecord(raw, "legacy node");
    const data = requireRecord(old.data, "legacy node.data");
    const id = requireString(old.id, "legacy node.id", true);
    if (seen.has(id)) throw new Error(`Legacy project has duplicate node id "${id}"; resolve it in a copy before migration.`);
    seen.add(id);
    const oldType = requireString(data.transportType, "legacy transportType", true);
    const actionId = Object.hasOwn(LEGACY_ACTIONS, oldType) ? LEGACY_ACTIONS[oldType] : `legacy.${oldType}`;
    const label = requireString(data.label, "legacy node label");
    const node = isDataAction(actionId)
      ? createDataNode({ kind: "file", format: actionId.slice(5) as DataFormat, path: "", dataType: "any" }, label, id)
      : { ...createModelNode(actionId, id), label };
    if (data.note !== undefined || old.note !== undefined) node.note = requireString(data.note ?? old.note, "legacy note");
    if (data.details !== undefined || old.details !== undefined) node.details = requireString(data.details ?? old.details, "legacy details");
    if (data.parameters !== undefined || old.parameters !== undefined) node.parameters = requireRecord(data.parameters ?? old.parameters, "legacy parameters") as Record<string, JsonValue>;
    if (data.outputNames !== undefined) node.outputNames = stringMap(data.outputNames, "legacy outputNames");
    if (data.source !== undefined && isDataAction(actionId)) node.source = source(data.source, "legacy source");
    // Preserve all old custom data separately; it is never executed as an action.
    node.legacy = { transportType: oldType, data: data as { [key: string]: JsonValue } };
    if (!Object.hasOwn(LEGACY_ACTIONS, oldType)) warnings.push(`Node "${label}" uses unsupported legacy type "${oldType}"; retained unchanged for repair.`);
    if (isDataAction(actionId) && !node.source?.path) warnings.push(`Data node "${label}" needs a source path and semantic data type; file format alone does not identify its contents.`);
    project.workflow.nodes.push(node);
    project.ui.nodes[id] = { position: position(old.position) };
  }
  const nodeById = new Map(project.workflow.nodes.map((node) => [node.id, node]));
  project.workflow.edges = candidate.edges.map((raw): TransportModelEdge => {
    const old = requireRecord(raw, "legacy edge");
    const id = requireString(old.id, "legacy edge.id", true);
    const sourceId = requireString(old.source, "legacy edge.source", true);
    const targetId = requireString(old.target, "legacy edge.target", true);
    return {
      id,
      source: { nodeId: sourceId, portId: legacyPort(nodeById.get(sourceId), old.sourceHandle, "outputs", warnings, id) },
      target: { nodeId: targetId, portId: legacyPort(nodeById.get(targetId), old.targetHandle, "inputs", warnings, id) },
    };
  });
  if (candidate.viewport !== undefined) {
    const viewport = requireRecord(candidate.viewport, "legacy viewport");
    project.ui.viewport = { x: requireNumber(viewport.x, "viewport.x"), y: requireNumber(viewport.y, "viewport.y"), zoom: requireNumber(viewport.zoom, "viewport.zoom") };
    if (project.ui.viewport.zoom <= 0) throw new Error("viewport.zoom must be positive.");
  }
  warnings.unshift("Opened a schema v1 project as v2 in memory. Save As creates a separate file; the original has not been changed.");
  return project;
}

export function loadTransportProject(value: unknown): TransportProjectLoadResult {
  const warnings: string[] = [];
  try {
    ensureJson(value);
    const candidate = requireRecord(structuredClone(value), "project");
    if (candidate.schemaVersion === 1) return { project: migrateV1(candidate, warnings), migrated: true, warnings };
    if (candidate.schemaVersion !== 2) throw new Error(`Unsupported Transport project schema version: ${String(candidate.schemaVersion)}.`);
    return { project: readV2(candidate), migrated: false, warnings };
  } catch (error) {
    return { project: null, migrated: false, warnings, error: error instanceof Error ? error.message : "Invalid Transport project." };
  }
}

export function parseTransportProject(value: unknown): TransportProject | null {
  return loadTransportProject(value).project;
}
