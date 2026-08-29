import { AlertTriangle, CheckCircle2, CircleX, X } from "lucide-react";
import type { TransportValidationResult } from "./transportValidation";

type TransportValidationPanelProps = {
  result: TransportValidationResult | null;
  status: string | null;
  onClose: () => void;
};

export function TransportValidationPanel({ result, status, onClose }: TransportValidationPanelProps) {
  if (!result && !status) return null;
  return (
    <aside className="shrink-0 rounded-lg border px-3 py-2" style={{ background: "var(--bg-secondary)", borderColor: result?.valid ? "var(--accent-dim)" : "var(--border)" }} aria-live="polite">
      <div className="flex items-start gap-2">
        {result?.valid ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> : result ? <CircleX size={15} className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }} /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />}
        <div className="min-w-0 flex-1">
          {status && <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{status}</p>}
          {result && <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>{result.errors} error(s), {result.warnings} warning(s)</p>}
          {result && result.issues.length > 0 && (
            <ul className="mt-1 max-h-24 space-y-0.5 overflow-auto text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {result.issues.map((issue, index) => <li key={`${issue.code}-${issue.nodeId ?? index}`}><span style={{ color: issue.severity === "error" ? "var(--danger)" : "var(--warning)" }}>{issue.severity === "error" ? "Error" : "Warning"}:</span> {issue.message}</li>)}
            </ul>
          )}
        </div>
        <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[var(--bg-tertiary)]" style={{ color: "var(--text-secondary)" }} aria-label="Close validation results"><X size={13} /></button>
      </div>
    </aside>
  );
}

