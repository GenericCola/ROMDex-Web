import { automaticDelivery } from "@/cloud/session";
import { hasDraftEdits } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useSyncExternalStore } from "react";
const beforeUnload = (event: BeforeUnloadEvent) => {
  const state = workspaceStore.getSnapshot();
  if (state.pendingWrites || state.error || hasDraftEdits()) {
    event.preventDefault();
    event.returnValue = "";
  }
};
const connectWorkspace = () => {
  void workspaceStore.start();
  const timer = window.setInterval(automaticDelivery, 10000);
  window.addEventListener("beforeunload", beforeUnload);
  const cleanup = () => {
    window.clearInterval(timer);
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
