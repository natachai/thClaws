import assert from "node:assert/strict";
import test from "node:test";
import { resultViewerReducer, type ResultViewerState } from "../src/components/transport/useResultViewer.ts";
import { DEMO_TRANSPORT_RESULT } from "../src/components/transport/demoTransportResult.ts";

test("switching result representations keeps the exact shared dataset", () => {
  let state: ResultViewerState = { dataset: DEMO_TRANSPORT_RESULT, view: "gis" };
  for (const view of ["data", "chart", "gis"] as const) {
    state = resultViewerReducer(state, { type: "select-view", view });
    assert.equal(state.dataset, DEMO_TRANSPORT_RESULT);
    assert.equal(state.view, view);
  }
  assert.equal(resultViewerReducer(state, { type: "select-view", view: "gis" }), state);
});

test("opening another result changes dataset and requested view atomically", () => {
  const dataset = { ...DEMO_TRANSPORT_RESULT, id: "assignment-result", name: "Assignment", sourceNodeId: "assignment-1", origin: "model" as const };
  const state = resultViewerReducer({ dataset: DEMO_TRANSPORT_RESULT, view: "gis" }, { type: "open", dataset, view: "data" });
  assert.deepEqual(state, { dataset, view: "data" });
});

test("view selection also supports no result being selected", () => {
  const state = resultViewerReducer({ dataset: null, view: "gis" }, { type: "select-view", view: "chart" });
  assert.deepEqual(state, { dataset: null, view: "chart" });
});
