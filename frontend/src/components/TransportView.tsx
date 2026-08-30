import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ResultViewer } from "./transport/ResultViewer";
import { NodeLibrary } from "./transport/NodeLibrary";
import { PanelSplitter } from "./transport/PanelSplitter";
import { WorkflowCanvas } from "./transport/WorkflowCanvas";
import { TransportProjectToolbar } from "./transport/TransportProjectToolbar";
import { TransportValidationPanel } from "./transport/TransportValidationPanel";
import { type TransportDataSource } from "./transport/transportTypes";
import { useTransportProject } from "./transport/useTransportProject";
import { toFlowNodes, toFlowEdges } from "./transport/transportFlow";
import { CreateDataDialog } from "./transport/CreateDataDialog";
import { TransportNodeDetails } from "./transport/TransportNodeDetails";
import { DEMO_TRANSPORT_RESULT } from "./transport/demoTransportResult";
import { useResultViewer } from "./transport/useResultViewer";

type TransportViewProps = {
  active: boolean;
};

type PanelSizes = [nodeLibrary: number, workflowCanvas: number, resultViewer: number];

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
  resultViewer: boolean;
};

const COLLAPSED_RAIL_WIDTH = 44;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function TransportView({ active }: TransportViewProps) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const nodePanelRef = useRef<HTMLDivElement | null>(null);
  const workflowPanelRef = useRef<HTMLDivElement | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const preMaximizeScrollRef = useRef<{ top: number; left: number } | null>(null);
  const preFocusCollapsedRef = useRef<CollapsedPanels>({
    nodeLibrary: false,
    resultViewer: false,
  });
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(DEFAULT_PANEL_SIZES);
  const [compact, setCompact] = useState(false);
  const [resultMaximized, setResultMaximized] = useState(false);
  const [nodeLibraryCollapsed, setNodeLibraryCollapsed] = useState(false);
  const [resultViewerCollapsed, setResultViewerCollapsed] = useState(false);
  const [workflowFocused, setWorkflowFocused] = useState(false);
  const results = useResultViewer(DEMO_TRANSPORT_RESULT, revealResultViewer);
  const editor = useTransportProject();
  const { project } = editor;
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [dataDialog, setDataDialog] = useState<{ editingId?: string } | null>(null);
  const detailsNode = project.workflow.nodes.find((node) => node.id === detailsId);
  const sourceNode = project.workflow.nodes.find((node) => node.id === dataDialog?.editingId);
  const flowNodes = useMemo(() => toFlowNodes(project, editor.selectedNodes, setDetailsId, editor.measurements), [project, editor.selectedNodes, editor.measurements, setDetailsId]);
  const flowEdges = useMemo(() => toFlowEdges(project, editor.selectedEdges), [project, editor.selectedEdges]);

  function registerSource(source: TransportDataSource, label: string) {
    if (sourceNode) {
      editor.updateNode({ ...sourceNode, source, label, actionId: `data.${source.format}` });
      setDetailsId(sourceNode.id);
    } else {
      setDetailsId(editor.addData(source, label));
    }
    setDataDialog(null);
  }

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
    if (!resultMaximized || !active || detailsNode || dataDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResultMaximized(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resultMaximized, active, detailsNode, dataDialog]);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (resultMaximized) {
      workspace.scrollTo(0, 0);
    } else if (preMaximizeScrollRef.current) {
      const { top, left } = preMaximizeScrollRef.current;
      workspace.scrollTo(left, top);
      preMaximizeScrollRef.current = null;
    }
  }, [resultMaximized]);

  function toggleResultMaximize() {
    const workspace = workspaceRef.current;
    // Capture before the Result panel becomes absolute; compact grid reflow
    // can otherwise clamp scrollTop before the layout effect gets to read it.
    if (!resultMaximized && workspace) {
      preMaximizeScrollRef.current = { top: workspace.scrollTop, left: workspace.scrollLeft };
    }
    setResultMaximized((value) => !value);
  }

  function currentPanelWidths(): PanelSizes {
    const measured: PanelSizes = [
      nodePanelRef.current?.getBoundingClientRect().width ?? 0,
      workflowPanelRef.current?.getBoundingClientRect().width ?? 0,
      resultPanelRef.current?.getBoundingClientRect().width ?? 0,
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
      setResultViewerCollapsed(preFocusCollapsedRef.current.resultViewer);
      setWorkflowFocused(false);
      return;
    }
    setNodeLibraryCollapsed((value) => !value);
  }

  // Future node actions call results.openResult(dataset, view); opening a result
  // also reveals its panel without changing the saved panel proportions.
  function revealResultViewer() {
    if (workflowFocused) {
      setNodeLibraryCollapsed(preFocusCollapsedRef.current.nodeLibrary);
      setWorkflowFocused(false);
    }
    setResultViewerCollapsed(false);
  }

  function toggleResultViewer() {
    if (workflowFocused) {
      setNodeLibraryCollapsed(preFocusCollapsedRef.current.nodeLibrary);
      setResultViewerCollapsed(false);
      setWorkflowFocused(false);
      return;
    }
    setResultViewerCollapsed((value) => !value);
  }

  function toggleWorkflowFocus() {
    if (workflowFocused) {
      setNodeLibraryCollapsed(preFocusCollapsedRef.current.nodeLibrary);
      setResultViewerCollapsed(preFocusCollapsedRef.current.resultViewer);
      setWorkflowFocused(false);
      return;
    }
    preFocusCollapsedRef.current = {
      nodeLibrary: nodeLibraryCollapsed,
      resultViewer: resultViewerCollapsed,
    };
    setNodeLibraryCollapsed(true);
    setResultViewerCollapsed(true);
    setWorkflowFocused(true);
  }

  const gridTemplateColumns = compact
    ? "minmax(0, 1fr)"
    : `${nodeLibraryCollapsed ? `${COLLAPSED_RAIL_WIDTH}px` : `minmax(${MIN_PANEL_WIDTHS[0]}px, ${panelSizes[0] * 100}fr)`} ${nodeLibraryCollapsed ? 0 : SPLITTER_WIDTH}px minmax(${MIN_PANEL_WIDTHS[1]}px, ${panelSizes[1] * 100}fr) ${resultViewerCollapsed ? 0 : SPLITTER_WIDTH}px ${resultViewerCollapsed ? `${COLLAPSED_RAIL_WIDTH}px` : `minmax(${MIN_PANEL_WIDTHS[2]}px, ${panelSizes[2] * 100}fr)`}`;
  const hiddenBehindResult = resultMaximized
    ? "opacity-0 pointer-events-none"
    : "";

  return (
    <div
      className={`relative flex h-full flex-col gap-4 overflow-hidden p-4 sm:p-6 ${
        active ? "" : "invisible pointer-events-none"
      }`}
      style={{
        background: "var(--bg-primary)",
        // Keep the component mounted for state preservation, but remove its
        // entire render subtree from the compositor while another tab is
        // active. React Flow owns absolute/SVG layers that can otherwise
        // outlive an ancestor's visibility boundary in WebView2.
        display: active ? "flex" : "none",
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
      }}
      aria-hidden={!active}
    >
      <header className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-48 flex-1">
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Transport Model</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Transport modelling workspace</p>
        </div>
        <TransportProjectToolbar
          projectName={project.metadata.name ?? ""}
          dirty={editor.dirty}
          busy={editor.busy}
          projects={editor.savedProjects}
          selectedProjectId={editor.selectedProjectId}
          onProjectNameChange={editor.setProjectName}
          onSelectProject={editor.setSelectedProjectId}
          onNew={() => { editor.newProject(); setDetailsId(null); setDataDialog(null); }}
          onOpen={editor.openProject}
          onSave={() => editor.saveProject()}
          onSaveAs={() => editor.saveProject(true)}
          onValidate={() => editor.runValidation(false)}
          onRun={() => editor.runValidation(true)}
        />
      </header>

      <TransportValidationPanel result={editor.validation} status={editor.status} onClose={editor.clearStatus} />

      <div
        ref={workspaceRef}
        className={`relative grid min-h-0 flex-1 ${resultMaximized ? "overflow-hidden" : "overflow-auto"}`}
        style={{
          gridTemplateColumns,
          gridTemplateRows: compact ? "auto auto auto" : "minmax(0, 1fr)",
          gap: compact ? "12px" : "0",
        }}
      >
        <div
          ref={nodePanelRef}
          inert={resultMaximized}
          aria-hidden={resultMaximized}
          className={`min-h-64 min-w-0 ${nodeLibraryCollapsed ? "" : "pr-1"} ${hiddenBehindResult}`}
          style={{ gridColumn: "1" }}
        >
          <NodeLibrary
            collapsed={nodeLibraryCollapsed}
            onToggleCollapsed={toggleNodeLibrary}
            dataNodes={project.workflow.nodes.filter((node) => node.actionId.startsWith("data."))}
            onCreateData={() => { setDetailsId(null); setDataDialog({}); }}
            onEditNode={setDetailsId}
            onAddModel={(actionId) => editor.addModel(actionId)}
          />
        </div>
        <div
          className={compact || resultMaximized || nodeLibraryCollapsed ? "hidden" : "block"}
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
          inert={resultMaximized}
          aria-hidden={resultMaximized}
          className={`min-w-0 px-1 ${hiddenBehindResult}`}
          style={{ gridColumn: compact ? "1" : "3" }}
        >
          <WorkflowCanvas
            focused={workflowFocused}
            onToggleFocus={toggleWorkflowFocus}
            nodes={flowNodes}
            edges={flowEdges}
            viewport={project.ui.viewport}
            active={active && !detailsNode && !dataDialog && !resultMaximized}
            onViewportChange={editor.setViewport}
            onNodesChange={editor.onNodesChange}
            onEdgesChange={editor.onEdgesChange}
            onAddNode={editor.addModel}
            onConnect={editor.onConnect}
            onEditNode={setDetailsId}
          />
        </div>
        <div
          className={compact || resultMaximized || resultViewerCollapsed ? "hidden" : "block"}
          style={{ gridColumn: compact ? "1" : "4" }}
        >
          <PanelSplitter
            label="Resize Workflow Canvas and Result Viewer"
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
          ref={resultPanelRef}
          className={
            resultMaximized
              ? "absolute inset-0 z-10 min-h-0 min-w-0"
              : `min-h-64 min-w-0 ${resultViewerCollapsed ? "" : "pl-1"}`
          }
          style={{
            gridColumn: resultMaximized ? "1 / -1" : compact ? "1" : "5",
          }}
        >
          <ResultViewer
            dataset={results.dataset}
            view={results.view}
            onViewChange={results.selectView}
            collapsed={resultViewerCollapsed && !resultMaximized}
            maximized={resultMaximized}
            onToggleCollapsed={toggleResultViewer}
            onToggleMaximize={toggleResultMaximize}
          />
        </div>
      </div>
      {detailsNode && !dataDialog && <TransportNodeDetails
        key={detailsNode.id}
        active={active}
        node={detailsNode}
        project={project}
        onUpdate={editor.updateNode}
        onBindInput={(portId, source) => editor.bindInput({ nodeId: detailsNode.id, portId }, source)}
        onEditSource={() => { setDataDialog({ editingId: detailsNode.id }); setDetailsId(null); }}
        onClose={() => setDetailsId(null)}
      />}
      {dataDialog && <CreateDataDialog
        key={dataDialog.editingId ?? "new-data"}
        active={active}
        initialSource={sourceNode?.source}
        initialLabel={sourceNode?.label}
        onCreate={registerSource}
        onClose={() => setDataDialog(null)}
      />}
    </div>
  );
}
