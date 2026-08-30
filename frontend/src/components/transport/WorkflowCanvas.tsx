import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
  type Connection,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Focus, Maximize, Minus, Minimize2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { TransportNode } from "./TransportNode";
import { MODEL_ACTIONS } from "./transportTypes";
import type { TransportFlowEdge, TransportFlowNode } from "./transportFlow";

type WorkflowCanvasProps = {
  focused: boolean;
  onToggleFocus: () => void;
  nodes: TransportFlowNode[];
  edges: TransportFlowEdge[];
  viewport?: Viewport;
  active: boolean;
  onViewportChange: (viewport: Viewport) => void;
  onEditNode: (id: string) => void;
  onNodesChange: (changes: NodeChange<TransportFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onAddNode: (nodeType: string, position: { x: number; y: number }) => void;
  onConnect: (connection: Connection) => void;
};

const nodeTypes = { transport: TransportNode };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function WorkflowEditor({ nodes, edges, viewport, active, onViewportChange, onEditNode, onNodesChange, onEdgesChange, onAddNode, onConnect }: Omit<WorkflowCanvasProps, "focused" | "onToggleFocus">) {
  const [zoom, setZoom] = useState(1);
  const { screenToFlowPosition, fitView, getViewport, setViewport } = useReactFlow();

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const transportType = event.dataTransfer.getData("application/thclaws-transport-node");
      const definition = MODEL_ACTIONS.find((item) => item.actionId === transportType);
      if (!definition) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onAddNode(definition.actionId, position);
    },
    [onAddNode, screenToFlowPosition],
  );

  const changeZoom = (delta: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom + delta).toFixed(2))));
    setZoom(next);
    setViewport({ ...getViewport(), zoom: next }, { duration: 150 });
  };

  const resetZoom = () => {
    setZoom(1);
    setViewport({ ...getViewport(), zoom: 1 }, { duration: 150 });
  };

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        viewport={viewport}
        onViewportChange={onViewportChange}
        onNodeDoubleClick={(_, node) => onEditNode(node.id)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMove={(_, viewport) => setZoom(viewport.zoom)}
        fitView={!viewport}
        deleteKeyCode={active ? ["Backspace", "Delete"] : null}
        nodesDraggable={active}
        nodesConnectable={active}
        elementsSelectable={active}
        selectionOnDrag
        panOnDrag
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-md border border-dashed px-4 py-2 text-xs" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Drag modelling components here
          </p>
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded border p-0.5" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} aria-label="Workflow canvas zoom controls">
        <button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-40" style={{ color: "var(--text-secondary)" }} title="Zoom out" aria-label="Zoom out"><Minus size={13} /></button>
        <button type="button" onClick={resetZoom} className="min-w-12 rounded px-1 text-[10px] tabular-nums hover:bg-[var(--bg-tertiary)]" style={{ color: "var(--text-secondary)" }} title="Reset canvas zoom" aria-label={`Reset canvas zoom (${Math.round(zoom * 100)}%)`}>{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-40" style={{ color: "var(--text-secondary)" }} title="Zoom in" aria-label="Zoom in"><Plus size={13} /></button>
        <button type="button" onClick={resetZoom} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--bg-tertiary)]" style={{ color: "var(--text-secondary)" }} title="Reset canvas zoom" aria-label="Reset canvas zoom"><RotateCcw size={12} /></button>
        <button type="button" onClick={() => fitView({ duration: 200, padding: 0.2 })} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--bg-tertiary)]" style={{ color: "var(--text-secondary)" }} title="Fit workflow" aria-label="Fit workflow"><Maximize size={12} /></button>
        <button type="button" onClick={() => { onNodesChange(nodes.map((node) => ({ type: "remove", id: node.id }))); onEdgesChange(edges.map((edge) => ({ type: "remove", id: edge.id }))); }} disabled={nodes.length === 0 && edges.length === 0} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-40" style={{ color: "var(--text-secondary)" }} title="Clear workflow" aria-label="Clear workflow"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

export function WorkflowCanvas({ focused, onToggleFocus, ...editorProps }: WorkflowCanvasProps) {
  return (
    <section className="flex h-full min-h-72 flex-col overflow-hidden rounded-lg border lg:min-h-96 xl:min-h-0" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Workflow Canvas</h2>
        <div className="flex-1" />
        <button type="button" onClick={onToggleFocus} className="flex h-7 w-7 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} title={focused ? "Restore Panel Layout" : "Focus Workflow"} aria-label={focused ? "Restore Panel Layout" : "Focus Workflow"}>
          {focused ? <Minimize2 size={14} /> : <Focus size={14} />}
        </button>
      </header>
      <div className="min-h-0 flex-1" style={{ background: "var(--bg-primary)" }}>
        <ReactFlowProvider>
          <WorkflowEditor {...editorProps} />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
