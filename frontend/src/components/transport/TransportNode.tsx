import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TransportWorkflowNode } from "./transportTypes";

export function TransportNode({ data, selected }: NodeProps<TransportWorkflowNode>) {
  const hasInput = data.category !== "data";
  const inputLabel = data.inputDataType ?? "Input";
  const outputLabel = data.outputDataType ?? "Output";
  return (
    <div
      className={`relative min-w-44 rounded-md border px-3 py-2 shadow-sm transition-shadow ${selected ? "ring-1 ring-[var(--accent)]" : ""}`}
      style={{ background: "var(--bg-secondary)", borderColor: selected ? "var(--accent)" : "var(--border)", color: "var(--text-primary)" }}
    >
      {hasInput && <>
        <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2" style={{ background: "var(--accent)", borderColor: "var(--bg-secondary)" }} aria-label={`Input: ${inputLabel}`} />
        <span className="pointer-events-none absolute -left-1 top-1/2 -translate-x-full -translate-y-1/2 whitespace-nowrap text-[9px]" style={{ color: "var(--text-secondary)" }}>{inputLabel}</span>
      </>}
      <div className="text-xs font-semibold leading-4">{data.label}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{data.category === "data" ? "Data source" : "Model component"}</div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2" style={{ background: "var(--accent)", borderColor: "var(--bg-secondary)" }} aria-label={`Output: ${outputLabel}`} />
      <span className="pointer-events-none absolute -right-1 top-1/2 translate-x-full -translate-y-1/2 whitespace-nowrap text-[9px]" style={{ color: "var(--text-secondary)" }}>{outputLabel}</span>
    </div>
  );
}
