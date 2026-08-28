import { GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const TRANSPORT_NODES = [
  "Input Data",
  "Trip Generation",
  "Trip Distribution",
  "Modal Split",
  "Traffic Assignment",
  "Transit Assignment",
  "Skim",
] as const;

type NodeLibraryProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function NodeLibrary({
  collapsed,
  onToggleCollapsed,
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
        {TRANSPORT_NODES.map((node) => (
          <button
            key={node}
            type="button"
            className="flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--accent-dim)]"
            style={{
              background: "var(--bg-tertiary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              cursor: "grab",
            }}
            aria-label={`${node} modelling component`}
          >
            <GripVertical
              size={14}
              className="shrink-0"
              style={{ color: "var(--text-secondary)" }}
            />
            <span>{node}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
