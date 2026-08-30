import { useReducer } from "react";
import type { TransportResultDataset, TransportResultView } from "./transportResultTypes";

export type ResultViewerState = {
  dataset: TransportResultDataset | null;
  view: TransportResultView;
};

type ResultViewerAction =
  | { type: "open"; dataset: TransportResultDataset; view: TransportResultView }
  | { type: "select-view"; view: TransportResultView };

export function resultViewerReducer(state: ResultViewerState, action: ResultViewerAction): ResultViewerState {
  if (action.type === "open") return { dataset: action.dataset, view: action.view };
  return action.view === state.view ? state : { ...state, view: action.view };
}

// Presentation state only: demo/results are not written into the workflow JSON.
// Future node actions can openResult(dataset, "data") without knowing UI internals.
export function useResultViewer(initialDataset: TransportResultDataset | null = null, onOpen?: () => void) {
  const [state, dispatch] = useReducer(resultViewerReducer, { dataset: initialDataset, view: "gis" });
  return {
    ...state,
    selectView: (view: TransportResultView) => dispatch({ type: "select-view", view }),
    openResult: (dataset: TransportResultDataset, view: TransportResultView = "gis") => {
      dispatch({ type: "open", dataset, view });
      onOpen?.();
    },
  };
}
