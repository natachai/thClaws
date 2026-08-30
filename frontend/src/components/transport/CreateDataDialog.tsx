import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowLeft, ArrowUp, Database, File, Folder, FolderOpen, X } from "lucide-react";
import { send, subscribe } from "../../hooks/useIPC";
import { DATA_FORMATS, DATA_TYPES } from "./transportTypes";
import type { TransportDataSource } from "./transportTypes";

type CreateDataDialogProps = {
  active: boolean;
  initialSource?: TransportDataSource;
  initialLabel?: string;
  onCreate: (source: TransportDataSource, label: string) => void;
  onClose: () => void;
};

type SourceEntry = { name: string; path: string; isDirectory: boolean };

const fieldClass = "w-full rounded border px-2.5 py-2 text-xs outline-none focus:border-[var(--accent)]";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" };
const buttonClass = "inline-flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-40";

function parentDirectory(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index >= 0 ? trimmed.slice(0, index + 1) : path;
}

function fileLabel(path: string): string {
  return (path.split(/[/\\]/).pop() ?? path).replace(/\.[^.]+$/, "");
}

function isEntry(value: unknown): value is SourceEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SourceEntry>;
  return typeof entry.name === "string" && typeof entry.path === "string" && typeof entry.isDirectory === "boolean";
}

/** The source picker registers a workspace file reference; it never parses or copies file contents. */
export function CreateDataDialog({ active, initialSource, initialLabel, onCreate, onClose }: CreateDataDialogProps) {
  const [step, setStep] = useState<"method" | "source">(initialSource ? "source" : "method");
  const [label, setLabel] = useState(initialLabel ?? "");
  const [format, setFormat] = useState<TransportDataSource["format"]>(initialSource?.format ?? "csv");
  const [dataType, setDataType] = useState(initialSource?.dataType ?? DATA_TYPES.find((type) => type.id !== "any")?.id ?? "table");
  const [selectedPath, setSelectedPath] = useState(initialSource?.path ?? "");
  const [directory, setDirectory] = useState(initialSource ? parentDirectory(initialSource.path) : ".");
  const [loadedDirectory, setLoadedDirectory] = useState("");
  const [entries, setEntries] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const pendingRequest = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialBrowseSent = useRef(false);

  const browse = useCallback((path: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const requestId = `transport-source-${crypto.randomUUID()}`;
    pendingRequest.current = requestId;
    setError("");
    setLoading(true);
    send({ type: "transport_data_sources", requestId, path: path.trim() || "." });
    timeoutRef.current = setTimeout(() => {
      if (pendingRequest.current !== requestId) return;
      pendingRequest.current = "";
      setLoading(false);
      setError("The source browser did not respond. Check the development backend and try opening the folder again.");
    }, 15000);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type !== "transport_data_sources" || message.requestId !== pendingRequest.current || !pendingRequest.current) return;
      pendingRequest.current = "";
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      if (message.ok !== true || typeof message.path !== "string" || !Array.isArray(message.entries)) {
        setError(typeof message.error === "string" ? message.error : "Could not open this workspace folder.");
        return;
      }
      setDirectory(message.path);
      setLoadedDirectory(message.path);
      setEntries(message.entries.filter(isEntry));
      setError("");
    });
    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!active || step !== "source" || initialBrowseSent.current) return;
    // Defer the initial IPC request until the subscriber and dialog are mounted.
    const timer = setTimeout(() => {
      initialBrowseSent.current = true;
      browse(initialSource ? parentDirectory(initialSource.path) : ".");
    }, 0);
    return () => clearTimeout(timer);
  }, [active, browse, initialSource, step]);

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

  const extension = format === "shapefile" ? ".shp" : `.${format}`;
  const visibleEntries = entries.filter((entry) => entry.isDirectory || entry.name.toLowerCase().endsWith(extension)).sort((left, right) => Number(right.isDirectory) - Number(left.isDirectory) || left.name.localeCompare(right.name));
  const validDataType = DATA_TYPES.some((type) => type.id === dataType && type.id !== "any");

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/35 p-2 sm:p-4" style={{ display: active ? "flex" : "none" }} aria-hidden={!active}>
      <div ref={dialogRef} role="dialog" aria-modal={active || undefined} aria-labelledby="transport-data-dialog-title" tabIndex={-1} onKeyDown={handleKeyDown} className="flex max-h-full w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-xl outline-none" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2"><Database size={16} /><h2 id="transport-data-dialog-title" className="text-sm font-semibold">{initialSource ? "Change data source" : "Create new data"}</h2></div>
          <button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-[var(--bg-tertiary)]" aria-label="Close data source dialog"><X size={16} /></button>
        </header>
        <div className="min-h-0 space-y-4 overflow-y-auto p-4">
          {step === "method" ? (
            <>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Choose how to create a data block for this workflow.</p>
              <button type="button" onClick={() => setStep("source")} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-[var(--bg-tertiary)]" style={{ borderColor: "var(--border)" }}>
                <FolderOpen size={22} style={{ color: "var(--accent)" }} />
                <span><span className="block text-sm font-medium">Import data from source</span><span className="mt-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Choose a workspace file, its format, and its modelling data type.</span></span>
              </button>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>This stage stores a source reference only. It does not read, copy, or process the dataset yet.</p>
            </>
          ) : (
            <>
              {!initialSource && <button type="button" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "var(--text-secondary)" }} onClick={() => setStep("method")}><ArrowLeft size={13} />Back</button>}
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>Source: local workspace file. Browsing is limited to the current THClaws workspace; keep the source dataset inside this workspace. Only its absolute path and metadata are registered.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs"><span className="block">File format</span><select value={format} onChange={(event) => {
                  const nextFormat = event.target.value as TransportDataSource["format"];
                  setFormat(nextFormat);
                  const nextExtension = nextFormat === "shapefile" ? ".shp" : `.${nextFormat}`;
                  if (!selectedPath.toLowerCase().endsWith(nextExtension)) setSelectedPath("");
                }} className={fieldClass} style={fieldStyle}>{DATA_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label className="space-y-1.5 text-xs"><span className="block">Modelling data type</span><select value={dataType} onChange={(event) => setDataType(event.target.value)} className={fieldClass} style={fieldStyle}>{DATA_TYPES.filter((item) => item.id !== "any").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              </div>
              <div className="space-y-2">
                <label className="block text-xs" htmlFor="transport-source-folder">Workspace folder</label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => browse(parentDirectory(loadedDirectory))} disabled={loading || !loadedDirectory} className={buttonClass} style={{ borderColor: "var(--border)" }} aria-label="Parent workspace folder"><ArrowUp size={14} /></button>
                  <input id="transport-source-folder" value={directory} onChange={(event) => setDirectory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); browse(directory); } }} className={`${fieldClass} min-w-0 flex-1`} style={fieldStyle} />
                  <button type="button" onClick={() => browse(directory)} disabled={loading} className={`${buttonClass} shrink-0`} style={{ borderColor: "var(--border)" }}>Open folder</button>
                </div>
                {error && <p role="alert" className="rounded border border-amber-500/35 bg-amber-500/10 p-2 text-xs text-amber-500">{error}</p>}
                <div className="h-44 overflow-y-auto rounded border sm:h-52" aria-label="Available source files" aria-busy={loading} style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                  {loading ? <p className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>Loading workspace folder…</p> : visibleEntries.length === 0 ? <p className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>No folders or {extension} files in this folder.</p> : visibleEntries.map((entry) => (
                    <button type="button" key={entry.path} onClick={() => {
                      if (entry.isDirectory) browse(entry.path);
                      else { setSelectedPath(entry.path); if (!label.trim()) setLabel(fileLabel(entry.name)); }
                    }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-tertiary)]" style={selectedPath === entry.path ? { background: "var(--bg-tertiary)", color: "var(--accent)" } : undefined} aria-pressed={!entry.isDirectory && selectedPath === entry.path} title={entry.path}>
                      {entry.isDirectory ? <Folder size={15} className="shrink-0" /> : <File size={15} className="shrink-0" />}<span className="truncate">{entry.name}</span>{selectedPath === entry.path && <span className="ml-auto shrink-0 text-[10px]">Selected</span>}
                    </button>
                  ))}
                </div>
                {format === "shapefile" && <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Select the .shp file. Keep its .dbf, .shx and other companion files together; companion validation and parsing are not implemented yet.</p>}
              </div>
              <label className="block space-y-1.5 text-xs"><span className="block">Selected source reference</span><input readOnly value={selectedPath} placeholder={`Choose a ${extension} file above`} className={fieldClass} style={fieldStyle} title={selectedPath} /></label>
              <label className="block space-y-1.5 text-xs"><span className="block">Data block name</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="For example: Base year zones" className={fieldClass} style={fieldStyle} /></label>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>The modelling data type describes how downstream input ports may use this source. It does not confirm that the file contains valid model data.</p>
            </>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <button type="button" onClick={onClose} className={buttonClass} style={{ borderColor: "var(--border)" }}>Cancel</button>
          {step === "source" && <button type="button" disabled={!selectedPath || !validDataType || loading} onClick={() => onCreate({ kind: "file", path: selectedPath, format, dataType }, label.trim() || fileLabel(selectedPath))} className={buttonClass} style={{ borderColor: "var(--accent-dim)", background: "var(--accent)", color: "var(--accent-fg)" }}>{initialSource ? "Update source reference" : "Create data block"}</button>}
        </footer>
      </div>
    </div>
  );
}
