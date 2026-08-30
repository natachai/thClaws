import { send, subscribe } from "../../hooks/useIPC";

// Match Files' platform confirmation: Wry uses the native confirmation bridge,
// whereas --serve has the browser's own dialog. Do not depend on WebView alerts.
export function confirmTransportDiscard(message: string): Promise<boolean> {
  if (!window.ipc) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    const id = `transport-confirm-${crypto.randomUUID()}`;
    const unsubscribe = subscribe((reply) => {
      if (reply.type !== "confirm_result" || reply.id !== id) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(reply.ok === true);
    });
    const timeout = setTimeout(() => { unsubscribe(); resolve(false); }, 60000);
    send({ type: "confirm", id, title: "Unsaved Transport project", message, yes_label: "Discard changes", no_label: "Cancel" });
  });
}
