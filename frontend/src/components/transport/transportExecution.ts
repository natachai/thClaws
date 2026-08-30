import type { TransportModelNode, TransportProject } from "./transportTypes";
import type { TransportResultDataset } from "./transportResultTypes";

export type PreparedExecution = { mode: "prepared-profile"; profileId: string; year: number };
export type TransportEngineProfile = { id: string; label: string; years: number[]; inputs: { id: string; label: string; format: string }[] };
export type TransportEngineCatalog = { protocolVersion: 1; engineVersion: string; profiles: TransportEngineProfile[] };
export type TransportNodeResult = {
  runId: string;
  engineRunId: string;
  nodeId: string;
  year: number;
  profileId: string;
  warnings: string[];
  totals: { productions: number; attractions: number };
  artifacts: { id: string; label: string; format: string; rowCount?: number }[];
};
export type TransportRunPhase = "requesting" | "started" | "progress" | "completed" | "failed" | "cancelled" | "unknown";
export type TransportNodeRun = {
  requestId: string;
  projectSessionId: string;
  nodeId: string;
  configKey: string;
  phase: TransportRunPhase;
  runId?: string;
  message?: string;
  error?: string;
  result?: TransportNodeResult;
};
export type TransportRunEvent = {
  requestId: string;
  projectSessionId: string;
  nodeId: string;
  runId: string;
  phase: "started" | "progress" | "completed" | "failed" | "cancelled";
  message?: string;
  error?: string;
  result?: TransportNodeResult;
};
export type TransportExecutionState = {
  projectSessionId: string;
  runs: Record<string, TransportNodeRun>;
  // An old project's job still owns the workspace slot until its terminal event.
  active: TransportNodeRun | null;
};
export type TransportExecutionAction =
  | { type: "session"; projectSessionId: string }
  | { type: "request"; run: TransportNodeRun }
  | { type: "event"; event: TransportRunEvent; currentConfigKey: string | null }
  | { type: "uncertain"; requestId: string; message: string };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function preparedExecutionDraft(node: TransportModelNode): { profileId: string; year: number | null } {
  const raw = node.parameters.execution;
  return record(raw) && raw.mode === "prepared-profile"
    ? { profileId: typeof raw.profileId === "string" ? raw.profileId : "", year: typeof raw.year === "number" && Number.isInteger(raw.year) ? raw.year : null }
    : { profileId: "", year: null };
}

export function preparedExecution(node: TransportModelNode): PreparedExecution | null {
  const draft = preparedExecutionDraft(node);
  return draft.profileId && draft.year !== null ? { mode: "prepared-profile", profileId: draft.profileId, year: draft.year } : null;
}

/** Ignore layout/labels/notes, but invalidate results on model configuration/binding changes. */
export function executionConfigKey(project: TransportProject, nodeId: string): string | null {
  const node = project.workflow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.actionId !== "transport.trip_generation") return null;
  const incoming = project.workflow.edges.filter((edge) => edge.target.nodeId === nodeId).map((edge) => [edge.id, edge.source.nodeId, edge.source.portId, edge.target.portId]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify([node.actionId, node.parameters, incoming]);
}

export function preparedRunProblem(project: TransportProject, nodeId: string, catalog: TransportEngineCatalog | null): string | null {
  const node = project.workflow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.actionId !== "transport.trip_generation") return "Only a Trip Generation block can run in this iteration.";
  if (project.workflow.edges.some((edge) => edge.target.nodeId === nodeId)) return "Disconnect every incoming edge before running a prepared profile. Custom workflow input bindings are not supported yet; connected data will not be silently ignored.";
  if (!catalog) return "Load the engine catalog before running.";
  const execution = preparedExecution(node);
  if (!execution) return "Choose a copied dataset and year explicitly before running.";
  const profile = catalog.profiles.find((candidate) => candidate.id === execution.profileId);
  if (!profile || !profile.years.includes(execution.year)) return "The saved dataset/year is not available in this workspace. Choose an available profile and year.";
  return null;
}

export function isTerminalRun(phase: TransportRunPhase): boolean {
  return phase === "completed" || phase === "failed" || phase === "cancelled";
}

export function transportExecutionReducer(state: TransportExecutionState, action: TransportExecutionAction): TransportExecutionState {
  if (action.type === "session") return state.projectSessionId === action.projectSessionId ? state : { projectSessionId: action.projectSessionId, runs: {}, active: state.active };
  if (action.type === "request") {
    if (state.active || action.run.projectSessionId !== state.projectSessionId) return state;
    return { ...state, active: action.run, runs: { ...state.runs, [action.run.nodeId]: action.run } };
  }
  const active = state.active;
  if (!active || active.requestId !== (action.type === "event" ? action.event.requestId : action.requestId)) return state;
  if (action.type === "uncertain") {
    const next = { ...active, phase: "unknown" as const, message: action.message };
    return { ...state, active: next, runs: active.projectSessionId === state.projectSessionId ? { ...state.runs, [active.nodeId]: next } : state.runs };
  }
  const event = action.event;
  if (event.projectSessionId !== active.projectSessionId || event.nodeId !== active.nodeId || (active.runId && event.runId !== active.runId)) return state;
  // Completion must identify the exact run and configured dataset/year, not merely a node.
  if (event.phase === "completed") {
    const result = event.result;
    if (!result || result.nodeId !== active.nodeId || result.runId !== event.runId) return state;
  }
  const next: TransportNodeRun = { ...active, runId: event.runId || active.runId, phase: event.phase, message: event.message, error: event.error, result: event.result };
  const visible = active.projectSessionId === state.projectSessionId && active.configKey === action.currentConfigKey;
  return { ...state, active: isTerminalRun(event.phase) ? null : next, runs: visible ? { ...state.runs, [active.nodeId]: next } : state.runs };
}

export function currentNodeRun(state: TransportExecutionState, project: TransportProject, nodeId: string): TransportNodeRun | undefined {
  const run = state.runs[nodeId];
  return run && run.projectSessionId === state.projectSessionId && run.configKey === executionConfigKey(project, nodeId) ? run : undefined;
}

export function parseEngineCatalog(value: unknown): TransportEngineCatalog | null {
  if (!record(value) || value.protocolVersion !== 1 || typeof value.engineVersion !== "string" || !Array.isArray(value.profiles)) return null;
  if (!value.profiles.every((profile) => record(profile) && typeof profile.id === "string" && typeof profile.label === "string" && Array.isArray(profile.years) && profile.years.every((year) => typeof year === "number" && Number.isInteger(year)) && Array.isArray(profile.inputs) && profile.inputs.every((input) => record(input) && typeof input.id === "string" && typeof input.label === "string" && typeof input.format === "string"))) return null;
  return value as TransportEngineCatalog;
}

export function parseNodeResult(value: unknown): TransportNodeResult | undefined {
  if (!record(value) || typeof value.runId !== "string" || typeof value.engineRunId !== "string" || typeof value.nodeId !== "string" || typeof value.profileId !== "string" || typeof value.year !== "number" || !Number.isInteger(value.year)) return undefined;
  if (!Array.isArray(value.warnings) || !value.warnings.every((warning) => typeof warning === "string") || !record(value.totals) || ![value.totals.productions, value.totals.attractions].every((number) => typeof number === "number" && Number.isFinite(number))) return undefined;
  if (!Array.isArray(value.artifacts) || !value.artifacts.every((artifact) => record(artifact) && typeof artifact.id === "string" && typeof artifact.label === "string" && typeof artifact.format === "string" && (artifact.rowCount === undefined || (typeof artifact.rowCount === "number" && Number.isInteger(artifact.rowCount) && artifact.rowCount >= 0)))) return undefined;
  return value as TransportNodeResult;
}

export function parseRunEvent(value: Record<string, unknown>): TransportRunEvent | null {
  if (![value.requestId, value.projectSessionId, value.nodeId, value.runId].every((id) => typeof id === "string") || !["started", "progress", "completed", "failed", "cancelled"].includes(String(value.phase))) return null;
  return { requestId: value.requestId as string, projectSessionId: value.projectSessionId as string, nodeId: value.nodeId as string, runId: value.runId as string, phase: value.phase as TransportRunEvent["phase"], message: typeof value.message === "string" ? value.message : undefined, error: typeof value.error === "string" ? value.error : undefined, result: parseNodeResult(value.result) };
}

export function parseModelPreview(value: unknown, nodeId: string, artifactId: string): TransportResultDataset | null {
  if (!record(value) || typeof value.id !== "string" || typeof value.name !== "string" || value.origin !== "model" || value.sourceNodeId !== nodeId || value.sourcePortId !== artifactId || !Array.isArray(value.fields) || !Array.isArray(value.rows)) return null;
  const fields = value.fields;
  if (!fields.every((field) => record(field) && typeof field.id === "string" && typeof field.label === "string" && ["string", "number", "boolean"].includes(String(field.type)))) return null;
  if (new Set(fields.map((field) => field.id)).size !== fields.length) return null;
  if (!value.rows.every((row) => record(row) && typeof row.id === "string" && record(row.values) && fields.every((field) => { const cell = (row.values as Record<string, unknown>)[field.id]; return cell === null || typeof cell === "string" || typeof cell === "boolean" || (typeof cell === "number" && Number.isFinite(cell)); }))) return null;
  if (new Set(value.rows.map((row) => row.id)).size !== value.rows.length) return null;
  return value as TransportResultDataset;
}
