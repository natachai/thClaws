import { Map } from "lucide-react";
import type { TransportResultDataset } from "./transportResultTypes";

type GISViewProps = {
  dataset: TransportResultDataset | null;
};

/** A mounted representation of the Result Viewer's shared dataset, ready for a future map renderer. */
export function GISView({ dataset }: GISViewProps) {
  return (
    <section
      className="h-full min-h-0 min-w-0 overflow-auto"
      aria-label="GIS representation"
      style={{ background: "var(--bg-secondary)" }}
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: "var(--bg-tertiary)",
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <Map size={20} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          GIS Viewer
        </h3>
        <p className="max-w-xs text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
          Road networks, zones, skim results, and assignment outputs will appear here.
        </p>
        <div
          className="w-full max-w-sm space-y-2 rounded-md border p-3 text-xs leading-5"
          style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
        >
          {dataset ? (
            <>
              <p className="break-words font-medium" style={{ color: "var(--text-primary)" }}>
                {dataset.name}
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                {dataset.rows.length.toLocaleString()} records shared with the Data and Chart views.
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                {dataset.geometry
                  ? "This dataset has geometry attached. Map rendering is not implemented yet."
                  : "This dataset has no geometry attached. Map rendering is not implemented yet."}
              </p>
              {dataset.origin === "demo" && (
                <p style={{ color: "var(--text-muted)" }}>Demo data only — not a calculated model result.</p>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>
              No dataset selected. Select a dataset in Result Viewer to use it across GIS, Data, and Chart.
              Map rendering is not implemented yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
