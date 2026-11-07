import { hasDraftEdits } from "./editor-drafts";
import { workspaceStore } from "./workspace-store";
import { hasWorkspaceWork } from "./workspace-work";
/*
 * Tells other windows when this one saved, and takes their newer saves while
 * this window has nothing unsaved. Only one window is normally active (see
 * single-window), so this covers browsers without Web Locks and handovers.
 */
export const connectWorkspaceChannel = () => {
  if (typeof BroadcastChannel === "undefined")
    return () => {
      // Nothing to disconnect.
    };
  const channel = new BroadcastChannel("romdex-workspace");
  let announced = workspaceStore.savedRevision(),
    adopting = false;
  const idle = () => {
    return !hasDraftEdits() && !hasWorkspaceWork();
  };
  const saved = () => {
    const revision = workspaceStore.savedRevision();
    if (revision <= announced) return;
    announced = revision;
    // A save taken from another window is not announced back to it.
    if (!adopting) channel.postMessage({ type: "saved", revision });
  };
  const adopted = () => {
    adopting = false;
  };
  const received = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (
      !message ||
      typeof message !== "object" ||
      !("revision" in message) ||
      typeof message.revision !== "number" ||
      message.revision <= workspaceStore.savedRevision()
    )
      return;
    adopting = true;
    void workspaceStore.adoptNewer(idle).then(adopted, adopted);
  };
  channel.addEventListener("message", received);
  const unsubscribe = workspaceStore.subscribe(saved);
  return () => {
    unsubscribe();
    channel.removeEventListener("message", received);
    channel.close();
  };
};
