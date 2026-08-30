import { useEffect, useRef, useState } from "react";
import type { Connection, EdgeChange, NodeChange, Viewport } from "@xyflow/react";
import { send, subscribe } from "../../hooks/useIPC";
import { createDataNode, createEmptyTransportProject, createModelNode, getNodePorts, isCompatibleDataType, loadTransportProject, type TransportDataSource, type TransportModelNode, type TransportProject } from "./transportTypes";
import { validateTransportProject, type TransportValidationResult } from "./transportValidation";
import type { TransportFlowNode } from "./transportFlow";
import type { SavedTransportProject } from "./TransportProjectToolbar";
import { confirmTransportDiscard } from "./transportConfirm";

type Endpoint = { nodeId: string; portId: string };
type PendingRequest = { requestId: string; kind: "save" | "load"; revision: number };

export function useTransportProject() {
  const [project, setProject] = useState(createEmptyTransportProject);
  const projectRef = useRef(project);
  const revision = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedTransportProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const currentFileId = useRef<string | undefined>(undefined);
  const pending = useRef<PendingRequest | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRequest = useRef("");
  const [validation, setValidation] = useState<TransportValidationResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(() => new Set());
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(() => new Set());
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});

  function edit(next: TransportProject) {
    projectRef.current = next;
    revision.current += 1;
    setProject(next);
    setDirty(true);
    setValidation(null);
  }

  useEffect(() => {
    function refreshList() {
      listRequest.current = crypto.randomUUID();
      send({ type: "transport_project_list", requestId: listRequest.current });
    }
    const unsub = subscribe((msg) => {
      if (msg.type === "transport_project_list" && msg.requestId === listRequest.current) {
        setSavedProjects(Array.isArray(msg.projects) ? msg.projects as SavedTransportProject[] : []);
        if (msg.ok === false) setStatus(`Could not list projects: ${String(msg.error ?? "unknown error")}`);
        return;
      }
      const request = pending.current;
      if (!request || request.requestId !== msg.requestId) return;
      if (msg.type !== "transport_project_saved" && msg.type !== "transport_project_loaded") return;
      pending.current = null;
      if (timeout.current) clearTimeout(timeout.current);
      setBusy(false);
      if (msg.ok !== true) {
        setStatus(`${request.kind === "save" ? "Save" : "Open"} failed: ${String(msg.error ?? "unknown error")}`);
        return;
      }
      if (request.kind === "save" && msg.type === "transport_project_saved") {
        const summary = msg.project as SavedTransportProject;
        currentFileId.current = summary.id;
        setSelectedProjectId(summary.id);
        if (revision.current === request.revision) setDirty(false);
        setStatus(`Saved ${summary.name}.${summary.backupPath ? ` Previous version backed up to ${summary.backupPath}.` : ""}${revision.current !== request.revision ? " Newer edits are still unsaved." : ""}`);
        refreshList();
      } else if (request.kind === "load" && msg.type === "transport_project_loaded") {
        if (revision.current !== request.revision) {
          setStatus("Open cancelled because the current project changed while loading. Your edits were kept.");
          return;
        }
        const loaded = loadTransportProject(msg.project);
        if (!loaded.project) {
          setStatus(`Open failed: ${loaded.error ?? "unsupported or invalid project format"}`);
          return;
        }
        projectRef.current = loaded.project;
        revision.current += 1;
        setProject(loaded.project);
        setDirty(loaded.migrated);
        setSelectedNodes(new Set());
        setSelectedEdges(new Set());
        setMeasurements({});
        setValidation(null);
        const summary = msg.summary as SavedTransportProject;
        // First save of a migrated project is a new v2 copy, not an overwrite of v1.
        currentFileId.current = loaded.migrated ? undefined : summary.id;
        setStatus(`Opened ${loaded.project.metadata.name ?? "Transport project"}.${loaded.migrated ? " Migrated to v2 in memory; Save will create a new copy and keep the original v1 file." : ""}${loaded.warnings.length ? ` ${loaded.warnings.join(" ")}` : ""}`);
      }
    });
    refreshList();
    return () => { unsub(); if (timeout.current) clearTimeout(timeout.current); };
  }, []);

  function watchRequest(request: PendingRequest) {
    if (timeout.current) clearTimeout(timeout.current);
    pending.current = request;
    timeout.current = setTimeout(() => {
      if (pending.current?.requestId !== request.requestId) return;
      setBusy(false);
      setStatus(request.kind === "save" ? "Save response timed out. The file may already have been saved; check Saved projects before retrying. Your edits are still kept in memory." : "Open response timed out. Your current project is unchanged.");
      if (request.kind === "save") {
        listRequest.current = crypto.randomUUID();
        send({ type: "transport_project_list", requestId: listRequest.current });
      }
      pending.current = null;
    }, 20000);
  }

  async function newProject() {
    if (busy) return;
    if (dirty) {
      const before = revision.current;
      setBusy(true);
      const confirmed = await confirmTransportDiscard("Start a new Transport project and discard unsaved changes?");
      setBusy(false);
      if (!confirmed || before !== revision.current) return;
    }
    const next = createEmptyTransportProject();
    projectRef.current = next;
    revision.current += 1;
    setProject(next);
    currentFileId.current = undefined;
    setSelectedProjectId("");
    setSelectedNodes(new Set());
    setSelectedEdges(new Set());
    setMeasurements({});
    setDirty(false);
    setValidation(null);
    setStatus("New Transport project created.");
  }

  function saveProject(saveAs = false) {
    if (busy) return;
    const name = projectRef.current.metadata.name?.trim();
    if (!name) { setStatus("Enter a project name before saving."); return; }
    const snapshot = { ...projectRef.current, metadata: { ...projectRef.current.metadata, name, updatedAt: new Date().toISOString() } };
    edit(snapshot);
    const requestId = crypto.randomUUID();
    watchRequest({ requestId, kind: "save", revision: revision.current });
    setBusy(true);
    setStatus("Saving project…");
    send({ type: "transport_project_save", requestId, name, project: snapshot, id: saveAs ? undefined : currentFileId.current, saveAs });
  }

  async function openProject() {
    if (busy || !selectedProjectId) return;
    if (dirty) {
      const before = revision.current;
      setBusy(true);
      const confirmed = await confirmTransportDiscard("Open the selected project and discard unsaved changes?");
      setBusy(false);
      if (!confirmed || before !== revision.current) return;
    }
    const requestId = crypto.randomUUID();
    watchRequest({ requestId, kind: "load", revision: revision.current });
    setBusy(true);
    setStatus("Opening project…");
    send({ type: "transport_project_load", requestId, id: selectedProjectId });
  }

  function onNodesChange(changes: NodeChange<TransportFlowNode>[]) {
    if (changes.some((change) => change.type === "select" || change.type === "remove")) setSelectedNodes((current) => {
      const next = new Set(current);
      for (const change of changes) {
        if (change.type === "select") { if (change.selected) next.add(change.id); else next.delete(change.id); }
        if (change.type === "remove") next.delete(change.id);
      }
      return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
    });
    if (changes.some((change) => change.type === "dimensions" || change.type === "remove")) setMeasurements((current) => {
      const next = { ...current };
      let changed = false;
      for (const change of changes) {
        if (change.type === "remove" && next[change.id]) { delete next[change.id]; changed = true; }
        if (change.type === "dimensions" && change.dimensions) {
          const old = next[change.id];
          if (old?.width !== change.dimensions.width || old?.height !== change.dimensions.height) {
            next[change.id] = change.dimensions;
            changed = true;
          }
        }
      }
      return changed ? next : current;
    });
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    const positions = changes.filter((change) => change.type === "position" && change.position);
    if (removed.size === 0 && positions.length === 0) return;
    const current = projectRef.current;
    const uiNodes = { ...current.ui.nodes };
    for (const id of removed) delete uiNodes[id];
    for (const change of positions) {
      if (change.type === "position" && change.position && !removed.has(change.id)) uiNodes[change.id] = { position: change.position };
    }
    edit({ ...current, workflow: { nodes: current.workflow.nodes.filter((node) => !removed.has(node.id)), edges: current.workflow.edges.filter((edge) => !removed.has(edge.source.nodeId) && !removed.has(edge.target.nodeId)) }, ui: { ...current.ui, nodes: uiNodes } });
  }

  function onEdgesChange(changes: EdgeChange[]) {
    if (changes.some((change) => change.type === "select" || change.type === "remove")) setSelectedEdges((current) => {
      const next = new Set(current);
      for (const change of changes) {
        if (change.type === "select") { if (change.selected) next.add(change.id); else next.delete(change.id); }
        if (change.type === "remove") next.delete(change.id);
      }
      return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
    });
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removed.size) edit({ ...projectRef.current, workflow: { ...projectRef.current.workflow, edges: projectRef.current.workflow.edges.filter((edge) => !removed.has(edge.id)) } });
  }

  function addNode(node: TransportModelNode, position?: { x: number; y: number }) {
    const current = projectRef.current;
    const index = current.workflow.nodes.length;
    edit({ ...current, workflow: { ...current.workflow, nodes: [...current.workflow.nodes, node] }, ui: { ...current.ui, nodes: { ...current.ui.nodes, [node.id]: { position: position ?? { x: 60 + (index % 3) * 310, y: 60 + Math.floor(index / 3) * 230 } } } } });
    return node.id;
  }

  function updateNode(node: TransportModelNode) {
    const current = projectRef.current;
    edit({ ...current, workflow: { ...current.workflow, nodes: current.workflow.nodes.map((entry) => entry.id === node.id ? node : entry) } });
  }

  function bindInput(target: Endpoint, source: Endpoint | null) {
    const current = projectRef.current;
    const edges = current.workflow.edges.filter((edge) => edge.target.nodeId !== target.nodeId || edge.target.portId !== target.portId);
    if (source) {
      const sourceNode = current.workflow.nodes.find((node) => node.id === source.nodeId);
      const targetNode = current.workflow.nodes.find((node) => node.id === target.nodeId);
      const output = sourceNode && getNodePorts(sourceNode).outputs.find((port) => port.id === source.portId);
      const input = targetNode && getNodePorts(targetNode).inputs.find((port) => port.id === target.portId);
      if (!output || !input || source.nodeId === target.nodeId || !isCompatibleDataType(output.dataType, input.dataType)) {
        setStatus("Connection blocked: choose compatible output and input ports on different blocks.");
        return;
      }
      // Check the proposed connection independently of other validation problems.
      const reachable = new Set<string>();
      const todo = [target.nodeId];
      while (todo.length) {
        const id = todo.pop()!;
        if (id === source.nodeId) { setStatus("Connection blocked: it would create a workflow cycle."); return; }
        if (reachable.has(id)) continue;
        reachable.add(id);
        todo.push(...edges.filter((edge) => edge.source.nodeId === id).map((edge) => edge.target.nodeId));
      }
      edges.push({ id: `edge-${crypto.randomUUID()}`, source, target });
    }
    edit({ ...current, workflow: { ...current.workflow, edges } });
  }

  function onConnect(connection: Connection) {
    if (!connection.sourceHandle || !connection.targetHandle) return;
    bindInput({ nodeId: connection.target, portId: connection.targetHandle }, { nodeId: connection.source, portId: connection.sourceHandle });
  }

  function setViewport(viewport: Viewport) {
    const current = projectRef.current;
    const old = current.ui.viewport;
    if (old?.x === viewport.x && old.y === viewport.y && old.zoom === viewport.zoom) return;
    edit({ ...current, ui: { ...current.ui, viewport } });
  }

  function runValidation(forRun = false) {
    const result = validateTransportProject(projectRef.current);
    setValidation(result);
    setStatus(forRun ? result.valid ? "Workflow structure is valid. No calculation was started: the execution engine is not implemented yet." : "Run blocked: fix the workflow errors below." : result.valid ? "Workflow structure is valid. Source files have not been parsed or verified by an engine." : "Workflow validation failed.");
  }

  return { project, dirty, busy, savedProjects, selectedProjectId, setSelectedProjectId, validation, status, selectedNodes, selectedEdges, measurements,
    newProject, saveProject, openProject, onNodesChange, onEdgesChange, onConnect, updateNode, bindInput, setViewport, runValidation,
    addModel: (actionId: string, position?: { x: number; y: number }) => addNode(createModelNode(actionId, `node-${crypto.randomUUID()}`), position),
    addData: (source: TransportDataSource, label: string) => addNode(createDataNode(source, label, `node-${crypto.randomUUID()}`)),
    setProjectName: (name: string) => edit({ ...projectRef.current, metadata: { ...projectRef.current.metadata, name } }),
    clearStatus: () => { setValidation(null); setStatus(null); },
  };
}
