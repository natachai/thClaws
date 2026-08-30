import { useLayoutEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Database, FilePenLine, Info, X } from "lucide-react";
import { getNodePorts, isCompatibleDataType } from "./transportTypes";
import type { TransportModelNode, TransportProject } from "./transportTypes";

type TransportNodeDetailsProps = {
  active: boolean;
  node: TransportModelNode;
  project: TransportProject;
  onUpdate: (node: TransportModelNode) => void;
  onBindInput: (portId: string, source: { nodeId: string; portId: string } | null) => void;
  onEditSource: () => void;
  onClose: () => void;
};

const fieldClass = "w-full rounded border px-2.5 py-2 text-xs outline-none focus:border-[var(--accent)]";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" };

/** Edits the project model, not React Flow internals. Bindings always refer to stable port IDs. */
export function TransportNodeDetails({ active, node, project, onUpdate, onBindInput, onEditSource, onClose }: TransportNodeDetailsProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const ports = getNodePorts(node);
  const incoming = project.workflow.edges.filter((edge) => edge.target.nodeId === node.id);
  const unmappedIncoming = incoming.filter((edge) => !ports.inputs.some((port) => port.id === edge.target.portId));
  const otherOutputs = project.workflow.nodes.filter((candidate) => candidate.id !== node.id).flatMap((candidate) => getNodePorts(candidate).outputs.map((port) => ({ node: candidate, port, key: JSON.stringify([candidate.id, port.id]) })));

  useLayoutEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.focus();
    return () => {
      if (dialog?.contains(document.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [active]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']")).filter((element) => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements.at(-1);
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      first.focus();
    }
  }

  function sourceDescription(nodeId: string, portId: string | null | undefined) {
    const sourceNode = project.workflow.nodes.find((candidate) => candidate.id === nodeId);
    const sourcePort = sourceNode ? getNodePorts(sourceNode).outputs.find((port) => port.id === portId) : undefined;
    const outputLabel = sourceNode?.outputNames?.[portId ?? ""] || sourcePort?.label || portId || "unmapped output";
    return `${sourceNode?.label || nodeId} → ${outputLabel}`;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/35 p-2 sm:p-4" style={{ display: active ? "flex" : "none" }} aria-hidden={!active}>
      <div ref={dialogRef} role="dialog" aria-modal={active || undefined} aria-labelledby="transport-node-details-title" tabIndex={-1} onKeyDown={handleKeyDown} className="flex max-h-full w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-xl outline-none" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0"><h2 id="transport-node-details-title" className="flex items-center gap-2 text-sm font-semibold"><FilePenLine size={16} />Block details</h2><p className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{node.actionId}</p></div>
          <button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-[var(--bg-tertiary)]" aria-label="Close block details"><X size={16} /></button>
        </header>
        <div className="grid min-h-0 grid-cols-1 gap-5 overflow-y-auto p-4 md:grid-cols-2">
          <section className="min-w-0 space-y-4" aria-label="Block information">
            <label className="block space-y-1.5 text-xs"><span className="block">Block name</span><input value={node.label} onChange={(event) => onUpdate({ ...node, label: event.target.value })} placeholder="Name this block" className={fieldClass} style={fieldStyle} /></label>
            <label className="block space-y-1.5 text-xs"><span className="block">Note</span><textarea value={node.note ?? ""} onChange={(event) => onUpdate({ ...node, note: event.target.value })} placeholder="A short note shown on the workflow block" rows={2} className={`${fieldClass} resize-y`} style={fieldStyle} /></label>
            <label className="block space-y-1.5 text-xs"><span className="block">Details</span><textarea value={node.details ?? ""} onChange={(event) => onUpdate({ ...node, details: event.target.value })} placeholder="Assumptions, data provenance, or modelling notes" rows={5} className={`${fieldClass} resize-y`} style={fieldStyle} /></label>
            {(node.source || node.actionId.startsWith("data.")) && <div className="space-y-2 rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <h3 className="flex items-center gap-1.5 text-xs font-medium"><Database size={14} />Data source</h3>
              {node.source ? <><p className="break-all text-xs" style={{ color: "var(--text-secondary)" }}>{node.source.path}</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{node.source.format} · {node.source.dataType}</p></> : <p className="text-xs text-amber-500">No source reference is configured yet.</p>}
              <button type="button" onClick={onEditSource} className="rounded border px-2.5 py-1.5 text-xs hover:bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--border)" }}>{node.source ? "Change source" : "Choose source"}</button>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Source reference only. File contents have not been imported or validated.</p>
            </div>}
          </section>
          <section className="min-w-0 space-y-5" aria-label="Block data inputs and outputs">
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold"><ArrowDownToLine size={14} />Inputs</h3>
              {ports.inputs.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>This source block does not take workflow inputs.</p>}
              {ports.inputs.map((port) => {
                const boundEdges = incoming.filter((edge) => edge.target.portId === port.id);
                const compatibleOutputs = otherOutputs.filter((candidate) => isCompatibleDataType(candidate.port.dataType, port.dataType));
                const existing = boundEdges[0];
                const existingKey = existing ? JSON.stringify([existing.source.nodeId, existing.source.portId]) : "";
                const validExisting = boundEdges.length === 1 && compatibleOutputs.some((candidate) => candidate.key === existingKey);
                const invalidExisting = boundEdges.length > 0 && !validExisting;
                const value = invalidExisting ? "__unresolved__" : existingKey;
                return <div key={port.id} className="space-y-1.5 rounded border p-3" style={{ borderColor: "var(--border)" }}>
                  <label className="block space-y-1.5 text-xs"><span className="flex flex-wrap items-center justify-between gap-1"><span>{port.label}{port.required ? " *" : ""}</span><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{port.dataType}</span></span>
                    <select value={value} onChange={(event) => {
                      const candidate = compatibleOutputs.find((option) => option.key === event.target.value);
                      onBindInput(port.id, candidate ? { nodeId: candidate.node.id, portId: candidate.port.id } : null);
                    }} className={fieldClass} style={fieldStyle} aria-label={`Input source for ${port.label}`}>
                      <option value="">{boundEdges.length ? "Disconnect input" : "Choose an output…"}</option>
                      {invalidExisting && <option value="__unresolved__" disabled>{boundEdges.length > 1 ? "Multiple existing bindings — review required" : `Existing binding: ${sourceDescription(existing.source.nodeId, existing.source.portId)} (incompatible or unmapped)`}</option>}
                      {compatibleOutputs.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.node.label || candidate.node.actionId} → {candidate.node.outputNames?.[candidate.port.id] || candidate.port.label} [{candidate.port.dataType}]</option>)}
                    </select>
                  </label>
                  {compatibleOutputs.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No compatible outputs from other blocks. Add a suitable data source or modelling block.</p>}
                  {invalidExisting && <div className="space-y-1 text-[11px] text-amber-500"><p>Existing connections are preserved. Choose a compatible output or explicitly disconnect.</p>{boundEdges.map((edge) => <p key={edge.id} className="break-words">{sourceDescription(edge.source.nodeId, edge.source.portId)}</p>)}</div>}
                </div>;
              })}
              {unmappedIncoming.length > 0 && <div className="space-y-1.5 rounded border border-amber-500/35 bg-amber-500/10 p-3 text-[11px] text-amber-500"><p className="font-medium">Unmapped legacy connections</p>{unmappedIncoming.map((edge) => <p key={edge.id} className="break-words">{sourceDescription(edge.source.nodeId, edge.source.portId)} → {edge.target.portId || "unmapped input"}</p>)}<p>These connections have not been removed. Review them on the canvas, delete the unresolved connection explicitly, then choose a named input above.</p></div>}
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold"><ArrowUpFromLine size={14} />Outputs</h3>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Name the data another block can select as an input. Model outputs are planned references, not calculated results.</p>
              {ports.outputs.map((port) => {
                const consumers = project.workflow.edges.filter((edge) => edge.source.nodeId === node.id && edge.source.portId === port.id);
                return <div key={port.id} className="space-y-2 rounded border p-3" style={{ borderColor: "var(--border)" }}>
                  <label className="block space-y-1.5 text-xs"><span className="flex flex-wrap items-center justify-between gap-1"><span>{port.label}</span><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{port.dataType}</span></span><input value={node.outputNames?.[port.id] ?? ""} onChange={(event) => onUpdate({ ...node, outputNames: { ...node.outputNames, [port.id]: event.target.value } })} placeholder={port.label} aria-label={`Output name for ${port.label}`} className={fieldClass} style={fieldStyle} /></label>
                  <div className="space-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}><p>{consumers.length === 0 ? "Not used by another block yet." : "Used as input by:"}</p>{consumers.map((edge) => {
                    const targetNode = project.workflow.nodes.find((candidate) => candidate.id === edge.target.nodeId);
                    const targetPort = targetNode ? getNodePorts(targetNode).inputs.find((candidate) => candidate.id === edge.target.portId) : undefined;
                    return <p key={edge.id} className="break-words">{targetNode?.label || edge.target.nodeId} → {targetPort?.label || edge.target.portId || "unmapped input"}</p>;
                  })}</div>
                </div>;
              })}
            </div>
          </section>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}><p className="flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}><Info size={13} className="mt-0.5 shrink-0" />Changes update the current project. Use Save in Transport to write them to disk.</p><button type="button" onClick={onClose} className="shrink-0 rounded border px-3 py-2 text-xs hover:bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--border)" }}>Done</button></footer>
      </div>
    </div>
  );
}
