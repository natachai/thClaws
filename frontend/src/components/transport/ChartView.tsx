import { ChartColumn } from "lucide-react";
import type { TransportResultDataset } from "./transportResultTypes";

type ChartViewProps = {
  dataset: TransportResultDataset | null;
};

/** Placeholder only: chart rendering will consume the same dataset as GIS and Data. */
export function ChartView({ dataset }: ChartViewProps) {
  return (
    <section
      className="h-full min-h-0 min-w-0 overflow-auto"
      aria-label="Chart representation"
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
          <ChartColumn size={20} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Chart Viewer
        </h3>
        <p className="max-w-sm text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
          {dataset
            ? "The selected dataset is shared with the GIS and Data views."
            : "No dataset selected. Select a dataset in Result Viewer to use it across GIS, Data, and Chart."}
        </p>
        {dataset && (
          <p className="max-w-sm break-words text-xs" style={{ color: "var(--text-primary)" }}>
            {dataset.name} · {dataset.rows.length.toLocaleString()} records
          </p>
        )}
        <div
          className="w-full max-w-sm rounded-md border p-3 text-left"
          style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
        >
          <h4 className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Planned chart types
          </h4>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-[11px] leading-4">
            <div>
              <dt className="font-medium" style={{ color: "var(--text-primary)" }}>Bar</dt>
              <dd style={{ color: "var(--text-muted)" }}>Compare categories</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--text-primary)" }}>Line</dt>
              <dd style={{ color: "var(--text-muted)" }}>Explore trends</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--text-primary)" }}>Scatter</dt>
              <dd style={{ color: "var(--text-muted)" }}>Compare paired values</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--text-primary)" }}>Histogram</dt>
              <dd style={{ color: "var(--text-muted)" }}>View value distributions</dd>
            </div>
          </dl>
        </div>
        <p className="max-w-sm text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
          Placeholder only. No chart is rendered and no calculations are performed yet.
          {dataset?.origin === "demo" ? " Demo data is not a model result." : ""}
        </p>
      </div>
    </section>
  );
}
