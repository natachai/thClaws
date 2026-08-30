import assert from "node:assert/strict";
import test from "node:test";
import { createDataNode, createEmptyTransportProject, createModelNode, loadTransportProject } from "../src/components/transport/transportTypes.ts";
import type { TransportModelEdge, TransportProject } from "../src/components/transport/transportTypes.ts";
import { validateTransportProject } from "../src/components/transport/transportValidation.ts";

function edge(id: string, from: string, output: string, to: string, input: string): TransportModelEdge {
  return { id, source: { nodeId: from, portId: output }, target: { nodeId: to, portId: input } };
}
function sample(): TransportProject {
  const project = createEmptyTransportProject("AM demand");
  project.workflow.nodes = [
    createDataNode({ kind: "file", path: "C:\\survey.csv", format: "csv", dataType: "table.socioeconomic" }, "Survey", "data"),
    createDataNode({ kind: "file", path: "C:\\roads.geojson", format: "geojson", dataType: "network.road" }, "Roads", "network"),
    createModelNode("transport.trip_generation", "generation"),
    createModelNode("transport.trip_distribution", "distribution"),
    createModelNode("transport.modal_split", "modal"),
    createModelNode("transport.traffic_assignment", "assignment"),
    createModelNode("transport.skim", "skim"),
  ];
  project.workflow.edges = [
    edge("e1", "data", "data", "generation", "socioeconomic_data"),
    edge("e2", "generation", "productions", "distribution", "productions"),
    edge("e3", "generation", "attractions", "distribution", "attractions"),
    edge("e4", "distribution", "trips", "modal", "trips"),
    edge("e5", "modal", "road_demand", "assignment", "demand"),
    edge("e6", "network", "data", "assignment", "network"),
    edge("e7", "network", "data", "skim", "network"),
    edge("e8", "skim", "skim", "distribution", "costs"),
    edge("e9", "skim", "skim", "modal", "costs"),
  ];
  return project;
}
function codes(project: TransportProject): string[] {
  return validateTransportProject(project).issues.map((issue) => issue.code);
}

test("compatible workflow accepts reused outputs, fanout and independent multiple inputs", () => {
  const result = validateTransportProject(sample());
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.errors, 0);
  assert.ok(result.warnings > 0);
});

test("empty workflow reports distinct missing components", () => {
  const result = validateTransportProject(createEmptyTransportProject());
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["EMPTY_WORKFLOW", "NO_DATA_SOURCE", "NO_MODEL_COMPONENT"]);
});

test("missing one required input remains invalid even if other inputs are present", () => {
  const project = sample();
  project.workflow.edges = project.workflow.edges.filter((item) => item.id !== "e6");
  const result = validateTransportProject(project);
  assert.ok(result.issues.some((issue) => issue.code === "REQUIRED_INPUT_MISSING" && issue.nodeId === "assignment" && issue.portId === "network"));
});

test("two sources cannot bind one input even though an output may fan out", () => {
  const project = sample();
  project.workflow.edges.push(edge("duplicate", "generation", "productions", "distribution", "productions"));
  assert.ok(codes(project).includes("MULTIPLE_INPUT_BINDINGS"));
});

test("data-type mismatch is a blocking error", () => {
  const project = sample();
  project.workflow.edges[0].source.nodeId = "network";
  const mismatch = validateTransportProject(project).issues.find((issue) => issue.code === "DATA_TYPE_MISMATCH");
  assert.equal(mismatch?.severity, "error");
});

test("unknown ports and missing nodes are retained but invalid", () => {
  const project = sample();
  project.workflow.edges[0].source.portId = "legacy.outputs.out";
  project.workflow.edges[1].target.portId = "legacy.inputs.in";
  project.workflow.edges.push(edge("broken", "missing", "data", "generation", "socioeconomic_data"));
  const found = codes(project);
  assert.ok(found.includes("UNKNOWN_OUTPUT_PORT"));
  assert.ok(found.includes("UNKNOWN_INPUT_PORT"));
  assert.ok(found.includes("BROKEN_EDGE"));
});

test("unknown actions never become executable implicitly", () => {
  const project = sample();
  project.workflow.nodes[2].actionId = "legacy.input-data";
  assert.ok(codes(project).includes("UNKNOWN_ACTION"));
});

test("duplicate node and edge IDs are invalid", () => {
  const project = sample();
  project.workflow.nodes.push({ ...project.workflow.nodes[0] });
  project.workflow.edges.push({ ...project.workflow.edges[0] });
  const found = codes(project);
  assert.ok(found.includes("DUPLICATE_NODE_ID"));
  assert.ok(found.includes("DUPLICATE_EDGE_ID"));
});

test("cycles and self-loops are rejected even when their port types match", () => {
  const project = sample();
  project.workflow.edges.push(edge("cycle", "assignment", "skim", "distribution", "costs"));
  assert.ok(codes(project).includes("WORKFLOW_CYCLE"));
  const self = sample();
  self.workflow.edges.push(edge("self", "modal", "road_demand", "modal", "trips"));
  assert.ok(codes(self).includes("WORKFLOW_CYCLE"));
});

test("source configuration requires a file reference and selected semantic type", () => {
  const project = sample();
  project.workflow.nodes[0].source!.path = "";
  project.workflow.nodes[0].source!.dataType = "any";
  const found = codes(project);
  assert.ok(found.includes("DATA_SOURCE_MISSING"));
  assert.ok(found.includes("DATA_TYPE_MISSING"));
  assert.ok(found.includes("DATA_TYPE_MISMATCH"));
});

test("source formats, model sources and output name port IDs are checked", () => {
  const project = sample();
  project.workflow.nodes[0].source!.format = "parquet";
  project.workflow.nodes[2].source = { ...project.workflow.nodes[0].source! };
  project.workflow.nodes[2].outputNames.unknown = "Missing port";
  const found = codes(project);
  assert.ok(found.includes("DATA_SOURCE_FORMAT_MISMATCH"));
  assert.ok(found.includes("MODEL_HAS_SOURCE"));
  assert.ok(found.includes("UNKNOWN_OUTPUT_NAME_PORT"));
});

test("file references are not mistaken for physically checked or imported contents", () => {
  const project = sample();
  project.workflow.nodes[0].source!.path = "C:\\does-not-exist\\source.csv";
  assert.equal(validateTransportProject(project).valid, true);
});

test("saved and reopened domain workflow validates identically", () => {
  const project = sample();
  const loaded = loadTransportProject(JSON.parse(JSON.stringify(project)));
  assert.ok(loaded.project);
  assert.deepEqual(validateTransportProject(loaded.project), validateTransportProject(project));
});
