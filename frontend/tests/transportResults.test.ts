import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_TRANSPORT_RESULT } from "../src/components/transport/demoTransportResult.ts";
import { formatTransportResultValue } from "../src/components/transport/transportResultTypes.ts";
import type { TransportResultDataset } from "../src/components/transport/transportResultTypes.ts";

test("result demo contains the exact supplied three-zone example", () => {
  assert.deepEqual(DEMO_TRANSPORT_RESULT.fields.map((field) => field.label), ["TAZ", "Population", "Employment", "Production", "Attraction"]);
  assert.deepEqual(DEMO_TRANSPORT_RESULT.rows.map((row) => row.values), [
    { taz: "001", population: 12430, employment: 8240, production: 4821, attraction: 3921 },
    { taz: "002", population: 9821, employment: 11302, production: 3824, attraction: 5127 },
    { taz: "003", population: 18231, employment: 7921, production: 6120, attraction: 4011 },
  ]);
});

test("demo is explicitly marked and does not invent a model output or geometry", () => {
  assert.equal(DEMO_TRANSPORT_RESULT.origin, "demo");
  assert.equal(DEMO_TRANSPORT_RESULT.sourceNodeId, undefined);
  assert.equal(DEMO_TRANSPORT_RESULT.sourcePortId, undefined);
  assert.equal(DEMO_TRANSPORT_RESULT.geometry, undefined);
});

test("result rows and fields use unique stable identities independent of array position", () => {
  const { fields, rows } = DEMO_TRANSPORT_RESULT;
  assert.equal(new Set(fields.map((field) => field.id)).size, fields.length);
  assert.deepEqual(rows.map((row) => row.id), ["taz-001", "taz-002", "taz-003"]);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  const reordered = [...rows].reverse();
  assert.equal(reordered.find((row) => row.id === "taz-001")?.values.taz, "001");
  for (const row of rows) assert.deepEqual(Object.keys(row.values), fields.map((field) => field.id));
});

test("formatting preserves identifier strings and displays numeric grouping without integer coercion", () => {
  assert.equal(formatTransportResultValue("001"), "001");
  assert.equal(formatTransportResultValue(12430), "12,430");
  assert.equal(formatTransportResultValue(12.34567), "12.34567");
  assert.equal(formatTransportResultValue(-0.25), "-0.25");
  assert.equal(formatTransportResultValue(0), "0");
});

test("formatting distinguishes missing values from false and empty strings", () => {
  assert.equal(formatTransportResultValue(null), "—");
  assert.equal(formatTransportResultValue(undefined), "—");
  assert.equal(formatTransportResultValue(NaN), "—");
  assert.equal(formatTransportResultValue(Infinity), "—");
  assert.equal(formatTransportResultValue(false), "false");
  assert.equal(formatTransportResultValue(true), "true");
  assert.equal(formatTransportResultValue(""), "");
});

test("result contract supports non-zone fields, empty datasets and optional geometry linkage", () => {
  const network: TransportResultDataset = {
    id: "road-flows",
    name: "Road link results",
    origin: "model",
    sourceNodeId: "assignment-node",
    sourcePortId: "link_flows",
    fields: [{ id: "link", label: "Link", type: "string" }, { id: "flow", label: "Flow", type: "number", unit: "veh/h" }],
    rows: [],
    geometry: { format: "geojson", rowIdProperty: "resultRowId", data: { type: "FeatureCollection", features: [] }, crs: "EPSG:4326" },
  };
  assert.equal(network.rows.length, 0);
  assert.equal(network.fields[1].unit, "veh/h");
  assert.equal(network.geometry?.rowIdProperty, "resultRowId");
  assert.equal(formatTransportResultValue(network.rows[0]?.values.flow), "—");
});

test("demo preview round-trips as JSON without modifying its source or result identities", () => {
  const before = JSON.stringify(DEMO_TRANSPORT_RESULT);
  const loaded = JSON.parse(before);
  assert.deepEqual(loaded, DEMO_TRANSPORT_RESULT);
  DEMO_TRANSPORT_RESULT.rows.forEach((row) => Object.values(row.values).forEach(formatTransportResultValue));
  assert.equal(JSON.stringify(DEMO_TRANSPORT_RESULT), before);
});
