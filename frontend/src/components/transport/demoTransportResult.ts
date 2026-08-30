import type { TransportResultDataset } from "./transportResultTypes.ts";

/** Explicit demo preview, not a project node's output or a completed model run. */
export const DEMO_TRANSPORT_RESULT: TransportResultDataset = {
  id: "demo-trip-generation-by-zone",
  name: "Trip generation by zone (demo)",
  origin: "demo",
  fields: [
    { id: "taz", label: "TAZ", type: "string" },
    { id: "population", label: "Population", type: "number" },
    { id: "employment", label: "Employment", type: "number" },
    { id: "production", label: "Production", type: "number" },
    { id: "attraction", label: "Attraction", type: "number" },
  ],
  rows: [
    { id: "taz-001", values: { taz: "001", population: 12430, employment: 8240, production: 4821, attraction: 3921 } },
    { id: "taz-002", values: { taz: "002", population: 9821, employment: 11302, production: 3824, attraction: 5127 } },
    { id: "taz-003", values: { taz: "003", population: 18231, employment: 7921, production: 6120, attraction: 4011 } },
  ],
};
