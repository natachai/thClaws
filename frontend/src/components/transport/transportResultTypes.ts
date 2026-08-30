/** Result presentation is independent of the workflow editor and calculation engine. */
export type TransportResultView = "gis" | "data" | "chart";
export type TransportResultValue = string | number | boolean | null;

export type TransportResultField = Readonly<{
  id: string;
  label: string;
  type: "string" | "number" | "boolean";
  unit?: string;
}>;

export type TransportResultRow = Readonly<{
  /** Stable identity shared by future table selection, charts and GIS features. */
  id: string;
  values: Readonly<Record<string, TransportResultValue>>;
}>;

export type TransportResultDataset = Readonly<{
  id: string;
  name: string;
  sourceNodeId?: string;
  sourcePortId?: string;
  origin: "demo" | "model";
  fields: readonly TransportResultField[];
  rows: readonly TransportResultRow[];
  geometry?: Readonly<{
    format: "geojson";
    /** Feature property containing a matching TransportResultRow.id. */
    rowIdProperty: string;
    /** A future GIS adapter must validate the payload before rendering it. */
    data: unknown;
    crs?: string;
  }>;
}>;

const resultNumberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 });

/** Display-only formatting: never coerce identifier strings (for example, 001). */
export function formatTransportResultValue(value: TransportResultValue | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? resultNumberFormat.format(value) : "—";
  return String(value);
}
