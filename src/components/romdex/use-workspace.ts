import { watchIncoming } from "@/cloud/watch-incoming";
import { watchOutgoing } from "@/cloud/watch-outgoing";
import { hasDraftEdits } from "@/domain/editor-drafts";
import { connectWorkspaceChannel } from "@/domain/workspace-channel";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useSyncExternalStore } from "react";
// A waiting save starts at once when the page may be closed or frozen.
const saveNow = () => {
  workspaceStore.saveNow();
};
const hidden = () => {
  if (document.visibilityState === "hidden") saveNow();
};
const beforeUnload = (event: BeforeUnloadEvent) => {
  saveNow();
  const state = workspaceStore.getSnapshot();
  if (state.pendingWrites || state.error || hasDraftEdits()) {
    event.preventDefault();
    event.returnValue = "";
  }
};
const connectWorkspace = () => {
  void workspaceStore.start();
  const stopOutgoing = watchOutgoing();
  const stopIncoming = watchIncoming();
  const stopChannel = connectWorkspaceChannel();
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", hidden);
  const cleanup = () => {
    stopOutgoing();
    stopIncoming();
    stopChannel();
    window.removeEventListener("pagehide", saveNow);
    document.removeEventListener("visibilitychange", hidden);
    return window.removeEventListener("beforeunload", beforeUnload);
  };
  return cleanup;
};
export const useWorkspace = () => {
  const state = useSyncExternalStore(
    workspaceStore.subscribe,
    workspaceStore.getSnapshot,
    workspaceStore.getSnapshot,
  );
  useEffect(connectWorkspace, []);
  return state;
};
