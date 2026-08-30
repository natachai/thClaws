import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NotebookPen } from "lucide-react";
import { getNodePorts } from "./transportTypes";
import type { TransportFlowNode } from "./transportFlow";

export function TransportNode({ data, selected }: NodeProps<TransportFlowNode>) {
  const { model } = data;
  const ports = getNodePorts(model);
  const inputPorts = [...ports.inputs, ...data.unresolvedInputs.map((id) => ({ id, label: "Unmapped input", dataType: "legacy", required: false }))];
  const outputPorts = [...ports.outputs, ...data.unresolvedOutputs.map((id) => ({ id, label: "Unmapped output", dataType: "legacy" }))];
  return (
    <div
      className={`relative w-64 rounded-md border shadow-sm ${selected ? "ring-1 ring-[var(--accent)]" : ""}`}
      style={{ background: "var(--bg-secondary)", borderColor: selected ? "var(--accent)" : "var(--border)", color: "var(--text-primary)" }}
    >
      <div className="flex items-start gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <div className="min-w-0 flex-1">
          <div className="break-words text-xs font-semibold leading-4">{model.label}</div>
          <div className="mt-1 text-[9px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{model.actionId.startsWith("data.") ? "Data source" : "Model component"}</div>
        </div>
        <button type="button" onClick={data.onEdit} className="nodrag nopan flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[var(--bg-tertiary)]" aria-label={`Edit ${model.label} details`} title="Edit name, notes, inputs and outputs"><NotebookPen size={14} /></button>
      </div>
      {model.note && <p className="mx-3 my-2 line-clamp-3 whitespace-pre-wrap break-words text-[10px]" style={{ color: "var(--text-secondary)" }}>{model.note}</p>}
      <div className="grid grid-cols-2 gap-2 py-2 text-[10px]">
        <div className="min-w-0">
          <div className="mb-1 px-3 text-[9px] uppercase" style={{ color: "var(--text-secondary)" }}>Inputs</div>
          {inputPorts.length === 0 && <p className="px-3 opacity-50">—</p>}
          {inputPorts.map((port) => <div key={port.id} className="relative min-h-7 py-1 pl-3 pr-1" title={`${port.label}: ${port.dataType}`}>
            <Handle id={port.id} type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2" style={{ background: "var(--accent)", borderColor: "var(--bg-secondary)" }} aria-label={`${model.label} input ${port.label}`} />
            <span className="block break-words">{port.label}{port.required ? " *" : ""}</span>
          </div>)}
        </div>
        <div className="min-w-0 text-right">
          <div className="mb-1 px-3 text-[9px] uppercase" style={{ color: "var(--text-secondary)" }}>Outputs</div>
          {outputPorts.map((port) => <div key={port.id} className="relative min-h-7 py-1 pl-1 pr-3" title={`${port.label}: ${port.dataType}`}>
            <span className="block break-words">{model.outputNames[port.id] || port.label}</span>
            <Handle id={port.id} type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2" style={{ background: "var(--accent)", borderColor: "var(--bg-secondary)" }} aria-label={`${model.label} output ${port.label}`} />
          </div>)}
        </div>
      </div>
    </div>
  );
}
