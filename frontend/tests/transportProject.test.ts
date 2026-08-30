import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DATA_FORMATS,
  MODEL_ACTIONS,
  createDataNode,
  createEmptyTransportProject,
  createModelNode,
  getNodePorts,
  isCompatibleDataType,
  loadTransportProject,
  parseTransportProject,
} from "../src/components/transport/transportTypes.ts";
import type { TransportProject } from "../src/components/transport/transportTypes.ts";

function legacyFixture() {
  return JSON.parse(readFileSync(new URL("./fixtures/transport-v1-all-nodes.json", import.meta.url), "utf8"));
}

function richProject(): TransportProject {
  const project = createEmptyTransportProject("กรุงเทพ 2568");
  project.metadata = { name: "กรุงเทพ 2568", baseYear: 2025, region: "Bangkok", updatedAt: "2026-08-30T03:00:00Z" };
  const data = createDataNode({ kind: "file", format: "csv", path: "C:\\data\\survey.csv", dataType: "table.socioeconomic" }, "Survey", "data-1");
  const model = createModelNode("transport.trip_generation", "generation-1");
  model.label = "Morning demand";
  model.note = "ตรวจสอบข้อมูล";
  model.details = "Details\nwith multiple lines";
  model.parameters = { factor: 1.1, options: { enabled: true, modes: ["car", "transit"], missing: null } };
  model.outputNames = { productions: "AM productions", attractions: "AM attractions" };
  project.workflow.nodes = [data, model];
  project.workflow.edges = [{ id: "e1", source: { nodeId: data.id, portId: "data" }, target: { nodeId: model.id, portId: "socioeconomic_data" } }];
  project.ui.nodes = { "data-1": { position: { x: 40, y: -10 } }, "generation-1": { position: { x: 380, y: 50 } } };
  project.ui.viewport = { x: 10, y: 20, zoom: 0.75 };
  return project;
}

test("schema v2 round-trips labels, notes, details, output names, sources, parameters and UI", () => {
  const project = richProject();
  const loaded = loadTransportProject(JSON.parse(JSON.stringify(project)));
  assert.equal(loaded.migrated, false);
  assert.deepEqual(loaded.warnings, []);
  assert.deepEqual(loaded.project, project);
});

test("workflow JSON contains no React Flow properties", () => {
  const workflow = richProject().workflow;
  const forbidden = ["position", "selected", "measured", "dragging", "sourceHandle", "targetHandle"];
  for (const name of forbidden) assert.equal(JSON.stringify(workflow).includes(`"${name}"`), false);
  assert.equal("type" in workflow.nodes[0], false);
  assert.equal("data" in workflow.nodes[0], false);
});

test("empty project creates independent mutable state", () => {
  const first = createEmptyTransportProject();
  const second = createEmptyTransportProject();
  first.workflow.nodes.push(createModelNode("transport.skim", "skim"));
  assert.equal(second.workflow.nodes.length, 0);
  assert.deepEqual(parseTransportProject(second), second);
});

test("all v1 data/model actions migrate with metadata, labels and positions intact", () => {
  const original = legacyFixture();
  const before = JSON.stringify(original);
  const { project, migrated, warnings } = loadTransportProject(original);
  assert.ok(project);
  assert.equal(migrated, true);
  assert.equal(project.workflow.nodes.length, 10);
  assert.equal(project.workflow.edges.length, 6);
  assert.deepEqual(project.metadata, original.metadata);
  assert.deepEqual(project.ui.viewport, original.viewport);
  assert.deepEqual(new Set(project.workflow.nodes.map((node) => node.actionId)), new Set([
    ...DATA_FORMATS.map((format) => `data.${format.id}`), ...MODEL_ACTIONS.map((action) => action.actionId),
  ]));
  for (const old of original.nodes) {
    assert.deepEqual(project.ui.nodes[old.id].position, old.position);
    assert.equal(project.workflow.nodes.find((node) => node.id === old.id)?.label, old.data.label);
  }
  const generation = project.workflow.nodes.find((node) => node.id === "generation")!;
  assert.equal(generation.note, "Check survey");
  assert.equal(generation.details, "Peak hour only");
  assert.deepEqual(generation.parameters, { factor: 1.2, enabled: true });
  assert.ok(warnings.some((warning) => warning.includes("original has not been changed")));
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(parseTransportProject(JSON.parse(JSON.stringify(project))), project);
});

test("legacy unnamed ports map deterministic old advertised defaults", () => {
  const project = loadTransportProject(legacyFixture()).project!;
  assert.deepEqual(project.workflow.edges.map((edge) => [edge.source.portId, edge.target.portId]), [
    ["data", "socioeconomic_data"], ["productions", "productions"], ["trips", "trips"],
    ["road_demand", "demand"], ["data", "network"], ["data", "network"],
  ]);
});

test("legacy named handles are retained unresolved with a warning, never guessed or dropped", () => {
  const original = legacyFixture();
  original.edges[0].sourceHandle = "custom/out";
  original.edges[0].targetHandle = "custom-in";
  const loaded = loadTransportProject(original);
  assert.ok(loaded.project);
  assert.equal(loaded.project.workflow.edges.length, original.edges.length);
  assert.equal(loaded.project.workflow.edges[0].source.portId, "legacy.outputs.custom%2Fout");
  assert.equal(loaded.project.workflow.edges[0].target.portId, "legacy.inputs.custom-in");
  assert.ok(loaded.warnings.some((warning) => warning.includes("custom/out")));
});

test("unsupported Input Data and unknown node data survive migration", () => {
  const original = legacyFixture();
  original.nodes[0].data.transportType = "input-data";
  original.nodes[0].data.custom = { important: "retain" };
  const loaded = loadTransportProject(original);
  assert.ok(loaded.project);
  const retained = loaded.project.workflow.nodes[0];
  assert.equal(retained.actionId, "legacy.input-data");
  assert.equal(retained.label, "My survey");
  assert.deepEqual(retained.legacy, { transportType: "input-data", data: original.nodes[0].data });
  assert.equal(loaded.project.workflow.edges[0].source.portId, "legacy.outputs.unresolved");
  assert.ok(loaded.warnings.some((warning) => warning.includes("unsupported legacy type")));
});

test("broken legacy edges remain available for validation and repair", () => {
  const original = legacyFixture();
  original.edges[0].source = "missing-node";
  const loaded = loadTransportProject(original);
  assert.ok(loaded.project);
  assert.equal(loaded.project.workflow.edges[0].source.nodeId, "missing-node");
  assert.equal(loaded.project.workflow.edges.length, original.edges.length);
});

test("loading does not alias parameters or legacy custom data into the input object", () => {
  const original = richProject();
  const loaded = parseTransportProject(original)!;
  loaded.workflow.nodes[1].parameters.factor = 9;
  assert.equal(original.workflow.nodes[1].parameters.factor, 1.1);
  const legacy = legacyFixture();
  const migrated = parseTransportProject(legacy)!;
  migrated.workflow.nodes[4].parameters.factor = 9;
  assert.equal(legacy.nodes[4].data.parameters.factor, 1.2);
});

test("v2 rejects malformed, nonfinite, unsafe and unsupported schema instead of dropping fields", () => {
  const invalid: unknown[] = [null, [], {}, { ...richProject(), schemaVersion: 3 }, { ...richProject(), workflow: {} }];
  const nonfinite = richProject();
  nonfinite.ui.nodes["data-1"].position.x = Infinity;
  invalid.push(nonfinite);
  const invalidZoom = richProject();
  invalidZoom.ui.viewport!.zoom = 0;
  invalid.push(invalidZoom);
  const extra = richProject();
  Object.assign(extra.workflow.nodes[0], { selected: true });
  invalid.push(extra);
  const unsafeId = richProject();
  unsafeId.workflow.nodes[0].id = "__proto__";
  invalid.push(unsafeId);
  const unsafeKey = JSON.parse(JSON.stringify(richProject()));
  unsafeKey.workflow.nodes[0].parameters = JSON.parse('{"__proto__":{"polluted":true}}');
  invalid.push(unsafeKey);
  const malformedNote = JSON.parse(JSON.stringify(richProject()));
  malformedNote.workflow.nodes[0].note = 42;
  invalid.push(malformedNote);
  const circular = richProject();
  Object.assign(circular.workflow.nodes[0].parameters, { circular });
  invalid.push(circular);
  for (const value of invalid) {
    const loaded = loadTransportProject(value);
    assert.equal(loaded.project, null);
    assert.ok(loaded.error);
  }
});

test("duplicate legacy IDs reject migration before ambiguous positions can be lost", () => {
  const original = legacyFixture();
  original.nodes[1].id = original.nodes[0].id;
  const loaded = loadTransportProject(original);
  assert.equal(loaded.project, null);
  assert.match(loaded.error ?? "", /duplicate node id/);
});

test("v2 duplicate node IDs are rejected before the canvas can merge blocks", () => {
  const project = richProject();
  project.workflow.nodes[1].id = project.workflow.nodes[0].id;
  const loaded = loadTransportProject(project);
  assert.equal(loaded.project, null);
  assert.match(loaded.error ?? "", /duplicate node id/);
});

test("v2 duplicate edge IDs are rejected before the canvas can merge connections", () => {
  const project = richProject();
  project.workflow.edges.push({ ...project.workflow.edges[0] });
  const loaded = loadTransportProject(project);
  assert.equal(loaded.project, null);
  assert.match(loaded.error ?? "", /duplicate edge id/);
});

test("registry yields independent multi-port values and unknown actions have no implicit ports", () => {
  const node = createModelNode("transport.traffic_assignment", "assignment");
  const ports = getNodePorts(node);
  assert.deepEqual(ports.inputs.map((port) => port.id), ["demand", "network"]);
  assert.ok(ports.inputs.every((port) => port.required));
  ports.inputs[0].label = "mutated";
  assert.notEqual(getNodePorts(node).inputs[0].label, "mutated");
  assert.deepEqual(getNodePorts(createModelNode("legacy.custom", "custom")), { inputs: [], outputs: [] });
});

test("semantic types are independent of file formats and unknown output cannot satisfy a typed input", () => {
  const node = createDataNode({ kind: "file", format: "csv", path: "C:\\input.csv", dataType: "matrix.od" }, "Demand", "data");
  assert.equal(getNodePorts(node).outputs[0].dataType, "matrix.od");
  assert.equal(isCompatibleDataType("matrix.od", "matrix.od"), true);
  assert.equal(isCompatibleDataType("network.road", "matrix.od"), false);
  assert.equal(isCompatibleDataType("any", "matrix.od"), false);
  assert.equal(isCompatibleDataType("matrix.od", "any"), true);
});
