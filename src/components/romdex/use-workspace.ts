import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useSyncExternalStore } from "react";
const beforeUnload = (event: BeforeUnloadEvent) => {
  const state = workspaceStore.getSnapshot();
  if (state.pendingWrites || state.error) {
    event.preventDefault();
    event.returnValue = "";
  }
};
const connectWorkspace = () => {
  void workspaceStore.start();
  window.addEventListener("beforeunload", beforeUnload);
  const cleanup = () => {
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
