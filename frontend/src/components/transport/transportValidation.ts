import { DATA_TYPES, MODEL_ACTIONS, getNodePorts, isCompatibleDataType, isDataAction } from "./transportTypes.ts";
import type { TransportProject } from "./transportTypes.ts";

export type ValidationSeverity = "error" | "warning";
export type TransportValidationIssue = { severity: ValidationSeverity; code: string; message: string; nodeId?: string; edgeId?: string; portId?: string };
export type TransportValidationResult = { valid: boolean; errors: number; warnings: number; issues: TransportValidationIssue[] };

export function validateTransportProject(project: TransportProject): TransportValidationResult {
  const issues: TransportValidationIssue[] = [];
  const { nodes, edges } = project.workflow;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const inputBindings = new Map<string, number>();
  const outgoing = new Map(nodes.map((node) => [node.id, 0]));
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const error = (code: string, message: string, context: Partial<TransportValidationIssue> = {}) => issues.push({ severity: "error", code, message, ...context });
  const bindingKey = (nodeId: string, portId: string) => JSON.stringify([nodeId, portId]);

  if (nodes.length === 0) error("EMPTY_WORKFLOW", "Create Data and add at least one modelling component.");
  if (!nodes.some((node) => isDataAction(node.actionId))) error("NO_DATA_SOURCE", "Workflow requires at least one Data source.");
  if (!nodes.some((node) => MODEL_ACTIONS.some((action) => action.actionId === node.actionId))) error("NO_MODEL_COMPONENT", "Workflow requires at least one modelling component.");

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) error("DUPLICATE_NODE_ID", `Duplicate node id: ${node.id}.`, { nodeId: node.id });
    nodeIds.add(node.id);
    if (!node.label.trim()) error("NODE_LABEL_MISSING", "Give this block a name.", { nodeId: node.id });
    const isData = isDataAction(node.actionId);
    if (!isData && !MODEL_ACTIONS.some((action) => action.actionId === node.actionId)) error("UNKNOWN_ACTION", `Block "${node.label}" uses unsupported action ${node.actionId}; replace or repair it explicitly.`, { nodeId: node.id });
    if (isData) {
      if (!node.source || !node.source.path.trim() || [...node.source.path].some((character) => character.charCodeAt(0) < 32)) error("DATA_SOURCE_MISSING", `${node.label}: choose a source file. File contents are not imported or checked yet.`, { nodeId: node.id });
      if (node.source && node.actionId !== `data.${node.source.format}`) error("DATA_SOURCE_FORMAT_MISMATCH", `${node.label}: source format and Data action do not match.`, { nodeId: node.id });
      if (!node.source || node.source.dataType === "any" || !DATA_TYPES.some((type) => type.id === node.source?.dataType)) error("DATA_TYPE_MISSING", `${node.label}: select the semantic data type, not just the file format.`, { nodeId: node.id });
    } else if (node.source) {
      error("MODEL_HAS_SOURCE", `${node.label}: model inputs must reference Data or another block output.`, { nodeId: node.id });
    }
    const outputPorts = getNodePorts(node).outputs;
    for (const portId of Object.keys(node.outputNames)) {
      if (!outputPorts.some((port) => port.id === portId)) error("UNKNOWN_OUTPUT_NAME_PORT", `${node.label}: output name references unknown port ${portId}.`, { nodeId: node.id, portId });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) error("DUPLICATE_EDGE_ID", `Duplicate connection id: ${edge.id}.`, { edgeId: edge.id });
    edgeIds.add(edge.id);
    const source = nodeById.get(edge.source.nodeId);
    const target = nodeById.get(edge.target.nodeId);
    if (!source || !target) {
      error("BROKEN_EDGE", `Connection ${edge.id} references a missing node; retained for repair.`, { edgeId: edge.id });
      continue;
    }
    adjacency.get(source.id)?.push(target.id);
    indegree.set(target.id, (indegree.get(target.id) ?? 0) + 1);
    outgoing.set(source.id, (outgoing.get(source.id) ?? 0) + 1);
    const output = getNodePorts(source).outputs.find((port) => port.id === edge.source.portId);
    const input = getNodePorts(target).inputs.find((port) => port.id === edge.target.portId);
    if (!output) error("UNKNOWN_OUTPUT_PORT", `${source.label}: connection ${edge.id} uses unknown output ${edge.source.portId}.`, { nodeId: source.id, edgeId: edge.id, portId: edge.source.portId });
    if (!input) error("UNKNOWN_INPUT_PORT", `${target.label}: connection ${edge.id} uses unknown input ${edge.target.portId}.`, { nodeId: target.id, edgeId: edge.id, portId: edge.target.portId });
    if (input) {
      const key = bindingKey(target.id, input.id);
      inputBindings.set(key, (inputBindings.get(key) ?? 0) + 1);
    }
    if (output && input && !isCompatibleDataType(output.dataType, input.dataType)) error("DATA_TYPE_MISMATCH", `${source.label} (${output.dataType}) cannot supply ${target.label} / ${input.label} (${input.dataType}).`, { nodeId: target.id, edgeId: edge.id, portId: input.id });
  }

  for (const node of nodes) {
    for (const port of getNodePorts(node).inputs) {
      const bindings = inputBindings.get(bindingKey(node.id, port.id)) ?? 0;
      if (port.required && bindings === 0) error("REQUIRED_INPUT_MISSING", `${node.label}: select data for ${port.label}.`, { nodeId: node.id, portId: port.id });
      if (bindings > 1) error("MULTIPLE_INPUT_BINDINGS", `${node.label}: ${port.label} must have exactly one source, not ${bindings}.`, { nodeId: node.id, portId: port.id });
    }
    if ((outgoing.get(node.id) ?? 0) === 0) issues.push({ severity: "warning", code: "TERMINAL_NODE", nodeId: node.id, message: `${node.label} has no outgoing connection. Its outputs are planned workflow results, not calculated data.` });
  }

  // Iterative DAG check avoids call-stack exhaustion on large workflows.
  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let processed = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    processed += 1;
    for (const next of adjacency.get(id) ?? []) {
      const degree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  if (processed !== indegree.size) error("WORKFLOW_CYCLE", "Workflow contains a cycle. Connect blocks in a one-way dependency order.");
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return { valid: errors === 0, errors, warnings: issues.length - errors, issues };
}
