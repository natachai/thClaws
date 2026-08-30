import { ChartColumn, Map, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Table2 } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";
import { GISView } from "./GISView";
import { DataView } from "./DataView";
import { ChartView } from "./ChartView";
import type { TransportResultDataset, TransportResultView } from "./transportResultTypes";

type ResultViewerProps = {
  dataset: TransportResultDataset | null;
  view: TransportResultView;
  onViewChange: (view: TransportResultView) => void;
  collapsed: boolean;
  maximized: boolean;
  onToggleCollapsed: () => void;
  onToggleMaximize: () => void;
};

const RESULT_TABS = [
  { id: "gis", label: "GIS", icon: Map },
  { id: "data", label: "Data", icon: Table2 },
  { id: "chart", label: "Chart", icon: ChartColumn },
] as const;

export function ResultViewer({ dataset, view, onViewChange, collapsed, maximized, onToggleCollapsed, onToggleMaximize }: ResultViewerProps) {
  const tabPrefix = useId();
  const tabRefs = useRef<Partial<Record<TransportResultView, HTMLButtonElement | null>>>({});

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % RESULT_TABS.length; break;
      case "ArrowLeft": next = (index + RESULT_TABS.length - 1) % RESULT_TABS.length; break;
      case "Home": next = 0; break;
      case "End": next = RESULT_TABS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const nextView = RESULT_TABS[next].id;
    onViewChange(nextView);
    tabRefs.current[nextView]?.focus();
  }

  return (
    <section
      aria-label="Result Viewer"
      onKeyDown={(event) => {
        // React Flow listens for deletion on window. Reading a result table
        // must not delete a selected workflow block in the neighboring panel.
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={`relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border ${maximized ? "min-h-0" : "min-h-64"} ${collapsed ? "items-center" : ""}`}
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <header
        className={`flex shrink-0 border-b ${collapsed ? "h-full flex-col items-center gap-3 border-b-0 px-1 py-2" : "items-center gap-2 px-3 py-3"}`}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className={`text-sm font-semibold ${collapsed ? "hidden" : ""}`} style={{ color: "var(--text-primary)" }}>Result Viewer</h2>
        {!collapsed && <div className="flex-1" />}
        {!maximized && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            title={collapsed ? "Expand Result Viewer" : "Collapse Result Viewer"}
            aria-label={collapsed ? "Expand Result Viewer" : "Collapse Result Viewer"}
          >
            {collapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMaximize}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          title={maximized ? "Restore Result Viewer (Esc)" : "Maximize Result Viewer"}
          aria-label={maximized ? "Restore Result Viewer" : "Maximize Result Viewer"}
        >
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {collapsed && <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]" style={{ color: "var(--text-secondary)" }} aria-hidden="true">Results</span>}
      </header>

      {/* All representations stay mounted, including during collapse/maximize.
          Only the common container and selected tab control visibility. */}
      <div className="min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden" style={{ display: collapsed ? "none" : "flex" }} inert={collapsed} aria-hidden={collapsed}>
        <div role="tablist" aria-label="Result views" className="flex shrink-0 gap-1 border-b px-2 pt-2" style={{ borderColor: "var(--border)" }}>
          {RESULT_TABS.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              ref={(element) => { tabRefs.current[id] = element; }}
              type="button"
              role="tab"
              id={`${tabPrefix}-tab-${id}`}
              aria-controls={`${tabPrefix}-panel-${id}`}
              aria-selected={view === id}
              tabIndex={view === id ? 0 : -1}
              onClick={() => onViewChange(id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-t border-b-2 px-2 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)] focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              style={{ color: view === id ? "var(--accent)" : "var(--text-secondary)", borderColor: view === id ? "var(--accent)" : "transparent", outlineColor: "var(--accent)" }}
            >
              <Icon size={13} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <div className="min-w-0 shrink-0 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }} title={dataset?.name}>{dataset?.name ?? "No result selected"}</p>
          <p className="mt-1 text-[11px] leading-4" style={{ color: "var(--text-secondary)" }}>
            {dataset ? `${dataset.origin === "demo" ? "Demo data — not model output" : "Model result"} · ${dataset.rows.length} rows · ${dataset.fields.length} fields` : "Open a result to see its GIS, Data or Chart representation."}
          </p>
        </div>
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {RESULT_TABS.map(({ id }) => (
            <div
              key={id}
              id={`${tabPrefix}-panel-${id}`}
              role="tabpanel"
              aria-labelledby={`${tabPrefix}-tab-${id}`}
              aria-hidden={view !== id}
              inert={view !== id}
              tabIndex={0}
              data-result-view={id}
              className="h-full min-h-0 min-w-0 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              style={{ display: view === id ? "block" : "none", outlineColor: "var(--accent)" }}
            >
              {id === "gis" ? <GISView dataset={dataset} /> : id === "data" ? <DataView dataset={dataset} /> : <ChartView dataset={dataset} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
