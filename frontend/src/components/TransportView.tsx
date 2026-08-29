import { useEffect, useRef, useState } from "react";
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import { GISViewer } from "./transport/GISViewer";
import { NodeLibrary } from "./transport/NodeLibrary";
import { PanelSplitter } from "./transport/PanelSplitter";
import { WorkflowCanvas } from "./transport/WorkflowCanvas";
import { TransportProjectToolbar, type SavedTransportProject } from "./transport/TransportProjectToolbar";
import { TransportValidationPanel } from "./transport/TransportValidationPanel";
import { ALL_TRANSPORT_NODE_TYPES, INITIAL_TRANSPORT_PROJECT, createEmptyTransportProject, parseTransportProject, type TransportWorkflowNode } from "./transport/transportTypes";
import { validateTransportProject, type TransportValidationResult } from "./transport/transportValidation";
import { send, subscribe } from "../hooks/useIPC";

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
  const [project, setProject] = useState(INITIAL_TRANSPORT_PROJECT);
  const nextNodeIdRef = useRef(project.nodes.length);
  const [dirty, setDirty] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedTransportProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [validation, setValidation] = useState<TransportValidationResult | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);

  function onNodesChange(changes: NodeChange<TransportWorkflowNode>[]) {
    setProject((current) => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) }));
    if (changes.some((change) => change.type !== "select" && change.type !== "dimensions")) {
      setDirty(true);
      setValidation(null);
    }
  }

  function onEdgesChange(changes: EdgeChange[]) {
    setProject((current) => ({ ...current, edges: applyEdgeChanges(changes, current.edges) }));
    if (changes.some((change) => change.type !== "select")) {
      setDirty(true);
      setValidation(null);
    }
  }

  function onAddNode(transportType: string, position: { x: number; y: number }) {
    const definition = ALL_TRANSPORT_NODE_TYPES.find((item) => item.transportType === transportType);
    if (!definition) return;
    nextNodeIdRef.current += 1;
    const isDataNode = "dataType" in definition;
    setProject((current) => ({
      ...current,
      nodes: [...current.nodes, {
        id: `transport-${nextNodeIdRef.current}`,
        type: "transport",
        position,
        data: {
          label: definition.label,
          transportType: definition.transportType,
          category: isDataNode ? "data" : "model",
          inputDataType: "inputDataType" in definition ? definition.inputDataType : undefined,
          outputDataType: isDataNode ? definition.dataType : ("outputDataType" in definition ? definition.outputDataType : undefined),
        },
      }],
    }));
    setDirty(true);
    setValidation(null);
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setProject((current) => ({
      ...current,
      edges: current.edges.some((edge) => edge.source === connection.source && edge.target === connection.target)
        ? current.edges
        : addEdge({ ...connection, type: "smoothstep" }, current.edges),
    }));
    setDirty(true);
    setValidation(null);
  }

  function resetNodeCounter(nodes: TransportWorkflowNode[]) {
    nextNodeIdRef.current = nodes.reduce((maximum, node) => {
      const match = /^transport-(\d+)$/.exec(node.id);
      return Math.max(maximum, match ? Number(match[1]) : 0);
    }, 0);
  }

  function newProject() {
    if (dirty && !window.confirm("Start a new Transport project and discard unsaved changes?")) return;
    const next = createEmptyTransportProject();
    setProject(next);
    resetNodeCounter(next.nodes);
    setSelectedProjectId("");
    setDirty(false);
    setValidation(null);
    setProjectStatus("New Transport project created.");
  }

  function saveProject() {
    const name = project.metadata.name?.trim() ?? "";
    if (!name) {
      setProjectStatus("Enter a project name before saving.");
      return;
    }
    const projectToSave = { ...project, metadata: { ...project.metadata, name, updatedAt: new Date().toISOString() } };
    setProject(projectToSave);
    setProjectStatus("Saving project…");
    send({ type: "transport_project_save", name, project: projectToSave });
  }

  function openProject() {
    if (!selectedProjectId) return;
    if (dirty && !window.confirm("Open the selected project and discard unsaved changes?")) return;
    setProjectStatus("Opening project…");
    send({ type: "transport_project_load", id: selectedProjectId });
  }

  function runValidation(forRun = false) {
    const result = validateTransportProject(project);
    setValidation(result);
    setProjectStatus(
      forRun
        ? result.valid
          ? "Workflow is valid. Execution engine is the next backend milestone; no calculation was started."
          : "Run blocked: fix the workflow errors below."
        : result.valid
          ? "Workflow validation passed."
          : "Workflow validation failed.",
    );
  }

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "transport_project_list") {
        setSavedProjects(Array.isArray(msg.projects) ? msg.projects as SavedTransportProject[] : []);
        if (msg.ok === false) setProjectStatus(`Could not list projects: ${String(msg.error ?? "unknown error")}`);
      } else if (msg.type === "transport_project_saved") {
        if (msg.ok === true && msg.project && typeof msg.project === "object") {
          const summary = msg.project as SavedTransportProject;
          setSelectedProjectId(summary.id);
          setDirty(false);
          setProjectStatus(`Saved ${summary.name}.`);
          send({ type: "transport_project_list" });
        } else {
          setProjectStatus(`Save failed: ${String(msg.error ?? "unknown error")}`);
        }
      } else if (msg.type === "transport_project_loaded") {
        const loaded = parseTransportProject(msg.project);
        if (msg.ok === true && loaded) {
          setProject(loaded);
          resetNodeCounter(loaded.nodes);
          setDirty(false);
          setValidation(null);
          setProjectStatus(`Opened ${loaded.metadata.name ?? "Transport project"}.`);
        } else {
          setProjectStatus(`Open failed: ${String(msg.error ?? "unsupported or invalid project format")}`);
        }
      }
    });
    send({ type: "transport_project_list" });
    return unsub;
  }, []);

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
          dirty={dirty}
          projects={savedProjects}
          selectedProjectId={selectedProjectId}
          onProjectNameChange={(name) => {
            setProject((current) => ({ ...current, metadata: { ...current.metadata, name } }));
            setDirty(true);
          }}
          onSelectProject={setSelectedProjectId}
          onNew={newProject}
          onOpen={openProject}
          onSave={saveProject}
          onValidate={() => runValidation(false)}
          onRun={() => runValidation(true)}
        />
      </header>

      <TransportValidationPanel result={validation} status={projectStatus} onClose={() => { setValidation(null); setProjectStatus(null); }} />

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
            nodes={project.nodes}
            edges={project.edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onAddNode={onAddNode}
            onConnect={onConnect}
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
