import type { TransportProject, TransportWorkflowNode } from "./transportTypes";

export type ValidationSeverity = "error" | "warning";

export type TransportValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  nodeId?: string;
};

export type TransportValidationResult = {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: TransportValidationIssue[];
};

const GENERIC_INPUT_TYPES = new Set(["Data source", "Raw inputs", "Network", "Input"]);

function hasCycle(nodes: TransportWorkflowNode[], edges: TransportProject["edges"]): boolean {
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  edges.forEach((edge) => adjacency.get(edge.source)?.push(edge.target));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => visit(node.id));
}

export function validateTransportProject(project: TransportProject): TransportValidationResult {
  const issues: TransportValidationIssue[] = [];
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const incoming = new Map(project.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(project.nodes.map((node) => [node.id, 0]));

  if (project.nodes.length === 0) {
    issues.push({ severity: "error", code: "EMPTY_WORKFLOW", message: "Add at least one Data node and one modelling component." });
  }
  if (!project.nodes.some((node) => node.data.category === "data")) {
    issues.push({ severity: "error", code: "NO_DATA_SOURCE", message: "Workflow requires at least one Data source (Shapefile, CSV, GeoJSON, or Parquet)." });
  }
  if (!project.nodes.some((node) => node.data.category === "model")) {
    issues.push({ severity: "error", code: "NO_MODEL_COMPONENT", message: "Workflow requires at least one modelling component." });
  }

  for (const edge of project.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) {
      issues.push({ severity: "error", code: "BROKEN_EDGE", message: `Connection ${edge.id} references a missing node.` });
      continue;
    }
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + 1);
    outgoing.set(source.id, (outgoing.get(source.id) ?? 0) + 1);
    const outputType = source.data.outputDataType;
    const inputType = target.data.inputDataType;
    if (outputType && inputType && !GENERIC_INPUT_TYPES.has(inputType) && outputType !== inputType) {
      issues.push({
        severity: "warning",
        code: "DATA_TYPE_MISMATCH",
        nodeId: target.id,
        message: `${source.data.label} outputs ${outputType}, but ${target.data.label} expects ${inputType}.`,
      });
    }
  }

  for (const node of project.nodes) {
    const inCount = incoming.get(node.id) ?? 0;
    const outCount = outgoing.get(node.id) ?? 0;
    if (node.data.category === "data" && inCount > 0) {
      issues.push({ severity: "warning", code: "DATA_HAS_INPUT", nodeId: node.id, message: `${node.data.label} is a Data source and normally should not have an incoming connection.` });
    }
    if (node.data.category === "model" && inCount === 0) {
      issues.push({ severity: "error", code: "MODEL_INPUT_MISSING", nodeId: node.id, message: `${node.data.label} is missing an input connection.` });
    }
    if (outCount === 0) {
      issues.push({ severity: "warning", code: "TERMINAL_NODE", nodeId: node.id, message: `${node.data.label} has no outgoing connection and will be treated as a workflow output.` });
    }
  }

  if (hasCycle(project.nodes, project.edges)) {
    issues.push({ severity: "error", code: "WORKFLOW_CYCLE", message: "Workflow contains a cycle. Transport workflows must be acyclic." });
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  return { valid: errors === 0, errors, warnings, issues };
}

