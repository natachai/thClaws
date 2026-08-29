import { FilePlus2, FolderOpen, Play, Save, ShieldCheck } from "lucide-react";

export type SavedTransportProject = {
  id: string;
  name: string;
  path: string;
};

type TransportProjectToolbarProps = {
  projectName: string;
  dirty: boolean;
  projects: SavedTransportProject[];
  selectedProjectId: string;
  onProjectNameChange: (name: string) => void;
  onSelectProject: (id: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onValidate: () => void;
  onRun: () => void;
};

const buttonClass = "flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs transition-colors hover:bg-[var(--bg-tertiary)]";

export function TransportProjectToolbar({
  projectName,
  dirty,
  projects,
  selectedProjectId,
  onProjectNameChange,
  onSelectProject,
  onNew,
  onOpen,
  onSave,
  onValidate,
  onRun,
}: TransportProjectToolbarProps) {
  const borderStyle = { borderColor: "var(--border)", color: "var(--text-secondary)" };
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <label className="min-w-40 flex-1 sm:max-w-56">
        <span className="sr-only">Transport project name</span>
        <input
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          className="h-8 w-full rounded border px-2 text-xs outline-none focus:border-[var(--accent-dim)]"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          placeholder="Transport project name"
        />
      </label>
      <button type="button" onClick={onNew} className={buttonClass} style={borderStyle} title="New Transport Project"><FilePlus2 size={13} />New</button>
      <select
        value={selectedProjectId}
        onChange={(event) => onSelectProject(event.target.value)}
        className="h-8 max-w-48 rounded border px-2 text-xs outline-none"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        aria-label="Saved Transport projects"
      >
        <option value="">Saved projects</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <button type="button" onClick={onOpen} disabled={!selectedProjectId} className={buttonClass} style={borderStyle} title="Open selected project"><FolderOpen size={13} />Open</button>
      <button type="button" onClick={onSave} className={buttonClass} style={borderStyle} title="Save project"><Save size={13} />Save{dirty ? "*" : ""}</button>
      <button type="button" onClick={onValidate} className={buttonClass} style={borderStyle} title="Validate workflow"><ShieldCheck size={13} />Validate</button>
      <button type="button" onClick={onRun} className={`${buttonClass} font-medium`} style={{ borderColor: "var(--accent-dim)", background: "var(--accent)", color: "var(--accent-fg)" }} title="Validate and run workflow"><Play size={13} />Run Workflow</button>
    </div>
  );
}

