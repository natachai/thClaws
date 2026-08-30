import { Database, GripVertical, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { MODEL_ACTIONS, type TransportModelNode } from "./transportTypes";

type NodeLibraryProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dataNodes: TransportModelNode[];
  onCreateData: () => void;
  onEditNode: (id: string) => void;
  onAddModel: (actionId: string) => void;
};

export function NodeLibrary({
  collapsed,
  onToggleCollapsed,
  dataNodes,
  onCreateData,
  onEditNode,
  onAddModel,
}: NodeLibraryProps) {
  return (
    <section
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border ${collapsed ? "items-center" : ""}`}
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <header
        className={`flex shrink-0 border-b ${collapsed ? "h-full flex-col items-center gap-3 border-b-0 px-1 py-2" : "items-start gap-3 px-4 py-3"}`}
        style={{ borderColor: "var(--border)" }}
      >
        <div className={collapsed ? "hidden" : "min-w-0 flex-1"}>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Node Library
          </h2>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            Transport modelling components
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          title={collapsed ? "Expand Node Library" : "Collapse Node Library"}
          aria-label={collapsed ? "Expand Node Library" : "Collapse Node Library"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        {collapsed && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]"
            style={{ color: "var(--text-secondary)" }}
            aria-hidden="true"
          >
            Nodes
          </span>
        )}
      </header>

      <div
        className={`flex flex-col gap-2 overflow-auto p-3 ${collapsed ? "invisible absolute inset-0 pointer-events-none" : ""}`}
        aria-hidden={collapsed}
      >
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Data</p>
        <button type="button" onClick={onCreateData} className="flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs hover:bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--accent-dim)", color: "var(--text-primary)" }}><Plus size={15} />Create new data</button>
        {dataNodes.map((node) => <button key={node.id} type="button" onClick={() => onEditNode(node.id)} className="flex items-center gap-2 rounded border px-2 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} title="Edit data source and details"><Database size={13} className="shrink-0" /><span className="min-w-0 truncate">{node.label}</span></button>)}
        <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Modelling</p>
        {MODEL_ACTIONS.map((node) => (
          <NodeLibraryButton key={node.actionId} label={node.label} actionId={node.actionId} onAdd={() => onAddModel(node.actionId)} description="Click or drag to add" />
        ))}
      </div>
    </section>
  );
}

function NodeLibraryButton({ label, actionId, description, onAdd }: { label: string; actionId: string; description: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      draggable
      onClick={onAdd}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/thclaws-transport-node", actionId);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors hover:border-[var(--accent-dim)]"
      style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)", cursor: "grab" }}
      aria-label={`${label} transport component`}
    >
      <GripVertical size={14} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        <span className="block text-[10px]" style={{ color: "var(--text-secondary)" }}>{description}</span>
      </span>
    </button>
  );
}
