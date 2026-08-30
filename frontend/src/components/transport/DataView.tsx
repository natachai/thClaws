import { Table2 } from "lucide-react";
import { formatTransportResultValue } from "./transportResultTypes";
import type { TransportResultDataset } from "./transportResultTypes";

type DataViewProps = { dataset: TransportResultDataset | null };

/** Generic read-only table: columns come from the result contract, not node types. */
export function DataView({ dataset }: DataViewProps) {
  if (!dataset || dataset.fields.length === 0) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-3 overflow-auto p-6 text-center" style={{ color: "var(--text-secondary)" }}>
        <Table2 size={24} aria-hidden="true" />
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{dataset ? "No fields to display" : "No dataset selected"}</p>
        <p className="max-w-xs text-xs leading-5">{dataset ? "This dataset does not define any table columns yet." : "Select a result dataset to inspect its data here."}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        <span>Read-only · {dataset.rows.length} {dataset.rows.length === 1 ? "row" : "rows"} · {dataset.fields.length} columns</span>
        {dataset.origin === "demo" && <span className="rounded border px-1.5 py-0.5" style={{ borderColor: "var(--accent-dim)", color: "var(--accent)" }}>Demo data</span>}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]" role="region" aria-label={`${dataset.name} table`} tabIndex={0}>
        <table className="w-full min-w-max border-separate border-spacing-0 text-xs" style={{ color: "var(--text-primary)" }}>
          <caption className="sr-only">{dataset.name} — read-only result data{dataset.origin === "demo" ? ", demonstration values, not model output" : ""}</caption>
          <thead>
            <tr>
              {dataset.fields.map((field) => (
                <th key={field.id} scope="col" className={`sticky top-0 z-10 whitespace-nowrap border-b px-3 py-2.5 font-semibold ${field.type === "number" ? "text-right" : "text-left"}`} style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)" }}>
                  {field.label}{field.unit && <span className="ml-1 font-normal" style={{ color: "var(--text-secondary)" }}>({field.unit})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.length === 0 ? (
              <tr><td colSpan={dataset.fields.length} className="px-4 py-8 text-center" style={{ color: "var(--text-secondary)" }}>This dataset has no rows yet.</td></tr>
            ) : dataset.rows.map((row) => (
              <tr key={row.id} className="hover:bg-[var(--bg-tertiary)]">
                {dataset.fields.map((field) => (
                  <td key={field.id} className={`whitespace-nowrap border-b px-3 py-2 ${field.type === "number" ? "text-right tabular-nums" : "text-left"}`} style={{ borderColor: "var(--border)" }}>
                    {formatTransportResultValue(row.values[field.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
