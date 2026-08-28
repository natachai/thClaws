import { useEffect, useRef, useState } from "react";
import { GISViewer } from "./transport/GISViewer";
import { NodeLibrary } from "./transport/NodeLibrary";
import { PanelSplitter } from "./transport/PanelSplitter";
import { WorkflowCanvas } from "./transport/WorkflowCanvas";

type TransportViewProps = {
  active: boolean;
};

type PanelSizes = [nodeLibrary: number, workflowCanvas: number, gisViewer: number];

const DEFAULT_PANEL_SIZES: PanelSizes = [0.18, 0.52, 0.3];
const MIN_PANEL_WIDTHS: PanelSizes = [160, 300, 250];
const SPLITTER_WIDTH = 8;
const COMPACT_LAYOUT_WIDTH =
  MIN_PANEL_WIDTHS[0] +
  MIN_PANEL_WIDTHS[1] +
  MIN_PANEL_WIDTHS[2] +
  SPLITTER_WIDTH * 2;

type DragState = {
  divider: 0 | 1;
  startX: number;
  startWidths: PanelSizes;
  pairSizeTotal: number;
};

type CollapsedPanels = {
  nodeLibrary: boolean;
  gisViewer: boolean;
};

const COLLAPSED_RAIL_WIDTH = 44;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function TransportView({ active }: TransportViewProps) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const nodePanelRef = useRef<HTMLDivElement | null>(null);
  const workflowPanelRef = useRef<HTMLDivElement | null>(null);
  const gisPanelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const preFocusCollapsedRef = useRef<CollapsedPanels>({
    nodeLibrary: false,
    gisViewer: false,
  });
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(DEFAULT_PANEL_SIZES);
  const [compact, setCompact] = useState(false);
  const [gisMaximized, setGisMaximized] = useState(false);
  const [nodeLibraryCollapsed, setNodeLibraryCollapsed] = useState(false);
  const [gisViewerCollapsed, setGisViewerCollapsed] = useState(false);
  const [workflowFocused, setWorkflowFocused] = useState(false);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const observer = new ResizeObserver(([entry]) => {
      setCompact(entry.contentRect.width < COMPACT_LAYOUT_WIDTH);
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!gisMaximized) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGisMaximized(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gisMaximized]);

  function currentPanelWidths(): PanelSizes {
    const measured: PanelSizes = [
      nodePanelRef.current?.getBoundingClientRect().width ?? 0,
      workflowPanelRef.current?.getBoundingClientRect().width ?? 0,
      gisPanelRef.current?.getBoundingClientRect().width ?? 0,
    ];
    if (measured.every((width) => width > 0)) return measured;
    const workspaceWidth = workspaceRef.current?.clientWidth ?? 0;
    return panelSizes.map((size) => size * workspaceWidth) as PanelSizes;
  }

  function resizeDivider(divider: 0 | 1, startWidths: PanelSizes, delta: number) {
    const widths: PanelSizes = [...startWidths];
    const leftIndex = divider;
    const rightIndex = divider + 1;
    const pairWidth = startWidths[leftIndex] + startWidths[rightIndex];
    widths[leftIndex] = clamp(
      startWidths[leftIndex] + delta,
      MIN_PANEL_WIDTHS[leftIndex],
      pairWidth - MIN_PANEL_WIDTHS[rightIndex],
    );
    widths[rightIndex] = pairWidth - widths[leftIndex];
    return widths;
  }

  function beginResize(divider: 0 | 1, clientX: number) {
    const startWidths = currentPanelWidths();
    dragRef.current = {
      divider,
      startX: clientX,
      startWidths,
      pairSizeTotal: panelSizes[divider] + panelSizes[divider + 1],
    };
  }

  function continueResize(clientX: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const widths = resizeDivider(
      drag.divider,
      drag.startWidths,
      clientX - drag.startX,
    );
    const pairWidth = widths[drag.divider] + widths[drag.divider + 1];
    setPanelSizes((current) => {
      const next: PanelSizes = [...current];
      next[drag.divider] =
        drag.pairSizeTotal * (widths[drag.divider] / pairWidth);
      next[drag.divider + 1] =
        drag.pairSizeTotal * (widths[drag.divider + 1] / pairWidth);
      return next;
    });
  }

  function keyboardResize(divider: 0 | 1, delta: number) {
    const currentWidths = currentPanelWidths();
    const widths = resizeDivider(
      divider,
      currentWidths,
      delta,
    );
    const pairWidth = widths[divider] + widths[divider + 1];
    setPanelSizes((current) => {
      const next: PanelSizes = [...current];
      const pairSizeTotal = current[divider] + current[divider + 1];
      next[divider] = pairSizeTotal * (widths[divider] / pairWidth);
      next[divider + 1] = pairSizeTotal * (widths[divider + 1] / pairWidth);
      return next;
    });
  }

  function toggleNodeLibrary() {
    if (workflowFocused) {
      setNodeLibraryCollapsed(false);
      setGisViewerCollapsed(preFocusCollapsedRef.current.gisViewer);
      setWorkflowFocused(false);
      return;
    }
    setNodeLibraryCollapsed((value) => !value);
  }

  function toggleGisViewer() {
    if (workflowFocused) {
      setNodeLibraryCollapsed(preFocusCollapsedRef.current.nodeLibrary);
      setGisViewerCollapsed(false);
      setWorkflowFocused(false);
      return;
    }
    setGisViewerCollapsed((value) => !value);
  }

  function toggleWorkflowFocus() {
    if (workflowFocused) {
      setNodeLibraryCollapsed(preFocusCollapsedRef.current.nodeLibrary);
      setGisViewerCollapsed(preFocusCollapsedRef.current.gisViewer);
      setWorkflowFocused(false);
      return;
    }
    preFocusCollapsedRef.current = {
      nodeLibrary: nodeLibraryCollapsed,
      gisViewer: gisViewerCollapsed,
    };
    setNodeLibraryCollapsed(true);
    setGisViewerCollapsed(true);
    setWorkflowFocused(true);
  }

  const gridTemplateColumns = compact
    ? "minmax(0, 1fr)"
    : `${nodeLibraryCollapsed ? `${COLLAPSED_RAIL_WIDTH}px` : `minmax(${MIN_PANEL_WIDTHS[0]}px, ${panelSizes[0] * 100}fr)`} ${nodeLibraryCollapsed ? 0 : SPLITTER_WIDTH}px minmax(${MIN_PANEL_WIDTHS[1]}px, ${panelSizes[1] * 100}fr) ${gisViewerCollapsed ? 0 : SPLITTER_WIDTH}px ${gisViewerCollapsed ? `${COLLAPSED_RAIL_WIDTH}px` : `minmax(${MIN_PANEL_WIDTHS[2]}px, ${panelSizes[2] * 100}fr)`}`;
  const hiddenBehindGis = gisMaximized
    ? "invisible pointer-events-none"
    : "";

  return (
    <div
      className="flex h-full flex-col gap-4 overflow-hidden p-4 sm:p-6"
      style={{ background: "var(--bg-primary)" }}
      aria-hidden={!active}
    >
      <header>
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Transport Model
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Transport modelling workspace
        </p>
      </header>

      <div
        ref={workspaceRef}
        className="relative grid min-h-0 flex-1 overflow-auto"
        style={{
          gridTemplateColumns,
          gridTemplateRows: compact ? "auto auto auto" : "minmax(0, 1fr)",
          gap: compact ? "12px" : "0",
        }}
      >
        <div
          ref={nodePanelRef}
          className={`min-h-64 min-w-0 ${nodeLibraryCollapsed ? "" : "pr-1"} ${hiddenBehindGis}`}
          style={{ gridColumn: "1" }}
        >
          <NodeLibrary
            collapsed={nodeLibraryCollapsed}
            onToggleCollapsed={toggleNodeLibrary}
          />
        </div>
        <div
          className={compact || gisMaximized || nodeLibraryCollapsed ? "hidden" : "block"}
          style={{ gridColumn: compact ? "1" : "2" }}
        >
          <PanelSplitter
            label="Resize Node Library and Workflow Canvas"
            onResizeStart={(clientX) => beginResize(0, clientX)}
            onResize={continueResize}
            onResizeEnd={() => {
              dragRef.current = null;
            }}
            onKeyboardResize={(delta) => keyboardResize(0, delta)}
            onReset={() => setPanelSizes(DEFAULT_PANEL_SIZES)}
          />
        </div>
        <div
          ref={workflowPanelRef}
          className={`min-w-0 px-1 ${hiddenBehindGis}`}
          style={{ gridColumn: compact ? "1" : "3" }}
        >
          <WorkflowCanvas
            focused={workflowFocused}
            onToggleFocus={toggleWorkflowFocus}
          />
        </div>
        <div
          className={compact || gisMaximized || gisViewerCollapsed ? "hidden" : "block"}
          style={{ gridColumn: compact ? "1" : "4" }}
        >
          <PanelSplitter
            label="Resize Workflow Canvas and GIS Viewer"
            onResizeStart={(clientX) => beginResize(1, clientX)}
            onResize={continueResize}
            onResizeEnd={() => {
              dragRef.current = null;
            }}
            onKeyboardResize={(delta) => keyboardResize(1, delta)}
            onReset={() => setPanelSizes(DEFAULT_PANEL_SIZES)}
          />
        </div>
        <div
          ref={gisPanelRef}
          className={
            gisMaximized
              ? "absolute inset-0 z-10 min-h-0 min-w-0"
              : `min-h-64 min-w-0 ${gisViewerCollapsed ? "" : "pl-1"}`
          }
          style={{
            gridColumn: gisMaximized ? "1 / -1" : compact ? "1" : "5",
          }}
        >
          <GISViewer
            collapsed={gisViewerCollapsed && !gisMaximized}
            maximized={gisMaximized}
            onToggleCollapsed={toggleGisViewer}
            onToggleMaximize={() => setGisMaximized((value) => !value)}
          />
        </div>
      </div>
    </div>
  );
}
