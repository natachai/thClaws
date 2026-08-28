import { Focus, Minimize2 } from "lucide-react";

type WorkflowCanvasProps = {
  focused: boolean;
  onToggleFocus: () => void;
};

export function WorkflowCanvas({
  focused,
  onToggleFocus,
}: WorkflowCanvasProps) {
  return (
    <section
      className="flex h-full min-h-72 flex-col overflow-hidden rounded-lg border lg:min-h-96 xl:min-h-0"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <header
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Workflow Canvas
        </h2>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleFocus}
          className="flex h-7 w-7 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          title={focused ? "Restore Panel Layout" : "Focus Workflow"}
          aria-label={focused ? "Restore Panel Layout" : "Focus Workflow"}
        >
          {focused ? <Minimize2 size={14} /> : <Focus size={14} />}
        </button>
      </header>

      <div
        className="flex flex-1 items-center justify-center p-6 text-center"
        style={{
          backgroundColor: "var(--bg-primary)",
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          color: "var(--text-secondary)",
        }}
      >
        <p
          className="rounded-md border border-dashed px-4 py-2 text-xs"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          Drag modelling components here
        </p>
      </div>
    </section>
  );
}
