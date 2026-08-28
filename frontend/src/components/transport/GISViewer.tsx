import {
  Map,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

type GISViewerProps = {
  collapsed: boolean;
  maximized: boolean;
  onToggleCollapsed: () => void;
  onToggleMaximize: () => void;
};

export function GISViewer({
  collapsed,
  maximized,
  onToggleCollapsed,
  onToggleMaximize,
}: GISViewerProps) {
  return (
    <section
      className={`relative flex h-full min-h-64 flex-col overflow-hidden rounded-lg border ${collapsed ? "items-center" : ""}`}
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <header
        className={`flex shrink-0 border-b ${collapsed ? "h-full flex-col items-center gap-3 border-b-0 px-1 py-2" : "items-center gap-3 px-4 py-3"}`}
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          className={`text-sm font-semibold ${collapsed ? "hidden" : ""}`}
          style={{ color: "var(--text-primary)" }}
        >
          GIS Viewer
        </h2>
        {!collapsed && <div className="flex-1" />}
        {!maximized && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
            title={collapsed ? "Expand GIS Viewer" : "Collapse GIS Viewer"}
            aria-label={collapsed ? "Expand GIS Viewer" : "Collapse GIS Viewer"}
          >
            {collapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMaximize}
          className="flex h-7 w-7 items-center justify-center rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          title={maximized ? "Restore GIS Viewer (Esc)" : "Maximize GIS Viewer"}
          aria-label={maximized ? "Restore GIS Viewer" : "Maximize GIS Viewer"}
        >
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {collapsed && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]"
            style={{ color: "var(--text-secondary)" }}
            aria-hidden="true"
          >
            GIS
          </span>
        )}
      </header>

      <div
        className={`flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center ${collapsed ? "invisible absolute inset-0 pointer-events-none" : ""}`}
        aria-hidden={collapsed}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md border"
          style={{
            background: "var(--bg-tertiary)",
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <Map size={20} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          GIS Viewer
        </p>
        <p
          className="max-w-xs text-xs leading-5"
          style={{ color: "var(--text-secondary)" }}
        >
          Road networks, zones, skim results, and assignment outputs will appear
          here.
        </p>
      </div>
    </section>
  );
}
